// レッスン表を「いまのレッスン」を見せて開く（#1520）。「できた！」の「次のチャレンジ」と、
// 課題バーの「ほかのチャレンジへ」が同じ動きをするので、ここにまとめる。
import { focusLessonsLibrary } from '../../reducers/lesson-mode';
import { openLessonsLibrary } from '../../reducers/modals';

/**
 * レッスン表を開き、`challengeId` のレッスンへスクロールして、次のまだできていない
 * チャレンジを目立たせる（見せ方は lesson-progress.js の lessonsLibraryFocus）。
 * @param {Function} dispatch - Redux の dispatch。
 * @param {?string} challengeId - いまのチャレンジ id。null ならふつうに開く。
 */
export const openLessonsLibraryAt = (dispatch, challengeId) => {
    if (challengeId) dispatch(focusLessonsLibrary(challengeId));
    dispatch(openLessonsLibrary());
};
