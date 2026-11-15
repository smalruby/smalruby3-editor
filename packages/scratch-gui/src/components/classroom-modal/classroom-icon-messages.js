import { defineMessages } from 'react-intl';

// Names of the icon buttons of class management (#1924 C11), defined once:
// ↻ is named「読み込み直す」everywhere (members tab, welcome back, the status
// and classmates' work panels), and ⛶ shows「全画面」next to it.
const classroomIconMessages = defineMessages({
    refresh: {
        defaultMessage: 'Reload',
        description: 'Name of the ↻ button that reads the class status again',
        id: 'gui.classroom.refresh',
    },
    fullscreen: {
        defaultMessage: 'Full screen',
        description: 'Text next to the ⛶ icon of the button that shows the join code full screen',
        id: 'gui.classroom.joinCode.fullscreenShort',
    },
});

export default classroomIconMessages;
