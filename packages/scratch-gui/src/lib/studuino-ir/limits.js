// 構文木（Studuino IR）の上限（S12 = C）。
//
// ⚠️ Lambda の上限と同じ数字にする。正は infra/smalruby-studuino-hex/lambda/ir.ts の
// `DEFAULT_IR_LIMITS`（ノード・深さ・変数）と policy.ts の `DEFAULT_LIMITS.maxRequestBytes`（本文の大きさ）。
// Lambda の値を変えたら、ここも変える（Lambda は環境変数でも変えられるので、本番の値と違うときは
// ブラウザで止めずに Lambda の 413 で分かる。ブラウザの検査は先に知らせるための目安）。
// infra のコードは GUI から import しない（別のパッケージ・別のデプロイなので）。

/** 構文木の版（Lambda の `IR_VERSION`）。 */
export const STUDUINO_IR_VERSION = 1;

export const STUDUINO_IR_LIMITS = Object.freeze({
    /** ノード（文・式・リテラル・変数の参照）の数。Lambda の `maxNodes`。 */
    maxNodes: 10000,
    /** 入れ子の深さ（`main` の文が 1）。Lambda の `maxDepth`。 */
    maxDepth: 100,
    /** 変数の数（ATmega168PA の RAM は 1KB）。Lambda の `maxVariables`。 */
    maxVariables: 64,
    /** リクエストの本文 `{"ir": ...}` の大きさ（バイト）。Lambda の `maxRequestBytes`。 */
    maxRequestBytes: 128 * 1024,
});
