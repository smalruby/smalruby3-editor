import messages from './tag-messages.js';

// The key order here drives the category display order in the tutorial
// library (library.jsx sorts sections by `Object.values(CATEGORIES)`).
// Intended order: gettingStarted -> Block 4 series -> rubyBasics -> Mesh 3
// steps -> (DNCL, added in Phase 4). See docs/tutorial/improvement-plan.md.
export const CATEGORIES = {
    gettingStarted: 'gettingStarted',
    // Phase 3: Block-axis series (教科ラベル型). These two categories are the
    // common foundation shared by the follow-up Block decks (#680); each is a
    // book-excerpt "試食" tutorial (see book-promo.jsx). Only chapters 1 and 4
    // are covered because the source book PDFs were provided for those chapters
    // only (ch5/ch6 dropped — no source; see #962).
    blockBasics: 'blockBasics', // 第1章 はじめての操作
    blockGames: 'blockGames', // 第4章 ゲームを作ろう
    // Phase 2: Ruby basics — TryRuby-inspired, puts-centric series
    rubyBasics: 'rubyBasics', // Ruby のきほん
    // Mesh tutorial series — split from the former single `chatApp` category
    // into three numbered "通信入門" steps so that the sequential nature is
    // visible in the tutorial library (see docs/tutorial/improvement-plan.md
    // Phase 1).
    meshStep1: 'meshStep1', // 通信入門 ① メッセージを送ってみよう
    meshStep2: 'meshStep2', // 通信入門 ② ふたりで会話しよう
    meshStep3: 'meshStep3' // 通信入門 ③ みんなで会話しよう (メッシュ)
};

export default [
    {tag: 'ruby', intlLabel: messages.ruby},
    {tag: 'mesh', intlLabel: messages.mesh}
];
