// CloudFront Functions (cloudfront-js-2.0) — smalruby.app の viewer-request。
//
// GitHub Pages と同じ URL で同じものを返す。S3 は REST エンドポイント（OAC）なので、
// ディレクトリの index.html も、拡張子を省いた `.html` も自分では解決しない。
// - `/` や `/admin/` → `.../index.html`
// - `/admin` のように index.html を持つディレクトリ（SITE_DIRECTORIES）→ `/admin/` へ 301
//   （admin の SPA は相対パスでアセットを読むので、`/` 無しのままだと 1 階層上を見てしまう）
// - `/about` のようにトップレベルで拡張子の無いパス → `/about.html` を返す（リダイレクトしない。
//   GitHub Pages も `/about` に about.html を 200 で返す。同意画面のプライバシーポリシーなど、
//   外から拡張子なしの URL で参照されている）
// - それ以外（`/gui.<hash>.js`、`/assignments/LICENSE` のような下の階層のファイル）はそのまま
//
// 関数から S3 にオブジェクトがあるかは問い合わせられないので、index.html を持つディレクトリは
// 固定の一覧で持つ。ページ（.html）はビルドで全部トップレベルに置かれる（pages/ と legal/ を
// `.` へコピーする）ので、`.html` を補うのはトップレベルだけにする。下の階層にある拡張子の無い
// ファイル（assignments/LICENSE など）を壊さないため。
//
// 301 の Location は先頭の `/` と `\` を 1 つの `/` にまとめる。`//evil.com/x` をそのまま
// `//evil.com/x/` で返すと、ブラウザはプロトコル相対 URL として別ホストへ飛ぶ（オープンリダイレクト）。

// index.html を持つトップレベルのディレクトリ。ビルドに増えたらここに足す
// （test/site-viewer-request.test.ts がリポジトリの中身と突き合わせる）。
var SITE_DIRECTORIES = ['admin', 'assignments'];

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
    if (lastSegment.indexOf('.') !== -1) {
        return request;
    }

    var path = uri.replace(/^[\/\\]+/, '');
    if (SITE_DIRECTORIES.indexOf(path) !== -1) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: {
                    value: '/' + path + '/' + encodeQueryString(request.querystring || {}),
                },
            },
        };
    }

    if (path.indexOf('/') === -1 && path.indexOf('\\') === -1) {
        request.uri = '/' + path + '.html';
    }
    return request;
}
