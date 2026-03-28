# Smalruby Language Specification

This document defines the Ruby syntax and methods supported by Smalruby.
Based on `packages/scratch-gui/src/lib/ruby-to-blocks-converter/` (Ruby → Blocks) and `packages/scratch-gui/src/lib/ruby-generator/` (Blocks → Ruby).

- Japanese version: [smalruby-language-spec.ja.md](./smalruby-language-spec.ja.md)
- Extension methods: [smalruby-language-spec-extensions.md](./smalruby-language-spec-extensions.md)
- Version 1 API differences: [smalruby-language-spec-v1-diff.md](./smalruby-language-spec-v1-diff.md)

> **Note**: This document describes the **Version 2** API. For Version 1 differences, see the [v1 diff](./smalruby-language-spec-v1-diff.md).

## 1. Overview

Smalruby is a Ruby subset with methods corresponding to MIT Scratch 3.0 visual programming blocks. Ruby code is converted to Scratch blocks for execution, so only supported methods and syntax can be used.

### Key Differences from Standard Ruby

- Class definitions are limited (only for sprite configuration)
- **`module` and `include` ARE supported** — use to share `def` methods across sprites
- Loops use `loop do...end`, `N.times do...end`, `while...end`, `until...end` (no `for`/`each`)
- Variables: instance (`@score`), global (`$score`), local (`score`)
- String interpolation (`"#{var}"`) is NOT supported
- `require`, `puts`/`print`/`p`, exception handling (`begin/rescue`) are NOT supported
- Compound assignment operators `+=`, `-=`, `*=`, `/=`, `%=` ARE supported
- Recursion is NOT supported

## 2. Program Structure

### Top-Level Structure

Smalruby programs can be written in two forms.

#### Form 1: Without class (recommended, simple form)

```ruby
# Event handlers and method definitions at top-level
# Internally wrapped in class Sprite1 ... end

self.rotation_style = "left-right"

when_flag_clicked do
  loop do
    move(10)
    bounce_if_on_edge
  end
end

def my_method(a, b)
  a + b
end
```

#### Form 2: With class definition

```ruby
class Cat
  set_name "Cat"
  set_x 100
  set_y -50

  when_flag_clicked do
    move(10)
  end
end
```

### Class Definition Restrictions

- Namespaced class names are not allowed (`Foo::Bar` is invalid)
- Class inheritance (`class Foo < Bar`) is syntactically accepted but the superclass is ignored
- Only **event handlers** (`when_xxx`), **method definitions** (`def`), and **`include`** are allowed at the class top-level

### Module and Include

Define a `module` and `include` it in a class to share methods across sprites.

```ruby
module Utils
  def add(a, b)
    a + b
  end
end

class Sprite1
  include Utils

  when_flag_clicked do
    say(add(1, 5))
  end
end
```

**Restrictions**:
- Only `def` methods are allowed inside `module` (no variables, no nested modules)
- `module_function` and `extend` are not supported
- `module` and `include` are not available on Stage

### Class-Only Configuration Methods

The following `set_xxx` methods can only be used at the **class definition top-level** (not inside event handlers).

#### For Sprites (`class Sprite1` / `class Cat` etc.)

| Method | Description | Default |
|---|---|---|
| `set_name "name"` | Set sprite name | - |
| `set_sprite "name"` | Load from sprite library | - |
| `set_x value` | Set X coordinate | 0 |
| `set_y value` | Set Y coordinate | 0 |
| `set_direction value` | Set direction | 90 |
| `set_visible true/false` | Set visibility | true |
| `set_size value` | Set size (%) | 100 |
| `set_current_costume value` | Set costume number | 0 |
| `set_rotation_style "style"` | Set rotation style | "all around" |
| `set_costumes ["name1", "name2"]` | Set costumes from library | - |
| `set_sounds ["name1", "name2"]` | Set sounds from library | - |

#### For Stage (`class Stage`)

| Method | Description | Default |
|---|---|---|
| `set_name "name"` | Set stage name | - |
| `set_current_backdrop value` | Set current backdrop number | 0 |
| `set_backdrops ["name1", "name2"]` | Set backdrops from library | - |
| `set_sounds ["name1", "name2"]` | Set sounds from library | - |

