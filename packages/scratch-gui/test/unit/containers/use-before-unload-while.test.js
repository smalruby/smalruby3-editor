/* eslint-env jest */
/**
 * 採点の画面で消えるものがある間だけ、再読み込み・タブを閉じる前にブラウザの確認を出す (#1923 C4・Q1)。
 * `?no_beforeunload=1` のときは出さない。
 */
import { renderHook } from '@testing-library/react';
import useBeforeUnloadWhile from '../../../src/containers/use-before-unload-while.js';

const mockUrlParams = { noBeforeUnload: false };
jest.mock('../../../src/lib/url-params.js', () => ({
    getUrlParams: () => mockUrlParams,
}));

const fire = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
};

describe('useBeforeUnloadWhile', () => {
    beforeEach(() => {
        mockUrlParams.noBeforeUnload = false;
    });

    test('asks only while active', () => {
        const hook = renderHook(({ active }) => useBeforeUnloadWhile(active), { initialProps: { active: false } });
        expect(fire()).toBe(false);
        hook.rerender({ active: true });
        expect(fire()).toBe(true);
        hook.rerender({ active: false });
        expect(fire()).toBe(false);
        hook.unmount();
    });

    test('stops asking when unmounted (the modal is closed)', () => {
        const hook = renderHook(() => useBeforeUnloadWhile(true));
        hook.unmount();
        expect(fire()).toBe(false);
    });

    test('does not ask with ?no_beforeunload=1', () => {
        mockUrlParams.noBeforeUnload = true;
        const hook = renderHook(() => useBeforeUnloadWhile(true));
        expect(fire()).toBe(false);
        hook.unmount();
    });
});
