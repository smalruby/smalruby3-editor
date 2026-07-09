# autopilot モニタ スクリーンショット

autopilot モニタ（`tools/autopilot/src/monitor.js` の Web UI）の動作イメージ。
`/board` に代表的なデータ（稼働バージョン + `tools/autopilot` の更新あり状態）を与えて
レンダリングしたもの。

| ファイル | 内容 |
| --- | --- |
| `monitor-version-footer.png` | フッターに稼働バージョン `branch @ shortCommit` を常時表示。更新があるときは `⬆️ 更新あり（N 件）` バッジを表示（#885） |
| `monitor-update-modal.png` | 更新バッジ押下で開く更新手順モーダル。`update autopilot` 指示のコピー、手動更新手順、`tools/autopilot` の差分コミット一覧（#885） |