**Notes**:
- Sprite-only methods (`set_x`, `set_y`, etc.) cannot be used in `class Stage`.
- Stage-only methods (`set_current_backdrop`, `set_backdrops`) cannot be used in sprite classes.
- In top-level form (without class), use `self.attribute = value` instead (e.g., `self.rotation_style = "left-right"`).

### Stage Class Definition

The stage can be configured using `class Stage`.

```ruby
class Stage
  set_current_backdrop 1
  set_backdrops ["Arctic", "Blue Sky"]
  set_sounds ["pop"]

  when_flag_clicked do
    switch_backdrop("Blue Sky")
  end
end
```

**Note**: If `class Stage` is omitted, it is automatically added on file save.

## 3. Supported Ruby Syntax

### Literals

| Syntax | Example | Notes |
|---|---|---|
| Integer | `42`, `-5`, `0` | |
| Float | `3.14`, `1.0` | |
| String | `"hello"` | **Double quotes only**. No interpolation (`#{}`) |
| Symbol | `:symbol` | Limited use (hash keys, symbol list storage) |
| Array | `[1, 2, 3]`, `[x, y]` | Used for coordinates in `go_to`, variable storage |
| Hash | `{key: val}` | Used for keyword arguments and hash variable storage |
| Range | `1..10`, `1...10` | Used in `rand()` etc. |
| true / false | `true`, `false` | |
| nil | `nil` | |
| Regexp | `/^hello/i` | Used with `=~`/`!~` operators and variable assignment |

### Variables

| Type | Notation | Description |
|---|---|---|
| Instance variable | `@score` | Sprite variable (per-sprite) |
| Global variable | `$global_score` | Stage variable (shared across sprites) |
| Local variable | `score` | Local scope variable |

```ruby
# Instance variable (sprite variable)
@score = 0
@score += 1
@score -= 1
@score *= 2
@score /= 2
@score %= 3

# Global variable (stage variable)
$high_score = 100

# Local variable
count = 0
count += 1

# String variable concatenation
@name = "He"
@name += "llo"  # @name becomes "Hello"
```

### Assignment Operators

| Operator | Example | Notes |
|---|---|---|
| `=` | `@score = 10` | Assign value to variable |
| `+=` | `@score += 1` | Increment for numbers, concatenate for strings |
| `-=` | `@score -= 1` | Decrease variable value |
| `*=` | `@score *= 2` | Multiply variable value |
| `/=` | `@score /= 2` | Divide variable value |
| `%=` | `@score %= 3` | Modulo of variable value |

### Conditionals

```ruby
# if statement
if x > 10
  say("big")
end

# if-else
if touching?("_edge_")
  bounce_if_on_edge
else
  move(10)
end

# if-elsif-else
if x > 100
  say("very big")
elsif x > 50
  say("big")
else
  say("small")
end

# unless
unless touching?("_edge_")
  move(10)
end

# case-when
case @direction
when 1
  move(10)
when 2
  turn_right(90)
else
  say("unknown")
end

# Modifier if / unless
move(10) if keyboard.pressed?("space")
say("safe") unless touching?("_edge_")
```

### Loops

```ruby
# Forever loop
loop do
  move(1)
end

# Repeat N times
10.times do
  move(10)
  turn_right(36)
end

# While loop
i = 0
while i < 5
  move(5)
  i += 1
end

# Until loop
until touching?("_edge_")
  move(5)
end
```

**Note**: `for` and `each` loops are NOT supported.

**Important — Loop auto-wait**: `loop do...end`, `N.times do...end`, `while...end`, and `until...end` automatically wait 1 frame (~33ms, 30fps) at each iteration end. Do NOT add `sleep()` for animation speed control. Only use `sleep()` for explicit long waits (0.5s or more).

### Logical Operators

| Operator | Example | Notes |
|---|---|---|
| `&&` / `and` | `a && b` | AND |
| `\|\|` / `or` | `a \|\| b` | OR |
| `!` | `!touching?("_edge_")` | NOT |

