/**
 * Icons (tm2scratch.png, tm2scratch-small.png) are from champierre/tm2scratch.
 * Original copyright: (c) Junya Ishihara and Koji Yokokawa, AGPL-3.0.
 * See https://github.com/champierre/tm2scratch
 */
let formatMessage = (messageData) => messageData.defaultMessage;

import tm2scratchIconURL from './tm2scratch.png';
import tm2scratchInsetIconURL from './tm2scratch-small.png';
import translations from './translations.json';

const entry = {
    get name() {
        return formatMessage({
            defaultMessage: 'TM2Scratch',
            description: "Name for the 'tm2scratch' extension",
            id: 'tm2scratch.entry.name',
        });
    },
    extensionId: 'tm2scratch',
    iconURL: tm2scratchIconURL,
    insetIconURL: tm2scratchInsetIconURL,
    get description() {
        return formatMessage({
            defaultMessage:
                'Use image/sound recognition with Teachable Machine.',
            description: "Description for the 'tm2scratch' extension",
            id: 'tm2scratch.entry.description',
        });
    },
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: true,
    launchPeripheralConnectionFlow: false,
    useAutoScan: false,
    helpLink: 'https://github.com/champierre/tm2scratch',
    setFormatMessage: (formatter) => {
        formatMessage = formatter;
    },
    translationMap: translations,
};

export { entry }; // loadable-extension needs this line.
export default entry;
