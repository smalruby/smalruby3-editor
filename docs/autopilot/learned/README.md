# 人間から学んだこと（分野ごと）

autopilot が人間の答えから学んだことを、分野ごとに 1 ファイルにまとめて置く。
仕組みは [`../learnings-and-tasks.md`](../learnings-and-tasks.md)。

- worker は、変えるファイルの分野のものだけを読む（`learnedRuleFilesFor`。`general.md` はいつも読む）。
  分野の名前は `.claude/rules/<area>/` と同じ（`scratch-gui` / `scratch-vm` / `infra` / `autopilot` など）。
- ファイルは手で書かない。ためた学びから、モニターの操作で worker が書き直して PR にする。
  直したいときは、学びをためて（`tools/autopilot/bin/autopilot-learn`）PR にし直す。

## 一覧

（まだありません。学びの PR が足していく）

---

## License

This document is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
