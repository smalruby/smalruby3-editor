/**
 * scratch-storage の `FetchWorkerTool` (Web Worker 内 fetch) がレスポンスを
 * 返さず永久にハングする現象への対策。
 *
 * 既知の発生条件:
 * - サブディレクトリ deploy (例: `https://smalruby.jp/smalruby3-editor/...`)
 *   かつ iOS Safari (WebKit ベース)
 * - root deploy (例: `https://smalruby.app/`) では再現しない
 *
 * 仕組み:
 * - scratch-storage の `ProxyTool.get()` は
 *   `tool.get(reqConfig).catch(nextTool)` で **REJECTION** が発生したときだけ
 *   次の tool (FetchTool) にフォールバックする。HANG だと永久に pending
 *   なので `.catch` ハンドラが発火せず、`storage.load` の Promise も無限に
 *   pending → スプライト追加が完了しない症状になる。
 * - 対策として FetchWorkerTool の `get` を `Promise.race` で 5 秒
 *   タイムアウトし、応答が来なければ強制 reject する。これで ProxyTool が
 *   FetchTool に切り替わり、main thread の `fetch()` で取得できる。
 * - 一度タイムアウトが起きた場合、後続呼び出しでも Worker は壊れている
 *   可能性が高いので、`isGetSupported` を false にして以降は ProxyTool が
 *   即座に FetchTool に行くようにする。これで 5 秒×N 回の wait が回避できる。
 *
 * UA detection を使わない理由:
 * - iOS でも root deploy (smalruby.app) では Worker が正常動作する。
 * - 「iOS だから無条件に Worker を切る」のは過剰で、smalruby.app での
 *   並列読み込みのメリットを失う。
 * - timeout-based fallback は env 非依存なので、将来の別ブラウザ/別 deploy
 *   形態の似た問題にも自動的に対応する。
 */

const FETCH_WORKER_TIMEOUT_MS = 5000;

/**
 * tool が `PublicFetchWorkerTool` インスタンスかを判定する。
 *
 * production バンドルでは terser が class 名を 1 文字に mangle するので
 * `constructor.name === 'PublicFetchWorkerTool'` は使えない。
 * `PublicFetchWorkerTool` のみが持つ `inner` プロパティ
 * (`this.inner = PrivateFetchWorkerTool.instance`) の存在を見る。
 * `inner` は string property name なので terser のデフォルト mangle で残る
 * (production bundle の `'.inner=V.instance'` や `'this.inner.isGetSupported'`
 * で実在することを確認済み)。
 * @param {object} tool - assetTool.tools の要素
 * @returns {boolean} FetchWorkerTool ならば true
 */
const isFetchWorkerTool = tool => Boolean(tool && tool.inner && typeof tool.inner === 'object');

/**
 * `vm.runtime.storage` に対し、FetchWorkerTool への timeout patch を当てる。
 * 一度適用したら再適用しない (idempotent)。
 * @param {object} storage - vm.runtime.storage インスタンス
 * @returns {boolean} 適用したか (false = storage が無い / すでに patch 済み)
 */
const applyStorageWorkerTimeout = storage => {
    const tools = storage?.webHelper?.assetTool?.tools;
    if (!tools || !Array.isArray(tools)) return false;
    let patchedAny = false;
    for (const tool of tools) {
        if (!isFetchWorkerTool(tool)) continue;
        if (tool.__smalrubyWorkerTimeoutPatched) continue;
        const origGet = tool.get.bind(tool);
        let workerProvenBroken = false;
        tool.get = function (reqConfig) {
            // Worker が壊れていることが既に判明しているなら、即 reject して
            // ProxyTool に FetchTool フォールバックさせる (5s 待ちを省略)。
            if (workerProvenBroken) {
                return Promise.reject(new Error('FetchWorkerTool disabled after first timeout'));
            }
            return Promise.race([
                origGet(reqConfig),
                new Promise((_, reject) =>
                    setTimeout(() => {
                        workerProvenBroken = true;
                        reject(new Error(`FetchWorkerTool timeout after ${FETCH_WORKER_TIMEOUT_MS}ms`));
                    }, FETCH_WORKER_TIMEOUT_MS),
                ),
            ]);
        };
        tool.__smalrubyWorkerTimeoutPatched = true;
        patchedAny = true;
    }
    return patchedAny;
};

export { applyStorageWorkerTimeout, isFetchWorkerTool, FETCH_WORKER_TIMEOUT_MS };
