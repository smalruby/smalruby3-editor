// === Smalruby: This file is Smalruby-specific (module visitor for Ruby-to-blocks converter) ===

import RubyParser from '../ruby-parser';

import {RubyToBlocksConverterError} from './errors';
import {messages} from './converter-errors';
import {findTargetsWithModule, generateTargetCode, extractModuleCode} from '../module-sync';

/**
 * Mixin methods for visiting module nodes in the Ruby-to-blocks converter.
 * These methods are mixed into RubyToBlocksConverter.prototype via Object.assign.
 * @type {object}
 */
const ModuleVisitor = {
    visitModuleNode (node) {
        // module definitions are only supported in version 2
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.moduleNotSupportedInV1)
            );
        }

        // module is not supported in Stage (stage and sprite have different available methods)
        if (this._context.target && this._context.target.isStage) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.moduleNotSupportedInStage)
            );
        }

        // Nested modules are not supported
        if (this._context.currentModuleName) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.nestedModuleNotSupported)
            );
        }

        const moduleName = node.name;

        // Validate: only DefNode allowed in module body
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                const typeName = this._getNodeTypeName(stmt);
                if (typeName === 'CallNode' && stmt.name === 'module_function' && !stmt.receiver) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.moduleFunctionNotSupported)
                    );
                }
                if (typeName !== 'DefNode') {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.onlyMethodsInModule)
                    );
                }
            }
        }

        // Save the module's method DefNodes in context for later expansion by include
        this._context.modules[moduleName] = {
            name: moduleName,
            methods: (node.body && node.body.body) ? node.body.body : []
        };

        // Module definition itself does not produce blocks
        return [];
    },

    /**
     * Try to import a module definition from other sprites.
     * Searches other sprites' block comments for `@ruby:module_source:moduleName`,
     * generates Ruby code from the found sprite, extracts the module definition,
     * parses it, and stores the DefNodes in this._context.modules.
     * @param {string} moduleName - The module name to import
     * @returns {boolean} true if the module was successfully imported
     */
    _importModuleFromOtherSprites (moduleName) {
        if (!this.vm || !this.vm.runtime) return false;

        const currentTargetId = this._context.target ? this._context.target.id : null;
        const sourceCandidates = findTargetsWithModule(this.vm, moduleName, currentTargetId);
        if (sourceCandidates.length === 0) return false;

        // Use the first sprite that has the module
        const sourceTarget = sourceCandidates[0];
        const sourceCode = generateTargetCode(sourceTarget, String(this.version));
        const moduleCode = extractModuleCode(sourceCode, moduleName);
        if (!moduleCode) return false;

        // Parse the module code to get DefNodes
        const prism = RubyParser.getPrism();
        if (!prism) return false;

        const parseResult = prism.parse(moduleCode);
        if (parseResult.errors.length > 0) return false;

        // The parsed result should be: ProgramNode > StatementsNode > [ModuleNode]
        const root = parseResult.value;
        let moduleNode = null;
        if (root.statements && root.statements.body) {
            for (const stmt of root.statements.body) {
                if (this._getNodeTypeName(stmt) === 'ModuleNode') {
                    moduleNode = stmt;
                    break;
                }
            }
        }
        if (!moduleNode) return false;

        // Store the module's method DefNodes
        this._context.modules[moduleName] = {
            name: moduleName,
            methods: (moduleNode.body && moduleNode.body.body) ? moduleNode.body.body : []
        };
        return true;
    }
};

export default ModuleVisitor;
