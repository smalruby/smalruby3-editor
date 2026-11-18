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
function handler(event) {
    var response = event.response;
    response.headers['strict-transport-security'] = { value: 'max-age=31536000' };
    response.headers['x-content-type-options'] = { value: 'nosniff' };
    return response;
}
