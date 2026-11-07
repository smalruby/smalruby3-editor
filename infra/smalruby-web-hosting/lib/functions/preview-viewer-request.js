// CloudFront Functions (cloudfront-js-2.0) — preview.smalruby.app の viewer-request。
//
// S3 は REST エンドポイント（OAC）なので、ディレクトリの index.html を自分で解決しない。
// - `/<slug>/` や `/<slug>/x/` → `.../index.html`
// - `/<slug>` のように末尾が `/` でも拡張子付きファイルでもない → `/<slug>/` へ 301
//   （GUI は相対パスでアセットを読むので、`/` 無しのままだと 1 階層上を見てしまう）
// - それ以外（`/<slug>/gui.<hash>.js`、ルートの `/auth-redirect.html` など）はそのまま
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

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri.charAt(uri.length - 1) === '/') {
        request.uri = uri + 'index.html';
        return request;
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

    return request;
}
