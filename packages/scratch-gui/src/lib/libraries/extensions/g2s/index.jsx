/*
 * AkaDako extension for Smalruby.
 * Original source: https://github.com/tfabworks/xcx-g2s (MIT License)
 * Copyright (c) 2026 TFabWorks
 */
let formatMessage = (messageData) => messageData.defaultMessage;

import g2sIconURL from './g2s.png';
import g2sInsetIconURL from './g2s-small.png';
import translations from './translations.json';

const entry = {
    get name() {
        return formatMessage({
            defaultMessage: 'AkaDako',
            description: "Name for the 'g2s' extension",
            id: 'g2s.entry.name',
        });
    },
    extensionId: 'g2s',
    iconURL: g2sIconURL,
    insetIconURL: g2sInsetIconURL,
    get description() {
        return formatMessage({
            defaultMessage: 'Connect Grove sensors and actuators.',
            description: "Description for the 'g2s' extension",
            id: 'g2s.entry.description',
        });
    },
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: false,
    launchPeripheralConnectionFlow: false,
    useAutoScan: false,
    helpLink: 'https://akadako.com/',
    collaborator: 'TFabWorks',
    setFormatMessage: (formatter) => {
        formatMessage = formatter;
    },
    translationMap: translations,
};

export { entry }; // loadable-extension needs this line.
export default entry;
