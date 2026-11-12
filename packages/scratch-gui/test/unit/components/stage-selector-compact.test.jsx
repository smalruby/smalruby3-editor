/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StageSelector from '../../../src/components/stage-selector/stage-selector.jsx';
import TargetPane from '../../../src/components/target-pane/target-pane.jsx';

const renderSelector = (props = {}) =>
    render(
        // upstream の訳（scratch-l10n）は渡さないので、見つからない警告は出さない
        <IntlProvider locale="en" messages={{}} onError={() => {}}>
            <StageSelector backdropCount={2} raised={false} receivedBlocks={false} selected={false} {...props} />
        </IntlProvider>,
    );

describe('StageSelector without the header (middle stage)', () => {
    test('does not show the "Stage" header, but keeps "Backdrops" and the count', () => {
        const { container, queryByText, getByText } = renderSelector({ hideHeader: true });
        expect(queryByText('Stage')).toBeNull();
        expect(container.querySelector('.header')).toBeNull();
        expect(getByText('Backdrops')).toBeInTheDocument();
        expect(getByText('2')).toBeInTheDocument();
    });

    test('does not pass hideHeader to the DOM', () => {
        const { container } = renderSelector({ hideHeader: true });
        expect(container.firstChild).not.toHaveAttribute('hideHeader');
        expect(container.firstChild).not.toHaveAttribute('hideheader');
    });

    test('shows the "Stage" header by default (upstream)', () => {
        const { getByText } = renderSelector();
        expect(getByText('Stage')).toBeInTheDocument();
        expect(getByText('Backdrops')).toBeInTheDocument();
    });
});

// TargetPane が中サイズのときだけ見出しを消すかどうかを、StageSelector（container）に渡す props で確かめる
jest.mock('../../../src/containers/stage-selector.jsx', () => {
    const StageSelectorMock = (props) => (
        <div data-testid="stage-selector-mock" data-hide-header={String(Boolean(props.hideHeader))} />
    );
    return StageSelectorMock;
});
jest.mock('../../../src/containers/sprite-selector-item.jsx', () => () => null);
jest.mock('../../../src/components/sprite-selector/sprite-selector.jsx', () => () => null);

const renderPane = (props) =>
    render(
        <IntlProvider locale="en" messages={{}} onError={() => {}}>
            <TargetPane
                editingTarget="stage"
                sprites={{}}
                stage={{ id: 'stage', costumeCount: 2 }}
                onActivateBlocksTab={() => {}}
                {...props}
            />
        </IntlProvider>,
    );

const hideHeaderOf = (utils) => utils.getByTestId('stage-selector-mock').getAttribute('data-hide-header');

describe('TargetPane hides the stage header only on the middle stage', () => {
    test('middle: hidden', () => {
        expect(hideHeaderOf(renderPane({ stageSize: 'middle' }))).toBe('true');
    });

    test('small / large: shown (upstream)', () => {
        let utils = renderPane({ stageSize: 'small' });
        expect(hideHeaderOf(utils)).toBe('false');
        utils.unmount();
        utils = renderPane({ stageSize: 'large' });
        expect(hideHeaderOf(utils)).toBe('false');
    });

    test('SP sprite panel (keepStageSelectorHeader): shown even on middle', () => {
        expect(hideHeaderOf(renderPane({ stageSize: 'middle', keepStageSelectorHeader: true }))).toBe('false');
    });
});
