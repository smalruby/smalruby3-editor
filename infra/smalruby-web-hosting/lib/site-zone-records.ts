/**
 * Route 53 に写す `smalruby.app` のレコード（EPIC #1931 の段 2・Issue #2000）。
 *
 * 値はお名前.com のゾーンのエクスポート（BIND 形式）と同じにする。ネームサーバーを
 * お名前.com から Route 53 へ変えた瞬間に、外から見える答えが変わらないようにするため
 * （docs/hosting/README.md の「DNS の切り替え」）。値を変えるときは、お名前.com 側も同じに
 * そろえるか、切り替え後であることを確かめてからにする。
 *
 * 写さないもの:
 * - apex の NS / SOA（Route 53 のゾーンが自分のものを持つ）
 * - `everdiary.smalruby.app` A（使っていないことを人間が確かめ、お名前.com からも消した）
 * - ワイルドカード（docs/security/github-pages-subdomain-takeover.md）
 */

/** 本番のゾーン名。作り直すと NS が変わるので変えない。 */
export const SITE_ZONE_NAME = 'smalruby.app';

/**
 * apex の A（いまの GitHub Pages）。CloudFront へ向けるのは別の変更（#2007）。
 * お名前.com では TTL 3600 だが、切り替えや戻しを早く効かせるため Route 53 では 300 にする。
 */
export const SITE_APEX_A_TTL_SECONDS = 300;
export const SITE_APEX_A_VALUES = [
    '185.199.108.153',
    '185.199.109.153',
    '185.199.110.153',
    '185.199.111.153',
];

/** Google Search Console の所有確認（お名前.com では TTL 300）。 */
export const SITE_APEX_TXT_TTL_SECONDS = 300;
export const SITE_APEX_TXT_VALUES = [
    'google-site-verification=IjEgIRcoKO9cJVQAqtwUZH7WfDtA9ujP2zRCJUE8vZA',
];

/**
 * GitHub の組織のドメイン検証。**消さない**（サブドメイン乗っ取り対策の Layer 1。
 * docs/security/github-pages-subdomain-takeover.md）。
 */
export const SITE_GITHUB_PAGES_CHALLENGE_NAME = '_github-pages-challenge-smalruby';
export const SITE_GITHUB_PAGES_CHALLENGE_TTL_SECONDS = 3600;
export const SITE_GITHUB_PAGES_CHALLENGE_VALUES = ['a445b86bba88094e49c43b9af4b04d'];

/**
 * 証明書を発行してよい認証局。ACM（Amazon の 4 つ）と、GitHub Pages が使う Let's Encrypt。
 * ワイルドカード証明書はどこにも出させない（issuewild ";"）。
 */
export const SITE_CAA_TTL_SECONDS = 3600;
export const SITE_CAA_VALUES: { tag: 'issue' | 'issuewild'; value: string }[] = [
    { tag: 'issue', value: 'amazon.com' },
    { tag: 'issue', value: 'amazonaws.com' },
    { tag: 'issue', value: 'amazontrust.com' },
    { tag: 'issue', value: 'awstrust.com' },
    { tag: 'issue', value: 'letsencrypt.org' },
    { tag: 'issuewild', value: ';' },
];

/**
 * サブドメインの委任（それぞれ別の Route 53 のゾーン）。いまお名前.com に書いてある NS を
 * そのまま写す。ゾーンを作り直すと NS が変わるので、そのときはここも直す。
 * 末尾の `.` は付けたままにする（ゾーン名を足した相対名と読まれないように。照合スクリプトも同じ）。
 */
export const SITE_DELEGATION_TTL_SECONDS = 900;
export const SITE_DELEGATIONS: { name: string; id: string; nameServers: string[] }[] = [
    {
        // API 群のカスタムドメイン用のゾーン（このプロジェクトの外で管理している）。
        name: 'api',
        id: 'SiteApiDelegation',
        nameServers: [
            'ns-1254.awsdns-28.org.',
            'ns-1861.awsdns-40.co.uk.',
            'ns-457.awsdns-57.com.',
            'ns-703.awsdns-23.net.',
        ],
    },
    {
        // ブランチプレビュー（このプロジェクトの stg のゾーン `PreviewHostedZone`）。
        name: 'preview',
        id: 'SitePreviewDelegation',
        nameServers: [
            'ns-1447.awsdns-52.org.',
            'ns-1984.awsdns-56.co.uk.',
            'ns-233.awsdns-29.com.',
            'ns-857.awsdns-43.net.',
        ],
    },
];
