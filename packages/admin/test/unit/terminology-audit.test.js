/**
 * 用語監査ガード (#1131).
 *
 * Admin の操作対象は 2 階層に分かれる（用語辞典: docs/admin/README.md）:
 * クラス（学級）= ClassroomGroups / groupId、課題（1授業）= Classrooms / classroomId。
 * 課題を「クラス」と呼ぶ文言が復活すると、運用者が「先生の画面に戻った」と
 * 誤読する（EPIC #1129 の発端になった実際の事故）。個々の画面のテストに加えて、
 * ソース全体をパターンで見張り、新しい画面で同じ揺れが再発しないようにする。
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

// 「課題を指しているのに クラス と名乗る」既知の揺れと、代わりに使う語。
const BANNED = [
    {pattern: /このクラスを(アーカイブ|利用中|復元)/, use: 'この課題を〜'},
    {pattern: /このクラスは(まだ)?存在/, use: 'この課題は…'},
    {pattern: /削除済みクラス/, use: '削除済み課題'},
    {pattern: /クラス総数/, use: '課題総数'},
    // 「組」「学級」「クラスルーム」は用語辞典で不採用（クラス（学級）に統一）。
    {pattern: /クラスルーム/, use: 'クラス（学級）'},
    {pattern: /組も復元/, use: 'クラス（学級）も復元'}
];

const collectFiles = dir =>
    fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? collectFiles(full) : [full];
    });

describe('admin terminology audit (#1131)', () => {
    test.each(BANNED)('課題を指す文言に $pattern を使わない', ({pattern, use}) => {
        const offenders = collectFiles(SRC_DIR)
            .filter(file => pattern.test(fs.readFileSync(file, 'utf8')))
            .map(file => path.relative(SRC_DIR, file));
        expect({pattern: String(pattern), use, offenders}).toEqual({
            pattern: String(pattern), use, offenders: []
        });
    });
});
