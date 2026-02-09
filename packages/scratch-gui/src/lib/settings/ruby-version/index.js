import {defineMessages} from 'react-intl';

const VERSION_1 = '1';
const VERSION_2 = '2';

const messages = defineMessages({
    [VERSION_1]: {
        id: 'gui.rubyVersion.v1',
        defaultMessage: 'v1 (default)',
        description: 'label for legacy Ruby version (v1)'
    },
    [VERSION_2]: {
        id: 'gui.rubyVersion.v2',
        defaultMessage: 'v2',
        description: 'label for standard Ruby version (v2)'
    },
    rubyMenu: {
        id: 'gui.menuBar.rubyVersion',
        defaultMessage: 'Ruby',
        description: 'Ruby version sub-menu'
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
