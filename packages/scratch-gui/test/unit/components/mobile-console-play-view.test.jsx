/* eslint-env jest */
import { act, renderHook } from '@testing-library/react';
import { EventEmitter } from 'events';
import {
    CONSOLE_PLAY_VIEW_EVENTS,
    shouldOpenConsolePlayView,
    useConsolePlayView,
} from '../../../src/components/mobile-gui/use-console-play-view.js';
import { PRINT_EVENT } from '../../../src/components/smalruby-console/smalruby-console.jsx';

const base = (override) => ({
    event: CONSOLE_PLAY_VIEW_EVENTS.print,
    active: true,
    isFullScreen: false,
    openedThisRun: false,
    ...override,
});

describe('shouldOpenConsolePlayView', () => {
    test('opens the play view on the first line printed from the Japanese tab', () => {
        expect(shouldOpenConsolePlayView(base())).toBe(true);
    });

    test('opens the play view when the program waits for an answer', () => {
        expect(shouldOpenConsolePlayView(base({ event: CONSOLE_PLAY_VIEW_EVENTS.question }))).toBe(true);
    });

    test('opens the play view for a question even after the child went back to the editor', () => {
        // the answer can only be typed in the console
        expect(
            shouldOpenConsolePlayView(base({ event: CONSOLE_PLAY_VIEW_EVENTS.question, openedThisRun: true })),
        ).toBe(true);
    });

    test('does not open it again for the lines printed after the child went back to the editor', () => {
        expect(shouldOpenConsolePlayView(base({ openedThisRun: true }))).toBe(false);
    });

    test('does nothing while the play view is shown', () => {
        expect(shouldOpenConsolePlayView(base({ isFullScreen: true }))).toBe(false);
    });

    test('does nothing outside the Japanese tab (the console is not shown)', () => {
        expect(shouldOpenConsolePlayView(base({ active: false }))).toBe(false);
        expect(shouldOpenConsolePlayView(base({ active: false, event: CONSOLE_PLAY_VIEW_EVENTS.question }))).toBe(
            false,
        );
    });
});

const makeVm = () => {
    const runtime = new EventEmitter();
    // the threads running at the end of the last tick (0 in the first tick of a run)
    runtime._nonMonitorThreadCount = 0;
    return { runtime };
};

describe('useConsolePlayView', () => {
    test('opens the play view when a line is printed, once a run', () => {
        const vm = makeVm();
        const onOpen = jest.fn();
        const { rerender } = renderHook((props) => useConsolePlayView(props), {
            initialProps: { vm, active: true, isFullScreen: false, onOpen },
        });

        // the first tick of a run prints before PROJECT_RUN_START
        act(() => vm.runtime.emit(PRINT_EVENT, 'こんにちは'));
        expect(onOpen).toHaveBeenCalledTimes(1);
        vm.runtime._nonMonitorThreadCount = 1;
        act(() => vm.runtime.emit('PROJECT_RUN_START'));

        // the child went back to the editor: the next lines of the same run keep the editor
        rerender({ vm, active: true, isFullScreen: false, onOpen });
        act(() => vm.runtime.emit(PRINT_EVENT, 'again'));
        expect(onOpen).toHaveBeenCalledTimes(1);

        // a new run shows the play view again
        vm.runtime._nonMonitorThreadCount = 0;
        act(() => vm.runtime.emit('PROJECT_RUN_STOP'));
        act(() => vm.runtime.emit(PRINT_EVENT, 'next'));
        expect(onOpen).toHaveBeenCalledTimes(2);
    });

    test('keeps the editor after the child left a run started in the play view', () => {
        const vm = makeVm();
        const onOpen = jest.fn();
        const { rerender } = renderHook((props) => useConsolePlayView(props), {
            initialProps: { vm, active: true, isFullScreen: true, onOpen },
        });

        // started with ▶: the first lines are printed in the play view
        act(() => vm.runtime.emit(PRINT_EVENT, '1'));
        vm.runtime._nonMonitorThreadCount = 1;
        act(() => vm.runtime.emit('PROJECT_RUN_START'));
        expect(onOpen).not.toHaveBeenCalled();

        // the child left the full screen without stopping: the next lines keep the editor
        rerender({ vm, active: true, isFullScreen: false, onOpen });
        act(() => vm.runtime.emit(PRINT_EVENT, '2'));
        expect(onOpen).not.toHaveBeenCalled();
    });

    test('opens the play view again for a run that ended in its first tick', () => {
        const vm = makeVm();
        const onOpen = jest.fn();
        renderHook((props) => useConsolePlayView(props), {
            initialProps: { vm, active: true, isFullScreen: false, onOpen },
        });

        // no PROJECT_RUN_START / STOP for a run that ends in its first tick
        act(() => vm.runtime.emit(PRINT_EVENT, '1'));
        act(() => vm.runtime.emit(PRINT_EVENT, '2'));
        expect(onOpen).toHaveBeenCalledTimes(2);
    });

    test('opens the play view when the program asks, but not when the question is taken away', () => {
        const vm = makeVm();
        const onOpen = jest.fn();
        renderHook((props) => useConsolePlayView(props), {
            initialProps: { vm, active: true, isFullScreen: false, onOpen },
        });

        act(() => vm.runtime.emit('QUESTION', null));
        expect(onOpen).not.toHaveBeenCalled();
        act(() => vm.runtime.emit('QUESTION', ''));
        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    test('does nothing outside the Japanese tab', () => {
        const vm = makeVm();
        const onOpen = jest.fn();
        renderHook((props) => useConsolePlayView(props), {
            initialProps: { vm, active: false, isFullScreen: false, onOpen },
        });

        act(() => vm.runtime.emit(PRINT_EVENT, 'x'));
        act(() => vm.runtime.emit('QUESTION', ''));
        expect(onOpen).not.toHaveBeenCalled();
    });

    test('stops listening when unmounted', () => {
        const vm = makeVm();
        const { unmount } = renderHook((props) => useConsolePlayView(props), {
            initialProps: { vm, active: true, isFullScreen: false, onOpen: jest.fn() },
        });
        unmount();
        expect(vm.runtime.listenerCount(PRINT_EVENT)).toBe(0);
        expect(vm.runtime.listenerCount('QUESTION')).toBe(0);
        expect(vm.runtime.listenerCount('PROJECT_RUN_STOP')).toBe(0);
    });
});
