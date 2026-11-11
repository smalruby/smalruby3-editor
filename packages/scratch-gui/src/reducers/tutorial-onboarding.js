const MARK_TUTORIAL_SEEN = 'scratch-gui/tutorial-onboarding/MARK_TUTORIAL_SEEN';
const MARK_RUBY_TAB_USED = 'scratch-gui/tutorial-onboarding/MARK_RUBY_TAB_USED';
const DISMISS_TOOLTIP = 'scratch-gui/tutorial-onboarding/DISMISS_TOOLTIP';
// レッスンモードに入る action（reducers/lesson-mode.js の OPEN_CHALLENGE）。チャレンジを開いたら
// 「レッスンをはじめよう！」の役目は終わるので、レッスン表を開いたときと同じ印を付ける。
// レッスン表を通らない入口（window.smalruby.startChallenge など）でも印が付くよう、ここで受ける (#1498)
const OPEN_CHALLENGE = 'scratch-gui/lesson-mode/OPEN_CHALLENGE';

const STORAGE_KEY_TUTORIAL_SEEN = 'smalruby:tutorialSeen';
const STORAGE_KEY_RUBY_TAB_USED = 'smalruby:rubyTabUsed';

// Load initial state from localStorage
const loadFromStorage = () => {
    try {
        const tutorialSeen = localStorage.getItem(STORAGE_KEY_TUTORIAL_SEEN) === 'true';
        const rubyTabUsed = localStorage.getItem(STORAGE_KEY_RUBY_TAB_USED) === 'true';
        return {
            tutorialSeen,
            rubyTabUsed,
            tooltipDismissed: tutorialSeen || rubyTabUsed,
        };
    } catch (e) {
        // If localStorage is not available, treat as first-time user
        return {
            tutorialSeen: false,
            rubyTabUsed: false,
            tooltipDismissed: false,
        };
    }
};

const initialState = loadFromStorage();

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case MARK_TUTORIAL_SEEN:
        case OPEN_CHALLENGE:
            try {
                localStorage.setItem(STORAGE_KEY_TUTORIAL_SEEN, 'true');
            } catch (e) {
                // Ignore localStorage errors
            }
            return Object.assign({}, state, {
                tutorialSeen: true,
                tooltipDismissed: true,
            });
        case MARK_RUBY_TAB_USED:
            try {
                localStorage.setItem(STORAGE_KEY_RUBY_TAB_USED, 'true');
            } catch (e) {
                // Ignore localStorage errors
            }
            return Object.assign({}, state, {
                rubyTabUsed: true,
                tooltipDismissed: true,
            });
        case DISMISS_TOOLTIP:
            return Object.assign({}, state, {
                tooltipDismissed: true,
            });
        default:
            return state;
    }
};

const markTutorialSeen = function () {
    return {
        type: MARK_TUTORIAL_SEEN,
    };
};

const markRubyTabUsed = function () {
    return {
        type: MARK_RUBY_TAB_USED,
    };
};

const dismissTooltip = function () {
    return {
        type: DISMISS_TOOLTIP,
    };
};

const shouldShowTooltip = (state) => !state.scratchGui.tutorialOnboarding.tooltipDismissed;

export {
    reducer as default,
    initialState as tutorialOnboardingInitialState,
    markTutorialSeen,
    markRubyTabUsed,
    dismissTooltip,
    shouldShowTooltip,
};
