/* eslint-disable no-console */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Configuration (from environment variables)
// ---------------------------------------------------------------------------
const RATE_LIMIT_TABLE_NAME = process.env.RATE_LIMIT_TABLE_NAME || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const RATE_LIMIT_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '35', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '40', 10);
const MAX_USER_MESSAGE_LENGTH = parseInt(process.env.MAX_USER_MESSAGE_LENGTH || '250', 10);
const MIN_USER_MESSAGE_LENGTH = parseInt(process.env.MIN_USER_MESSAGE_LENGTH || '10', 10);
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'https://smalruby.app').split(',').map(o => o.trim());
const MAX_FIELD_NAME_LENGTH = 100;       // sprite/costume/sound names
const MAX_CURRENT_CODE_LENGTH = 1000;    // currentCode in stateContext
const MAX_HISTORY_TURNS = 20;            // conversation turns
const MAX_HISTORY_TURN_TEXT_LENGTH = 1000; // chars per history turn

// Gemini model
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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
- No module definitions
- Loops use \`loop do...end\` or \`N.times do...end\` (no while/for/each)
- Conditionals: \`if\`, \`unless\`, \`case/when\`, \`until\`
- Variables: instance (\`@score\`), global (\`$score\`), local (\`score\`)
- String interpolation (\`"#{var}"\`) is NOT supported
- \`require\`, \`puts\`/\`print\`/\`p\`, exception handling (\`begin/rescue\`) are NOT supported
- Compound assignment operators \`+=\`, \`-=\`, \`*=\`, \`/=\`, \`%=\` ARE supported
- \`+=\` increments numeric variables, concatenates string variables
- Recursion is NOT supported

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
- \`stop("all")\` — stop all ("all", "this script", "other scripts in sprite")
- \`create_clone("_myself_")\` — create clone
- \`delete_this_clone\`
- \`when_start_as_a_clone do...end\`

⚠️ **Loop auto-wait (critical)**: \`loop do...end\`, \`N.times do...end\`, and \`until...end\` automatically wait 1 frame (~33ms, 30fps) at each iteration end. Do NOT add sleep() for animation speed control. Only use sleep() for explicit long waits (0.5s or more).

### Sensing
- \`touching?("target")\` — touching? ("_mouse_", "_edge_", sprite name)
- \`touching_color?("#rrggbb")\`
- \`distance("_mouse_")\`
- \`ask("question")\` / \`answer\`
- \`Keyboard.pressed?("key")\`
- \`Mouse.down?\` / \`Mouse.x\` / \`Mouse.y\`
- \`Timer.value\` / \`Timer.reset\`
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
- ❌ \`mouse_x\`, \`mouse_y\` → ✅ \`Mouse.x\`, \`Mouse.y\`
- ❌ \`mouse_down?\` → ✅ \`Mouse.down?\`
- ❌ \`key_pressed?()\` → ✅ \`Keyboard.pressed?()\`
- ❌ \`timer\`, \`reset_timer\` → ✅ \`Timer.value\`, \`Timer.reset\`
- ❌ \`touching?("_mouse_pointer_")\` → ✅ \`touching?("_mouse_")\`
- ❌ \`play_sound()\`, \`stop_sounds\` → ✅ \`play()\`, \`stop_all_sounds\`
- ❌ \`clear_effects\` → ✅ \`clear_graphic_effects\`
- ❌ \`glide(secs, x, y)\` → ✅ \`glide([x, y], secs: n)\`
- ❌ \`go_to(x, y)\` → ✅ \`go_to([x, y])\`
- ❌ \`while\`, \`for\`, \`each\` → ✅ \`loop do...end\`, \`N.times do...end\`, \`until...end\`
- ❌ \`sleep(0.05)\`, \`sleep(0.1)\` for animation FPS → ✅ loops auto-wait; only use sleep() for 0.5s+ delays
- ❌ \`puts\`, \`print\`, \`p\` → ✅ \`say()\`
- ❌ \`when_backdrop_changes()\` → ✅ \`when_backdrop_switches()\`

## Sample Programs

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

## Code Generation Guidelines

1. **Keep it simple**: Write code that elementary/middle school students can read and understand
2. **Make it interactive**: Prioritize code with movement and interaction
3. **Comment in Japanese**: Add Japanese comments where helpful
4. **Always start with an event**: Begin programs with \`when_flag_clicked do...end\`
5. **Output code in code blocks (required)**: Always output Ruby code in this format:
   \`\`\`ruby
   (code here)
   \`\`\`
6. **Add explanation**: Briefly explain the code and how to use it in Japanese
7. **Use only listed methods**: Only use the methods documented above
8. **Check forbidden methods**: Always check the forbidden methods list before generating
9. **⚠️ Costume/sound names must match current state**: Only use names listed in the "Current State" section

## Important Output Rules

- When asked to create a program, **always generate Ruby code**
- Code block format must start with \`\`\`ruby and end with \`\`\`
- Always include code unless there is a clear reason not to
- **Respond in Japanese** for all explanations and messages
- If the user asks about something unrelated to Smalruby programming, respond in Japanese: 「それはスモウルビーに関係がないので答えられません」
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

  // Build Gemini request
  const systemInstruction = buildSystemInstruction(body.stateContext);
  const newUserTurn: HistoryTurn = {
    role: 'user',
    parts: [{ text: body.userMessage }],
  };
  const contents = [...(body.history || []), newUserTurn];

  const geminiRequestBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
    },
  };

  // Call Gemini API
  const geminiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(`[Gemini] API error ${geminiResponse.status}: ${errText}`);
      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'GEMINI_API_ERROR', status: geminiResponse.status }),
      };
    }

    const geminiData = await geminiResponse.json() as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const outputTokens = geminiData.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = geminiData.usageMetadata?.totalTokenCount || 0;

    // Log token usage to CloudWatch (omit sourceIp in prod for cost/privacy)
    const logData: Record<string, unknown> = {
      event: 'gemini_response',
      outputTokens,
      totalTokens,
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
    console.error('[Gemini] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'INTERNAL_ERROR' }),
    };
  }
};