### Regex Match Operators

| Operator | Example | Notes |
|---|---|---|
| `=~` | `"hello" =~ /^he/` | True if matches |
| `!~` | `"hello" !~ /world/` | True if does not match |

Regex literals can also be assigned to variables.

```ruby
r = /^hello/i
if @name =~ r
  say("matched!")
end
```

**Supported flags**: `i` (case-insensitive), `m` (multiline), `x` (extended)

**Note**: Internally, `=~`/`!~` are converted to `operator_contains` blocks. When `STRING2` contains a `/pattern/` format string, the VM interprets it as a regular expression.

### Comparison Operators

| Operator | Example |
|---|---|
| `==` | `@score == 10` |
| `!=` | `@score != 0` |
| `>` | `x > 100` |
| `<` | `x < -100` |
| `>=` | `@score >= 100` |
| `<=` | `timer.value <= 0` |

### Arithmetic Operators

| Operator | Example |
|---|---|
| `+` | `@score + 1` |
| `-` | `x - 10` |
| `*` | `@speed * 2` |
| `/` | `360 / 10` |
| `%` | `@count % 2` |
| `**` | `10 ** 2` (power) |

### Method Definition

```ruby
# Method definition
def greet(name)
  say(name)
end

# Method call
greet("hello")
```

**Restrictions**:
- Keyword arguments are not supported (`def foo(name:)` is invalid)
- Class methods (`def self.method`) cannot be defined
- `attr_accessor`/`attr_reader`/`attr_writer` are not supported
- Method overloading is not supported
- Recursion is not supported

### Return Values

```ruby
def add(a, b)
  a + b  # Last expression is the return value (implicit return)
end

def check(x)
  return true if x > 0  # Explicit return
  false
end
```

### super

When a class `include`s a module and overrides a same-named method, `super` calls the module's version of that method.

```ruby
module Utils
  def greet
    say("hello")
  end
end

class Sprite1
  include Utils

  def greet
    super        # Calls Utils' greet (forwards arguments)
    say("goodbye")
  end

  when_flag_clicked do
    greet
  end
end
```

`super(args)` can also pass arguments explicitly.

```ruby
module Utils
  def add(a, b)
    a + b
  end
end

class Sprite1
  include Utils

  def add(a, b)
    result = super(a, b)  # Calls Utils' add
    result * 2
  end
end
```

**Restrictions**:
- `super` can only be used inside a `def` method
- A same-named method must exist in an included module
- Not available on Stage (`class Stage`)

## 4. Available Methods

### Motion

| Method | Description | Example |
|---|---|---|
| `move(steps)` | Move forward | `move(10)` |
| `turn_right(degrees)` | Rotate clockwise | `turn_right(15)` |
| `turn_left(degrees)` | Rotate counter-clockwise | `turn_left(15)` |
| `go_to("target")` | Move to target | `go_to("_mouse_")`, `go_to("_random_")` |
| `go_to([x, y])` | Move to coordinates | `go_to([0, 0])` |
| `glide("target", secs: n)` | Glide to target | `glide("_mouse_", secs: 1)` |
| `glide([x, y], secs: n)` | Glide to coordinates | `glide([100, 50], secs: 2)` |
| `point_towards("target")` | Point towards target | `point_towards("_mouse_")` |
| `bounce_if_on_edge` | Bounce off edges | `bounce_if_on_edge` |
| `self.direction = degrees` | Set direction | `self.direction = 90` |
| `self.x = value` | Set X coordinate | `self.x = 0` |
| `self.y = value` | Set Y coordinate | `self.y = 0` |
| `self.x += value` | Change X coordinate | `self.x += 10` |
| `self.y += value` | Change Y coordinate | `self.y += -10` |
| `self.rotation_style = "style"` | Set rotation style | `self.rotation_style = "left-right"` |
| `x` | Get X coordinate | `x` |
| `y` | Get Y coordinate | `y` |
| `direction` | Get direction | `direction` |

**Target names for go_to / point_towards**: `"_mouse_"` (mouse pointer), `"_random_"` (random position)

