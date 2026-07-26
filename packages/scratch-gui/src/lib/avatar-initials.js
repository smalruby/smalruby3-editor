/**
 * メールアドレスからアバター用イニシャルを作る（お知らせ通知センター #1111 の
 * アバターメニュー）。
 *
 * - `kouji@example.com`            → `K`
 * - `kouji.takao@example.com`      → `KT`
 * - `kouji.takao.xxx@example.com`  → `KT`（ローカル部の先頭 2 セグメント）
 *
 * ドット区切りのローカル部を姓名とみなし、先頭 2 セグメントの頭文字を採る。
 * 1 セグメントなら 1 文字。判定不能なら `?`。
 * @param {string} email - メールアドレス（null/不正でも安全）
 * @returns {string} 1〜2 文字のイニシャル（大文字）
 */
const initialsFromEmail = (email) => {
    if (typeof email !== 'string' || email.indexOf('@') < 1) return '?';
    const local = email.slice(0, email.indexOf('@'));
    const segments = local.split('.').filter((s) => s.length > 0);
    if (segments.length === 0) return '?';
    const first = segments[0][0];
    if (segments.length >= 2) {
        return (first + segments[1][0]).toUpperCase();
    }
    return first.toUpperCase();
};

export { initialsFromEmail };
export default initialsFromEmail;
