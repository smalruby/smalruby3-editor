// meshInputValidation - クライアントから受け取る ID・グループ名・イベントの payload の入力上限 (issue #1267 / #1846)
//
// APPSYNC_JS は Function 間でモジュールを import できないため、このファイルは単独では
// デプロイしない。CDK（lib/appsync-code.ts の withMeshInputValidation）が、検査を使う
// Function のソースの末尾にこの本文を連結する（関数宣言は巻き上げられるので末尾で良い）。
// そのため import / export を書かないこと。
//
// サーバーは長さと使える文字の上限だけを持つ。グループ名・payload の中身（`|host=` などの書式）は
// クライアント間の約束なので検査しない。
// 同じ上限を Ruby Lambda 側（lambda/domain/mesh_input.rb）にも持つ。対で更新すること。

// 今のクライアントの ID は 32 桁の 16 進（+ 任意で `s<2〜3 桁>`）。余裕を持たせ、
// 旧形式・テストのハイフン入り ID も通す。`#` / `|` などキー区切りに使う文字は通さない。
const MESH_ID_MAX_LENGTH = 128;

// クライアントは 512 文字以内で作る。余裕を持って 2 倍。
const MESH_GROUP_NAME_MAX_LENGTH = 1024;

// イベントの payload の上限（GUI の上限と同じ 1000 文字。issue #1846）。
// 費用と悪用を防ぐため、GUI だけでなくサーバーでも守る。payload が無い（null）イベントは検査しない。
const MESH_PAYLOAD_MAX_LENGTH = 1000;

// APPSYNC_JS は正規表現リテラルを受け付けない（デプロイ時に "The code contains one or more
// errors" で失敗する）。文字の判定は for...of と文字列の比較で書く。

// A-Z a-z 0-9 _ - だけか
function meshIdHasOnlyAllowedChars(text) {
  for (const ch of text) {
    const allowed =
      (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '_' || ch === '-';
    if (!allowed) return false;
  }
  return true;
}

// 制御文字（U+0000〜U+001F, U+007F）を含むか
function meshHasControlChar(text) {
  for (const ch of text) {
    if (ch < ' ' || ch === '\u007f') return true;
  }
  return false;
}

function meshIdError(field, value) {
  if (value === undefined || value === null || `${value}` === '') {
    return `${field} is required`;
  }
  const text = `${value}`;
  if (text.length > MESH_ID_MAX_LENGTH) {
    return `${field} must be ${MESH_ID_MAX_LENGTH} characters or less`;
  }
  if (!meshIdHasOnlyAllowedChars(text)) {
    return `${field} contains invalid characters (allowed: A-Z a-z 0-9 _ -)`;
  }
  return null;
}

function meshGroupNameError(field, value) {
  if (value === undefined || value === null || `${value}` === '') {
    return `${field} is required`;
  }
  const text = `${value}`;
  if (text.length > MESH_GROUP_NAME_MAX_LENGTH) {
    return `${field} must be ${MESH_GROUP_NAME_MAX_LENGTH} characters or less`;
  }
  if (meshHasControlChar(text)) {
    return `${field} contains control characters`;
  }
  return null;
}

// 文字数（コードポイント単位）。Ruby の String#length と同じ数え方にして、
// 絵文字などのサロゲートペアで JS（fireEventsByNode）と Ruby（recordEventsByNode）の判定がずれないようにする。
function meshCharCount(text) {
  let count = 0;
  for (const ch of text) {
    // ch は常に 1 文字以上（未使用の変数を残さないため条件に使う）
    if (ch !== '') count += 1;
  }
  return count;
}

// APPSYNC_JS は `for (;;)` と `continue` を受け付けないので、for...of と if で書く。
function meshEventsError(events) {
  if (!Array.isArray(events)) return null;
  let index = 0;
  for (const event of events) {
    const payload = event ? event.payload : null;
    if (payload !== undefined && payload !== null && meshCharCount(`${payload}`) > MESH_PAYLOAD_MAX_LENGTH) {
      return `events[${index}].payload must be ${MESH_PAYLOAD_MAX_LENGTH} characters or less`;
    }
    index += 1;
  }
  return null;
}

// ctx.args にある name / hostId / nodeId / events を検査し、最初のエラーメッセージを返す（無ければ null）。
// 引数に無いフィールドは検査しない（mutation ごとに受け取るフィールドが違うため）。
function meshInputError(args) {
  if (args.name !== undefined) {
    const nameError = meshGroupNameError('name', args.name);
    if (nameError) return nameError;
  }
  if (args.hostId !== undefined) {
    const hostIdError = meshIdError('hostId', args.hostId);
    if (hostIdError) return hostIdError;
  }
  if (args.nodeId !== undefined) {
    const nodeIdError = meshIdError('nodeId', args.nodeId);
    if (nodeIdError) return nodeIdError;
  }
  if (args.events !== undefined) {
    const eventsError = meshEventsError(args.events);
    if (eventsError) return eventsError;
  }
  return null;
}
