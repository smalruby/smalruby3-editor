// CloudFront Functions (cloudfront-js-2.0) — preview.smalruby.app の viewer-response。
//
// 本番（site-viewer-response.js）の `Vary` の部分だけ。プレビューは HSTS / nosniff を付けない
// （いまの挙動を変えない）。定額プランの配信（本番）とは関数を共有できないので、ファイルも
// リソースも別にする。
//
// 事前圧縮した gui の JS（viewer-request が URI を `.br` / `.gz` に書きかえたもの）は S3 が
// `Content-Encoding` を付けて返すが、`Vary` は付かない。途中のキャッシュが br をほかの
// クライアントへ渡さないよう、`content-encoding` があるときは `Vary: Accept-Encoding` を付ける
// （すでに `Accept-Encoding` を含むなら足さない。ほかの値があれば後ろに足す）。
function addVaryAcceptEncoding(headers) {
    if (!headers['content-encoding']) {
        return;
    }
    var vary = headers['vary'];
    if (!vary || !vary.value) {
        headers['vary'] = { value: 'Accept-Encoding' };
        return;
    }
    var names = vary.value.split(',');
    for (var i = 0; i < names.length; i++) {
        var name = names[i].trim().toLowerCase();
        if (name === 'accept-encoding' || name === '*') {
            return;
        }
    }
    headers['vary'] = { value: vary.value + ', Accept-Encoding' };
}

function handler(event) {
    var response = event.response;
    addVaryAcceptEncoding(response.headers);
    return response;
}
