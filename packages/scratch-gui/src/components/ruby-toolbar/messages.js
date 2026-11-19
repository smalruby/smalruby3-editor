// === Smalruby: This file is Smalruby-specific (Ruby toolbar i18n messages) ===
import { defineMessages } from 'react-intl';

const messages = defineMessages({
    executeLine: {
        id: 'gui.rubyToolbar.executeLine',
        defaultMessage: 'Execute current line',
        description: 'Tooltip for execute line button',
    },
    executeAll: {
        id: 'gui.rubyToolbar.executeAll',
        defaultMessage: 'Run all',
        description: 'Tooltip for execute all button in DNCL mode',
    },
    modeFurigana: {
        id: 'gui.rubyToolbar.modeFurigana',
        defaultMessage: 'Ruby with furigana',
        description: 'Tooltip for Ruby furigana mode button',
    },
    modeFuriganaLine1: {
        id: 'gui.rubyToolbar.modeFuriganaLine1',
        defaultMessage: 'Ruby',
        description: 'First line of Ruby furigana mode button label',
    },
    modeFuriganaLine2: {
        id: 'gui.rubyToolbar.modeFuriganaLine2',
        defaultMessage: 'Furigana',
        description: 'Second line of Ruby furigana mode button label',
    },
    modeRuby: {
        id: 'gui.rubyToolbar.modeRuby',
        defaultMessage: 'Ruby mode',
        description: 'Tooltip for Ruby mode button',
    },
    stopExecution: {
        id: 'gui.rubyToolbar.stopExecution',
        defaultMessage: 'Stop execution',
        description: 'Tooltip for stop execution button',
    },
    search: {
        id: 'gui.rubyToolbar.search',
        defaultMessage: 'Search',
        description: 'Tooltip for search button',
    },
    keyboardShow: {
        id: 'gui.rubyToolbar.keyboardShow',
        defaultMessage: 'Show keyboard',
        description: 'Tooltip for keyboard toggle button when the software keyboard is hidden',
    },
    keyboardHide: {
        id: 'gui.rubyToolbar.keyboardHide',
        defaultMessage: 'Hide keyboard',
        description: 'Tooltip for keyboard toggle button when the software keyboard is shown',
    },
    undo: {
        id: 'gui.rubyToolbar.undo',
        defaultMessage: 'Undo',
        description: 'Tooltip for undo button',
    },
    redo: {
        id: 'gui.rubyToolbar.redo',
        defaultMessage: 'Redo',
        description: 'Tooltip for redo button',
    },
    prevSprite: {
        id: 'gui.rubyToolbar.prevSprite',
        defaultMessage: 'Previous sprite',
        description: 'Tooltip for previous sprite button',
    },
    nextSprite: {
        id: 'gui.rubyToolbar.nextSprite',
        defaultMessage: 'Next sprite',
        description: 'Tooltip for next sprite button',
    },
    commandPlaceholder: {
        id: 'gui.rubyToolbar.commandPlaceholder',
        defaultMessage: 'Search sprites by name',
        description: 'Placeholder for command input',
    },
    download: {
        id: 'gui.rubyToolbar.download',
        defaultMessage: 'Download Ruby code',
        description: 'Tooltip for download button',
    },
    furiganaOn: {
        id: 'gui.rubyToolbar.furiganaOn',
        defaultMessage: 'Hide furigana',
        description: 'Tooltip for furigana toggle button when ON',
    },
    furiganaOff: {
        id: 'gui.rubyToolbar.furiganaOff',
        defaultMessage: 'Show furigana',
        description: 'Tooltip for furigana toggle button when OFF',
    },
    autoCorrectOn: {
        id: 'gui.rubyToolbar.autoCorrectOn',
        defaultMessage: 'Disable auto-correct',
        description: 'Tooltip for auto-correct toggle button when ON',
    },
    autoCorrectOff: {
        id: 'gui.rubyToolbar.autoCorrectOff',
        defaultMessage: 'Enable auto-correct',
        description: 'Tooltip for auto-correct toggle button when OFF',
    },
    moreOptions: {
        id: 'gui.rubyToolbar.moreOptions',
        defaultMessage: 'More options',
        description: 'Tooltip for three-dot menu button',
    },
    autoCorrectSettings: {
        id: 'gui.rubyToolbar.autoCorrectSettings',
        defaultMessage: 'Auto-Correct Settings',
        description: 'Label for auto-correct settings menu item',
    },
    saveRubyScript: {
        id: 'gui.rubyToolbar.saveRubyScript',
        defaultMessage: 'Save Ruby script',
        description: 'Label for save Ruby script menu item',
    },
    insertClass: {
        id: 'gui.rubyToolbar.insertClass',
        defaultMessage: 'Insert class',
        description: 'Label for insert class menu item in More menu',
    },
    copyProblemForm: {
        id: 'gui.rubyToolbar.copyProblemForm',
        defaultMessage: 'Copy in the form of the test questions',
        description: 'More menu item of the Japanese mode: copy the program with line numbers and rules',
    },
    settingsPatternExample: {
        id: 'gui.rubyToolbar.settingsPatternExample',
        defaultMessage: 'Settings: the form of the examples (indices from 0)',
        description: 'More menu item of the Japanese mode: write the program by the settings of the examples',
    },
    settingsPatternIndexFromOne: {
        id: 'gui.rubyToolbar.settingsPatternIndexFromOne',
        defaultMessage: 'Settings: a problem whose indices start at 1',
        description:
            'More menu item of the Japanese mode: write the program by the settings of a problem whose indices start at 1',
    },
    previewRubyScript: {
        id: 'gui.rubyToolbar.previewRubyScript',
        defaultMessage: 'Preview Ruby script',
        description: 'Label for preview Ruby script menu item in More menu',
    },
    stage: {
        id: 'gui.rubyToolbar.stage',
        defaultMessage: 'Stage',
        description: 'Name for stage target',
    },
});

export default messages;
