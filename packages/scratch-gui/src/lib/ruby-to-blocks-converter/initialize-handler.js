// === Smalruby: This file is Smalruby-specific (initialize handler for Ruby-to-blocks converter) ===
import { messages } from './converter-errors';
import { RubyToBlocksConverterError } from './errors';

/**
 * Mixin methods for processing def initialize in the Ruby-to-blocks converter.
 * These methods are mixed into RubyToBlocksConverter.prototype via Object.assign.
 * @type {object}
 */
const InitializeHandler = {
    /**
     * Process def initialize in a class body: make the variables and the lists that it sets, keep
     * their values for the target (`initializeValues`) and make the comment `@ruby:initialize:...`.
     * What each line sets is decided by the analysis stage (`initializes` of `class-analysis.js`).
     * @param {object} initialize - The structure of the def initialize.
     */
    _processInitialize(initialize) {
        const defNode = initialize.node;
        this._checkNoExceptionHandling(defNode.body);
        const commentParts = [];

        // Save arguments if present
        if (initialize.parameters) {
            let params = this._getSource(initialize.parameters);
            if (params) {
                // Ensure params are wrapped in parentheses for unambiguous round-trip
                if (!params.startsWith('(')) {
                    params = `(${params})`;
                }
                commentParts.push(`args=${params}`);
            }
        }

        // super on the first line
        if (initialize.superArgs) {
            const argsSource = initialize.superArgs.map((a) => this._getSource(a)).join(', ');
            commentParts.push(`super=(${argsSource})`);
        } else if (initialize.hasSuper) {
            commentParts.push('super');
        }

        // The variable/list assignments (`@a` in a sprite, `$a` in the Stage)
        const initializeValues = {};
        for (const statement of initialize.statements) {
            const stmt = statement.node;
            if (statement.error) {
                const source = this._getSource(stmt);
                throw new RubyToBlocksConverterError(
                    stmt,
                    this._translator(messages[statement.error.message], {
                        SOURCE: statement.error.truncated ? this._truncateSource(source) : source,
                        ...statement.error.values,
                    }),
                );
            }
            if (statement.isList) {
                // `@_a_list_` is the list `a` beside the variable `a` (issue #1622)
                const list = this._lookupOrCreateList(statement.rubyName);
                // A copy: the table of the analysis is frozen, and the list of the target is changed
                initializeValues[`list:${list.name}`] = {
                    name: list.name,
                    value: [...statement.value],
                    type: 'list',
                };
            } else {
                const variable = this._lookupOrCreateVariable(statement.rubyName);
                initializeValues[`:${variable.name}`] = { name: variable.name, value: statement.value, type: '' };
            }
        }

        this._context.initializeValues = initializeValues;
        // The variables of attr_accessor / attr_reader / attr_writer set here. The generator does not
        // write those variables in initialize unless they are named in the comment (issue #1839).
        if (initialize.attrNames.length > 0) {
            commentParts.push(`attr=${initialize.attrNames.join('+')}`);
        }

        // Create comment for round-trip
        if (commentParts.length > 0) {
            this._createComment(`@ruby:initialize:${commentParts.join(',')}`, null);
        }
    },
};

export default InitializeHandler;
