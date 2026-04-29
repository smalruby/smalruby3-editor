/* eslint-env jest */
import React from 'react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { MobileDrawerComponent } from '../../../src/components/mobile-drawer/mobile-drawer.jsx';

// SB3Downloader は connect(state.scratchGui.vm.saveProjectSb3) を使うため、
// 単体テストでは Redux Provider 無しで描画すると store エラーになる。
// 保存メニューの「クリックで onClose する」挙動はクリック先のコールバックを
// fakeDownloader として渡して検証する。
jest.mock('../../../src/containers/sb3-downloader.jsx', () => ({
    __esModule: true,
    default: ({ children }) => children('', () => {}),
}));

const fakeIntl = {
    locale: 'en',
    formatMessage: descriptor => descriptor.defaultMessage,
};

const baseProps = () => ({
    open: true,
    onClose: jest.fn(),
    currentLocale: 'en',
    onClickNew: jest.fn(),
    onSelectLocale: jest.fn(),
    onStartSelectingFileUpload: jest.fn(),
    intl: fakeIntl,
});

const renderWithIntl = props => {
    const merged = { ...baseProps(), ...props };
    return {
        ...render(
            <IntlProvider locale="en" messages={{}}>
                <MobileDrawerComponent {...merged} />
            </IntlProvider>,
        ),
        props: merged,
    };
};

describe('MobileDrawer', () => {
    test('does not mark backdrop as open when open=false', () => {
        const { queryByTestId } = renderWithIntl({ open: false });
        const backdrop = queryByTestId('mobile-drawer-backdrop');
        expect(backdrop).toBeInTheDocument();
        expect(backdrop).toHaveAttribute('data-state', 'closed');
    });

    test('marks backdrop / drawer as open when open=true', () => {
        const { getByTestId } = renderWithIntl();
        expect(getByTestId('mobile-drawer-backdrop')).toHaveAttribute('data-state', 'open');
        expect(getByTestId('mobile-drawer')).toHaveAttribute('data-state', 'open');
    });

    test('clicking backdrop calls onClose', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-backdrop'));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking close button calls onClose', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-close'));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking "New" calls onClickNew + onClose', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-new'));
        expect(props.onClickNew).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking "Load from computer" triggers SBFileUploader + onClose', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-load'));
        expect(props.onStartSelectingFileUpload).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking "Save" calls onClose (download is wired via SB3Downloader)', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-save'));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking a locale calls onSelectLocale with code + onClose', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-locale-ja'));
        expect(props.onSelectLocale).toHaveBeenCalledWith('ja');
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('selected locale gets the selected attribute', () => {
        const { getByTestId } = renderWithIntl({ currentLocale: 'ja' });
        expect(getByTestId('mobile-drawer-locale-ja')).toHaveAttribute('data-selected', 'true');
        expect(getByTestId('mobile-drawer-locale-en')).toHaveAttribute('data-selected', 'false');
    });
});
