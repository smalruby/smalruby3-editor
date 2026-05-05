/**
 * Blockly v12 / scratch-blocks v2 移行後、Smalruby 固有コードが Blockly の
 * trailing-underscore (private) フィールドや currentGesture_ 等のプライベート
 * 内部 API に新たに依存していないかを検出する単体テスト。
 *
 * upstream merge のたびに private フィールドはリネーム/削除されうるので、
 * 新しい private アクセスが入り込んだら CI で検知して migrate する。既知で
 * 公開 API が無いアクセスは ALLOWLIST に登録する。
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');

// Blockly オブジェクト名と思われる識別子の prefix。フィールドアクセスチェーン
// の根本に来る変数名のうち、Blockly インスタンスを持ちうるものを列挙する。
const BLOCKLY_OBJECTS = [
    'workspace',
    'mainWorkspace',
    'flyout',
    'toolbox',
    'block',
    'field',
    'gesture',
    'ScratchBlocks',
    'Blockly',
];

// `<obj>.<name>_` (末尾アンダースコア) を検出する正規表現。
// `__` (Symbol.iterator 等) や `_$` などの誤検出を避ける。
const PRIVATE_ACCESS_REGEX = new RegExp(
    `\\b(?:${BLOCKLY_OBJECTS.join('|')})\\b(?:\\.[A-Za-z_$][\\w$]*)*\\.[a-zA-Z][\\w$]*_(?=[^\\w_]|$)`,
    'g',
);

// 既知の private アクセス。Blockly v12 で公開 API が無いか、移行コストが
// 大きすぎる箇所のみを許可する。新規追加時は理由を必ず明記すること。
const ALLOWLIST = [
    {
        // blocks-gesture-recovery.js: pointerdown 中の "drag in progress" を
        // 検出する公開 API が v12 にも無い。WorkspaceSvg.cancelCurrentGesture()
        // は cancel 用の公開 API として使えるが、状態取得は private のまま。
        file: 'src/lib/blocks-gesture-recovery.js',
        match: 'workspace?.currentGesture_',
        reason: 'Blockly v12 に「現在 gesture が drag 中か」を取る公開 API が無い',
    },
    {
        // blocks.jsx (palette toggle): flyout.hide() は isVisible_ しか
        // 切り替えないため、workspace.setVisible(true) で containerVisible_
        // が true に戻ると flyout が再表示される。SVG group の display を
        // 直接いじって確実に隠す必要がある。
        file: 'src/containers/blocks.jsx',
        match: 'flyout.svgGroup_',
        reason: 'flyout.hide() の単独使用では workspace.setVisible(true) 後に再表示されてしまう。SVG group display 直接操作が必要',
    },
    {
        // blocks.jsx: scratch-blocks の color picker eyedropper コールバックを
        // 上書きする upstream パターン。private 命名だが拡張ポイントとして
        // 利用される慣習。upstream Scratch も同様に上書きしている。
        file: 'src/containers/blocks.jsx',
        match: 'ScratchBlocks.FieldColourSlider.activateEyedropper_',
        reason: 'scratch-blocks の eyedropper 拡張ポイント (upstream Scratch も同様に利用)',
    },
    {
        // blocks.js: scratch-blocks の音符フィールド再生コールバックを
        // 上書きする upstream パターン。private 命名だが拡張ポイント。
        file: 'src/lib/blocks.js',
        match: 'ScratchBlocks.FieldNote.playNote_',
        reason: 'scratch-blocks の音符再生コールバック拡張ポイント (upstream Scratch も同様に利用)',
    },
];

/**
 * Smalruby 関連の JS/JSX ファイルを再帰的に走査する。
 * @param {string} dir 探索開始ディレクトリ
 * @returns {string[]} 絶対パスのリスト
 */
const collectSourceFiles = (dir) => {
    const out = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectSourceFiles(full));
        } else if (/\.(?:jsx?|tsx?)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

/**
 * ファイルから private アクセスを抽出する。
 * @param {string} filePath ファイルパス
 * @returns {Array<{match: string, line: number}>} 検出結果
 */
const findPrivateAccesses = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 行コメント / ブロックコメント開始行は除外 (allowlist の説明文に
        // 書いた識別子を誤検出しないため)
        if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
        const matches = line.matchAll(PRIVATE_ACCESS_REGEX);
        for (const m of matches) {
            results.push({ match: m[0], line: i + 1 });
        }
    }
    return results;
};

describe('Blockly v12 private API 自動検出', () => {
    test('Smalruby 固有コードに新規の private アクセスが入っていない', () => {
        const files = collectSourceFiles(SRC);
        const violations = [];

        for (const filePath of files) {
            const accesses = findPrivateAccesses(filePath);
            const relPath = path.relative(ROOT, filePath);
            for (const { match, line } of accesses) {
                const allowed = ALLOWLIST.find((entry) => entry.file === relPath && match.includes(entry.match));
                if (!allowed) {
                    violations.push(`${relPath}:${line} → ${match}`);
                }
            }
        }

        if (violations.length > 0) {
            const msg = [
                'Blockly の trailing-underscore (private) フィールドへの新規アクセスを検出しました。',
                '公開 API への移行を検討するか、移行不可能な場合は',
                'test/unit/lib/blockly-private-api.test.js の ALLOWLIST に理由付きで追加してください。',
                '',
                '検出箇所:',
                ...violations.map((v) => `  - ${v}`),
            ].join('\n');
            throw new Error(msg);
        }
    });

    test('ALLOWLIST のすべてのエントリが現在もファイル内に存在する (stale entry の検出)', () => {
        const stale = [];
        for (const entry of ALLOWLIST) {
            const fullPath = path.join(ROOT, entry.file);
            if (!fs.existsSync(fullPath)) {
                stale.push(`${entry.file} は存在しない`);
                continue;
            }
            const content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes(entry.match)) {
                stale.push(`${entry.file} に "${entry.match}" が見つからない`);
            }
        }
        if (stale.length > 0) {
            throw new Error(
                ['ALLOWLIST に古いエントリが残っています。削除してください:', ...stale.map((s) => `  - ${s}`)].join(
                    '\n',
                ),
            );
        }
    });
});
