import messages from './tag-messages.js';

export const CATEGORIES = {
    gettingStarted: 'gettingStarted',
    // Mesh tutorial series — split from the former single `chatApp` category
    // into three story-themed steps so that the progression is visible in the
    // tutorial library (see docs/tutorial/improvement-plan.md Phase 1).
    meshStep1: 'meshStep1', // メッセージを送ってみよう
    meshStep2: 'meshStep2', // ふたりで会話しよう
    meshStep3: 'meshStep3'  // みんなで会話しよう
};

export default [
    {tag: 'ruby', intlLabel: messages.ruby},
    {tag: 'mesh', intlLabel: messages.mesh}
];
