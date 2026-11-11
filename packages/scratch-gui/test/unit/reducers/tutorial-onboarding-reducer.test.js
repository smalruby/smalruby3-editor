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

    // Issue #1512: 「レッスンをはじめよう！」が無くなったので、チャレンジを開いても印は付けない
    test('opening a challenge leaves the onboarding state as it is', () => {
        const state = reducer(firstTime, openChallenge('blocks-l1-if'));
        expect(state).toEqual(firstTime);
        expect(window.localStorage.getItem('smalruby:tutorialSeen')).toBeNull();
    });
});
