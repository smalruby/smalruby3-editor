/* eslint-disable no-console */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Configuration (from environment variables)
// ---------------------------------------------------------------------------
const RATE_LIMIT_TABLE_NAME = process.env.RATE_LIMIT_TABLE_NAME || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const RATE_LIMIT_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '35', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '40', 10);
const MAX_USER_MESSAGE_LENGTH = parseInt(process.env.MAX_USER_MESSAGE_LENGTH || '250', 10);
const MIN_USER_MESSAGE_LENGTH = parseInt(process.env.MIN_USER_MESSAGE_LENGTH || '10', 10);
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'https://smalruby.app').split(',').map(o => o.trim());
const MAX_FIELD_NAME_LENGTH = 100;       // sprite/costume/sound names
const MAX_CURRENT_CODE_LENGTH = 1000;    // currentCode in stateContext
const MAX_HISTORY_TURNS = 20;            // conversation turns
const MAX_HISTORY_TURN_TEXT_LENGTH = 1000; // chars per history turn

// Anthropic API
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// ---------------------------------------------------------------------------
// DynamoDB client
// ---------------------------------------------------------------------------
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ContentPart {
  text: string;
}

interface HistoryTurn {
  role: 'user' | 'model';
  parts: ContentPart[];
}

interface SpriteState {
  name: string;
  x: number;
  y: number;
  size: number;
  direction: number;
  costumes: Array<{ name: string }>;
  sounds: Array<{ name: string }>;
  currentCode?: string;
}

interface StageState {
  width: number;
  height: number;
  costumes: Array<{ name: string }>;
  sounds?: Array<{ name: string }>;
}

interface VmState {
  extensions: string[];
}

interface StateContext {
  sprite?: SpriteState;
  stage?: StageState;
  vm?: VmState;
}

