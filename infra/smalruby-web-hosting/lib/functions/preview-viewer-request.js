// CloudFront Functions (cloudfront-js-2.0) — preview.smalruby.app と smalruby.app の viewer-request
// （同じコードで関数のリソースを配信ごとに作る）。
//
// S3 は REST エンドポイント（OAC）なので、ディレクトリの index.html を自分で解決しない。
// - `/<slug>/` や `/<slug>/x/` → `.../index.html`
// - `/<slug>` のように末尾が `/` でも拡張子付きファイルでもない → `/<slug>/` へ 301
//   （GUI は相対パスでアセットを読むので、`/` 無しのままだと 1 階層上を見てしまう）
// - gui の JS（本番 `/gui.<hash>.js`、プレビュー `/<slug>/gui.js` / `/<slug>/gui.<hash>.js`）は
//   `Accept-Encoding` を見て、CI が隣に置いた事前圧縮版 `.br`（優先）か `.gz` に URI を書きかえる
//   （CloudFront は 10,000,000 バイトを超えるファイルを圧縮しない。docs/hosting/README.md の
//   「事前圧縮した gui の JS」）。`q=0` は「使わない」と読む。ヘッダが無い、またはどちらも
//   受け取らないなら書きかえない（`Accept-Encoding` を落とすプロキシ経由でも無圧縮で返る）。
//   対象は scripts/precompress-assets.mjs が圧縮するもの（出力のトップレベルの gui の JS）だけにする。
//   圧縮版が無い URI へ書きかえると 404 になる。
// - 前の配信の日本語の入口 `/ja.html` → `/` へ 301（クエリ文字列は保つ）。学校の端末のブックマークに
//   残っていて 404 になっていた。前の配信で言語の入口はこれだけ（`en.html` などは無かった）
// - それ以外（ルートの `/auth-redirect.html` など）はそのまま
//
// 301 の Location は先頭の `/` と `\` を 1 つの `/` にまとめる。`//evil.com/x` をそのまま
// `//evil.com/x/` で返すと、ブラウザはプロトコル相対 URL として別ホストへ飛ぶ（オープンリダイレクト）。
function encodeQueryString(querystring) {
    var parts = [];
    for (var key in querystring) {
        var entry = querystring[key];
        var values = entry.multiValue ? entry.multiValue : [entry];
        for (var i = 0; i < values.length; i++) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(values[i].value));
        }
    }
    return parts.length > 0 ? '?' + parts.join('&') : '';
}

var GUI_JS_URI = /^\/(?:[^\/]+\/)?gui(?:\.[0-9a-f]{8,})?\.js$/;

// `Accept-Encoding` の値から、受け取れる符号化の名前（小文字）を集める。q=0 のものは除く。
// `*` は数えない（br / gzip を名前で挙げたときだけ書きかえる）。
function acceptedEncodings(headers) {
    var accepted = {};
    var header = headers && headers['accept-encoding'];
    if (!header) {
        return accepted;
    }
    var values = header.multiValue ? header.multiValue : [header];
    for (var i = 0; i < values.length; i++) {
        var items = String(values[i].value || '').split(',');
        for (var j = 0; j < items.length; j++) {
            var params = items[j].split(';');
            var name = params[0].trim().toLowerCase();
            if (!name) {
                continue;
            }
            var q = 1;
            for (var k = 1; k < params.length; k++) {
                var param = params[k].trim().toLowerCase();
                if (param.indexOf('q=') === 0) {
                    q = parseFloat(param.substring(2));
                }
            }
            if (q > 0) {
                accepted[name] = true;
            }
        }
    }
    return accepted;
}

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri.charAt(uri.length - 1) === '/') {
        request.uri = uri + 'index.html';
        return request;
    }

    if (uri === '/ja.html') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: { value: '/' + encodeQueryString(request.querystring || {}) },
            },
        };
    }

    var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
    if (lastSegment.indexOf('.') === -1) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: {
                    value:
                        '/' +
                        uri.replace(/^[\/\\]+/, '') +
                        '/' +
                        encodeQueryString(request.querystring || {}),
                },
            },
        };
    }

    if (GUI_JS_URI.test(uri)) {
        var accepted = acceptedEncodings(request.headers);
        if (accepted.br) {
            request.uri = uri + '.br';
        } else if (accepted.gzip) {
            request.uri = uri + '.gz';
        }
    }

    return request;
}
