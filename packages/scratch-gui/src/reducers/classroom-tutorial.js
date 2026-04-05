const MARK_SEEN = 'scratch-gui/classroom-tutorial/MARK_SEEN';

const STORAGE_PREFIX = 'smalruby:tutorial:';

const TUTORIAL_NAMES = [
    'googleAccountSelect',
    'checkboxes',
    'classCreation',
    'courseSelection',
    'bookmarkPrompt',
    'seatCountHint',
];

const loadFromStorage = () => {
    const seen = {};
    for (const name of TUTORIAL_NAMES) {
        try {
            seen[name] = localStorage.getItem(`${STORAGE_PREFIX}${name}`) === 'true';
        } catch {
            seen[name] = false;
        }
    }
    return { seen };
};

const initialState = loadFromStorage();

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case MARK_SEEN: {
            const { name } = action;
            try {
                localStorage.setItem(`${STORAGE_PREFIX}${name}`, 'true');
            } catch {
                // Ignore localStorage errors
            }
            return {
                ...state,
                seen: { ...state.seen, [name]: true },
            };
        }
        default:
            return state;
    }
};

const markClassroomTutorialSeen = name => ({
    type: MARK_SEEN,
    name,
});

const isTutorialSeen = (state, name) => state.scratchGui.classroomTutorial.seen[name] === true;

export default reducer;
export { initialState as classroomTutorialInitialState, markClassroomTutorialSeen, isTutorialSeen, TUTORIAL_NAMES };
