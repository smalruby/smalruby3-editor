// === Smalruby: This file is Smalruby-specific (initialize handler for Ruby-to-blocks converter) ===

import {RubyToBlocksConverterError} from './errors';
import {messages} from './converter-errors';

/**
 * Mixin methods for processing def initialize in the Ruby-to-blocks converter.
 * These methods are mixed into RubyToBlocksConverter.prototype via Object.assign.
 * @type {object}
 */
const InitializeHandler = {
    /**
     * Process def initialize in a class body.
     * Extracts variable/list assignments and stores them in context.
     * @param {object} defNode - The DefNode for initialize
     * @param {boolean} isStageClass - Whether this is a Stage class
     */
    _processInitialize (defNode, isStageClass) {
        const commentParts = [];

        // Save arguments if present
        if (defNode.parameters) {
            let params = this._getSource(defNode.parameters);
            if (params) {
                // Ensure params are wrapped in parentheses for unambiguous round-trip
                if (!params.startsWith('(')) {
                    params = `(${params})`;
                }
                commentParts.push(`args=${params}`);
            }
        }

        // Get body statements
        let bodyStmts = [];
        if (defNode.body && defNode.body.body) {
            bodyStmts = Array.isArray(defNode.body.body) ?
                defNode.body.body :
                [defNode.body.body];
        }

        // Check for super at the beginning
        let startIndex = 0;
        if (bodyStmts.length > 0) {
            const firstType = this._getNodeTypeName(bodyStmts[0]);
            if (firstType === 'SuperNode') {
                const superArgs = bodyStmts[0].arguments_;
                if (superArgs && superArgs.arguments_ && superArgs.arguments_.length > 0) {
                    const argsSource = superArgs.arguments_.map(a => this._getSource(a)).join(', ');
                    commentParts.push(`super=(${argsSource})`);
                } else {
                    commentParts.push('super');
                }
                startIndex = 1;
            } else if (firstType === 'ForwardingSuperNode') {
                commentParts.push('super');
                startIndex = 1;
            }
        }

        // Process body statements (variable/list assignments only)
        const initializeValues = {};
        for (let i = startIndex; i < bodyStmts.length; i++) {
            const stmt = bodyStmts[i];
            const stmtType = this._getNodeTypeName(stmt);

            if (stmtType === 'InstanceVariableWriteNode') {
                if (isStageClass) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.wrongVariableScopeInInitialize, {
                            SOURCE: this._getSource(stmt),
                            PREFIX: '$',
                            CLASS_TYPE: 'Stage'
                        })
                    );
                }
                const varName = stmt.name.replace(/^@/, '');
                const value = this._extractInitializeValue(stmt.value);
                if (value === null) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.invalidInitializeBody, {
                            SOURCE: this._truncateSource(this._getSource(stmt))
                        })
                    );
                }
                if (Array.isArray(value)) {
                    initializeValues[varName] = {value, type: 'list'};
                    this._lookupOrCreateList(`@${varName}`);
                } else {
                    initializeValues[varName] = {value, type: ''};
                    this._lookupOrCreateVariable(`@${varName}`);
                }
            } else if (stmtType === 'GlobalVariableWriteNode') {
                if (!isStageClass) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.wrongVariableScopeInInitialize, {
                            SOURCE: this._getSource(stmt),
                            PREFIX: '@',
                            CLASS_TYPE: 'sprite'
                        })
                    );
                }
                const varName = stmt.name.replace(/^\$/, '');
                const value = this._extractInitializeValue(stmt.value);
                if (value === null) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.invalidInitializeBody, {
                            SOURCE: this._truncateSource(this._getSource(stmt))
                        })
                    );
                }
                if (Array.isArray(value)) {
                    initializeValues[varName] = {value, type: 'list'};
                    this._lookupOrCreateList(`$${varName}`);
                } else {
                    initializeValues[varName] = {value, type: ''};
                    this._lookupOrCreateVariable(`$${varName}`);
                }
            } else {
                const src = this._truncateSource(this._getSource(stmt));
                throw new RubyToBlocksConverterError(
                    stmt,
                    this._translator(messages.invalidInitializeBody, {SOURCE: src})
                );
            }
        }

        this._context.initializeValues = initializeValues;

        // Create comment for round-trip
        if (commentParts.length > 0) {
            this._createComment(`@ruby:initialize:${commentParts.join(',')}`, null);
        }
    },

    /**
     * Extract a scalar or array value from an AST node for def initialize.
     * @param {object} valueNode - AST node representing the value
     * @returns {number|string|boolean|Array|null} The extracted value, or null if not supported
     */
    _extractInitializeValue (valueNode) {
        const type = this._getNodeTypeName(valueNode);
        switch (type) {
        case 'IntegerNode':
            return valueNode.value;
        case 'FloatNode':
            return valueNode.value;
        case 'StringNode': {
            const unescaped = valueNode.unescaped;
            return typeof unescaped === 'object' ? unescaped.value : unescaped;
        }
        case 'TrueNode':
            return true;
        case 'FalseNode':
            return false;
        case 'NilNode':
            return '';
        case 'CallNode':
            // Handle negative numbers: -10 (parsed as CallNode with name '-@')
            if (valueNode.name === '-@') {
                const inner = this._extractInitializeValue(valueNode.receiver);
                if (typeof inner === 'number') return -inner;
            }
            return null;
        case 'ArrayNode': {
            const elements = valueNode.elements || [];
            const result = [];
            for (const elem of elements) {
                const val = this._extractInitializeValue(elem);
                if (val === null) return null;
                if (Array.isArray(val)) return null; // No nested arrays
                result.push(val);
            }
            return result;
        }
        default:
            return null;
        }
    }
};

export default InitializeHandler;
