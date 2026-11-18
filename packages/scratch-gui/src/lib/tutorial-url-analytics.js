// `?tutorial=<id>` で開いたのに、その id のチュートリアルが無かったときの GA 計測。
//
// チュートリアルを上流（Scratch）のものに戻したので、スモウルビー独自のチュートリアル
// （`?tutorial=chat1Basic1` など）へのリンクは開かなくなった。こうしたリンクが実際に
// 使われているかを数で確かめてから、つなぎかえるかどうかを決める（docs/tutorial/README.md）。
//
// - 送る id は、前にスモウルビーにあったチュートリアルの id（下の決めた一覧）だけ。
//   一覧に無い値は、入力した文字かもしれないので 'unknown' にする。
// - 項目は action と label だけ（category の中でいつも同じ）。
// - 計測の失敗は握りつぶし、エディタの起動を止めない。
import analytics from './analytics';

const TUTORIAL_URL_CATEGORY = 'tutorial_url';
const TUTORIAL_URL_NOT_FOUND = 'not_found';
const UNKNOWN_TUTORIAL_ID = 'unknown';

// 上流に戻す前に、スモウルビーのチュートリアルが持っていた urlId（`?tutorial=` の値）。
const OLD_SMALRUBY_TUTORIAL_IDS = Object.freeze([
    'chat1Basic1',
    'chat1Basic2',
    'chat1Basic3',
    'chat2Sprites1',
    'chat2Sprites2',
    'chat2Sprites3',
    'chat3Mesh1',
    'chat3Mesh2',
    'chat3Mesh3',
    'gettingStartedCostume',
    'gettingStartedSprites',
    'rubyBasics1Numbers',
    'rubyBasics2Strings',
    'rubyBasics3Variables',
    'rubyBasics4Arrays',
    'rubyBasics5Blocks',
    'rubyBasics6Methods',
    'rubyBasics7Next',
]);

/**
 * 見つからなかったチュートリアルの id から、送るイベントを作る。
 * @param {*} tutorialId - `?tutorial=` の値。
 * @returns {{category: string, action: string, label: string}} 送るイベント。
 */
const tutorialUrlNotFoundEvent = (tutorialId) => ({
    category: TUTORIAL_URL_CATEGORY,
    action: TUTORIAL_URL_NOT_FOUND,
    label:
        typeof tutorialId === 'string' && OLD_SMALRUBY_TUTORIAL_IDS.includes(tutorialId)
            ? tutorialId
            : UNKNOWN_TUTORIAL_ID,
});

/**
 * 見つからなかったチュートリアルの id を GA に送る（失敗は握りつぶす）。
 * @param {*} tutorialId - `?tutorial=` の値。
 */
const reportTutorialUrlNotFound = (tutorialId) => {
    try {
        analytics.event(tutorialUrlNotFoundEvent(tutorialId));
    } catch (_e) {
        // 計測できなくても、エディタは開く
    }
};

export {
    OLD_SMALRUBY_TUTORIAL_IDS,
    TUTORIAL_URL_CATEGORY,
    UNKNOWN_TUTORIAL_ID,
    reportTutorialUrlNotFound,
    tutorialUrlNotFoundEvent,
};
