/**
 * Smalruby console extension - 表示する and 入力する of the Japanese mode
 */
import consoleInsetIconURL from './smalruby-console-small.svg';
import consoleIconURL from './smalruby-console.svg';
import translations from './translations.json';

let formatMessage = (messageData) => messageData.defaultMessage;

const entry = {
    get name() {
        return formatMessage({
            defaultMessage: 'Console',
            description: "Name for the 'console' extension",
            id: 'smalrubyConsole.entry.name',
        });
    },
    extensionId: 'smalrubyConsole',
    iconURL: consoleIconURL,
    insetIconURL: consoleInsetIconURL,
    get description() {
        return formatMessage({
            defaultMessage: 'Print text and take input.',
            description: "Description for the 'console' extension",
            id: 'smalrubyConsole.entry.description',
        });
    },
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: false,
    launchPeripheralConnectionFlow: false,
    useAutoScan: false,
    setFormatMessage: (formatter) => {
        formatMessage = formatter;
    },
    translationMap: translations,
};

export { entry }; // loadable-extension needs this line.
export default entry;
