/* eslint-env jest */
// The right column while the console is shown (in every tab) and in the Japanese tab: the tall
// console, and the sprites and backdrops behind a strip
// (docs/design-system/code-tab.md「コンソールを出しているときの右の列」).
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { JapaneseRightColumn } from '../../../src/components/japanese-right-column/japanese-right-column.jsx';
import en from '../../../src/locales/en';

const renderColumn = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <JapaneseRightColumn active isStage={false} stageSize="large" targetName="Sprite1" {...props}>
                <div data-testid="targets">sprites</div>
            </JapaneseRightColumn>
        </IntlProvider>,
    );

describe('JapaneseRightColumn', () => {
    test('shows the sprites and backdrops as they are outside the Japanese tab', () => {
        renderColumn({ active: false });
        expect(screen.getByTestId('targets')).toBeVisible();
        expect(screen.queryByTestId('japanese-right-column-strip')).toBeNull();
        expect(screen.queryByTestId('smalruby-console-slot')).toBeNull();
    });

    test('hides the sprites and backdrops behind a strip with the name of the edited sprite', () => {
        renderColumn();
        expect(screen.getByTestId('targets')).not.toBeVisible();
        expect(screen.getByTestId('japanese-right-column-strip')).toHaveTextContent('Program of Sprite1');
        // The column keeps the width of the stage with its borders while the console is shown in its
        // place, so the green flag and the strip do not move when it is shown or hidden (B22 of #1731)
        expect(screen.getByTestId('smalruby-console-slot').style.width).toBe('calc(480px + 0.125rem)');
    });

    test('opens the sprites and backdrops in place, and closes them again', () => {
        renderColumn();
        const link = screen.getByTestId('japanese-right-column-show-targets');
        expect(link).toHaveTextContent('See the sprites and backdrops');
        fireEvent.click(link);
        expect(screen.getByTestId('targets')).toBeVisible();
        expect(link).toHaveTextContent('Hide the sprites and backdrops');
        fireEvent.click(link);
        expect(screen.getByTestId('targets')).not.toBeVisible();
    });

    test('shows only the console, in place of the sprites, in the other tabs while it is shown', () => {
        renderColumn({ active: false, consoleVisible: true });
        expect(screen.getByTestId('targets')).not.toBeVisible();
        expect(screen.getByTestId('smalruby-console-slot')).toBeInTheDocument();
        expect(screen.getByTestId('japanese-right-column-strip')).toHaveTextContent('Program of Sprite1');
    });

    test('hides the console to show the sprites with the stage, never the two together', () => {
        const onHideConsole = jest.fn();
        const { rerender } = renderColumn({ consoleVisible: true, onHideConsole });
        const link = screen.getByTestId('japanese-right-column-show-targets');
        expect(link).toHaveTextContent('See the sprites and backdrops');
        fireEvent.click(link);
        expect(onHideConsole).toHaveBeenCalledTimes(1);
        // the console is hidden by the store: the sprites open with the stage
        rerender(
            <IntlProvider locale="en" messages={en}>
                <JapaneseRightColumn active consoleVisible={false} stageSize="large" targetName="Sprite1">
                    <div data-testid="targets">sprites</div>
                </JapaneseRightColumn>
            </IntlProvider>,
        );
        expect(screen.getByTestId('targets')).toBeVisible();
        // the console comes back (the `>_` button, or the program waits for an answer): only the console
        rerender(
            <IntlProvider locale="en" messages={en}>
                <JapaneseRightColumn active consoleVisible stageSize="large" targetName="Sprite1">
                    <div data-testid="targets">sprites</div>
                </JapaneseRightColumn>
            </IntlProvider>,
        );
        expect(screen.getByTestId('targets')).not.toBeVisible();
    });

    test('gives the other tabs the sprites as they are when the console is hidden from there', () => {
        const onHideConsole = jest.fn();
        renderColumn({ active: false, consoleVisible: true, onHideConsole });
        fireEvent.click(screen.getByTestId('japanese-right-column-show-targets'));
        expect(onHideConsole).toHaveBeenCalledTimes(1);
    });

    test('names the stage when the stage is edited', () => {
        renderColumn({ isStage: true, targetName: 'Stage' });
        expect(screen.getByTestId('japanese-right-column-strip')).toHaveTextContent('Program of the stage');
    });
});