**Rotation style values**: `"all around"`, `"left-right"`, `"don't rotate"`

### Looks

| Method | Description | Example |
|---|---|---|
| `say(message)` | Speech bubble | `say("hello")` |
| `say(message, seconds)` | Speech bubble for seconds | `say("hi", 2)` |
| `think(message)` | Thought bubble | `think("hmm")` |
| `think(message, seconds)` | Thought bubble for seconds | `think("hmm", 2)` |
| `switch_costume("name")` | Switch costume | `switch_costume("costume2")` |
| `next_costume` | Next costume | `next_costume` |
| `switch_backdrop("name")` | Switch backdrop | `switch_backdrop("backdrop2")` |
| `switch_backdrop_and_wait("name")` | Switch backdrop and wait | `switch_backdrop_and_wait("backdrop2")` |
| `next_backdrop` | Next backdrop | `next_backdrop` |
| `self.size = percent` | Set size | `self.size = 200` |
| `self.size += amount` | Change size | `self.size += 10` |
| `set_effect("effect", value)` | Set graphic effect | `set_effect("color", 25)` |
| `change_effect_by("effect", amount)` | Change graphic effect | `change_effect_by("color", 10)` |
| `clear_graphic_effects` | Clear all graphic effects | `clear_graphic_effects` |
| `show` | Show sprite | `show` |
| `hide` | Hide sprite | `hide` |
| `go_to_layer("front")` | Go to front layer | `go_to_layer("front")` |
| `go_to_layer("back")` | Go to back layer | `go_to_layer("back")` |
| `go_layers(n, "forward")` | Go forward n layers | `go_layers(1, "forward")` |
| `go_layers(n, "backward")` | Go backward n layers | `go_layers(1, "backward")` |
| `costume_number` | Get costume number | `costume_number` |
| `costume_name` | Get costume name | `costume_name` |
| `backdrop_number` | Get backdrop number | `backdrop_number` |
| `backdrop_name` | Get backdrop name | `backdrop_name` |
| `size` | Get size (%) | `size` |

**Graphic effect names**: `"color"`, `"fisheye"`, `"whirl"`, `"pixelate"`, `"mosaic"`, `"brightness"`, `"ghost"`

### Sound

| Method | Description | Example |
|---|---|---|
| `play("sound name")` | Play sound (non-blocking) | `play("Meow")` |
| `play_until_done("sound name")` | Play sound until done | `play_until_done("Meow")` |
| `stop_all_sounds` | Stop all sounds | `stop_all_sounds` |
| `change_sound_effect_by("effect", amount)` | Change sound effect | `change_sound_effect_by("PITCH", 10)` |
| `set_sound_effect("effect", value)` | Set sound effect | `set_sound_effect("PITCH", 100)` |
| `clear_sound_effects` | Clear sound effects | `clear_sound_effects` |
| `self.volume = value` | Set volume | `self.volume = 50` |
| `self.volume += amount` | Change volume | `self.volume += -10` |
| `volume` | Get volume | `volume` |

**Sound effect names**: `"PITCH"`, `"PAN"`

### Events

| Method | Description | Example |
|---|---|---|
| `when_flag_clicked do...end` | When green flag clicked | `when_flag_clicked do ... end` |
| `when_key_pressed("key") do...end` | When key pressed | `when_key_pressed("space") do ... end` |
| `when_clicked do...end` | When sprite clicked | `when_clicked do ... end` |
| `when_backdrop_switches("name") do...end` | When backdrop switches | `when_backdrop_switches("backdrop2") do ... end` |
| `when_greater_than("type", value) do...end` | When value exceeded | `when_greater_than("LOUDNESS", 10) do ... end` |
| `when_receive("message") do...end` | When message received | `when_receive("start") do ... end` |
| `broadcast("message")` | Broadcast message | `broadcast("start")` |
| `broadcast_and_wait("message")` | Broadcast and wait | `broadcast_and_wait("start")` |

**Key names**: `"space"`, `"left arrow"`, `"right arrow"`, `"up arrow"`, `"down arrow"`, `"any"`, `"a"`–`"z"`, `"0"`–`"9"`

