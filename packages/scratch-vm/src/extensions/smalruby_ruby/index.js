const formatMessage = require('format-message');
const Variable = require('../../engine/variable');
const translations = require('./translations.json');

const { getBlocks, menus } = require('./block-definitions');

const {
    executeStringMethod,
    executeArrayMethod,
    executeHashMethod,
} = require('./method-executors');

const {
    executeArrayMethodWithBlock,
    executeNumberMethodWithBlock,
} = require('./block-method-executors');

const blockIconURI = require('./ruby-logo-icon-uri');

const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale],
        );
    }
};

class SmalrubyRubyBlocks {
    static get CATEGORY_NAME() {
        return 'Ruby';
    }

    static get EXTENSION_ID() {
        return 'smalrubyRuby';
    }

    constructor(runtime) {
        this.runtime = runtime;
        if (formatMessage) setupTranslations();
    }

    getInfo() {
        setupTranslations();
        return {
            id: SmalrubyRubyBlocks.EXTENSION_ID,
            name: formatMessage({
                id: 'smalrubyRuby.categoryName',
                default: 'Ruby',
                description: 'Label for the ruby extension category',
            }),
            blockIconURI: blockIconURI,
            blocks: getBlocks(),
            menus: menus,
            translationMap: translations,
        };
    }

    // --- Thread-local return value helpers ---

    /**
     * Store a return value on the current thread.
     * @param {object} util - Block utility (has util.thread).
     * @param {*} value - The value to store.
     */
    _setReturnValue(util, value) {
        util.thread._smalrubyReturnValue = value;
    }

    /**
     * Get the return value from the current thread.
     * @param {object} util - Block utility.
     * @returns {*} The stored return value, or '' if none.
     */
    _getReturnValue(util) {
        const rv = util.thread._smalrubyReturnValue;
        return rv === undefined || rv === null ? '' : rv;
    }

    // --- Return value blocks ---

    returnValue(_args, util) {
        return this._getReturnValue(util);
    }

    returnValueTruthy(_args, util) {
        const rv = util.thread._smalrubyReturnValue;
        // Ruby truthiness: nil and false are falsy, everything else is truthy
        if (
            rv === null ||
            rv === undefined ||
            rv === false ||
            rv === 'false' ||
            rv === ''
        ) {
            return false;
        }
        return true;
    }

    // --- Block parameter ---

    blockParam(args, util) {
        const param = args.PARAM || '_1';
        const params = util.thread._smalrubyBlockParams;
        if (params && params[param] !== undefined) {
            return params[param];
        }
        return '';
    }

    // --- Method execution blocks (per class) ---

    stringMethod(args, util) {
        executeStringMethod(args, util, this._setReturnValue);
    }

    arrayMethod(args, util) {
        executeArrayMethod(args, util, this._setReturnValue);
    }

    hashMethod(args, util) {
        executeHashMethod(args, util, this._setReturnValue);
    }

    arrayMethodWithBlock(args, util) {
        executeArrayMethodWithBlock(args, util, this._setReturnValue);
    }

    numberMethodWithBlock(args, util) {
        executeNumberMethodWithBlock(args, util, this._setReturnValue);
    }

    // --- Variable names menu ---

    getVariableNamesMenuItems() {
        const sprite = this.runtime.getEditingTarget();
        if (!sprite) return [' '];
        return [' '].concat(
            sprite.getAllVariableNamesInScopeByType(Variable.SCALAR_TYPE),
        );
    }
}

module.exports = SmalrubyRubyBlocks;
