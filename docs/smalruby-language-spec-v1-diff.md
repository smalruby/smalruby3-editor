# Smalruby Language Specification — Version 1 API Differences

This document describes the differences between Version 1 and Version 2 APIs.
The main spec documents use Version 2 as the default. Refer to this document if you are using Version 1.

- Japanese version: [smalruby-language-spec-v1-diff.ja.md](./smalruby-language-spec-v1-diff.ja.md)
- Core language spec (v2): [smalruby-language-spec.md](./smalruby-language-spec.md)
- Extension methods (v2): [smalruby-language-spec-extensions.md](./smalruby-language-spec-extensions.md)

## Features Not Available in Version 1

The following features are **only available in Version 2**:

- `module` / `include` — sharing methods across sprites
- `super` — calling module methods from overriding class methods
- Automatic `class Stage` completion on file save

## Lists (Data)

| Feature | Version 2 | Version 1 |
|---|---|---|
| List reference | `@items.push(...)` (direct array) | `list("@items").push(...)` (wrapper) |
| Index | 0-indexed: `@items[0]` | 1-indexed: `list("@items")[1]` |
| Initialization | `@items = [1, 2, 3]` (array literal) | Not available |
| Hash | `$a[:key]`, `$a["key"]` | Not available |
| Empty check | `@items.empty?` | Not available |

## Sensing

| Feature | Version 2 | Version 1 |
|---|---|---|
| Key pressed? | `keyboard.pressed?("space")` | `Keyboard.pressed?("space")` |
| Mouse down? | `mouse.down?` | `Mouse.down?` |
| Mouse X | `mouse.x` | `Mouse.x` |
| Mouse Y | `mouse.y` | `Mouse.y` |
| Timer value | `timer.value` | `Timer.value` |
| Timer reset | `timer.reset` | `Timer.reset` |

## Pen Extension

| Feature | Version 2 | Version 1 |
|---|---|---|
| Clear | `pen.clear` | `pen_clear` |
| Stamp | `pen.stamp` | `pen_stamp` |
| Pen down | `pen.down` | `pen_down` |
| Pen up | `pen.up` | `pen_up` |
| Set pen color | `pen.color = "#ff0000"` | `self.pen_color = "#ff0000"` |
| Set color param | `pen.color = 50` | `self.pen_color = 50` |
| Change color param | `pen.color += 10` | `self.pen_color += 10` |
| Set saturation | `pen.saturation = 100` | `self.pen_saturation = 100` |
| Change saturation | `pen.saturation += 10` | `self.pen_saturation += 10` |
| Set brightness | `pen.brightness = 100` | `self.pen_brightness = 100` |
| Change brightness | `pen.brightness += 10` | `self.pen_brightness += 10` |
| Set transparency | `pen.transparency = 50` | `self.pen_transparency = 50` |
| Change transparency | `pen.transparency += 10` | `self.pen_transparency += 10` |
| Set pen size | `pen.size = 3` | `self.pen_size = 3` |
| Change pen size | `pen.size += 1` | `self.pen_size += 1` |

## Music Extension

| Feature | Version 2 | Version 1 |
|---|---|---|
| Play drum | `music.play_drum(drum: 1, beats: 0.25)` | `play_drum(drum: 1, beats: 0.25)` |
| Rest | `music.rest(0.25)` | `rest(0.25)` |
| Play note | `music.play_note(note: 60, beats: 0.25)` | `play_note(note: 60, beats: 0.25)` |
| Set instrument | `music.instrument = 1` | `self.instrument = 1` |
| Set tempo | `music.tempo = 120` | `self.tempo = 120` |
| Change tempo | `music.tempo += 20` | `self.tempo += 20` |
| Get tempo | `music.tempo` | `tempo` |

## Translate Extension

| Feature | Version 2 | Version 1 |
|---|---|---|
| Translate text | `translate.call("hello", "ja")` | `translate("hello", "ja")` |
| Get viewer language | `translate.language` | `language` |

## Microbit More Extension

| Feature | Version 2 | Version 1 |
|---|---|---|
| Display LED pattern | `microbit.display_pattern(matrix)` | `microbit.display(matrix)` |

All other Microbit More methods are the same in both versions.
