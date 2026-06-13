# Koshien golden fixtures

These JSON files are **golden recordings of the real Smalruby Koshien game server's
behavior**, captured by driving the server's in-process API (the same `SpecHelper::Server`
the server's own RSpec suite uses) through deterministic scenarios.

They are the source of truth for the Koshien client contract: the JS client in
`src/extensions/koshien/` must reproduce these responses when connected to a real server
(verified by `test/unit/extensions/koshien_golden_contract.js`).

## Provenance / regeneration

Recorded from `tmp/smalruby-koshien/game_server` on Ruby 3.1 with `SK_RANDOM_SEED=1`.
The recorder script and full setup are documented in the project notes
(`notes/koshien/scripts/koshien-golden-recorder.rb`, `notes/koshien/server-setup.md`).

```bash
# (from the koshien repo checkout)
SK_RANDOM_SEED=1 ruby koshien-golden-recorder.rb <out-dir>
# then copy <out-dir>/*.json here
```

## Files

| File | Scenario |
|------|----------|
| `move_basic.json` | `move_to` is a reservation; position is confirmed only after `turnTransition`. |
| `get_map_area.json` | `getMapArea` returns the player's accumulated 15x15 map (`-1` = unexplored) + `enemy` + `other_player`. |
| `two_actions.json` | Two actions in one turn (`move_to` + `getMapArea`). |

## Notes captured from real behavior

- A `move_to` does **not** change `x`/`y` until the viewer calls `turnTransition`
  (before: `[1,1]`, after: `[2,1]`).
- `getMapArea` returns the **full 15x15** player map (not a 5x5 slice); unexplored cells are `-1`.
- `enemy` is always present in `getMapArea`; `other_player` is `null` when out of range.
