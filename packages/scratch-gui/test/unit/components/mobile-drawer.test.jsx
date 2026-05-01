/* eslint-env jest */
import React from 'react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { MobileDrawerComponent } from '../../../src/components/mobile-drawer/mobile-drawer.jsx';

// SB3Downloader と TurboMode は connect されたコンテナで、テスト時に
// Redux Provider 無しで描画すると store エラーになる。render-prop の wrapper として
// モックして spy を渡す。
//
// jest.mock の factory は「mock」prefix の付いた変数しか参照できないため、
// すべて mock... 名で宣言する。
const mockSb3DownloadSpy = jest.fn();
jest.mock('../../../src/containers/sb3-downloader.jsx', () => ({
    __esModule: true,
    default: ({ children }) => children('', mockSb3DownloadSpy),
}));

const mockTurboToggleSpy = jest.fn();
const mockTurboState = { value: false };
jest.mock('../../../src/containers/turbo-mode.jsx', () => ({
    __esModule: true,
    default: ({ children }) => children(mockTurboToggleSpy, { turboMode: mockTurboState.value }),
}));

// classroom-api は CLASSROOM_API_ENDPOINT 環境変数で is configured を返す。
// テストでは個別ケースで切り替えたいので関数自体をモック化する。
jest.mock('../../../src/lib/classroom-api', () => ({
    isClassroomConfigured: jest.fn(() => false),
}));
const { isClassroomConfigured } = jest.requireMock('../../../src/lib/classroom-api');

const fakeIntl = {
    locale: 'en',
    formatMessage: descriptor => descriptor.defaultMessage,
};

