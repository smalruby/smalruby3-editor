/* eslint-env jest */
/**
 * クラス管理のタブ（#1956 Q7）: ロービングの tabIndex と、左右の矢印・Home・End での移動。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import ClassroomTab, { nextTabIndex } from '../../../src/components/classroom-modal/classroom-tab.jsx';

const renderTabs = (selected, onClick = jest.fn()) =>
    render(
        <div role="tablist">
            {['a', 'b', 'c'].map((id) => (
                <ClassroomTab
                    key={id}
                    dataTab={id}
                    dataTestId={`tab-${id}`}
                    selected={selected === id}
                    onClick={onClick}
                >
                    {id}
                </ClassroomTab>
            ))}
            <button data-testid="more" type="button">
                {'⋮'}
            </button>
        </div>,
    );

describe('ClassroomTab', () => {
    test('only the selected tab is in the Tab order', () => {
        const { getByTestId } = renderTabs('b');
        expect(getByTestId('tab-a')).toHaveAttribute('tabindex', '-1');
        expect(getByTestId('tab-b')).toHaveAttribute('tabindex', '0');
        expect(getByTestId('tab-c')).toHaveAttribute('tabindex', '-1');
        expect(getByTestId('tab-b')).toHaveAttribute('aria-selected', 'true');
        expect(getByTestId('tab-b')).toHaveAttribute('role', 'tab');
        expect(getByTestId('tab-b')).toHaveAttribute('type', 'button');
    });

    test('arrow keys move the focus and wrap around; other buttons in the list are skipped', () => {
        const { getByTestId } = renderTabs('a');
        getByTestId('tab-a').focus();
        fireEvent.keyDown(getByTestId('tab-a'), { key: 'ArrowRight' });
        expect(getByTestId('tab-b')).toHaveFocus();
        fireEvent.keyDown(getByTestId('tab-b'), { key: 'ArrowRight' });
        expect(getByTestId('tab-c')).toHaveFocus();
        fireEvent.keyDown(getByTestId('tab-c'), { key: 'ArrowRight' });
        expect(getByTestId('tab-a')).toHaveFocus();
        fireEvent.keyDown(getByTestId('tab-a'), { key: 'ArrowLeft' });
        expect(getByTestId('tab-c')).toHaveFocus();
    });

    test('Home and End go to the first and last tab', () => {
        const { getByTestId } = renderTabs('b');
        fireEvent.keyDown(getByTestId('tab-b'), { key: 'End' });
        expect(getByTestId('tab-c')).toHaveFocus();
        fireEvent.keyDown(getByTestId('tab-c'), { key: 'Home' });
        expect(getByTestId('tab-a')).toHaveFocus();
    });

    test('moving the focus does not select; Enter / click does', () => {
        const onClick = jest.fn();
        const { getByTestId } = renderTabs('a', onClick);
        fireEvent.keyDown(getByTestId('tab-a'), { key: 'ArrowRight' });
        expect(onClick).not.toHaveBeenCalled();
        fireEvent.click(getByTestId('tab-b'));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][0].target.dataset.tab).toBe('b');
    });

    test('nextTabIndex', () => {
        expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1);
        expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
        expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
        expect(nextTabIndex('Home', 2, 3)).toBe(0);
        expect(nextTabIndex('End', 0, 3)).toBe(2);
        expect(nextTabIndex('Enter', 0, 3)).toBeNull();
        expect(nextTabIndex('ArrowRight', -1, 3)).toBeNull();
        expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
    });
});
