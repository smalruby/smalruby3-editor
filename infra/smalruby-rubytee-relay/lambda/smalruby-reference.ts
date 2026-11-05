/**
 * Smalruby language reference shared by the chat prompt and the takeover prompt
 * (kept as one constant so that both stay in sync).
 */
export const SMALRUBY_REFERENCE = `## About Smalruby

Smalruby is a Ruby subset with methods corresponding to MIT Scratch 3.0 visual programming blocks. Ruby code is converted to Scratch blocks for execution, so only supported methods and syntax can be used.

### Key Differences from Standard Ruby
- Class definitions are limited (only for sprite configuration)
- **\`module\` and \`include\` ARE supported** (Version 2 only) — use to share \`def\` methods across sprites. When the user asks about module/include, ALWAYS generate a code example using them.
- Loops use \`loop do...end\`, \`N.times do...end\`, \`while...end\`, \`until...end\` (no for/each)
- Conditionals: \`if\`, \`unless\`, \`case/when\`, \`until\`
- Variables: instance (\`@score\`), global (\`$score\`), local (\`score\`)
- String interpolation (\`"#{var}"\`) is NOT supported
- \`require\`, \`puts\`/\`print\`/\`p\`, exception handling (\`begin/rescue\`) are NOT supported
- Compound assignment operators \`+=\`, \`-=\`, \`*=\`, \`/=\`, \`%=\` ARE supported
- \`+=\` increments numeric variables, concatenates string variables
- Recursion is NOT supported
- **Literals**: integers, floats, strings (double-quote only), symbols (\`:foo\`), arrays (\`[1, 2, 3]\`), hashes (\`{key: val}\`), ranges (\`1..10\`), regexps (\`/pattern/flags\`), \`true\`/\`false\`/\`nil\`
- **Regex match operators**: \`=~\` (match) and \`!~\` (not match) — e.g., \`"hello" =~ /^he/\`, \`@name !~ /world/\`
- **\`super\` IS supported** (Version 2 only) — calls the overridden method in an included module. Only works inside \`def\` methods that override a same-named module method.

## Available Methods

### Motion
- \`move(steps)\` — move forward: \`move(10)\`
- \`turn_right(degrees)\` / \`turn_left(degrees)\` — rotate: \`turn_right(15)\`
- \`go_to("_mouse_")\` / \`go_to("_random_")\` — move to mouse or random position
- \`go_to([x, y])\` — move to coordinates: \`go_to([100, 50])\`
- \`glide([x, y], secs: n)\` — glide to coordinates: \`glide([100, 50], secs: 1)\`
- \`glide("_mouse_", secs: n)\` — glide to mouse
- \`point_towards("_mouse_")\` — face the mouse
- \`bounce_if_on_edge\` — bounce off edges
- \`self.direction = degrees\` — set direction: \`self.direction = 90\`
- \`self.x = value\` / \`self.y = value\` — set coordinates
- \`self.x += value\` / \`self.y += value\` — change coordinates
- \`self.rotation_style = "style"\` — rotation style ("all around", "left-right", "don't rotate")
- \`x\` / \`y\` — get coordinates
- \`direction\` — get direction

### Looks
- \`say(message)\` / \`say(message, seconds)\` — speech bubble
- \`think(message)\` / \`think(message, seconds)\` — thought bubble
- \`switch_costume("name")\` — change costume
- \`next_costume\` — next costume
- \`switch_backdrop("name")\` — change backdrop
- \`next_backdrop\` — next backdrop
- \`self.size = percent\` — set size: \`self.size = 200\`
- \`self.size += amount\` — change size
- \`set_effect("color", value)\` / \`change_effect_by("color", amount)\`
- \`clear_graphic_effects\`
- \`show\` / \`hide\`
- \`go_to_layer("front")\` / \`go_to_layer("back")\`
- \`size\` / \`costume_number\` / \`costume_name\` / \`backdrop_number\` / \`backdrop_name\`

### Sound
- \`play("sound name")\` — play sound (non-blocking). **Only use names from the current state sound list**
- \`play_until_done("sound name")\` — play and wait. **Only use names from the current state sound list**
- \`stop_all_sounds\`
- \`self.volume = value\` / \`self.volume += amount\`
- \`volume\`

⚠️ **Sound name constraint (critical)**: Only use sound names listed in the "Current State" section. Using a non-existent sound name will cause an error. If the sound list is empty, do NOT use play() or play_until_done().

### Events
- \`when_flag_clicked do...end\` — when green flag clicked (program start)
- \`when_key_pressed("key") do...end\` — when key pressed
- \`when_clicked do...end\` — when sprite clicked
- \`when_backdrop_switches("name") do...end\` — when backdrop switches
- \`when_greater_than("LOUDNESS", value) do...end\`
- \`when_receive("message") do...end\`
- \`broadcast("message")\` / \`broadcast_and_wait("message")\`

**Key names**: "space", "left arrow", "right arrow", "up arrow", "down arrow", "any", "a"–"z", "0"–"9"

### Control
- \`sleep(seconds)\` — wait: \`sleep(1)\`
- \`loop do...end\` — repeat forever
- \`N.times do...end\` — repeat N times: \`10.times do...end\`
- \`until condition do...end\` — repeat until condition
- \`while condition do...end\` — repeat while condition
- \`stop("all")\` — stop all ("all", "this script", "other scripts in sprite")
- \`create_clone("_myself_")\` — create clone
- \`delete_this_clone\`
- \`when_start_as_a_clone do...end\`

⚠️ **Loop auto-wait (critical)**: \`loop do...end\`, \`N.times do...end\`, \`while...end\`, and \`until...end\` automatically wait 1 frame (~33ms, 30fps) at each iteration end. Do NOT add sleep() for animation speed control. Only use sleep() for explicit long waits (0.5s or more).

### Sensing
- \`touching?("target")\` — touching? ("_mouse_", "_edge_", sprite name)
- \`touching_color?("#rrggbb")\`
- \`distance("_mouse_")\`
- \`ask("question")\` / \`answer\`
- \`keyboard.pressed?("key")\`
- \`mouse.down?\` / \`mouse.x\` / \`mouse.y\`
- \`timer.value\` / \`timer.reset\`
- \`loudness\`

### Operators
- \`rand(min..max)\` — random: \`rand(1..10)\`
- Arithmetic: \`+\`, \`-\`, \`*\`, \`/\`, \`%\`
- Comparison: \`==\`, \`!=\`, \`<\`, \`>\`, \`<=\`, \`>=\`
- Logic: \`&&\`, \`||\`, \`!\`
- Math: \`value.round\`, \`value.abs\`, \`value.floor\`, \`value.ceil\`, \`Math.sqrt(value)\`

### Variables
- Instance variables (sprite): \`@score = 0\`, \`@score += 1\`
- Global variables (stage): \`$high_score = 100\`
- Local variables: \`count = 0\`
- \`show_variable("@score")\` / \`hide_variable("@score")\`

### Lists (Arrays)
- Initialize with array literal: \`@items = ["apple", "banana"]\`
- \`@items.push("cherry")\` — add to end
- \`@items.delete_at(0)\` — delete at index (0-indexed)
- \`@items.delete_at(-1)\` — delete last
- \`@items.clear\` — delete all
- \`@items.insert(0, "grape")\` — insert at index (0-indexed)
- \`@items[0] = "orange"\` — replace at index (0-indexed)
- \`@items[0]\` — get at index (0-indexed)
- \`@items.index("apple")\` — search (returns 0-based index, 0 if not found)
- \`@items.length\` — length
- \`@items.include?("apple")\` — contains?
- \`@items.empty?\` — empty?
- \`show_list("@items")\` / \`hide_list("@items")\` — show/hide list monitor

### Module / Include (Version 2 only)
- Define reusable methods in a \`module\`, then \`include\` in a class to share across sprites
- \`module ModuleName ... end\` — define a module with \`def\` methods only
- \`include ModuleName\` — include module methods in a class
- Only \`def\` methods allowed inside \`module\` (no variables, no nested modules)
- Not available on Stage or in Version 1
\`\`\`ruby
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
\`\`\`

### super (Version 2 only)
- \`super\` calls the overridden method in an included module (forwards all arguments)
- \`super(args)\` calls the overridden method with explicit arguments
- Only works inside \`def\` methods that override a same-named module method
- Not available on Stage or in Version 1
\`\`\`ruby
module Utils
  def greet
    say("hello")
  end
end

class Sprite1
  include Utils

  def greet
    super        # calls Utils' greet
    say("goodbye")
  end

  when_flag_clicked do
    greet
  end
end
\`\`\`

### Pen (extension)
- \`Pen.clear\`
- \`pen.down\` / \`pen.up\`
- \`pen.stamp\`
- \`pen.color = "#rrggbb"\`
- \`pen.size = value\` / \`pen.size += value\`

## Forbidden Methods (Common Mistakes)

Do NOT use these — they do not exist:
- ❌ \`set_x()\`, \`set_y()\`, \`change_x()\`, \`change_y()\` → ✅ \`self.x =\`, \`self.y =\`, \`self.x +=\`, \`self.y +=\`
- ❌ \`set_direction()\` → ✅ \`self.direction =\`
- ❌ \`set_size()\`, \`change_size()\` → ✅ \`self.size =\`, \`self.size +=\`
- ❌ \`mouse_x\`, \`mouse_y\` → ✅ \`mouse.x\`, \`mouse.y\`
- ❌ \`mouse_down?\` → ✅ \`mouse.down?\`
- ❌ \`key_pressed?()\`, \`Keyboard.pressed?()\` → ✅ \`keyboard.pressed?()\`
- ❌ \`timer\`, \`reset_timer\`, \`Timer.value\`, \`Timer.reset\` → ✅ \`timer.value\`, \`timer.reset\`
- ❌ \`Mouse.x\`, \`Mouse.y\`, \`Mouse.down?\` → ✅ \`mouse.x\`, \`mouse.y\`, \`mouse.down?\`
- ❌ \`list("@items")\` → ✅ \`@items\` (use array directly: \`@items.push(...)\`, \`@items[0]\`)
- ❌ \`touching?("_mouse_pointer_")\` → ✅ \`touching?("_mouse_")\`
- ❌ \`play_sound()\`, \`stop_sounds\` → ✅ \`play()\`, \`stop_all_sounds\`
- ❌ \`clear_effects\` → ✅ \`clear_graphic_effects\`
- ❌ \`glide(secs, x, y)\` → ✅ \`glide([x, y], secs: n)\`
- ❌ \`go_to(x, y)\` → ✅ \`go_to([x, y])\`
- ❌ \`for\`, \`each\` → ✅ \`loop do...end\`, \`N.times do...end\`, \`while...end\`, \`until...end\`
- ❌ \`module_function\`, \`extend\` → ✅ use \`module\` + \`include\` instead
- ❌ \`sleep(0.05)\`, \`sleep(0.1)\` for animation FPS → ✅ loops auto-wait; only use sleep() for 0.5s+ delays
- ❌ \`puts\`, \`print\`, \`p\` → ✅ \`say()\`
- ❌ \`when_backdrop_changes()\` → ✅ \`when_backdrop_switches()\`
- ❌ \`super\` outside a \`def\` method → ✅ \`super\` only inside \`def\` that overrides a module method
- ❌ \`super\` without \`include\` → ✅ first \`include ModuleName\`, then override the method with \`super\`

## Sample Programs

### Share methods with module/include
\\\`\\\`\\\`ruby
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
\\\`\\\`\\\`

### Follow the mouse
\`\`\`ruby
when_flag_clicked do
  loop do
    point_towards("_mouse_")
    move(5)
  end
end
\`\`\`

### Arrow key control
\`\`\`ruby
when_flag_clicked do
  loop do
    if Keyboard.pressed?("right arrow")
      self.x += 5
    end
    if Keyboard.pressed?("left arrow")
      self.x += -5
    end
    if Keyboard.pressed?("up arrow")
      self.y += 5
    end
    if Keyboard.pressed?("down arrow")
      self.y += -5
    end
  end
end
\`\`\`

### Bounce off walls
\`\`\`ruby
when_flag_clicked do
  self.rotation_style = "left-right"
  loop do
    move(5)
    bounce_if_on_edge
  end
end
\`\`\`

### Costume animation
\`\`\`ruby
when_flag_clicked do
  loop do
    next_costume
  end
end
\`\`\`

### Sprite configuration with class
\`\`\`ruby
class Shimaraby
  set_name "シマラビ"
  set_sprite "Shimaraby"
  set_x 0
  set_y -50
  set_direction 90
  set_size 80
  set_rotation_style "left-right"

  when_flag_clicked do
    loop do
      move(5)
      bounce_if_on_edge
      next_costume
    end
  end
end
\`\`\`

## Available Sprites (for \`set_sprite\`)

When using \`set_sprite\`, only the following sprite names are available:

| \`set_sprite\` name | Japanese name | Description | Best use |
|---|---|---|---|
| \`"Shimaraby"\` | シマラビ | Rabbit (original character), side-facing | Walking, running, platformers |
| \`"Shimacat"\` | シマネコ | Cat (original character), side-facing | Walking, running, platformers |
| \`"Cat 2"\` | ネコ | Cat seen from above | Top-down games, moving in all directions |
| \`"Ball"\` | ボール | Ball | Projectiles (set_size to make smaller), sports |
| \`"Balloon1"\` | 風船 | Balloon | Popping, catching games |
| \`"Button1"\` | ボタン | Button | Click interaction |
| \`"Dragon"\` | ドラゴン | Dragon | Fantasy games, boss enemies |
| \`"Ghost"\` | ゴースト | Ghost | Enemies, spooky games |
| \`"Lightning"\` | カミナリ | Lightning bolt | Dodge games, obstacles |
| \`"Bat"\` | こうもり | Bat | Enemies, flying obstacles |

⚠️ **"Cat" is NOT available**. Use \`"Shimacat"\` or \`"Cat 2"\` for cat sprites.
⚠️ When the user says "ねこ" or "ネコ", use \`set_sprite "Cat 2"\` (top-down) or \`set_sprite "Shimacat"\` (side-facing) depending on the game type.

`;
