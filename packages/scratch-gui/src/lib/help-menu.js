// 右上の「?」メニューの並び。
//
// 並びを変えるときは HELP_MENU_SECTIONS だけを書きかえる（区切り線で分けたまとまりの配列）。
// 項目の id は menu-bar.jsx（チュートリアル・デバッグ・バージョン）と gui.jsx（スモウルビーについて・
// ウェルカム・不具合を知らせる）が付ける。docs/menu-bar/README.md に並びの理由を書いている。
//
// 1. 困ったときにすぐ使うもの（チュートリアル・デバッグ）を上に置く。
// 2. 不具合を知らせるは、ヘルプとは別のまとまりにする（押しまちがえないように）。
// 3. スモウルビーのこと（ウェルカム・スモウルビーについて・バージョン）は下にまとめ、バージョンを一番下にする。
const HELP_MENU_SECTIONS = Object.freeze([
    Object.freeze(['tutorials', 'debug']),
    Object.freeze(['bugReport']),
    Object.freeze(['welcome', 'about', 'version']),
]);

/**
 * 「?」メニューの項目を、決めた並びのまとまりに分ける。
 * 並びに無い項目（id の無いもの・知らない id）は、最後のまとまりにそのままの順で入れる。
 * @param {Array<object>} items - 項目（`id` を持つ。`title` と `onClick` は menu-bar.jsx が使う）。
 * @param {Array<Array<string>>} [sections] - まとまりごとの id の並び。
 * @returns {Array<Array<object>>} 空でないまとまりの配列。
 */
const arrangeHelpMenu = (items, sections = HELP_MENU_SECTIONS) => {
    const byId = new Map();
    items.forEach((item) => {
        if (item.id && !byId.has(item.id)) byId.set(item.id, item);
    });
    const placed = new Set();
    const arranged = sections
        .map((ids) =>
            ids
                .filter((id) => byId.has(id))
                .map((id) => {
                    placed.add(id);
                    return byId.get(id);
                }),
        )
        .filter((section) => section.length > 0);
    const rest = items.filter((item) => !item.id || !placed.has(item.id));
    if (rest.length > 0) arranged.push(rest);
    return arranged;
};

/**
 * ビルドのコミットの sha から、メニューに出す短い版を作る。
 * @param {string} [commitSha] - `process.env.COMMIT_SHA`（本番とプレビューのビルドにだけ入る）。
 * @returns {?string} 7 文字の版。sha が無いとき（手元のビルド）は null。
 */
const shortVersion = (commitSha) =>
    typeof commitSha === 'string' && /^[0-9a-f]{7,40}$/i.test(commitSha) ? commitSha.slice(0, 7) : null;

export { HELP_MENU_SECTIONS, arrangeHelpMenu, shortVersion };
