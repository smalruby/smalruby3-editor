// ヒントのスポットライト（周りを暗くして指す場所を照らす）を見せたチャレンジの記録。
// 「はじめて開いたチャレンジ」のときだけ照らし、2 回目からは吹き出しだけにするための
// キーで、できたチャレンジの記録（lesson-progress.js）とは別に持つ（記録は「できた」だけを
// 持つ、と決めたため）。
//
// 保存の形: { "<challengeId>": "<ISO 日時>" }

export const SPOTLIGHT_SEEN_STORAGE_KEY = 'smalruby:lessonSpotlightSeen';

const defaultStorage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
        // localStorage の参照自体が例外になるブラウザ設定がある
        return null;
    }
};

const load = (storage) => {
    if (!storage) return {};
    try {
        const parsed = JSON.parse(storage.getItem(SPOTLIGHT_SEEN_STORAGE_KEY));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
        return {};
    }
};

/**
 * そのチャレンジでスポットライトを見せたことがあるか。読めないときは false（照らす側に倒す）。
 * @param {string} challengeId - チャレンジ id。
 * @param {?Storage} [storage] - 読む先（既定は window.localStorage）。
 * @returns {boolean} 見せたことがあれば true。
 */
export const isSpotlightSeen = (challengeId, storage = defaultStorage()) =>
    typeof load(storage)[challengeId] === 'string';

/**
 * そのチャレンジでスポットライトを見せたと記録する。書けないとき（容量・プライベートモード）も落とさない。
 * @param {string} challengeId - チャレンジ id。
 * @param {?Storage} [storage] - 書く先（既定は window.localStorage）。
 * @param {string} [seenAt] - 見せた日時（ISO）。
 * @returns {boolean} 書けたら true。
 */
export const markSpotlightSeen = (challengeId, storage = defaultStorage(), seenAt = new Date().toISOString()) => {
    if (!storage) return false;
    try {
        const seen = load(storage);
        if (typeof seen[challengeId] === 'string') return true;
        storage.setItem(SPOTLIGHT_SEEN_STORAGE_KEY, JSON.stringify({ ...seen, [challengeId]: seenAt }));
        return true;
    } catch (e) {
        return false;
    }
};
