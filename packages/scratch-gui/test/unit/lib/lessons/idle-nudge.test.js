import { act, renderHook } from '@testing-library/react';
import { EventEmitter } from 'events';
import { IDLE_NUDGE_MS, nextNudgeCheckIn, shouldNudgeHint } from '../../../../src/lib/lessons/idle-nudge';
import { useIdleNudge } from '../../../../src/lib/lessons/use-idle-nudge';

describe('shouldNudgeHint', () => {
    const base = { now: 0, lastChangeAt: 0, hintAvailable: true, hintVisible: false };

    test('nudges after 2 minutes without a change', () => {
        expect(IDLE_NUDGE_MS).toBe(120000);
        expect(shouldNudgeHint({ ...base, now: 119999 })).toBe(false);
        expect(shouldNudgeHint({ ...base, now: 120000 })).toBe(true);
    });

    test('counts from the last change', () => {
        expect(shouldNudgeHint({ ...base, now: 150000, lastChangeAt: 60000 })).toBe(false);
        expect(shouldNudgeHint({ ...base, now: 180000, lastChangeAt: 60000 })).toBe(true);
    });

    test('an operation that stopped the nudge counts as the start again', () => {
        expect(shouldNudgeHint({ ...base, now: 200000, lastDismissAt: 130000 })).toBe(false);
        expect(shouldNudgeHint({ ...base, now: 250000, lastDismissAt: 130000 })).toBe(true);
    });

    test('does not nudge without hints, while reading the hint, or while something else is shown', () => {
        const idle = { ...base, now: 999999 };
        expect(shouldNudgeHint({ ...idle, hintAvailable: false })).toBe(false);
        expect(shouldNudgeHint({ ...idle, hintVisible: true })).toBe(false);
        expect(shouldNudgeHint({ ...idle, blocked: true })).toBe(false);
    });

    test('the idle time can be changed', () => {
        expect(shouldNudgeHint({ ...base, now: 1000, idleMs: 1000 })).toBe(true);
    });
});

describe('nextNudgeCheckIn', () => {
    test('the time left until the nudge (never negative)', () => {
        expect(nextNudgeCheckIn({ now: 30000, lastChangeAt: 0 })).toBe(90000);
        expect(nextNudgeCheckIn({ now: 30000, lastChangeAt: 0, lastDismissAt: 20000 })).toBe(110000);
        expect(nextNudgeCheckIn({ now: 500000, lastChangeAt: 0 })).toBe(0);
    });
});

describe('useIdleNudge', () => {
    let vm;
    beforeEach(() => {
        jest.useFakeTimers();
        vm = new EventEmitter();
        vm.runtime = new EventEmitter();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    const props = (over = {}) => ({ vm, enabled: true, hintAvailable: true, hintVisible: false, ...over });

    test('nudges after 2 minutes and stops on an operation, then counts again', () => {
        const { result } = renderHook((p) => useIdleNudge(p), { initialProps: props() });
        expect(result.current).toBe(false);
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS - 1000));
        expect(result.current).toBe(false);
        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe(true);
        act(() => {
            document.dispatchEvent(new Event('pointerdown'));
        });
        expect(result.current).toBe(false);
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS));
        expect(result.current).toBe(true);
    });

    test('a change of the program or the stage starts the count again', () => {
        const { result } = renderHook((p) => useIdleNudge(p), { initialProps: props() });
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS - 1000));
        act(() => {
            vm.emit('PROJECT_CHANGED');
        });
        act(() => jest.advanceTimersByTime(2000));
        expect(result.current).toBe(false);
        act(() => {
            vm.runtime.emit('PROJECT_RUN_START');
            vm.emit('targetsUpdate', {});
        });
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS - 1000));
        expect(result.current).toBe(false);
        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe(true);
        // 光っているときの変化でも止まる
        act(() => {
            vm.emit('workspaceUpdate', {});
        });
        expect(result.current).toBe(false);
    });

    test('does not nudge while the hint is open, and stops when the hint opens', () => {
        const { result, rerender } = renderHook((p) => useIdleNudge(p), { initialProps: props() });
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS));
        expect(result.current).toBe(true);
        rerender(props({ hintVisible: true }));
        expect(result.current).toBe(false);
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS * 2));
        expect(result.current).toBe(false);
        // 小さくしたら（閉じたら）、そこからまた 2 分
        rerender(props({ hintVisible: false }));
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS - 1000));
        expect(result.current).toBe(false);
        act(() => jest.advanceTimersByTime(1000));
        expect(result.current).toBe(true);
    });

    test('outside a challenge it never nudges and leaves no listeners', () => {
        const { result, unmount } = renderHook((p) => useIdleNudge(p), { initialProps: props({ enabled: false }) });
        act(() => jest.advanceTimersByTime(IDLE_NUDGE_MS * 2));
        expect(result.current).toBe(false);
        expect(vm.listenerCount('PROJECT_CHANGED')).toBe(0);
        unmount();
    });

    test('removes the VM listeners when unmounted', () => {
        const { unmount } = renderHook((p) => useIdleNudge(p), { initialProps: props() });
        expect(vm.listenerCount('targetsUpdate')).toBe(1);
        expect(vm.runtime.listenerCount('SAY')).toBe(1);
        unmount();
        expect(vm.listenerCount('targetsUpdate')).toBe(0);
        expect(vm.runtime.listenerCount('SAY')).toBe(0);
    });
});