interface RelayRequest {
  userMessage: string;
  history?: HistoryTurn[];
  stateContext?: StateContext;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
const DANGEROUS_PATTERNS = [
  /ignore previous instructions/i,
  /forget everything/i,
  /you are now/i,
  /act as/i,
  /pretend you/i,
  /new persona/i,
  /system prompt/i,
  /jailbreak/i,
];

export function validateStateContext(stateContext?: StateContext): { valid: boolean; error?: string } {
  if (!stateContext) return { valid: true };

  const isInvalidName = (name: string) =>
    name.length > MAX_FIELD_NAME_LENGTH || /[\r\n]/.test(name);

  if (stateContext.sprite) {
    const s = stateContext.sprite;
    if (s.name && isInvalidName(s.name)) {
      return { valid: false, error: 'INVALID_STATE_CONTEXT' };
    }
    for (const c of s.costumes || []) {
      if (c.name && isInvalidName(c.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
    for (const snd of s.sounds || []) {
      if (snd.name && isInvalidName(snd.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
    if (s.currentCode) {
      if (s.currentCode.length > MAX_CURRENT_CODE_LENGTH) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(s.currentCode)) {
          return { valid: false, error: 'INVALID_STATE_CONTEXT' };
        }
      }
    }
  }

  if (stateContext.stage) {
    const st = stateContext.stage;
    for (const c of st.costumes || []) {
      if (c.name && isInvalidName(c.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
    for (const snd of st.sounds || []) {
      if (snd.name && isInvalidName(snd.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
  }

  for (const ext of stateContext.vm?.extensions || []) {
    if (isInvalidName(ext)) {
      return { valid: false, error: 'INVALID_STATE_CONTEXT' };
    }
  }

  return { valid: true };
}

export function validateHistory(history?: HistoryTurn[]): { valid: boolean; error?: string } {
  if (!history) return { valid: true };
  if (history.length > MAX_HISTORY_TURNS) {
    return { valid: false, error: 'HISTORY_TOO_LONG' };
  }
  for (const turn of history) {
    for (const part of turn.parts) {
      if (part.text && part.text.length > MAX_HISTORY_TURN_TEXT_LENGTH) {
        return { valid: false, error: 'HISTORY_TOO_LONG' };
      }
    }
  }
  return { valid: true };
}

export function validateInput(userMessage: string): { valid: boolean; error?: string } {
  if (!userMessage || typeof userMessage !== 'string') {
    return { valid: false, error: 'INPUT_MISSING' };
  }
  if (userMessage.length < MIN_USER_MESSAGE_LENGTH) {
    return { valid: false, error: 'INPUT_TOO_SHORT' };
  }
  if (userMessage.length > MAX_USER_MESSAGE_LENGTH) {
    return { valid: false, error: 'INPUT_TOO_LONG' };
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(userMessage)) {
      return { valid: false, error: 'INVALID_INPUT' };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Rate limiting (DynamoDB fixed window)
// ---------------------------------------------------------------------------
export function getCurrentWindowStart(): number {
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  return Math.floor(Date.now() / windowMs) * windowMs / 1000; // epoch seconds
}

export async function checkAndIncrementRateLimit(sourceIp: string): Promise<{
  allowed: boolean;
  resetAfterSeconds?: number;
}> {
  const windowStart = getCurrentWindowStart();
  const windowDurationSeconds = RATE_LIMIT_WINDOW_MINUTES * 60;
  const ttl = windowStart + windowDurationSeconds;

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: RATE_LIMIT_TABLE_NAME,
      Key: { sourceIp, windowStart },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':ttl': ttl },
      ReturnValues: 'ALL_NEW',
    }));

    const count = result.Attributes?.count as number;
    if (count > RATE_LIMIT_MAX_REQUESTS) {
      const now = Math.floor(Date.now() / 1000);
      const resetAfterSeconds = ttl - now;
      return { allowed: false, resetAfterSeconds: Math.max(0, resetAfterSeconds) };
    }
    return { allowed: true };
  } catch (err) {
    // Fail open: if DynamoDB is unavailable, allow the request
    console.error('[RateLimit] DynamoDB error, failing open:', err);
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// System instruction builder (English for cost efficiency)
// ---------------------------------------------------------------------------
export function buildSystemInstruction(stateContext?: StateContext): string {
  const stateSection = stateContext ? buildStateSection(stateContext) : '';

  return `You are "Smalruby Teacher". Help elementary and middle school students create fun games and animations by generating simple, easy-to-understand Ruby code for Smalruby (smalruby) programming.

## About Smalruby

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

## Code Generation Guidelines

1. **Keep it simple**: Write code that elementary/middle school students can read and understand. Use a single sprite unless the user explicitly asks for multiple sprites.
2. **Make it interactive**: Prioritize code with movement, keyboard control, and coordinate changes.
3. **Comment in Japanese**: Add Japanese comments where helpful
4. **Always start with an event**: Begin programs with \`when_flag_clicked do...end\`
5. **Output code in code blocks (required)**: Always output Ruby code in this format:
   \`\`\`ruby
   (code here)
   \`\`\`
6. **⚠️ One sprite per code block (CRITICAL)**: Each code block must contain code for **exactly one sprite**. When generating multiple sprites, use **separate code blocks** with explanation text between them. The user interface shows an "Insert this code" button for each code block, so the user needs to insert each sprite's code separately.

   ✅ **Correct format (separate code blocks)**:
   プレイヤーのスプライトです。
   \`\`\`ruby
   class Player
     set_sprite "Shimaraby"
     ...
   end
   \`\`\`
   次に、新しいスプライトを追加して、以下のプログラムを入力してください。
   \`\`\`ruby
   class Enemy
     set_sprite "Ghost"
     ...
   end
   \`\`\`

   ❌ **Wrong format (merged code blocks)**:
   \`\`\`ruby
   class Player
     ...
   end
   class Enemy
     ...
   end
   \`\`\`
7. **Add explanation**: Briefly explain the code and how to use it in Japanese. When using multiple sprites, explain which sprite to add the code to.
8. **Use only listed methods**: Only use the methods documented above
9. **Check forbidden methods**: Always check the forbidden methods list before generating
10. **⚠️ Costume/sound names must match current state**: Only use names listed in the "Current State" section

## Important Output Rules

- When asked to create a program, **always generate Ruby code**
- Code block format must start with \`\`\`ruby and end with \`\`\`
- Always include code unless there is a clear reason not to
- **Respond in Japanese** for all explanations and messages

## Complexity Control

- **Default**: Generate simple code using a **single sprite** with basic elements (coordinates, costumes, keyboard input, loops). Use top-level form (without \`class\`) for simplicity.
- **class / set_xxx configuration**: You MAY proactively use \`class Sprite1; set_name "名前"; set_sprite "すてきなスプライト名"; set_x 100; ... end\` when the program benefits from setting initial position, costume, or sprite appearance.
- **Multiple sprites**: Only suggest when the user explicitly requests it (e.g., "2つのスプライトで", "もっと楽しく", "発展的に").
- **def (method definition)**: Only use when the user explicitly asks for methods, refactoring, or code reuse.
- **module / include**: Only use when the user explicitly mentions "module", "include", or "メソッドを共有".
- **super**: Only use when the user explicitly mentions "super" or "オーバーライド".
- **clone / create_clone**: Only use when the user asks for cloning or effects that require duplicates.

## Critical Syntax Warnings

These are the most common mistakes. **Always verify your output against these rules**:

1. **\`self.x =\` NOT \`set_x()\`**: Outside class definitions, always use \`self.x = value\`, \`self.y = value\`, \`self.size = value\`, etc. The \`set_x()\`, \`set_y()\`, \`set_size()\` methods are ONLY valid at class definition top-level.
2. **\`keyboard.pressed?\` NOT \`key_pressed?\`**: Always use \`keyboard.pressed?("key")\`, never \`key_pressed?\` or \`Keyboard.pressed?\`.
3. **\`mouse.x\` NOT \`mouse_x\`**: Always use \`mouse.x\`, \`mouse.y\`, \`mouse.down?\` (lowercase).
4. **\`timer.value\` NOT \`timer\`**: Always use \`timer.value\` and \`timer.reset\` (lowercase).
13. **\`@items.push()\` NOT \`list("@items").push()\`**: Use arrays directly. \`list()\` does not exist.
5. **\`touching?("_mouse_")\` NOT \`touching?("_mouse_pointer_")\`**: The target name is \`"_mouse_"\`, not \`"_mouse_pointer_"\`.
6. **\`glide([x, y], secs: n)\` NOT \`glide(n, x, y)\`**: Coordinates in array, seconds as keyword argument.
7. **\`go_to([x, y])\` NOT \`go_to(x, y)\`**: Coordinates must be in an array.
8. **\`play()\` NOT \`play_sound()\`**: Use \`play("name")\` or \`play_until_done("name")\`.
9. **No \`for\`/\`each\`**: Use \`loop do...end\`, \`N.times do...end\`, \`while...end\`, or \`until...end\`.
10. **No \`puts\`/\`print\`/\`p\`**: Use \`say()\` to display text.
11. **No string interpolation**: \`"Hello \#{name}"\` is NOT supported. Use concatenation: \`"Hello " + name\`.
12. **Loop auto-wait**: Loops automatically wait 1 frame. Do NOT add \`sleep()\` for animation speed. Only use \`sleep()\` for delays ≥ 0.5s.
- If the user asks about something unrelated to Smalruby programming, respond in Japanese: 「それはスモウルビーに関係がないので答えられません」

## Child Safety Guidelines

You are interacting with elementary and middle school students (ages 6-15). Follow these safety rules strictly:

1. **Never ask for or discuss personal information**: Do not ask about the student's name, age, school, address, phone number, email, or any other personally identifiable information. If a student volunteers such information, gently redirect the conversation to programming.
2. **Keep content age-appropriate**: Only discuss topics related to Smalruby programming, games, animations, and creative coding. Avoid mature themes, violence (beyond simple game mechanics like "game over"), horror, or controversial topics.
3. **Be encouraging and supportive**: Use positive, encouraging language. Celebrate the student's ideas and efforts. If their code has issues, explain corrections in a constructive, educational way.
4. **Do not role-play as a human**: You are an AI programming assistant called "Rubytee" (ルビティー). Always maintain this identity. Do not pretend to be a friend, family member, teacher, or any other human role.
5. **Redirect off-topic conversations**: If asked about topics outside of programming (personal advice, homework in other subjects, social situations), politely redirect: 「プログラミングのことを聞いてね！」
6. **No external links or resources**: Do not suggest visiting external websites, downloading software, or accessing resources outside of Smalruby.
7. **Report-worthy content**: If a student's message contains concerning content (self-harm, abuse, bullying), respond with: 「心配なことがあったら、おうちの人や先生に相談してね。」 and redirect to programming.
${stateSection}`;
}

function buildStateSection(stateContext: StateContext): string {
  const parts: string[] = ['\n## Current State\n'];

  if (stateContext.sprite) {
    const s = stateContext.sprite;
    parts.push(`### Currently Editing Sprite: "${s.name}"`);
    parts.push(`- Coordinates: (${s.x}, ${s.y}), Direction: ${s.direction}°, Size: ${s.size}%`);

    const costumeNames = (s.costumes || []).map(c => c.name);
    parts.push(`- Costume list: ${costumeNames.length > 0 ? costumeNames.map(n => `"${n}"`).join(', ') : '(none)'}`);
    parts.push('  - **Only names from this list can be used with switch_costume()**');

    const soundNames = (s.sounds || []).map(s2 => s2.name);
    parts.push(`- Sound list: ${soundNames.length > 0 ? soundNames.map(n => `"${n}"`).join(', ') : '(none — do NOT use play() or play_until_done())'}`);
    if (soundNames.length > 0) {
      parts.push('  - **Only names from this list can be used with play() / play_until_done()**');
    }

    if (s.currentCode) {
      parts.push(`- Current code:\n\`\`\`ruby\n${s.currentCode}\n\`\`\``);
    }
    parts.push('');
  }

  if (stateContext.stage) {
    const st = stateContext.stage;
    parts.push('### Stage');
    parts.push(`- Size: ${st.width}x${st.height}`);

    const stageCostumes = (st.costumes || []).map(c => c.name);
    parts.push(`- Backdrop list: ${stageCostumes.length > 0 ? stageCostumes.map(n => `"${n}"`).join(', ') : '(none)'}`);
    parts.push('  - **Only names from this list can be used with switch_backdrop() / when_backdrop_switches()**');

    if (st.sounds && st.sounds.length > 0) {
      parts.push(`- Stage sound list: ${st.sounds.map(s => `"${s.name}"`).join(', ')}`);
    }
    parts.push('');
  }

  if (stateContext.vm && stateContext.vm.extensions && stateContext.vm.extensions.length > 0) {
    parts.push(`### Active Extensions: ${stateContext.vm.extensions.join(', ')}\n`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------
function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowedOrigin = origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers?.origin;
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Parse body
  let body: RelayRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'INVALID_JSON' }),
    };
  }

  // Validate input
  const validation = validateInput(body.userMessage);
  if (!validation.valid) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: validation.error }),
    };
  }

  // Validate stateContext (prompt injection prevention)
  const stateContextValidation = validateStateContext(body.stateContext);
  if (!stateContextValidation.valid) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: stateContextValidation.error }),
    };
  }

