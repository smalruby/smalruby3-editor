/* eslint-env jest */
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { MobileSpritePanelComponent } from '../../../src/components/mobile-sprite-panel/mobile-sprite-panel.jsx';

// upstream <TargetPane> は VM や Redux store / IntlProvider に依存する
// 重いコンテナなので、unit test ではモックして「active=true のとき
// MobileSpritePanel の portal にレンダリングされる」だけを確認する。
jest.mock('../../../src/containers/target-pane.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid="target-pane-stub" />,
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
});
