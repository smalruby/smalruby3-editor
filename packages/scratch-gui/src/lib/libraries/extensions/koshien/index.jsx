let formatMessage = messageData => messageData.defaultMessage;

/**
 * Koshien extension
 */

import koshienIconURL from './koshien.png';
import koshienInsetIconURL from './koshien-small.png';
import translations from './translations.json';

const entry = {
    get name () {
        return formatMessage({
            defaultMessage: 'Smalruby Koshien',
            description: "Name for the 'koshien' extension",
            id: 'koshien.entry.name'
        });
    },
    extensionId: 'koshien',
    iconURL: koshienIconURL,
    insetIconURL: koshienInsetIconURL,
    get description () {
        return formatMessage({
            defaultMessage: 'Smalruby Koshien AI.',
            description: "Description for the 'koshien' extension",
            id: 'koshien.entry.description'
        });
    },
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: false,
    launchPeripheralConnectionFlow: false,
    useAutoScan: false,
    helpLink: 'https://smalruby-koshien.netlab.jp/',
    setFormatMessage: formatter => {
        formatMessage = formatter;
    },
    translationMap: translations
};

export {entry}; // loadable-extension needs this line.
export default entry;
