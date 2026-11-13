// レッスン表を「いまのレッスン」を見せて開く（#1520）。「できた！」の「次のチャレンジ」と、
// 課題バーの「ほかのチャレンジへ」が同じ動きをするので、ここにまとめる。
import { focusLessonsLibrary, setLibraryAssignmentOnly } from '../../reducers/lesson-mode';
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

/**
 * レッスン表を、クラスの課題のチャレンジだけで開く（「はじめる」「レッスンを続ける」・#1599）。
 * 次にやる課題のチャレンジに「次はこれ！」を付ける（決め方は assignment-progress.js の
 * assignmentLibraryFocus）。
 * @param {Function} dispatch - Redux の dispatch。
 * @param {?string} [challengeId] - いまのチャレンジ id（この次からさがす）。null なら先頭から。
 */
export const openAssignmentLessonsLibrary = (dispatch, challengeId = null) => {
    dispatch(setLibraryAssignmentOnly(true));
    openLessonsLibraryAt(dispatch, challengeId);
};
