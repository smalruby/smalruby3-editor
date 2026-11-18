# EPIC の topic ブランチの進め方

EPIC（sub-issue に分けた大きな作業）は、develop から切った **topic ブランチ**（例: `topic/japanese-mode-1731`、
`topic/studuino-2162`）に sub-issue の PR を集め、まとめて develop へ出す。人間のレビュー待ちで
EPIC が止まらないように、**topic までは AI が進め、人間の確認は topic → develop の前に 1 回にまとめる**。

## topic へのマージ（AI が行う）

- sub-issue の PR は topic 宛てに作る。**topic へのマージは AI が行う**（人間の承認を待たない）。
  時間帯の決まり（develop へのマージの時間）も topic には当てはまらない。
- マージの前に、AI がインラインでレビューする（正確性・方針の docs への準拠・テストと docs・`.claude/rules` の準拠）。
- **レビューの指摘への対応は、AI の推奨を採用する。** 採用したものは、人間への報告は要らない。
- 推奨を**採用しなかったもの**と、**人間の判断が要るもの**（仕様の選択など）も、いったん topic にマージして先へ進む。
  その中身（PR・何を・AI の案・ほかの案）を、EPIC の Issue か作業メモに書きためておく。
- CI が通ってからマージする。`Closes #N` は topic 宛てでは自動で閉じないので、マージしたら Issue を手で閉じる。
- EPIC の docs も topic に入れる。実装しながら方針が変わるので、docs も topic の中で随時直す。

## 人間がいつでも見られるようにする

- topic に最初の変更が入ったら、**topic → develop の PR を draft で作る**。人間はこの PR で差分をいつでも見られる。
- この PR のブランチのプレビュー（`https://preview.smalruby.app/<slug>/`）で、topic の状態を画面で確かめられる。
  PR の本文にプレビューの URL と、いまどの sub-issue まで入っているかを書き、sub-issue をマージするたびに更新する。

## topic → develop の前に（人間の確認）

- develop へ出す前に、**決定ページ（artifact）を作って人間にまとめて確認する**。載せるのは、
  採用しなかった指摘と人間の判断が要るものだけ（採用したものは載せない）。選択肢・AI の推奨・コメント欄を付ける
  （作り方は既存の設計ページにならう）。
- 人間の答えを反映してから、draft を外して develop へマージする。develop へのマージは本番に出るので、
  平日は決まった時間に行う。

## 例外

- `.claude/` と `docs/` だけを変える PR は、CI が通れば AI が develop にマージしてよい（時間帯の決まりもない）。
  ただし EPIC の docs は topic に入れる（上）。
- 小さな直し（EPIC に属さない不具合の修正など）は、これまでどおり develop 宛ての PR にする。