**when_greater_than types**: `"LOUDNESS"`, `"TIMER"`

### Control

| Method | Description | Example |
|---|---|---|
| `sleep(seconds)` | Wait | `sleep(1)` |
| `loop do...end` | Repeat forever | `loop do ... end` |
| `N.times do...end` | Repeat N times | `10.times do ... end` |
| `if condition...end` | If then | `if x > 0 ... end` |
| `if condition...else...end` | If then else | `if x > 0 ... else ... end` |
| `until condition do...end` | Repeat until | `until touching?("_edge_") do ... end` |
| `while condition do...end` | Repeat while | `while @score < 100 ... end` |
| `stop("target")` | Stop execution | `stop("all")` |
| `create_clone("target")` | Create clone | `create_clone("_myself_")` |
| `delete_this_clone` | Delete this clone | `delete_this_clone` |
| `when_start_as_a_clone do...end` | When cloned | `when_start_as_a_clone do ... end` |

**Stop targets**: `"all"`, `"this script"`, `"other scripts in sprite"`

**Clone targets**: `"_myself_"`, sprite name

### Sensing

| Method | Description | Example |
|---|---|---|
| `touching?("target")` | Touching target? | `touching?("_mouse_")`, `touching?("_edge_")` |
| `touching_color?("color")` | Touching color? | `touching_color?("#ff0000")` |
| `color_is_touching_color?("c1", "c2")` | Color touching color? | `color_is_touching_color?("#ff0000", "#00ff00")` |
| `distance("target")` | Distance to target | `distance("_mouse_")` |
| `ask("question")` | Ask and wait | `ask("What's your name?")` |
| `answer` | Get answer | `answer` |
| `keyboard.pressed?("key")` | Key pressed? | `keyboard.pressed?("space")` |
| `mouse.down?` | Mouse down? | `mouse.down?` |
| `mouse.x` | Mouse X | `mouse.x` |
| `mouse.y` | Mouse Y | `mouse.y` |
| `self.drag_mode = "mode"` | Set drag mode | `self.drag_mode = "draggable"` |
| `loudness` | Microphone loudness | `loudness` |
| `timer.value` | Timer value | `timer.value` |
| `timer.reset` | Reset timer | `timer.reset` |
| `Time.now.year` | Current year | `Time.now.year` |
| `Time.now.month` | Current month | `Time.now.month` |
| `Time.now.day` | Current day | `Time.now.day` |
| `Time.now.hour` | Current hour | `Time.now.hour` |
| `Time.now.min` | Current minute | `Time.now.min` |
| `Time.now.sec` | Current second | `Time.now.sec` |
| `Time.now.wday + 1` | Day of week (1=Sun–7=Sat) | `Time.now.wday + 1` |
| `days_since_2000` | Days since 2000 | `days_since_2000` |
| `user_name` | Username | `user_name` |

**Touching targets**: `"_mouse_"` (mouse), `"_edge_"` (edge), sprite name

**Getting other sprite/stage info**:

```ruby
sprite("Sprite2").x
sprite("Sprite2").direction
sprite("Sprite2").costume_number
sprite("Sprite2").variable("@score")

stage.backdrop_number
stage.backdrop_name
stage.variable("$var")
```

### Operators

