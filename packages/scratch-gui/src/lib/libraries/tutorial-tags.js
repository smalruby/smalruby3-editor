import messages from './tag-messages.js';

export const CATEGORIES = {
    gettingStarted: 'gettingStarted',
    // Mesh tutorial series — split from the former single `chatApp` category
    // into three numbered "通信入門" steps so that the sequential nature is
    // visible in the tutorial library (see docs/tutorial/improvement-plan.md
    // Phase 1).
    meshStep1: 'meshStep1', // 通信入門 ① メッセージを送ってみよう
    meshStep2: 'meshStep2', // 通信入門 ② ふたりで会話しよう
    meshStep3: 'meshStep3'  // 通信入門 ③ みんなで会話しよう (メッシュ)
};

export default [
    {tag: 'ruby', intlLabel: messages.ruby},
    {tag: 'mesh', intlLabel: messages.mesh}
];