const baseProps = () => ({
    open: true,
    onClose: jest.fn(),
    currentLocale: 'en',
    activeRubyVersion: '2',
    isGoogleDriveFile: false,
    vm: { runtime: { targets: [] }, extensionManager: { isExtensionLoaded: () => false } },
    onClickNew: jest.fn(),
    onSelectLocale: jest.fn(),
    onChangeRubyVersion: jest.fn(),
    onOpenClassroomModal: jest.fn(),
    onOpenTeacherModal: jest.fn(),
    onOpenMeshModal: jest.fn(),
    onStartSelectingFileUpload: jest.fn(),
    onStartSelectingGoogleDrive: jest.fn(),
    onSaveDirectlyToGoogleDrive: jest.fn(),
    onStartSavingToGoogleDrive: jest.fn(),
    onStartSelectingUrlLoad: jest.fn(),
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
        mockSb3DownloadSpy.mockClear();
        mockTurboToggleSpy.mockClear();
        mockTurboState.value = false;
    });

    test('does not mark backdrop as open when open=false', () => {
        const { getByTestId } = renderWithIntl({ open: false });
        expect(getByTestId('mobile-drawer-backdrop')).toHaveAttribute('data-state', 'closed');
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

    describe('File > Open from accordion', () => {
        test('open-from is collapsed initially (children hidden)', () => {
            const { queryByTestId } = renderWithIntl();
            expect(queryByTestId('mobile-drawer-open-google-drive')).toBeNull();
            expect(queryByTestId('mobile-drawer-open-device')).toBeNull();
            expect(queryByTestId('mobile-drawer-open-scratch')).toBeNull();
        });

        test('clicking the parent toggle expands children', () => {
            const { getByTestId, queryByTestId } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-file-open'));
            expect(queryByTestId('mobile-drawer-open-google-drive')).toBeInTheDocument();
            expect(queryByTestId('mobile-drawer-open-device')).toBeInTheDocument();
            expect(queryByTestId('mobile-drawer-open-scratch')).toBeInTheDocument();
        });

        test('clicking "Google Drive" calls onStartSelectingGoogleDrive + onClose', () => {
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-file-open'));
            fireEvent.click(getByTestId('mobile-drawer-open-google-drive'));
            expect(props.onStartSelectingGoogleDrive).toHaveBeenCalledTimes(1);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        test('clicking "Device" calls onStartSelectingFileUpload + onClose', () => {
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-file-open'));
            fireEvent.click(getByTestId('mobile-drawer-open-device'));
            expect(props.onStartSelectingFileUpload).toHaveBeenCalledTimes(1);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        test('clicking "Scratch" calls onStartSelectingUrlLoad + onClose', () => {
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-file-open'));
            fireEvent.click(getByTestId('mobile-drawer-open-scratch'));
            expect(props.onStartSelectingUrlLoad).toHaveBeenCalledTimes(1);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('File > Save / Save As (context-sensitive)', () => {
        test('Save: when not Drive file, calls SB3 downloader (download to device)', () => {
            const { getByTestId, props } = renderWithIntl({ isGoogleDriveFile: false });
            fireEvent.click(getByTestId('mobile-drawer-save'));
            expect(mockSb3DownloadSpy).toHaveBeenCalledTimes(1);
            expect(props.onSaveDirectlyToGoogleDrive).not.toHaveBeenCalled();
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        test('Save: when Drive file, calls onSaveDirectlyToGoogleDrive', () => {
            const { getByTestId, props } = renderWithIntl({ isGoogleDriveFile: true });
            fireEvent.click(getByTestId('mobile-drawer-save'));
            expect(props.onSaveDirectlyToGoogleDrive).toHaveBeenCalledWith(true);
            expect(mockSb3DownloadSpy).not.toHaveBeenCalled();
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        test('Save As: when not Drive file, calls SB3 downloader', () => {
            const { getByTestId, props } = renderWithIntl({ isGoogleDriveFile: false });
            fireEvent.click(getByTestId('mobile-drawer-save-as'));
            expect(mockSb3DownloadSpy).toHaveBeenCalledTimes(1);
            expect(props.onStartSavingToGoogleDrive).not.toHaveBeenCalled();
        });

        test('Save As: when Drive file, calls onStartSavingToGoogleDrive', () => {
            const { getByTestId, props } = renderWithIntl({ isGoogleDriveFile: true });
            fireEvent.click(getByTestId('mobile-drawer-save-as'));
            expect(props.onStartSavingToGoogleDrive).toHaveBeenCalledTimes(1);
            expect(mockSb3DownloadSpy).not.toHaveBeenCalled();
        });
    });

    describe('Edit > Turbo Mode', () => {
        test('clicking turbo mode toggles via TurboMode container (does not close drawer)', () => {
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-turbo-mode'));
            expect(mockTurboToggleSpy).toHaveBeenCalledTimes(1);
            // ターボはトグルなのでドロワーは閉じない
            expect(props.onClose).not.toHaveBeenCalled();
        });

        test('shows checkmark when turbo mode is on', () => {
            mockTurboState.value = true;
            const { getByTestId } = renderWithIntl();
            expect(getByTestId('mobile-drawer-turbo-mode')).toHaveAttribute('data-turbo-mode', 'on');
            expect(getByTestId('mobile-drawer-turbo-mode')).toHaveAttribute('aria-pressed', 'true');
        });
    });

    test('tutorials menu item is not rendered (SP unsupported)', () => {
        const { queryByTestId } = renderWithIntl();
        expect(queryByTestId('mobile-drawer-tutorials')).toBeNull();
    });

    test('classroom is hidden when not configured', () => {
        isClassroomConfigured.mockReturnValue(false);
        const { queryByTestId } = renderWithIntl();
        expect(queryByTestId('mobile-drawer-classroom')).toBeNull();
        expect(queryByTestId('mobile-drawer-classroom-management')).toBeNull();
    });

    test('classroom (student) is shown and clicking it calls onOpenClassroomModal', () => {
        isClassroomConfigured.mockReturnValue(true);
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-drawer-classroom'));
        expect(props.onOpenClassroomModal).toHaveBeenCalledTimes(1);
        expect(props.onOpenTeacherModal).not.toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('mesh is hidden when meshV2 extension is not loaded', () => {
        const { queryByTestId } = renderWithIntl();
        expect(queryByTestId('mobile-drawer-mesh')).toBeNull();
    });

    test('mesh is shown and clicking it calls onOpenMeshModal("meshV2")', () => {
        const vm = {
            runtime: { targets: [] },
            extensionManager: { isExtensionLoaded: id => id === 'meshV2' },
        };
        const { getByTestId, props } = renderWithIntl({ vm });
        fireEvent.click(getByTestId('mobile-drawer-mesh'));
        expect(props.onOpenMeshModal).toHaveBeenCalledWith('meshV2');
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    describe('Settings accordion', () => {
        test('settings is collapsed initially (language / ruby children hidden)', () => {
            const { queryByTestId } = renderWithIntl();
            expect(queryByTestId('mobile-drawer-toggle-settings-language')).toBeNull();
            expect(queryByTestId('mobile-drawer-toggle-settings-ruby')).toBeNull();
            expect(queryByTestId('mobile-drawer-locale-ja')).toBeNull();
            expect(queryByTestId('mobile-drawer-ruby-version-1')).toBeNull();
        });

        test('expanding settings reveals language / ruby toggles (still collapsed)', () => {
            const { getByTestId, queryByTestId } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
            expect(getByTestId('mobile-drawer-toggle-settings-language')).toBeInTheDocument();
            expect(getByTestId('mobile-drawer-toggle-settings-ruby')).toBeInTheDocument();
            // 子の言語項目はまだ閉じている
            expect(queryByTestId('mobile-drawer-locale-ja')).toBeNull();
        });

        test('expanding settings then language reveals locale items + click works', () => {
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings-language'));
            fireEvent.click(getByTestId('mobile-drawer-locale-ja'));
            expect(props.onSelectLocale).toHaveBeenCalledWith('ja');
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        test('expanding settings then ruby reveals version items + click works', () => {
            const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '2' });
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings-ruby'));
            fireEvent.click(getByTestId('mobile-drawer-ruby-version-1'));
            expect(props.onChangeRubyVersion).toHaveBeenCalledWith('1');
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        test('switching to v1 with v2 features (class) shows alert', () => {
            const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
            const vm = {
                runtime: { targets: [{ comments: { c1: { text: '@ruby:class:Foo' } } }] },
                extensionManager: { isExtensionLoaded: () => false },
            };
            try {
                const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '2', vm });
                fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
                fireEvent.click(getByTestId('mobile-drawer-toggle-settings-ruby'));
                fireEvent.click(getByTestId('mobile-drawer-ruby-version-1'));
                expect(alertSpy).toHaveBeenCalledTimes(1);
                expect(props.onChangeRubyVersion).not.toHaveBeenCalled();
            } finally {
                alertSpy.mockRestore();
            }
        });

        test('switching to v2 with koshien loaded shows alert', () => {
            const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
            const vm = {
                runtime: { targets: [] },
                extensionManager: { isExtensionLoaded: ext => ext === 'koshien' },
            };
            try {
                const { getByTestId, props } = renderWithIntl({ activeRubyVersion: '1', vm });
                fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
                fireEvent.click(getByTestId('mobile-drawer-toggle-settings-ruby'));
                fireEvent.click(getByTestId('mobile-drawer-ruby-version-2'));
                expect(alertSpy).toHaveBeenCalledTimes(1);
                expect(props.onChangeRubyVersion).not.toHaveBeenCalled();
            } finally {
                alertSpy.mockRestore();
            }
        });

        test('classroom management is hidden when classroom not configured (even inside settings)', () => {
            isClassroomConfigured.mockReturnValue(false);
            const { getByTestId, queryByTestId } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
            expect(queryByTestId('mobile-drawer-classroom-management')).toBeNull();
        });

        test('classroom management is shown inside settings when configured', () => {
            isClassroomConfigured.mockReturnValue(true);
            const { getByTestId, props } = renderWithIntl();
            fireEvent.click(getByTestId('mobile-drawer-toggle-settings'));
            fireEvent.click(getByTestId('mobile-drawer-classroom-management'));
            expect(props.onOpenTeacherModal).toHaveBeenCalledTimes(1);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });
    });
});