| Method | Description | Example |
|---|---|---|
| `rand(range)` | Random number | `rand(1..10)` |
| `value.round` | Round | `3.7.round` |
| `value.abs` | Absolute value | `(-5).abs` |
| `value.floor` | Floor | `3.7.floor` |
| `value.ceil` | Ceiling | `3.2.ceil` |
| `Math.sqrt(value)` | Square root | `Math.sqrt(9)` |
| `Math.sin(value)` | Sine | `Math.sin(90)` |
| `Math.cos(value)` | Cosine | `Math.cos(0)` |
| `Math.tan(value)` | Tangent | `Math.tan(45)` |
| `Math.asin(value)` | Arcsine | `Math.asin(1)` |
| `Math.acos(value)` | Arccosine | `Math.acos(0)` |
| `Math.atan(value)` | Arctangent | `Math.atan(1)` |
| `Math.log(value)` | Natural log | `Math.log(10)` |
| `Math.log10(value)` | Common log | `Math.log10(100)` |
| `Math::E ** value` | e to the power | `Math::E ** 2` |
| `10 ** value` | 10 to the power | `10 ** 3` |
| `string.length` | String length | `"hello".length` |
| `string.include?(substring)` | String contains? | `"hello".include?("ell")` |
| `string[index]` | Character at index | `"hello"[0]` |
| `string1 + string2` | String concatenation | `"hello" + " world"` |
| `string =~ /regexp/` | Regex match | `"hello" =~ /^he/` |
| `/regexp/ =~ string` | Regex match (reversed) | `/^he/ =~ "hello"` |
| `string !~ /regexp/` | Regex not match | `"hello" !~ /world/` |
| `/regexp/ !~ string` | Regex not match (reversed) | `/world/ !~ "hello"` |

### Variables / Lists (Data)

#### Variables

```ruby
# Sprite variable (instance variable)
@score = 0
@score += 1      # Increment
@score -= 1      # Decrement
@score *= 2      # Multiply
@score /= 2      # Divide
@score %= 3      # Modulo

# Stage variable (global variable)
$high_score = 100

# Local variable
count = 0

# String concatenation
@greeting = "He"
@greeting += "llo"  # Becomes "Hello"

# Show/hide variables
show_variable("@score")
hide_variable("@score")
```

#### Lists (Arrays)

```ruby
# Initialize with array literal
@items = ["apple", "banana", "cherry"]

# Operations (0-indexed)
@items.push("apple")           # Add to end
@items.delete_at(0)            # Delete at index (0-indexed)
@items.delete_at(-1)           # Delete last
@items.clear                   # Delete all
@items.insert(0, "banana")     # Insert at index (0-indexed)
@items[0] = "orange"           # Replace at index (0-indexed)
@items[0]                      # Get at index (0-indexed)
@items.index("apple")          # Search (returns 0-based index, 0 if not found)
@items.length                  # Length
@items.include?("apple")       # Contains?
@items.empty?                  # Empty?
show_list("@items")            # Show list
hide_list("@items")            # Hide list
```

## 5. Unsupported Ruby Syntax

The following Ruby syntax is **NOT supported** in Smalruby:

- `for` loops
- `each` method
- `begin`/`rescue`/`ensure` (exception handling)
- `module_function`, `extend` (`module` and `include` are supported)
- `require` / `require_relative`
- String interpolation (`"Hello #{name}"`)
- Multiple assignment (`a, b = 1, 2`)
- Splat arguments (`*args`)
- Block-argument iterators (`each { |x| ... }`)
- Procs / Lambdas
- `yield`
- `open` / File I/O
- `puts` / `print` / `p` (use `say()` instead)

## 6. Common Mistakes

```ruby
# ❌ set_x / change_x do not exist
set_x(100)
change_x(10)

# ✅ Use self.x = / self.x +=
self.x = 100
self.x += 10
```

```ruby
# ❌ Wrong method names
mouse_x
key_pressed?("space")
timer
reset_timer

# ✅ Correct method names
mouse.x
keyboard.pressed?("space")
timer.value
timer.reset
```

```ruby
# ❌ Wrong target name
touching?("_mouse_pointer_")

# ✅ Use "_mouse_"
touching?("_mouse_")
```

```ruby
# ❌ Wrong argument order for glide
glide(1, 100, 50)

# ✅ Array for coordinates, keyword for seconds
glide([100, 50], secs: 1)
```

```ruby
# ❌ Wrong method names
play_sound("Meow")
stop_sounds

# ✅ Correct method names
play("Meow")
stop_all_sounds
```

```ruby
# ❌ set_size / change_size do not exist (outside class definition)
set_size(200)
change_size(10)

# ✅ Use self.size = / self.size +=
self.size = 200
self.size += 10
```

```ruby
# ❌ each is not supported
[1, 2, 3].each do |n|
  say(n)
end

# ✅ Use times
3.times do
  say("hello")
end
```
