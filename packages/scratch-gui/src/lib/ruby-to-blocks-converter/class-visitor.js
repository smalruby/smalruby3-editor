// === Smalruby: This file is Smalruby-specific (class visitor for Ruby-to-blocks converter) ===
import { messages } from './converter-errors';
import { RubyToBlocksConverterError } from './errors';
import { nodeTypeName } from './node-walk';

/**
 * Mixin methods for visiting class nodes in the Ruby-to-blocks converter.
 * These methods are mixed into RubyToBlocksConverter.prototype via Object.assign.
 * @type {object}
 */
const ClassVisitor = {
    /**
     * The structure of a class or a module that the analysis stage decided (`class-analysis.js`).
     * Every ClassNode / ModuleNode that the conversion visits is in the analyzed tree (a module
     * read from another sprite gives only its `def`s, and a `def` cannot hold a class or a module),
     * so a node that is not in the table is an error of the converter. It is not looked at again
     * here, so that a node the analysis missed is found instead of being hidden.
     * @param {object} node - A ClassNode or a ModuleNode.
     * @returns {object} The structure.
     */
    _structureOf(node) {
        const analysis = this._context.analysis;
        const entry = analysis && analysis.classes.ofNode.get(node);
        if (!entry) {
            throw new Error(`the analysis stage has no ${nodeTypeName(node)} here (an error of the converter)`);
        }
        return entry.structure;
    },

    /**
     * Throw an error that the analysis stage found in the structure of a class.
     * @param {?object} error - `{node, message, values}` (`message` is a key of `messages`), or null.
     */
    _throwStructureError(error) {
        if (error) {
            throw new RubyToBlocksConverterError(error.node, this._translator(messages[error.message], error.values));
        }
    },

    visitClassNode(node) {
        // class definitions are only supported in version 2
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(node, this._translator(messages.classNotSupportedInV1));
        }
        this._checkNoExceptionHandling(node.body);

        // What the body sets and the errors that the tree alone shows are decided by the analysis
        // stage. They are thrown here, in the order that the body is looked at.
        const structure = this._structureOf(node);
        this._throwStructureError(structure.superclassError);

        // attr_accessor / attr_reader / attr_writer make the instance variables, and the getters and
        // the setters read the kinds (`visitCallNode`)
        structure.attrVariables.forEach((name) => this._lookupOrCreateVariable(`@${name}`));
        this._context.attrAccessors = structure.attrs;

        this._throwStructureError(structure.setError);

        // include: the module is defined above in this code or in another sprite
        const includedModuleNames = [];
        for (const statement of structure.includeStatements) {
            if (statement.kind === 'extend') {
                throw new RubyToBlocksConverterError(statement.node, this._translator(messages.extendNotSupported));
            }
            if (structure.isStage) {
                throw new RubyToBlocksConverterError(
                    statement.node,
                    this._translator(messages.includeNotSupportedInStage),
                );
            }
            if (!this._context.modules[statement.name] && !this._importModuleFromOtherSprites(statement.name)) {
                throw new RubyToBlocksConverterError(
                    statement.node,
                    this._translator(messages.undefinedModule, { NAME: statement.name }),
                );
            }
            includedModuleNames.push(statement.name);
        }

        // The methods with super rename the method of the same name of the module they include
        // superMethodMap: { methodName: { moduleName, renamedProcName } }
        const superMethodMap = Object.create(null);
        if (includedModuleNames.length > 0) {
            for (const methodName of structure.superMethods) {
                const foundModule = includedModuleNames.find((moduleName) => {
                    const moduleDef = this._context.modules[moduleName];
                    return moduleDef && moduleDef.methods.some((m) => m.name === methodName);
                });
                if (foundModule) {
                    const index = Object.keys(superMethodMap).length + 1;
                    superMethodMap[methodName] = {
                        moduleName: foundModule,
                        renamedProcName: `_super_${methodName}_${index}_`,
                    };
                }
            }
        }
        this._context.superMethodMap = superMethodMap;

        this._throwStructureError(structure.assetError);

        this._createComment(structure.comment, null);

        // The attributes that the target takes (target-applier.js)
        if (structure.classInfo) {
            const classInfo = Object.create(null);
            Object.entries(structure.classInfo).forEach(([attr, value]) => {
                classInfo[attr] = Array.isArray(value) ? [...value] : value;
            });
            this._context.classInfo = classInfo;
        }

        // Expand included module methods: visit each module's DefNodes and attach comments
        const moduleBlocks = [];
        for (const moduleName of includedModuleNames) {
            const moduleDef = this._context.modules[moduleName];
            this._context.currentModuleName = moduleName;
            for (const methodNode of moduleDef.methods) {
                const originalMethodName = methodNode.name;
                const superEntry = superMethodMap[originalMethodName];

                // If this method is overridden with super, rename it
                if (superEntry && superEntry.moduleName === moduleName) {
                    this._context.superRenameTarget = superEntry.renamedProcName;
                }

                const block = this.visit(methodNode);

                this._context.superRenameTarget = null;

                if (block) {
                    const blocks = Array.isArray(block) ? block : [block];
                    for (const b of blocks) {
                        if (b && b.opcode === 'procedures_definition') {
                            // Attach comment with super_of info if renamed
                            let moduleCommentText;
                            if (superEntry && superEntry.moduleName === moduleName) {
                                moduleCommentText = `@ruby:module_source:${moduleName}:super_of:${originalMethodName}`;
                            } else {
                                moduleCommentText = `@ruby:module_source:${moduleName}`;
                            }
                            const commentId = this._createComment(moduleCommentText, b.id, 0, 0, true);
                            b.comment = commentId;
                        }
                    }
                    moduleBlocks.push(...blocks);
                }
            }
            this._context.currentModuleName = null;
        }

        // def initialize sets the variables and the lists of the target
        structure.initializes.forEach((initialize) => this._processInitialize(initialize));

        if (structure.hasBody) {
            const filteredStatements = structure.bodyStatements;
            if (filteredStatements.length === 0) {
                return moduleBlocks;
            }

            // Visit filtered statements manually
            const blocks = [];
            const blockToStmt = new Map();
            for (const stmt of filteredStatements) {
                this._context.methodCallIndices = Object.create(null);
                this._context.savedReturnValueInStatement = false;
                const block = this.visit(stmt);
                // A statement that has no block (`alias`, `undef`, ...) was dropped (issue #1814).
                this._checkStatementHasHandler(stmt, block, messages.wrongInstructionInClass);
                if (Array.isArray(block)) {
                    block.forEach((b) => {
                        blocks.push(b);
                        blockToStmt.set(b, stmt);
                    });
                } else if (block !== null && typeof block !== 'undefined') {
                    blocks.push(block);
                    blockToStmt.set(block, stmt);
                }
            }

            // Validate: only hat blocks and procedures_definition are allowed at class top-level
            for (const block of blocks) {
                if (!block || !block.opcode) continue;
                const blockType = this._getBlockType(block);
                if (blockType !== 'hat' && block.opcode !== 'procedures_definition') {
                    const errorNode = block.node || blockToStmt.get(block) || node;
                    const src = this._truncateSource(this._getSource(errorNode));
                    throw new RubyToBlocksConverterError(
                        errorNode,
                        this._translator(messages.wrongInstructionInClass, { SOURCE: src }),
                    );
                }
            }

            return [...moduleBlocks, ...blocks];
        }
        return moduleBlocks;
    },
};

export default ClassVisitor;
