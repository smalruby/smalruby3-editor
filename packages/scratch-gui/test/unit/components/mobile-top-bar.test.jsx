/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MobileTopBarComponent } from '../../../src/components/mobile-top-bar/mobile-top-bar.jsx';

const makeFakeVm = () => ({
    start: jest.fn(),
    greenFlag: jest.fn(),
    stopAll: jest.fn(),
});

const baseProps = () => ({
    vm: makeFakeVm(),
    isFullScreen: false,
    isStarted: false,
    projectTitle: '',
    onSetFullScreen: jest.fn(),
    onOpenDrawer: jest.fn(),
});

describe('MobileTopBar', () => {
    test('renders the play button when not fullscreen', () => {
        const props = baseProps();
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        expect(getByTestId('mobile-top-bar')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-play')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-play')).toHaveAttribute('aria-label', 'play');
    });

    test('still renders in fullscreen mode (button toggles to stop)', () => {
        const props = { ...baseProps(), isFullScreen: true, isStarted: true };
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        expect(getByTestId('mobile-top-bar')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-play')).toHaveAttribute('aria-label', 'stop');
    });

    test('clicking play activates fullscreen + vm.start + vm.greenFlag (when not started)', () => {
        const props = baseProps();
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        fireEvent.click(getByTestId('mobile-top-bar-play'));
        expect(props.onSetFullScreen).toHaveBeenCalledWith(true);
        expect(props.vm.start).toHaveBeenCalledTimes(1);
        expect(props.vm.greenFlag).toHaveBeenCalledTimes(1);
        expect(props.vm.stopAll).not.toHaveBeenCalled();
    });

    test('clicking play skips vm.start when isStarted is true', () => {
        const props = { ...baseProps(), isStarted: true };
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        fireEvent.click(getByTestId('mobile-top-bar-play'));
        expect(props.vm.start).not.toHaveBeenCalled();
        expect(props.vm.greenFlag).toHaveBeenCalledTimes(1);
    });

    test('clicking stop (in fullscreen) calls vm.stopAll + setFullScreen(false)', () => {
        const props = { ...baseProps(), isFullScreen: true, isStarted: true };
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        fireEvent.click(getByTestId('mobile-top-bar-play'));
        expect(props.vm.stopAll).toHaveBeenCalledTimes(1);
        expect(props.onSetFullScreen).toHaveBeenCalledWith(false);
        expect(props.vm.greenFlag).not.toHaveBeenCalled();
    });

    test('renders the hamburger menu button and project title', () => {
        const props = { ...baseProps(), projectTitle: 'My Cool Project' };
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        expect(getByTestId('mobile-top-bar-menu')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-title')).toHaveTextContent('My Cool Project');
    });

    test('clicking hamburger calls onOpenDrawer', () => {
        const props = baseProps();
        const { getByTestId } = render(<MobileTopBarComponent {...props} />);
        fireEvent.click(getByTestId('mobile-top-bar-menu'));
        expect(props.onOpenDrawer).toHaveBeenCalledTimes(1);
    });
});
