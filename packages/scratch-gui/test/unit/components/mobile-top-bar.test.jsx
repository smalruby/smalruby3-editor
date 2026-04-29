/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { MobileTopBarComponent } from '../../../src/components/mobile-top-bar/mobile-top-bar.jsx';

const makeFakeVm = () => ({
    start: jest.fn(),
    greenFlag: jest.fn(),
    stopAll: jest.fn(),
});

describe('MobileTopBar', () => {
    test('renders the play button when not fullscreen', () => {
        const { getByTestId } = render(
            <MobileTopBarComponent
                vm={makeFakeVm()}
                isFullScreen={false}
                isStarted={false}
                onSetFullScreen={() => {}}
            />,
        );
        expect(getByTestId('mobile-top-bar')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-play')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-play')).toHaveAttribute('aria-label', 'play');
    });

    test('still renders in fullscreen mode (button toggles to stop)', () => {
        const { getByTestId } = render(
            <MobileTopBarComponent
                vm={makeFakeVm()}
                isFullScreen={true}
                isStarted={true}
                onSetFullScreen={() => {}}
            />,
        );
        expect(getByTestId('mobile-top-bar')).toBeInTheDocument();
        expect(getByTestId('mobile-top-bar-play')).toHaveAttribute('aria-label', 'stop');
    });

    test('clicking play activates fullscreen + vm.start + vm.greenFlag (when not started)', () => {
        const vm = makeFakeVm();
        const onSetFullScreen = jest.fn();
        const { getByTestId } = render(
            <MobileTopBarComponent
                vm={vm}
                isFullScreen={false}
                isStarted={false}
                onSetFullScreen={onSetFullScreen}
            />,
        );
        fireEvent.click(getByTestId('mobile-top-bar-play'));
        expect(onSetFullScreen).toHaveBeenCalledWith(true);
        expect(vm.start).toHaveBeenCalledTimes(1);
        expect(vm.greenFlag).toHaveBeenCalledTimes(1);
        expect(vm.stopAll).not.toHaveBeenCalled();
    });

    test('clicking play skips vm.start when isStarted is true', () => {
        const vm = makeFakeVm();
        const { getByTestId } = render(
            <MobileTopBarComponent vm={vm} isFullScreen={false} isStarted={true} onSetFullScreen={jest.fn()} />,
        );
        fireEvent.click(getByTestId('mobile-top-bar-play'));
        expect(vm.start).not.toHaveBeenCalled();
        expect(vm.greenFlag).toHaveBeenCalledTimes(1);
    });

    test('clicking stop (in fullscreen) calls vm.stopAll + setFullScreen(false)', () => {
        const vm = makeFakeVm();
        const onSetFullScreen = jest.fn();
        const { getByTestId } = render(
            <MobileTopBarComponent vm={vm} isFullScreen={true} isStarted={true} onSetFullScreen={onSetFullScreen} />,
        );
        fireEvent.click(getByTestId('mobile-top-bar-play'));
        expect(vm.stopAll).toHaveBeenCalledTimes(1);
        expect(onSetFullScreen).toHaveBeenCalledWith(false);
        expect(vm.greenFlag).not.toHaveBeenCalled();
    });
});
