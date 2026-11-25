# autopilot モニタ スクリーンショット

autopilot モニタ（`tools/autopilot/src/monitor.js` の Web UI）の動作イメージ。
`/board` に代表的なデータ（稼働バージョン + `tools/autopilot` の更新あり状態）を与えて
レンダリングしたもの。

| ファイル | 内容 |
| --- | --- |
| `monitor-version-footer.png` | フッターに稼働バージョン `branch @ shortCommit` を常時表示。更新があるときは `⬆️ 更新あり（N 件）` バッジを表示（#885） |
| `monitor-update-modal.png` | 更新バッジ押下で開く更新手順モーダル。`update autopilot` 指示のコピー、手動更新手順、`tools/autopilot` の差分コミット一覧（#885） |
| `monitor-d-wide-light.png` / `monitor-d-wide-dark.png` | 並べ方 D「あなた宛て＋表」（1440×900）。左に答えが要る質問・学び・人間待ち、右に EPIC ごとの状況板（#2404） |
| `monitor-board-solo-priority.png` | 状況板の並び。EPIC に属さない Issue は優先度ごとのまとまりにし、同じ優先度の EPIC の下に置く（P1 の EPIC → P2 の EPIC → EPIC に属さない · P2 → P3 の EPIC → EPIC に属さない · P3）（#2411） |
| `monitor-d-phone.png` | 幅 400px のとき。欄をタブに切りかえる（#2404） |
| `monitor-fix-instruction-light.png` / `monitor-fix-instruction-dark.png` | 「AI に直してもらう」のダイアログ。PR のいちばん新しい round の bot の指摘を整形して見せ、下のコメント欄に直してほしいことを書いて送る（空では送れない）（#2415） |
| `monitor-release-check-row-light.png` / `monitor-release-check-row-dark.png` | 「あなた宛て」のリリース確認の行。札「リリース確認」、プレビューへのリンク、「確認の結果を書く」ボタン（#2430） |
| `monitor-release-check-dialog-light.png` / `monitor-release-check-dialog-dark.png` | 「確認の結果を書く」のダイアログ。観点（R1, R2, …）ごとに OK / NG とメモ、全体のコメントを書いて送る（#2430） |
| `monitor-heading-icon.png` | 上の行の見出しのアイコン（虹色の ∞ + A・ダーク・3 倍に拡大）（#2413） |
