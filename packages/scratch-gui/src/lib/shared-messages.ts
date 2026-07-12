import {defineMessages} from 'react-intl';

const reactIntlMessages = defineMessages({
    backdrop: {
        defaultMessage: 'backdrop{index}',
        description: 'Default name for a new backdrop, scratch will automatically adjust the number if necessary',
        id: 'gui.sharedMessages.backdrop'
    },
    costume: {
        defaultMessage: 'costume{index}',
        description: 'Default name for a new costume, scratch will automatically adjust the number if necessary',
        id: 'gui.sharedMessages.costume'
    },
    sprite: {
        defaultMessage: 'Sprite{index}',
        description: 'Default name for a new sprite, scratch will automatically adjust the number if necessary',
        id: 'gui.sharedMessages.sprite'
    },
    pop: {
        defaultMessage: 'pop',
        description: 'Name of the pop sound, the default sound added to a sprite',
        id: 'gui.sharedMessages.pop'
    },
    replaceProjectWarning: {
        id: 'gui.sharedMessages.replaceProjectWarning',
        defaultMessage: 'Replace contents of the current project?',
        description: 'Confirmation that user wants to overwrite the current project contents'
    },
    loadFromComputerTitle: {
        id: 'gui.sharedMessages.loadFromComputerTitle',
        defaultMessage: 'Load from your computer',
        description: 'Title for uploading a project from your computer'
    },
    migrateMeshV1Warning: {
        id: 'gui.sharedMessages.migrateMeshV1Warning',
        defaultMessage: 'This project contains old Mesh blocks. Would you like to migrate them to Mesh V2?',
        description: 'Confirmation that user wants to migrate old Mesh blocks to Mesh V2',
    },
    meshV1AutoMigrated: {
        id: 'gui.sharedMessages.meshV1AutoMigrated',
        defaultMessage:
            'The legacy Mesh service has ended. The blocks in this project have been ' +
            'automatically replaced with the new Mesh blocks. Please verify that it works as expected.',
        description: 'Alert shown after a project containing legacy Mesh blocks is auto-migrated on load',
    },
    meshV1BackpackAutoMigrated: {
        id: 'gui.sharedMessages.meshV1BackpackAutoMigrated',
        defaultMessage:
            '{count, plural, one {# legacy Mesh item in your backpack was} other {# legacy Mesh items in your backpack were}} ' +
            'automatically replaced with the new Mesh blocks.',
        description: 'Alert shown when legacy Mesh blocks/sprites in the backpack are auto-migrated',
    }
});

export default reactIntlMessages;
