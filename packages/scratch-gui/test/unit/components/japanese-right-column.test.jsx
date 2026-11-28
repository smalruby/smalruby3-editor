/* eslint-env jest */
// The right column of the Japanese tab: the tall console, and the sprites and backdrops
// behind a strip (docs/design-system/code-tab.md「日本語タブの右の列」).
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { JapaneseRightColumn } from '../../../src/components/japanese-right-column/japanese-right-column.jsx';
import en from '../../../src/locales/en';

const renderColumn = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <JapaneseRightColumn active isStage={false} targetName="Sprite1" {...props}>
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
        expect(screen.getByTestId('smalruby-console-slot')).toBeInTheDocument();
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

    test('names the stage when the stage is edited', () => {
        renderColumn({ isStage: true, targetName: 'Stage' });
        expect(screen.getByTestId('japanese-right-column-strip')).toHaveTextContent('Program of the stage');
    });
});
