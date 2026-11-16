// === Smalruby: This file is Smalruby-specific (localized names of the library sprites) ===
// ライブラリのスプライトのうち、名前を言語ごとに変えるもの（コース「チャットをつくろう」のキャラクター）。
// ライブラリ（sprites.json）の名前は英語の 1 つだけなので、作品に足すとき（チャレンジの始め方・
// 「プログラムを入れる」・「スプライトを選ぶ」）に、いまの言語の名前を付ける。
// 作品の中の名前は足したときの言語で決まるので（日本語で作った作品を英語の UI で開く、など）、名前で
// スプライトを探すときは、どの言語の名前でも見つける（`isSpriteNamed`）。

/** ライブラリの名前 → 言語ごとの名前。書いていない言語は、ライブラリの名前のまま。 */
export const LOCALIZED_SPRITE_NAMES = Object.freeze({
    Shimaraby: Object.freeze({ ja: 'シマラビ', 'ja-Hira': 'シマラビ', en: 'Shimaraby' }),
    Shimacat: Object.freeze({ ja: 'シマネコ', 'ja-Hira': 'シマネコ', en: 'Shimacat' }),
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * 作品に足すときの名前。
 * @param {string} name - ライブラリのスプライトの名前（例: `Shimaraby`）。
 * @param {?string} locale - いまの言語（例: `ja` / `ja-Hira` / `en`）。無ければライブラリの名前のまま。
 * @returns {string} 足すときの名前。
 */
export const localSpriteName = (name, locale) => {
    const names = hasOwn(LOCALIZED_SPRITE_NAMES, name) ? LOCALIZED_SPRITE_NAMES[name] : null;
    if (!names || !locale || !hasOwn(names, locale)) return name;
    return names[locale];
};

/**
 * そのスプライトの名前になりうるもの（ライブラリの名前と、どの言語の名前も）。
 * @param {string} name - ライブラリのスプライトの名前。
 * @returns {Array<string>} 名前（重ならない）。
 */
export const spriteNameAliases = (name) => {
    const names = hasOwn(LOCALIZED_SPRITE_NAMES, name) ? Object.values(LOCALIZED_SPRITE_NAMES[name]) : [];
    return [...new Set([name, ...names])];
};

/**
 * 作品の中のスプライトの名前が、ライブラリのスプライト `name` のどれかの言語の名前か。
 * @param {string} actual - 作品の中のスプライトの名前。
 * @param {string} name - ライブラリのスプライトの名前。
 * @returns {boolean} そうなら true。
 */
export const isSpriteNamed = (actual, name) => spriteNameAliases(name).includes(actual);

/**
 * 「スプライトを選ぶ」のライブラリの項目の名前を、いまの言語の名前にする（一覧の名前・検索・足したスプライトの
 * 名前がそろう）。名前を変えない項目はそのまま返す。
 * @param {Array<object>} library - スプライトのライブラリ（sprites.json の形）。
 * @param {?string} locale - いまの言語。
 * @returns {Array<object>} ライブラリ。
 */
export const localizeLibrarySprites = (library, locale) =>
    library.map((item) => {
        if (!item || typeof item.name !== 'string') return item;
        const localName = localSpriteName(item.name, locale);
        return localName === item.name ? item : { ...item, name: localName };
    });
