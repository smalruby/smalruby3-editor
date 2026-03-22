let formatMessage = messageData => messageData.defaultMessage;

/**
 * Smalruby Ruby extension - Ruby string manipulation methods
 */

import smalrubyRubyIconURL from './smalruby-ruby.svg';
import smalrubyRubyInsetIconURL from './smalruby-ruby-small.svg';
import translations from './translations.json';

const entry = {
    get name () {
        return formatMessage({
            defaultMessage: 'Ruby',
            description: "Name for the 'smalrubyRuby' extension",
            id: 'smalrubyRuby.entry.name'
        });
    },
    extensionId: 'smalrubyRuby',
    iconURL: smalrubyRubyIconURL,
    insetIconURL: smalrubyRubyInsetIconURL,
    get description () {
        return formatMessage({
            defaultMessage: 'Use Ruby string manipulation methods.',
            description: "Description for the 'smalrubyRuby' extension",
            id: 'smalrubyRuby.entry.description'
        });
    },
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: false,
    launchPeripheralConnectionFlow: false,
    useAutoScan: false,
    setFormatMessage: formatter => {
        formatMessage = formatter;
    },
    translationMap: translations
};

export {entry}; // loadable-extension needs this line.
export default entry;
