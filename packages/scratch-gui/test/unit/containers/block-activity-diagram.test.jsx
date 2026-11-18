/* eslint-env jest */
/**
 * ブロックを右クリック →「アクティビティ図」（#1647）: メニューの項目の登録・出す条件と、パネルの開閉・
 * 描き直しを守る。scratch-blocks のレジストリと VM は小さな偽物にする。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import BlockActivityDiagramContainer, {
    MENU_ITEM_ID,
    showsActivityDiagramMenuItem,
} from '../../../src/containers/block-activity-diagram.jsx';
import analytics from '../../../src/lib/analytics';
import { ja } from '../../../src/lib/lessons/activity-diagram/activity-diagram.locale';

jest.mock('../../../src/lib/analytics', () => ({ __esModule: true, default: { event: jest.fn() } }));

const makeRegistry = () => {
    const items = new Map();
    return {
        items,
        register: jest.fn((item) => {
            if (items.has(item.id)) throw new Error('already registered');
            items.set(item.id, item);
        }),
        unregister: jest.fn((id) => items.delete(id)),
        getItem: (id) => items.get(id) || null,
    };
};

// 旗が押されたとき → 「やあ」と言う
const makeBlocks = (message = 'やあ') => ({
    hat: {
        id: 'hat',
        opcode: 'event_whenflagclicked',
        topLevel: true,
        parent: null,
        next: 'say',
        inputs: {},
        fields: {},
    },
    say: {
        id: 'say',
        opcode: 'looks_say',
        parent: 'hat',
        next: null,
        fields: {},
        inputs: { MESSAGE: { name: 'MESSAGE', block: 'msg', shadow: 'msg' } },
    },
    msg: {
        id: 'msg',
        opcode: 'text',
        shadow: true,
        parent: 'say',
        next: null,
        inputs: {},
        fields: { TEXT: { name: 'TEXT', value: message } },
    },
});

const LESSON_MODE_CLOSED = { courseId: null, lessonId: null, challengeId: null, fromAssignment: false };

const setup = ({ lessonMode = LESSON_MODE_CLOSED, teacherLoggedIn = false } = {}) => {
    analytics.event.mockClear();
    const registry = makeRegistry();
    const scratchBlocks = {
        ContextMenuRegistry: { registry, ScopeType: { BLOCK: 'block' } },
        getMainWorkspace: () => ({ getBlockById: () => null }),
        Msg: {},
    };
    const sprite = { id: 'cat', isStage: false, getName: () => 'ネコ', blocks: { _blocks: makeBlocks() } };
    const vm = new EventEmitter();
    vm.editingTarget = sprite;
    vm.runtime = { getTargetById: (id) => (id === 'cat' ? sprite : null) };
    const store = createStore(() => ({
        scratchGui: {
            vm,
            blockDisplay: { scratchBlocks },
            lessonMode,
            modals: { lessonsLibrary: false },
            classroom: { teacherLoggedIn },
        },
    }));
    const utils = render(
        <Provider store={store}>
            <IntlProvider locale="ja" messages={ja}>
                <BlockActivityDiagramContainer />
            </IntlProvider>
        </Provider>,
    );
    return { ...utils, registry, sprite, vm };
};

const block = (overrides = {}) => {
    const b = { id: 'say', isInFlyout: false, workspace: { isFlyout: false }, outputConnection: null, ...overrides };
    b.getRootBlock = () => overrides.root || b;
    return b;
};

describe('showsActivityDiagramMenuItem', () => {
    test('shows for a block on the workspace', () => {
        expect(showsActivityDiagramMenuItem(block())).toBe(true);
    });

    test('hides for a block in the palette and for a reporter that is not in a script', () => {
        expect(showsActivityDiagramMenuItem(block({ isInFlyout: true }))).toBe(false);
        expect(showsActivityDiagramMenuItem(block({ workspace: { isFlyout: true } }))).toBe(false);
        expect(showsActivityDiagramMenuItem(block({ outputConnection: {} }))).toBe(false);
        expect(showsActivityDiagramMenuItem(null)).toBe(false);
    });

    test('shows for a reporter inside a script (the root is a stack block)', () => {
        const root = block({ id: 'hat' });
        expect(showsActivityDiagramMenuItem(block({ id: 'msg', outputConnection: {}, root }))).toBe(true);
    });
});

describe('BlockActivityDiagramContainer', () => {
    test('registers the block menu item with the locale text and unregisters it on unmount', () => {
        const { registry, unmount } = setup();
        const item = registry.getItem(MENU_ITEM_ID);
        expect(item.scopeType).toBe('block');
        expect(item.displayText()).toBe('アクティビティ図');
        expect(item.preconditionFn({ block: block() })).toBe('enabled');
        expect(item.preconditionFn({ block: block({ isInFlyout: true }) })).toBe('hidden');
        unmount();
        expect(registry.getItem(MENU_ITEM_ID)).toBeNull();
    });

    test('the menu item opens the panel with the diagram of the script, and × closes it', () => {
        const { registry } = setup();
        expect(screen.queryByTestId('block-activity-diagram')).toBeNull();
        act(() => registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
        expect(screen.getByTestId('block-activity-diagram-title')).toHaveTextContent('アクティビティ図（ネコ）');
        expect(screen.getByTestId('lesson-activity-diagram')).toBeInTheDocument();
        expect(screen.getByTestId('block-activity-diagram-body')).toHaveTextContent('「やあ」と言う');
        fireEvent.click(screen.getByTestId('block-activity-diagram-close'));
        expect(screen.queryByTestId('block-activity-diagram')).toBeNull();
    });

    test('Escape closes the panel', () => {
        const { registry } = setup();
        act(() => registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByTestId('block-activity-diagram')).toBeNull();
    });

    test('redraws when the blocks change, and says so when the script is gone', () => {
        jest.useFakeTimers();
        try {
            const { registry, sprite, vm } = setup();
            act(() => registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
            sprite.blocks._blocks = makeBlocks('またね');
            act(() => {
                vm.emit('PROJECT_CHANGED');
                jest.runAllTimers();
            });
            expect(screen.getByTestId('block-activity-diagram-body')).toHaveTextContent('「またね」と言う');
            sprite.blocks._blocks = {};
            act(() => {
                vm.emit('PROJECT_CHANGED');
                jest.runAllTimers();
            });
            expect(screen.getByTestId('block-activity-diagram-gone')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('sends the GA event each time the menu item opens the diagram (outside a lesson)', () => {
        const { registry } = setup();
        act(() => registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
        act(() => registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
        expect(analytics.event).toHaveBeenCalledTimes(2);
        expect(analytics.event.mock.calls[0][0]).toMatchObject({
            category: 'lessons',
            action: 'activity_diagram_open',
            label: 'sprite',
        });
        expect(analytics.event.mock.calls[0][0].challenge_id).toBeUndefined();
    });

    test('in a lesson the GA event has the challenge, and a logged-in teacher sends nothing', () => {
        const lessonMode = { courseId: 'c', lessonId: 'l', challengeId: 'ch', fromAssignment: false };
        const { registry, unmount } = setup({ lessonMode });
        act(() => registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
        expect(analytics.event.mock.calls[0][0]).toMatchObject({
            course_id: 'c',
            challenge_id: 'ch',
            label: 'sprite',
        });
        unmount();
        const teacher = setup({ teacherLoggedIn: true });
        act(() => teacher.registry.getItem(MENU_ITEM_ID).callback({ block: block() }));
        expect(analytics.event).not.toHaveBeenCalled();
        expect(screen.getByTestId('block-activity-diagram')).toBeInTheDocument();
    });
});
