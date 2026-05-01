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

// classroom-api は CLASSROOM_API_ENDPOINT 環境変数で is configured を返す。
// テストでは個別ケースで切り替えたいので関数自体をモック化する。
jest.mock('../../../src/lib/classroom-api', () => ({
    isClassroomConfigured: jest.fn(() => false),
}));
const { isClassroomConfigured } = jest.requireMock('../../../src/lib/classroom-api');

// persistRubyVersion は Ruby version 切替時に呼ばれるが、jsdom 上では localStorage
// に書き込んで終わりなので副作用なしで安全。モックは不要。

const fakeIntl = {
    locale: 'en',
    formatMessage: descriptor => descriptor.defaultMessage,
};

const baseProps = () => ({
    open: true,
    onClose: jest.fn(),
    currentLocale: 'en',
    activeRubyVersion: '2',
    vm: { runtime: { targets: [] }, extensionManager: { isExtensionLoaded: () => false } },
    onClickNew: jest.fn(),
    onSelectLocale: jest.fn(),
    onChangeRubyVersion: jest.fn(),
    onOpenBlockDisplayModal: jest.fn(),
    onOpenTeacherModal: jest.fn(),
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
    beforeEach(() => {
        isClassroomConfigured.mockReturnValue(false);
    });

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

    test('clicking "Reload" calls window.location.reload + onClose', () => {
        const reload = jest.fn();
        const originalLocation = window.location;
        // jsdom の window.location は writable: false なので一時的に置換する。
        delete window.location;
        window.location = { ...originalLocation, reload };
        try {
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-reload'));
            expect(reload).toHaveBeenCalledTimes(1);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        } finally {
            window.location = originalLocation;
        }
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

    test('clicking "Block Display" calls onOpenBlockDisplayModal + onClose', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-block-display'));
        expect(props.onOpenBlockDisplayModal).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('classroom item is hidden when not configured', () => {
        isClassroomConfigured.mockReturnValue(false);
        const { queryByTestId } = renderWithIntl();
        expect(queryByTestId('mobile-drawer-classroom')).toBeNull();
    });

    test('classroom item is shown and clicking it calls onOpenTeacherModal + onClose', () => {
        isClassroomConfigured.mockReturnValue(true);
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-classroom'));
        expect(props.onOpenTeacherModal).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking a Ruby version calls onChangeRubyVersion + onClose', () => {
        const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '2' });
        fireEvent.click(getByTestId('mobile-drawer-ruby-version-1'));
        expect(props.onChangeRubyVersion).toHaveBeenCalledWith('1');
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('selected Ruby version gets the selected attribute', () => {
        const { getByTestId } = renderWithIntl({ activeRubyVersion: '1' });
        expect(getByTestId('mobile-drawer-ruby-version-1')).toHaveAttribute('data-selected', 'true');
        expect(getByTestId('mobile-drawer-ruby-version-2')).toHaveAttribute('data-selected', 'false');
    });

    test('clicking the already-active Ruby version is a no-op (does not call onChange)', () => {
        const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '2' });
        fireEvent.click(getByTestId('mobile-drawer-ruby-version-2'));
        expect(props.onChangeRubyVersion).not.toHaveBeenCalled();
        // ただしドロワーは閉じる
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('switching to v1 with v2 features (class) shows alert and does not change version', () => {
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
        const vm = {
            runtime: {
                targets: [
                    {
                        comments: {
                            c1: { text: '@ruby:class:Foo' },
                        },
                    },
                ],
            },
            extensionManager: { isExtensionLoaded: () => false },
        };
        try {
            const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '2', vm });
            fireEvent.click(getByTestId('mobile-drawer-ruby-version-1'));
            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(props.onChangeRubyVersion).not.toHaveBeenCalled();
        } finally {
            alertSpy.mockRestore();
        }
    });

    test('switching to v2 with koshien loaded shows alert and does not change version', () => {
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
        const vm = {
            runtime: { targets: [] },
            extensionManager: { isExtensionLoaded: ext => ext === 'koshien' },
        };
        try {
            const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '1', vm });
            fireEvent.click(getByTestId('mobile-drawer-ruby-version-2'));
            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(props.onChangeRubyVersion).not.toHaveBeenCalled();
        } finally {
            alertSpy.mockRestore();
        }
    });
});
