// CloudFront Functions (cloudfront-js-2.0) — smalruby.app の viewer-response。
//
// GitHub Pages が返している HSTS と nosniff を付ける。以前はレスポンスヘッダーポリシー
// （SiteResponseHeaders）で付けていたが、CloudFront の定額プラン（Free / Pro）はカスタムの
// レスポンスヘッダーポリシーを使えないので、同じヘッダをこの関数で付ける。
// - Strict-Transport-Security: max-age は 365 日。includeSubDomains / preload は付けない
//   （ポリシーの includeSubdomains: false と同じ）。
// - X-Content-Type-Options: nosniff
// どちらもオリジン（S3）の値を上書きする（ポリシーの override: true と同じ）。
// 管理ポリシー Managed-SecurityHeadersPolicy は X-Frame-Options: SAMEORIGIN なども足し、
// smalruby.app を iframe に埋めている所を壊しうるので使わない。
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
    response.headers['strict-transport-security'] = { value: 'max-age=31536000' };
    response.headers['x-content-type-options'] = { value: 'nosniff' };
    addVaryAcceptEncoding(response.headers);
    return response;
}
