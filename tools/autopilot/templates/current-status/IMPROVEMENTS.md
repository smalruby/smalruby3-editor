# 現在地のテンプレートの改善メモ

現在地の artifact（モニタの「現在地を作る」）のテンプレートを、使いながら良くしていくための置き場。

## しくみ

1. 現在地を作る worker は、テンプレートで足りないこと・分かりにくかったことを結果ファイルの
   `templateNotes`（文字列の配列）に書く。
2. daemon はそれを `~/.config/autopilot/current-status-notes.jsonl`（`AUTOPILOT_STATE_DIR` で場所を変えられる）に
   1 行 1 件でためる。モニタの現在地の欄に、たまった数が出る。
3. ある程度たまったら、人間か指揮役の Claude が読んで、採るものをこのファイルの「採ったもの」に移し、
   `template.html` と `src/current-status.js` の `draftDataFromMaterial`（データの形）を同じ PR で直す。
   データの形を変えたら `TEMPLATE_DATA_SCHEMA` を上げる。
4. 下書き（`draftDataFromMaterial`）だけで十分な現在地が作れるようになったら、Claude を起動せずに
   daemon が描画して artifact を更新する形へ移る。

## 採ったもの

- 段（設計 → 実装 → topic の確認 → develop）・済み / 全部・決定待ちの数・次の確認の見込みを EPIC ごとに出す。
- 「人間を待っているもの」を先頭に、上から順に答えればよい形にする（もとにした手作りの現在地のページの並び）。

## 次に考えること

- 「入れたもの」（topic / develop / 本番に入ったもの）を材料から作る（いまは worker が GitHub から拾う）。
- 回答済みの問い・AI に聞く欄（もとのページにあったもの）を、決定待ちのまとめコメントとつなぐか。

## License

MIT License（`tools/autopilot/LICENSE`）。
