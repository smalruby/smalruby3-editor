import React from 'react';
import {fireEvent, act} from '@testing-library/react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import ActionMenu from '../../../src/components/action-menu/action-menu';

// Mock ReactTooltip
const ReactTooltip = props => <div className="mock-tooltip">{props.children}</div>;
ReactTooltip.hide = jest.fn();
ReactTooltip.show = jest.fn();
jest.mock('react-tooltip', () => ({
    __esModule: true,
    default: ReactTooltip,
    hide: ReactTooltip.hide,
    show: ReactTooltip.show
}));

// Mock styles
jest.mock('../../../src/components/action-menu/action-menu.css', () => ({
    menuContainer: 'menu-container',
    forceHidden: 'force-hidden',
    button: 'button',
    mainButton: 'main-button'
}));

describe('ActionMenu Component', () => {
    let defaultProps;

    beforeEach(() => {
        defaultProps = {
            img: 'main-img.png',
            onClick: jest.fn(),
            title: 'Main Title',
            moreButtons: [
                {
                    img: 'more-img.png',
                    title: 'More Title',
                    onClick: jest.fn()
                }
            ]
        };
        jest.clearAllMocks();
    });

    test('clickDelayer keeps forceHide true for CLOSE_DELAY', () => {
        jest.useFakeTimers();
        const {container} = renderWithIntl(<ActionMenu {...defaultProps} />);
        const mainButton = container.querySelector('.main-button');
        
        fireEvent.click(mainButton);
        
        const menuContainer = container.firstChild;
        expect(menuContainer.classList.contains('force-hidden')).toBe(true);
        
        // It should still be true after 100ms (buggy version would be false)
        act(() => {
            jest.advanceTimersByTime(100);
        });
        expect(menuContainer.classList.contains('force-hidden')).toBe(true);
        
        // It should be false after 300ms
        act(() => {
            jest.advanceTimersByTime(250); // Total 350ms
        });
        expect(menuContainer.classList.contains('force-hidden')).toBe(false);
        
        jest.useRealTimers();
    });

    test('componentWillUnmount clears timeout', () => {
        jest.useFakeTimers();
        // Use act to wrap rendering and interaction
        let wrapper;
        wrapper = renderWithIntl(<ActionMenu {...defaultProps} />);
        
        // We need to access the instance to set the timeout or trigger the method
        // But with @testing-library/react it's better to trigger events.
        // The issue might be that fireEvent.mouseLeave doesn't trigger the internal state correctly in JSDOM
        // Let's try to advance timers if needed, but here we just want to see if unmount calls clearTimeout.
        
        const menuContainer = wrapper.container.firstChild;
        fireEvent.mouseLeave(menuContainer);
        
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        
        wrapper.unmount();
        
        expect(clearTimeoutSpy).toHaveBeenCalled();
        jest.useRealTimers();
    });
});