  // Validate history
  const historyValidation = validateHistory(body.history);
  if (!historyValidation.valid) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: historyValidation.error }),
    };
  }

  // Rate limiting by source IP
  const sourceIp = event.requestContext.http.sourceIp || 'unknown';
  const rateLimitResult = await checkAndIncrementRateLimit(sourceIp);
  if (!rateLimitResult.allowed) {
    console.log(`[RateLimit] Blocked: ${sourceIp}, resetAfterSeconds: ${rateLimitResult.resetAfterSeconds}`);
    return {
      statusCode: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        resetAfterSeconds: rateLimitResult.resetAfterSeconds,
      }),
    };
  }

  // Build Claude request
  const systemInstruction = buildSystemInstruction(body.stateContext);

  // Convert history to Claude messages format
  // Input: { role: 'user'|'model', parts: [{ text }] }
  // Claude: { role: 'user'|'assistant', content: string }
  const claudeMessages = (body.history || []).map((turn: HistoryTurn) => ({
    role: turn.role === 'model' ? 'assistant' as const : 'user' as const,
    content: turn.parts[0].text,
  }));
  claudeMessages.push({ role: 'user' as const, content: body.userMessage });

  const claudeRequestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemInstruction,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: claudeMessages,
  };

  // Call Anthropic Claude API
  try {
    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(claudeRequestBody),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error(`[Claude] API error ${claudeResponse.status}: ${errText}`);

      // Map Anthropic error codes to appropriate relay responses
      if (claudeResponse.status === 529) {
        // Anthropic overloaded
        return {
          statusCode: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'AI_OVERLOADED' }),
        };
      }

      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'AI_API_ERROR', status: claudeResponse.status }),
      };
    }

    const claudeData = await claudeResponse.json() as {
      content: Array<{ type: string; text: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };

    const responseText = claudeData.content?.[0]?.text || '';
    const outputTokens = claudeData.usage?.output_tokens || 0;
    const inputTokens = claudeData.usage?.input_tokens || 0;
    const cacheCreationTokens = claudeData.usage?.cache_creation_input_tokens || 0;
    const cacheReadTokens = claudeData.usage?.cache_read_input_tokens || 0;

    // Log token usage to CloudWatch (omit sourceIp in prod for cost/privacy)
    const logData: Record<string, unknown> = {
      event: 'rubytee_response',
      model: CLAUDE_MODEL,
      outputTokens,
      inputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      userMessageLength: body.userMessage.length,
    };
    if (process.env.STAGE !== 'prod') {
      logData.sourceIp = sourceIp;
    }
    console.log(JSON.stringify(logData));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: responseText, outputTokens }),
    };
  } catch (err) {
    console.error('[Claude] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'INTERNAL_ERROR' }),
    };
  }
};
