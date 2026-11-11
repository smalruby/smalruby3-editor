import { openChallenge } from '../../../src/reducers/lesson-mode';
import reducer, { markTutorialSeen, tutorialOnboardingInitialState } from '../../../src/reducers/tutorial-onboarding';

const firstTime = { tutorialSeen: false, rubyTabUsed: false, tooltipDismissed: false };

describe('tutorialOnboarding reducer', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('initial state comes from localStorage', () => {
        expect(tutorialOnboardingInitialState).toEqual(firstTime);
    });

    test('opening the lessons library marks the tutorial as seen', () => {
        const state = reducer(firstTime, markTutorialSeen());
        expect(state.tooltipDismissed).toBe(true);
        expect(window.localStorage.getItem('smalruby:tutorialSeen')).toBe('true');
    });

    // Issue #1498: レッスン表を通らずにチャレンジを開いても「レッスンをはじめよう！」の役目は終わる
    test('opening a challenge marks the tutorial as seen', () => {
        const state = reducer(firstTime, openChallenge('blocks-l1-if'));
        expect(state).toEqual({ tutorialSeen: true, rubyTabUsed: false, tooltipDismissed: true });
        expect(window.localStorage.getItem('smalruby:tutorialSeen')).toBe('true');
    });
});
