/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import SpriteInfo from '../../../src/components/sprite-info/sprite-info.jsx';
import { STAGE_DISPLAY_SIZES } from '../../../src/lib/layout-constants.js';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';
import jaHira from '../../../src/locales/ja-Hira';

const renderInfo = (stageSize, { locale = 'en', messages = en } = {}) =>
    render(
        // upstream の訳（scratch-l10n）は渡さないので、見つからない警告は出さない
        <IntlProvider locale={locale} messages={messages} onError={() => {}}>
            <SpriteInfo
                direction={90}
                disabled={false}
                name="Sprite1"
                rotationStyle="all around"
                size={100}
                stageSize={stageSize}
                visible
                x={10}
                y={20}
            />
        </IntlProvider>,
    );

// <label> の中で入力欄より前（左隣）に字やアイコンがあるか
const labelBefore = (input) => input.closest('label').firstElementChild;

describe('SpriteInfo on the middle stage (compact)', () => {
    test('does not show the "Sprite" label, and puts x / y to the left of the inputs', () => {
        const { getByTestId, getByDisplayValue, queryByText } = renderInfo(STAGE_DISPLAY_SIZES.middle);
        expect(getByTestId('sprite-info-compact')).toBeInTheDocument();
        expect(queryByText('Sprite')).toBeNull();
        expect(getByDisplayValue('Sprite1').closest('label')).toBeNull();

        const x = getByDisplayValue('10');
        const y = getByDisplayValue('20');
        expect(labelBefore(x)).toHaveTextContent('x');
        expect(labelBefore(y)).toHaveTextContent('y');
        // 上ではなく左隣（column ではなく row の並び）
        expect(x.closest('label').className).not.toMatch(/column/);
        expect(y.closest('label').className).not.toMatch(/column/);
    });

    test('shows icons with tooltips instead of the size / direction words', () => {
        const { getByTestId, getByDisplayValue, queryByText } = renderInfo(STAGE_DISPLAY_SIZES.middle);
        expect(queryByText('Size')).toBeNull();
        expect(queryByText('Direction')).toBeNull();

        const sizeIcon = getByTestId('sprite-info-size-icon');
        expect(sizeIcon).toHaveAttribute('title', 'Size (%)');
        expect(sizeIcon).toHaveAttribute('aria-label', 'Size (%)');
        expect(labelBefore(getByDisplayValue('100'))).toContainElement(sizeIcon);

        const directionIcon = getByTestId('sprite-info-direction-icon');
        expect(directionIcon).toHaveAttribute('title', 'Direction (degrees)');
        expect(directionIcon).toHaveAttribute('aria-label', 'Direction (degrees)');
        expect(labelBefore(getByDisplayValue('90'))).toContainElement(directionIcon);
    });

    test('translates the tooltips into ja and ja-Hira', () => {
        let utils = renderInfo(STAGE_DISPLAY_SIZES.middle, { locale: 'ja', messages: ja });
        expect(utils.getByTestId('sprite-info-size-icon')).toHaveAttribute('title', '大きさ（%）');
        expect(utils.getByTestId('sprite-info-direction-icon')).toHaveAttribute('title', '向き（度）');
        utils.unmount();
        utils = renderInfo(STAGE_DISPLAY_SIZES.middle, { locale: 'ja-Hira', messages: jaHira });
        expect(utils.getByTestId('sprite-info-size-icon')).toHaveAttribute('title', 'おおきさ（%）');
        expect(utils.getByTestId('sprite-info-direction-icon')).toHaveAttribute('title', 'むき（ど）');
    });

    test('keeps the upstream layout on the large and small stages', () => {
        let utils = renderInfo(STAGE_DISPLAY_SIZES.large);
        expect(utils.queryByTestId('sprite-info-compact')).toBeNull();
        expect(utils.getByText('Sprite')).toBeInTheDocument();
        expect(utils.getByText('Size')).toBeInTheDocument();
        expect(utils.getByText('Direction')).toBeInTheDocument();
        expect(utils.queryByTestId('sprite-info-size-icon')).toBeNull();
        utils.unmount();

        utils = renderInfo(STAGE_DISPLAY_SIZES.small);
        expect(utils.queryByTestId('sprite-info-compact')).toBeNull();
        expect(utils.queryByTestId('sprite-info-size-icon')).toBeNull();
    });
});
