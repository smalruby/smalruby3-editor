import {defineMessages} from 'react-intl';

const VERSION_1 = '1';
const VERSION_2 = '2';

const messages = defineMessages({
    [VERSION_1]: {
        id: 'gui.rubyVersion.v1',
        defaultMessage: 'v1',
        description: 'label for legacy Ruby version (v1)'
    },
    [VERSION_2]: {
        id: 'gui.rubyVersion.v2',
        defaultMessage: 'v2 (default)',
        description: 'label for standard Ruby version (v2)'
    },
    rubyMenu: {
        id: 'gui.menuBar.rubyVersion',
        defaultMessage: 'Ruby',
        description: 'Ruby version sub-menu'
    },
    cannotSwitchToV1: {
        id: 'gui.menuBar.cannotSwitchToV1',
        defaultMessage: 'Cannot switch to v1 because v2 features (module, class) are in use.' +
            '\nRemove all module/class definitions first.',
        description: 'Alert message when trying to switch to v1 with v2 features in use'
    }
});

const rubyVersionMap = {
    [VERSION_1]: {
        label: messages[VERSION_1]
    },
    [VERSION_2]: {
        label: messages[VERSION_2]
    }
};

export {
    VERSION_1,
    VERSION_2,
    rubyVersionMap,
    messages
};
