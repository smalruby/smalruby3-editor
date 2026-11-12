// チャレンジを開くときの準備（deck-setup と同じ形の setup を作る）。
// コースの言語からタブと Ruby モードの既定を決め、チャレンジの setup で上書きする。
import { LANGUAGES } from './courses';

// 言語ごとの既定。ブロックのコースはコードタブ、Ruby / DNCL のコースは Ruby タブで始める
const DEFAULT_SETUP_BY_LANGUAGE = {
    [LANGUAGES.BLOCKS]: { tab: 'code' },
    [LANGUAGES.RUBY]: { tab: 'ruby', rubyMode: 'ruby' },
    [LANGUAGES.DNCL]: { tab: 'ruby', rubyMode: 'dncl' },
};

/**
 * チャレンジに適用する setup（`lib/deck-setup.js` の applyDeckSetup に渡す形）。
 * @param {object} course - チャレンジが入っているコース（`language` を見る）。
 * @param {object} challenge - チャレンジ（`setup` は null でもよい）。
 * @returns {object} タブ・Ruby モード・拡張機能などの setup。
 */
export const setupForChallenge = (course, challenge) => ({
    ...(DEFAULT_SETUP_BY_LANGUAGE[course.language] || {}),
    ...(challenge.setup || {}),
});
