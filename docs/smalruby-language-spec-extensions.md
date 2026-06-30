# Smalruby Language Specification — Extensions

This document defines the Ruby methods available through Smalruby extensions.
Only extensions visible in the extension library are listed (those with `defaultHidden: true` are excluded).

- Japanese version: [smalruby-language-spec-extensions.ja.md](./smalruby-language-spec-extensions.ja.md)
- Core language spec: [smalruby-language-spec.md](./smalruby-language-spec.md)
- Version 1 API differences: [smalruby-language-spec-v1-diff.md](./smalruby-language-spec-v1-diff.md)

> **Note**: This document describes the **Version 2** API. For Version 1 differences, see the [v1 diff](./smalruby-language-spec-v1-diff.md).

## Table of Contents

1. [Pen](#1-pen)
2. [Music](#2-music)
3. [Video Sensing](#3-video-sensing)
4. [Face Sensing](#4-face-sensing)
5. [Text to Speech](#5-text-to-speech)
6. [Translate](#6-translate)
7. [Mesh V2](#7-mesh-v2)
8. [Smalrubot S1](#8-smalrubot-s1)
9. [Microbit More](#9-microbit-more)
10. [Koshien](#10-koshien)
11. [Ruby String](#11-ruby-string)

---

## 1. Pen

Draw with your sprites using the pen.

| Method | Description | Example |
|---|---|---|
| `pen.clear` | Erase all | `pen.clear` |
| `pen.stamp` | Stamp | `pen.stamp` |
| `pen.down` | Pen down | `pen.down` |
| `pen.up` | Pen up | `pen.up` |
| `pen.color = color` | Set pen color (hex `"#ff0000"` / shorthand `"#f00"` / name `"red"` / `"rgb(255,0,0)"`) | `pen.color = "#ff0000"` |
| `pen.color = value` | Set pen color parameter | `pen.color = 50` |
| `pen.color += value` | Change pen color parameter | `pen.color += 10` |
| `pen.saturation = value` | Set saturation | `pen.saturation = 100` |
| `pen.saturation += value` | Change saturation | `pen.saturation += 10` |
| `pen.brightness = value` | Set brightness | `pen.brightness = 100` |
| `pen.brightness += value` | Change brightness | `pen.brightness += 10` |
| `pen.transparency = value` | Set transparency | `pen.transparency = 50` |
| `pen.transparency += value` | Change transparency | `pen.transparency += 10` |
| `pen.size = value` | Set pen size | `pen.size = 3` |
| `pen.size += value` | Change pen size | `pen.size += 1` |

---

## 2. Music

Play instruments and drums.

| Method | Description | Example |
|---|---|---|
| `music.play_drum(drum: n, beats: n)` | Play drum | `music.play_drum(drum: 1, beats: 0.25)` |
| `music.rest(beats)` | Rest | `music.rest(0.25)` |
| `music.play_note(note: n, beats: n)` | Play note | `music.play_note(note: 60, beats: 0.25)` |
| `music.instrument = value` | Set instrument | `music.instrument = 1` |
| `music.tempo = value` | Set tempo | `music.tempo = 120` |
| `music.tempo += amount` | Change tempo | `music.tempo += 20` |
| `music.tempo` | Get tempo | `music.tempo` |

---

## 3. Video Sensing

Sense motion with the camera.

| Method | Description | Example |
|---|---|---|
| `video_sensing.when_video_motion_greater_than(value) do...end` | When video motion exceeds value | `video_sensing.when_video_motion_greater_than(10) do ... end` |
| `video_sensing.video_turn(state)` | Turn video on/off | `video_sensing.video_turn("on")` |
| `video_sensing.video_transparency = value` | Set video transparency | `video_sensing.video_transparency = 50` |
| `video_sensing.video_on(attribute, subject)` | Get video attribute | `video_sensing.video_on("motion", "this sprite")` |

**Video state values**: `"on"`, `"off"`, `"on-flipped"`

**Video attributes**: `"motion"`, `"direction"`

**Video subjects**: `"this sprite"`, `"Stage"`

---

## 4. Face Sensing

Sense faces with the camera. (Smalruby-specific extension)

### Commands

| Method | Description | Example |
|---|---|---|
| `face_sensing.go_to(part)` | Move sprite to face part | `face_sensing.go_to("nose")` |
| `face_sensing.point_in_direction_of_face_tilt` | Point in face tilt direction | `face_sensing.point_in_direction_of_face_tilt` |
| `face_sensing.set_size_to_face_size` | Set sprite size to match face | `face_sensing.set_size_to_face_size` |

### Event Handlers

| Method | Description | Example |
|---|---|---|
| `face_sensing.when_face_tilted(direction) do...end` | When face is tilted | `face_sensing.when_face_tilted("left") do ... end` |
| `face_sensing.when_this_sprite_touch(part) do...end` | When sprite touches face part | `face_sensing.when_this_sprite_touch("nose") do ... end` |
| `face_sensing.when_face_detected do...end` | When a face is detected | `face_sensing.when_face_detected do ... end` |

### Reporters

| Method | Description | Example |
|---|---|---|
| `face_sensing.face_detected?` | Is face detected? | `face_sensing.face_detected?` |
| `face_sensing.face_tilt` | Get face tilt angle | `face_sensing.face_tilt` |
| `face_sensing.face_size` | Get face size | `face_sensing.face_size` |

**Face parts**: `"left_eye"`, `"right_eye"`, `"nose"`, `"mouth"`, `"left_ear"`, `"right_ear"`, `"between_eyes"`, `"top_of_head"`

**Tilt directions**: `"left"`, `"right"`, `"up"`, `"down"`

---

## 5. Text to Speech

Make your projects talk. (Requires internet connection)

| Method | Description | Example |
|---|---|---|
| `text2speech.speak(words)` | Speak text | `text2speech.speak("hello")` |
| `text2speech.voice = voice` | Set voice | `text2speech.voice = "ALTO"` |
| `text2speech.language = language` | Set language | `text2speech.language = "ja"` |

**Voice options**: `"ALTO"`, `"TENOR"`, `"SQUEAK"`, `"GIANT"`, `"KITTEN"`

---

## 6. Translate

Translate text into many languages. (Requires internet connection)

| Method | Description | Example |
|---|---|---|
| `translate.call(words, language)` | Translate text | `translate.call("hello", "ja")` |
| `translate.language` | Get viewer's language | `translate.language` |

---

## 7. Mesh V2

Allow users to interact over a computer network. (Requires internet connection)

| Method | Description | Example |
|---|---|---|
| `mesh.sensor_value(name)` | Get sensor value by name | `mesh.sensor_value("score")` |

---

## 8. Smalrubot S1

Control the Smalrubot S1 robot.

### Commands

| Method | Description | Example |
|---|---|---|
| `smalrubot_s1.action(action)` | Perform action | `smalrubot_s1.action("forward")` |
| `smalrubot_s1.action(action, secs)` | Perform action for seconds | `smalrubot_s1.action("forward", 1)` |
| `smalrubot_s1.bend_arm(degree, secs)` | Bend arm | `smalrubot_s1.bend_arm(90, 1)` |
| `smalrubot_s1.led(position, true/false)` | Turn LED on/off | `smalrubot_s1.led("left", true)` |
| `smalrubot_s1.set_motor_speed(position, speed)` | Set motor speed | `smalrubot_s1.set_motor_speed("left", 100)` |
| `smalrubot_s1.arm_calibration = degree` | Set arm calibration | `smalrubot_s1.arm_calibration = 0` |

### Reporters

| Method | Description | Example |
|---|---|---|
| `smalrubot_s1.sensor_value(position)` | Get sensor value | `smalrubot_s1.sensor_value("left")` |
| `smalrubot_s1.get_motor_speed(position)` | Get motor speed | `smalrubot_s1.get_motor_speed("left")` |

**Action values**: `"forward"`, `"backward"`, `"left"`, `"right"`, `"stop"`

**Position values**: `"left"`, `"right"`

---

## 9. Microbit More

Enhanced micro:bit support with sensors, display, and data communication.

### Event Handlers

| Method | Description | Example |
|---|---|---|
| `microbit.when_microbit(state) do...end` | When connection changes | `microbit.when_microbit("connected") do ... end` |
| `microbit.when_button_is(name, event) do...end` | When button event | `microbit.when_button_is("A", "down") do ... end` |
| `microbit.when_pin_is(name, event) do...end` | When pin touch event | `microbit.when_pin_is("LOGO", "touched") do ... end` |
| `microbit.when_pin_connected(pin) do...end` | When pin connected | `microbit.when_pin_connected(0) do ... end` |
| `microbit.when(gesture) do...end` | When gesture detected | `microbit.when("shake") do ... end` |
| `microbit.when_tilted(direction) do...end` | When tilted | `microbit.when_tilted("any") do ... end` |
| `microbit.when_catch_at_pin(event, pin) do...end` | When pin event caught | `microbit.when_catch_at_pin("low pulse", "P0") do ... end` |
| `microbit.when_data_received_from_microbit(label) do...end` | When data received | `microbit.when_data_received_from_microbit("label-01") do ... end` |

### Buttons and Touch

| Method | Description | Example |
|---|---|---|
| `microbit.button_pressed?(name)` | Is button pressed? | `microbit.button_pressed?("A")` |
| `microbit.pin_is_touched?(name)` | Is pin touched? | `microbit.pin_is_touched?("LOGO")` |

### Sensors

| Method | Description | Example |
|---|---|---|
| `microbit.light_intensity` | Light level | `microbit.light_intensity` |
| `microbit.temperature` | Temperature | `microbit.temperature` |
| `microbit.angle_with_north` | Compass heading | `microbit.angle_with_north` |
| `microbit.pitch` | Pitch angle | `microbit.pitch` |
| `microbit.roll` | Roll angle | `microbit.roll` |
| `microbit.sound_level` | Sound level | `microbit.sound_level` |
| `microbit.magnetic_force(axis)` | Magnetic force | `microbit.magnetic_force("absolute")` |
| `microbit.acceleration(axis)` | Acceleration | `microbit.acceleration("x")` |
| `microbit.analog_value(pin)` | Analog pin value | `microbit.analog_value("P0")` |

### Display

| Method | Description | Example |
|---|---|---|
| `microbit.display_pattern(matrix)` | Display LED pattern | `microbit.display_pattern("11111", "10001", "10001", "10001", "11111")` |
| `microbit.display_text(text)` | Display text | `microbit.display_text("Hello!")` |
| `microbit.display_text_delay(text, delay)` | Display text with delay | `microbit.display_text_delay("Hello!", 120)` |
| `microbit.clear_display` | Clear display | `microbit.clear_display` |

### Pin Control

| Method | Description | Example |
|---|---|---|
| `microbit.set_pin_to_input_pull(pin, mode)` | Set pin pull mode | `microbit.set_pin_to_input_pull("P0", "up")` |
| `microbit.is_pin_high?(pin)` | Is pin high? | `microbit.is_pin_high?("P0")` |
| `microbit.set_digital(pin, level)` | Set digital output | `microbit.set_digital("P0", "High")` |
| `microbit.set_analog(pin, level)` | Set analog output | `microbit.set_analog("P0", 512)` |
| `microbit.set_servo(pin, angle)` | Set servo angle | `microbit.set_servo("P0", 90)` |

### Audio

| Method | Description | Example |
|---|---|---|
| `microbit.play_tone(freq, vol)` | Play tone | `microbit.play_tone(440, 100)` |
| `microbit.stop_tone` | Stop tone | `microbit.stop_tone` |

### Pin Events

| Method | Description | Example |
|---|---|---|
| `microbit.listen_event_on(event_type, pin)` | Listen for pin event type | `microbit.listen_event_on("pulse", "P0")` |
| `microbit.value_of(event, pin)` | Get pin event value | `microbit.value_of("low pulse", "P0")` |

### Tilt

| Method | Description | Example |
|---|---|---|
| `microbit.tilted?(direction)` | Is tilted? | `microbit.tilted?("any")` |
| `microbit.tilt_angle(direction)` | Get tilt angle | `microbit.tilt_angle("front")` |

### Data Communication

| Method | Description | Example |
|---|---|---|
| `microbit.send_data_to_microbit(data, label)` | Send data to micro:bit | `microbit.send_data_to_microbit("data", "label-01")` |
| `microbit.data[label]` | Get received data | `microbit.data["label-01"]` |

**Button names**: `"A"`, `"B"`

**Button events**: `"down"`, `"up"`, `"click"`

**Touch events**: `"touched"`, `"released"`, `"tapped"`

**Gesture names**: `"tilted_front"`, `"tilted_back"`, `"tilted_left"`, `"tilted_right"`, `"face up"`, `"face down"`, `"freefall"`, `"3G"`, `"6G"`, `"8G"`, `"shake"`, `"jumped"`, `"moved"`, `"tilted_any"`

**Tilt directions**: `"any"`, `"front"`, `"back"`, `"left"`, `"right"`

**Axis values**: `"x"`, `"y"`, `"z"`, `"absolute"`

**Pin event types**: `"none"`, `"pulse"`, `"edge"`

**Pin events**: `"low pulse"`, `"high pulse"`, `"fall"`, `"rise"`

**LED matrix pattern**: Each row is a 5-character string where `1` = on, `.` = off. Example: `"1.1.1"`.

---

## 10. Koshien

Smalruby Koshien competition support.

### Connection

| Method | Description | Example |
|---|---|---|
| `koshien.connect_game(name: name)` | Connect to game | `koshien.connect_game(name: "player1")` |

### Map Operations

| Method | Description | Example |
|---|---|---|
| `koshien.get_map_area(position)` | Get map area | `koshien.get_map_area("0:0")` |
| `koshien.map(position)` | Get map at position | `koshien.map("0:0")` |
| `koshien.map_from(position, variable)` | Get map from variable | `koshien.map_from("0:0", @map)` |
| `koshien.map_all` | Get entire map | `koshien.map_all` |
| `koshien.move_to(position)` | Move to position | `koshien.move_to("1:2")` |

### Route Calculation

| Method | Description | Example |
|---|---|---|
| `koshien.calc_route(result: list)` | Calculate route to goal | `koshien.calc_route(result: list("@route"))` |
| `koshien.calc_route(result: list, src: pos, dst: pos, except_cells: list)` | Calculate route with options | `koshien.calc_route(result: list("@route"), src: "0:0", dst: "4:4", except_cells: list("@walls"))` |

### Items and Objects

| Method | Description | Example |
|---|---|---|
| `koshien.set_<item>(position)` | Set item at position | `koshien.set_flag("1:1")` |
| `koshien.locate_objects(result: list, sq_size: n, cent: pos, objects: str)` | Locate objects | `koshien.locate_objects(result: list("@objs"), sq_size: 5, cent: "2:2", objects: "ABCD")` |
| `koshien.object(object)` | Get object | `koshien.object("unknown")` |

### Position and Coordinates

| Method | Description | Example |
|---|---|---|
| `koshien.position(x, y)` | Create position | `koshien.position(0, 0)` |
| `koshien.position_of_x(position)` | Get X from position | `koshien.position_of_x("1:2")` |
| `koshien.position_of_y(position)` | Get Y from position | `koshien.position_of_y("1:2")` |
| `koshien.<target>` | Get target position | `koshien.player` |
| `koshien.<target>_x` | Get target X | `koshien.player_x` |
| `koshien.<target>_y` | Get target Y | `koshien.player_y` |

### Game Control

| Method | Description | Example |
|---|---|---|
| `koshien.turn_over` | End turn | `koshien.turn_over` |
| `koshien.set_message(message)` | Set message | `koshien.set_message("hello")` |

---

## 11. Ruby String

Ruby String manipulation methods. (Smalruby-specific extension)

### Reporter Methods (non-destructive)

These return a new string without modifying the original. Can be used with string literals, variables, or block results.

| Method | Description | Example |
|---|---|---|
| `string.delete(chars)` | Delete characters | `"hello world".delete("l")` |
| `string.gsub(pattern, replacement)` | Replace all occurrences | `"hello".gsub("l", "r")` |

### Command Methods (destructive, in-place)

These modify the variable's value in place. **Can only be used with variable receivers**.

| Method | Description | Example |
|---|---|---|
| `variable.delete!(chars)` | Delete characters in place | `@name.delete!("l")` |
| `variable.gsub!(pattern, replacement)` | Replace all in place | `@name.gsub!("l", "r")` |

**Note**: The `!` (bang) methods require a variable as the receiver — string literals (`"hello".delete!("l")`) are not allowed.
