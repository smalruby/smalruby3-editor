/**
 * メールアドレスからアバター用イニシャルを作る（#1111 レビュー）。
 * scratch-gui 側 (src/lib/avatar-initials.js) と同じ仕様の複製
 * （別アプリのため共有できない。仕様変更時は両方を更新する）。
 *
 * - `kouji@example.com`            → `K`
 * - `kouji.takao@example.com`      → `KT`
 * - `kouji.takao.xxx@example.com`  → `KT`
 * @param {string} email - メールアドレス（null/不正でも安全）
 * @returns {string} 1〜2 文字のイニシャル（大文字）
 */
const initialsFromEmail = email => {
    if (typeof email !== 'string' || email.indexOf('@') < 1) return '?';
    const local = email.slice(0, email.indexOf('@'));
    const segments = local.split('.').filter(s => s.length > 0);
    if (segments.length === 0) return '?';
    const first = segments[0][0];
    if (segments.length >= 2) {
        return (first + segments[1][0]).toUpperCase();
    }
    return first.toUpperCase();
};

export {initialsFromEmail};
export default initialsFromEmail;
