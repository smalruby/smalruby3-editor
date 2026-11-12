/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { MobileSpritePanelComponent } from '../../../src/components/mobile-sprite-panel/mobile-sprite-panel.jsx';

// upstream <TargetPane> は VM や Redux store / IntlProvider に依存する
// 重いコンテナなので、unit test ではモックして「active=true のとき
// MobileSpritePanel の portal にレンダリングされる」だけを確認する。
jest.mock('../../../src/containers/target-pane.jsx', () => ({
    __esModule: true,
    default: (props) => (
        <div
            data-testid="target-pane-stub"
            data-stage-size={props.stageSize}
            data-keep-stage-selector-header={String(Boolean(props.keepStageSelectorHeader))}
        />
    ),
}));

const fakeVm = {};

describe('MobileSpritePanel', () => {
    test('renders nothing when active=false', () => {
        const { queryByTestId } = render(
            <MobileSpritePanelComponent active={false} vm={fakeVm} onNewBackdropClick={() => {}} />,
        );
        expect(queryByTestId('mobile-sprite-panel')).not.toBeInTheDocument();
        expect(queryByTestId('target-pane-stub')).not.toBeInTheDocument();
    });

    test('renders panel + TargetPane when active=true', () => {
        const { getByTestId } = render(
            <MobileSpritePanelComponent active={true} vm={fakeVm} onNewBackdropClick={() => {}} />,
        );
        expect(getByTestId('mobile-sprite-panel')).toBeInTheDocument();
        expect(getByTestId('target-pane-stub')).toBeInTheDocument();
    });

    // デスクトップの中サイズのステージでは見出し「ステージ」を消すが、SP の見た目は変えない（#1585）
    test('keeps the stage selector header on SP even though it passes the middle stage size', () => {
        const { getByTestId } = render(
            <MobileSpritePanelComponent active={true} vm={fakeVm} onNewBackdropClick={() => {}} />,
        );
        const pane = getByTestId('target-pane-stub');
        expect(pane).toHaveAttribute('data-stage-size', 'middle');
        expect(pane).toHaveAttribute('data-keep-stage-selector-header', 'true');
    });
});
