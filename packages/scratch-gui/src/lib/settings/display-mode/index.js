import {defineMessages} from 'react-intl';

/**
 * 表示モードのユーザー設定 (Issue #865)。
 *
 * - `auto`    : viewport から自動判定 (既定)。狭い画面なら MobileGui。
 * - `desktop` : viewport に関係なく常に PC (desktop) GUI。
 * - `mobile`  : viewport に関係なく常に MobileGui。
 *
 * Chromebook でズームすると高さが縮んで意図せずスマホモードになってしまう
 * 問題への対策として、ユーザーが明示的に PC モードへ固定できるようにする。
 * 固定は localStorage に保存され、そのマシンでは以後ずっと維持される
 * (設定メニュー / モバイルドロワーからいつでも変更可能)。
 */
const DISPLAY_MODE_AUTO = 'auto';
const DISPLAY_MODE_DESKTOP = 'desktop';
const DISPLAY_MODE_MOBILE = 'mobile';

const messages = defineMessages({
    displayModeMenu: {
        id: 'gui.menuBar.displayMode',
        defaultMessage: 'Display mode',
        description: 'Display mode (auto / PC / mobile) sub-menu label in the settings menu'
    },
    [DISPLAY_MODE_AUTO]: {
        id: 'gui.displayMode.auto',
        defaultMessage: 'Automatic',
        description: 'Label for the automatic (viewport-based) display mode'
    },
    [DISPLAY_MODE_DESKTOP]: {
        id: 'gui.displayMode.desktop',
        defaultMessage: 'PC mode',
        description: 'Label for the forced desktop (PC) display mode'
    },
    [DISPLAY_MODE_MOBILE]: {
        id: 'gui.displayMode.mobile',
        defaultMessage: 'Smartphone mode',
        description: 'Label for the forced mobile (smartphone) display mode'
    }
});

const displayModeMap = {
    [DISPLAY_MODE_AUTO]: {
        label: messages[DISPLAY_MODE_AUTO]
    },
    [DISPLAY_MODE_DESKTOP]: {
        label: messages[DISPLAY_MODE_DESKTOP]
    },
    [DISPLAY_MODE_MOBILE]: {
        label: messages[DISPLAY_MODE_MOBILE]
    }
};

export {
    DISPLAY_MODE_AUTO,
    DISPLAY_MODE_DESKTOP,
    DISPLAY_MODE_MOBILE,
    displayModeMap,
    messages
};
