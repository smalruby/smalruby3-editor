// === Smalruby: This file is Smalruby-specific (class visitor for Ruby-to-blocks converter) ===

import {RubyToBlocksConverterError} from './errors';
import {
    messages,
    spriteLibraryNames,
    costumeLibraryNames,
    soundLibraryNames,
    backdropLibraryNames
} from './converter-errors';

/**
 * Mixin methods for visiting class nodes in the Ruby-to-blocks converter.
 * These methods are mixed into RubyToBlocksConverter.prototype via Object.assign.
 * @type {object}
 */
const ClassVisitor = {
    visitClassNode (node) {
        // class definitions are only supported in version 2
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.classNotSupportedInV1)
            );
        }

        const className = node.name;
        const isSpriteIndexName = /^Sprite\d+$/.test(className);
        const isStageClass = className === 'Stage';

        // Extract superclass path (e.g. "::Smalruby3::Sprite", "Foo")
        let superclassPath = null;
        if (node.superclass) {
            superclassPath = this._constantNodeToPath(node.superclass);
        }

        // Stage only accepts no superclass, ::Smalruby3::Stage, or Smalruby3::Stage
        if (isStageClass && superclassPath !== null) {
            if (superclassPath !== '::Smalruby3::Stage' && superclassPath !== 'Smalruby3::Stage') {
                throw new RubyToBlocksConverterError(
                    node.superclass,
                    this._translator(messages.invalidStageSuperclass)
                );
            }
            // Accepted Stage superclass — don't store it (Stage is always Stage)
            superclassPath = null;
        }

        // Set of recognized set_xxx class methods (sprite-specific)
        const SPRITE_SET_METHODS = {
            set_name: 'name',
            set_sprite: 'sprite',
            set_x: 'x',
            set_y: 'y',
            set_direction: 'direction',
            set_visible: 'visible',
            set_size: 'size',
            set_current_costume: 'current_costume',
            set_rotation_style: 'rotation_style',
            set_costumes: 'costumes',
            set_sounds: 'sounds'
        };

        // Set of recognized set_xxx class methods (stage-specific)
        const STAGE_SET_METHODS = {
            set_name: 'name',
            set_current_backdrop: 'current_backdrop',
            set_backdrops: 'backdrops',
            set_sounds: 'sounds'
        };

        // Methods rejected in V2 (use def initialize instead)
        const REJECTED_SET_METHODS = new Set(['set_variables', 'set_lists']);

        // Methods only allowed in sprite classes (forbidden in Stage)
        const SPRITE_ONLY_METHODS = new Set([
            'set_sprite', 'set_x', 'set_y', 'set_direction', 'set_visible',
            'set_size', 'set_current_costume', 'set_rotation_style', 'set_costumes'
        ]);

        // Methods only allowed in stage class (forbidden in sprite classes)
        const STAGE_ONLY_METHODS = new Set([
            'set_current_backdrop', 'set_backdrops'
        ]);

        const SET_METHODS = isStageClass ? STAGE_SET_METHODS : SPRITE_SET_METHODS;

        // Canonical attribute order for comment text
        const SPRITE_ATTR_ORDER = [
            'sprite', 'name', 'x', 'y', 'direction', 'visible', 'size',
            'current_costume', 'rotation_style', 'costumes', 'sounds'
        ];
        const STAGE_ATTR_ORDER = [
            'name', 'current_backdrop', 'backdrops', 'sounds'
        ];
        const ATTR_ORDER = isStageClass ? STAGE_ATTR_ORDER : SPRITE_ATTR_ORDER;

        // Pre-scan class body for attr_accessor/attr_reader/attr_writer
        // { varName: 'accessor' | 'reader' | 'writer' }
        const attrAccessors = {};
        const attrStatements = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    !stmt.receiver &&
                    (stmt.name === 'attr_accessor' ||
                     stmt.name === 'attr_reader' ||
                     stmt.name === 'attr_writer') &&
                    stmt.arguments_ &&
                    stmt.arguments_.arguments_.length >= 1) {

                    const kind = stmt.name.replace('attr_', '');
                    for (const argNode of stmt.arguments_.arguments_) {
                        if (this._getNodeTypeName(argNode) === 'SymbolNode') {
                            const unescaped = argNode.unescaped;
                            const symName = typeof unescaped === 'object' ? unescaped.value : unescaped;
                            attrAccessors[symName] = kind;
                            // Create instance variable
                            this._lookupOrCreateVariable(`@${symName}`);
                        }
                    }
                    attrStatements.add(stmt);
                }
            }
        }
        // Store attr info in context for getter/setter resolution
        this._context.attrAccessors = attrAccessors;

        // Pre-scan class body for set_xxx calls
        const classInfo = {};
        const setMethodNames = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    !stmt.receiver &&
                    stmt.arguments_ &&
                    stmt.arguments_.arguments_.length === 1) {

                    // Check for cross-class method usage
                    if (isStageClass && SPRITE_ONLY_METHODS.has(stmt.name)) {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.spriteMethodInStageClass, {METHOD: stmt.name})
                        );
                    }
                    if (!isStageClass && STAGE_ONLY_METHODS.has(stmt.name)) {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.stageMethodInSpriteClass, {METHOD: stmt.name})
                        );
                    }

                    // Reject set_variables/set_lists in V2
                    if (REJECTED_SET_METHODS.has(stmt.name)) {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.setVariablesListsNotSupported, {METHOD: stmt.name})
                        );
                    }

                    if (SET_METHODS[stmt.name]) {
                        const attrName = SET_METHODS[stmt.name];
                        const arg = stmt.arguments_.arguments_[0];
                        const value = this._extractClassMethodArg(arg);
                        if (value !== null) {
                            classInfo[attrName] = value;
                            setMethodNames.add(stmt.name);
                        }
                    }
                }
            }
        }

        // Pre-scan for include/extend statements
        const includedModuleNames = [];
        const includeStatements = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'CallNode' && !stmt.receiver) {
                    // Reject extend
                    if (stmt.name === 'extend') {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.extendNotSupported)
                        );
                    }
                    // Handle include
                    if (stmt.name === 'include' &&
                        stmt.arguments_ &&
                        stmt.arguments_.arguments_.length === 1) {
                        const argNode = stmt.arguments_.arguments_[0];
                        const argType = this._getNodeTypeName(argNode);
                        if (argType === 'ConstantReadNode') {
                            const moduleName = argNode.name;

                            if (isStageClass) {
                                throw new RubyToBlocksConverterError(
                                    stmt,
                                    this._translator(messages.includeNotSupportedInStage)
                                );
                            }

                            if (!this._context.modules[moduleName]) {
                                // Try to import the module from other sprites
                                const imported = this._importModuleFromOtherSprites(moduleName);
                                if (!imported) {
                                    throw new RubyToBlocksConverterError(
                                        stmt,
                                        this._translator(messages.undefinedModule, {NAME: moduleName})
                                    );
                                }
                            }

                            includedModuleNames.push(moduleName);
                            includeStatements.add(stmt);
                        }
                    }
                }
            }
        }

        // Pre-scan class methods for super usage to determine which module methods need renaming
        // superMethodMap: { methodName: { moduleName, renamedProcName } }
        const superMethodMap = {};
        if (node.body && node.body.body && includedModuleNames.length > 0) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'DefNode' && !stmt.receiver) {
                    const methodName = stmt.name;
                    if (this._nodeContainsSuper(stmt)) {
                        // Find which module has a method with the same name
                        let foundModule = null;
                        for (const moduleName of includedModuleNames) {
                            const moduleDef = this._context.modules[moduleName];
                            if (moduleDef && moduleDef.methods.some(m => m.name === methodName)) {
                                foundModule = moduleName;
                                break;
                            }
                        }
                        if (foundModule) {
                            const index = Object.keys(superMethodMap).length + 1;
                            superMethodMap[methodName] = {
                                moduleName: foundModule,
                                renamedProcName: `_super_${methodName}_${index}_`
                            };
                        }
                    }
                }
            }
        }
        this._context.superMethodMap = superMethodMap;

        // Mutual exclusion: set_sprite cannot be used with set_costumes/set_sounds (sprite only)
        const has = prop => Object.prototype.hasOwnProperty.call(classInfo, prop);
        if (!isStageClass && has('sprite') && (has('costumes') || has('sounds'))) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.spriteAndCostumesSoundsExclusive)
            );
        }

        // Validate library names
        if (has('sprite') && !spriteLibraryNames.has(classInfo.sprite)) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.invalidSpriteName, {NAME: classInfo.sprite})
            );
        }
        if (has('costumes') && Array.isArray(classInfo.costumes)) {
            for (const name of classInfo.costumes) {
                if (!costumeLibraryNames.has(name)) {
                    throw new RubyToBlocksConverterError(
                        node,
                        this._translator(messages.invalidCostumeName, {NAME: name})
                    );
                }
            }
        }
        if (has('backdrops') && Array.isArray(classInfo.backdrops)) {
            for (const name of classInfo.backdrops) {
                if (!backdropLibraryNames.has(name)) {
                    throw new RubyToBlocksConverterError(
                        node,
                        this._translator(messages.invalidBackdropName, {NAME: name})
                    );
                }
            }
        }
        if (has('sounds') && Array.isArray(classInfo.sounds)) {
            for (const name of classInfo.sounds) {
                if (!soundLibraryNames.has(name)) {
                    throw new RubyToBlocksConverterError(
                        node,
                        this._translator(messages.invalidSoundName, {NAME: name})
                    );
                }
            }
        }

        // Collect attribute names for comment
        const attributeNames = Object.keys(classInfo);
        if (!isSpriteIndexName && !isStageClass &&
            !Object.prototype.hasOwnProperty.call(classInfo, 'name')) {
            attributeNames.push('name');
        }
        // Sort by canonical order
        attributeNames.sort((a, b) => ATTR_ORDER.indexOf(a) - ATTR_ORDER.indexOf(b));

        // Generate comment text
        // For non-Sprite\d+ class names (excluding Stage), use name=ClassName format
        // Superclass is encoded as <=path with :: replaced by /
        let commentText;
        const commentParts = [];
        if (superclassPath) {
            let encodedSuperclass;
            if (superclassPath.startsWith('::')) {
                encodedSuperclass = `//${superclassPath.slice(2).replace(/::/g, '/')}`;
            } else {
                encodedSuperclass = superclassPath.replace(/::/g, '/');
            }
            commentParts.push(`<=${encodedSuperclass}`);
        }
        if (attributeNames.length > 0) {
            attributeNames.forEach(attr => {
                if (attr === 'name' && !isSpriteIndexName && !isStageClass) {
                    commentParts.push(`name=${className}`);
                } else if (attr === 'sprite') {
                    commentParts.push(`sprite=${classInfo.sprite}`);
                } else {
                    commentParts.push(attr);
                }
            });
        }
        // Add attr_accessor/reader/writer parts
        const attrByKind = { accessor: [], reader: [], writer: [] };
        for (const [name, kind] of Object.entries(attrAccessors)) {
            attrByKind[kind].push(name);
        }
        for (const [kind, names] of Object.entries(attrByKind)) {
            if (names.length > 0) {
                commentParts.push(`attr_${kind}=${names.join('+')}`);
            }
        }

        // Add include= parts for each included module (in order)
        includedModuleNames.forEach(moduleName => {
            commentParts.push(`include=${moduleName}`);
        });

        if (commentParts.length > 0) {
            commentText = `@ruby:class:${commentParts.join(',')}`;
        } else {
            commentText = '@ruby:class';
        }
        this._createComment(commentText, null);

        // Store class info in context
        if (attributeNames.length > 0) {
            if (!Object.prototype.hasOwnProperty.call(classInfo, 'name') &&
                !isSpriteIndexName && !isStageClass) {
                classInfo.name = className;
            }
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
                                moduleCommentText =
                                    `@ruby:module_source:${moduleName}:super_of:${originalMethodName}`;
                            } else {
                                moduleCommentText = `@ruby:module_source:${moduleName}`;
                            }
                            const commentId = this._createComment(
                                moduleCommentText, b.id, 0, 0, true
                            );
                            b.comment = commentId;
                        }
                    }
                    moduleBlocks.push(...blocks);
                }
            }
            this._context.currentModuleName = null;
        }

        // Pre-scan for def initialize and process it
        const initializeNodes = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'DefNode' && stmt.name === 'initialize') {
                    initializeNodes.add(stmt);
                    this._processInitialize(stmt, isStageClass);
                }
            }
        }

        // Visit class body, filtering out set_xxx calls, include statements, and def initialize
        if (node.body && node.body.body) {
            const filteredStatements = node.body.body.filter(stmt => {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    setMethodNames.has(stmt.name) &&
                    !stmt.receiver) {
                    return false;
                }
                // Filter out include statements (already processed above)
                if (includeStatements.has(stmt)) {
                    return false;
                }
                // Filter out attr_accessor/reader/writer (processed in pre-scan)
                if (attrStatements.has(stmt)) {
                    return false;
                }
                // Filter out def initialize (already processed above)
                if (initializeNodes.has(stmt)) {
                    return false;
                }
                return true;
            });

            if (filteredStatements.length === 0) {
                return moduleBlocks;
            }

            // Visit filtered statements manually
            const blocks = [];
            const blockToStmt = new Map();
            for (const stmt of filteredStatements) {
                this._context.methodCallIndices = {};
                const block = this.visit(stmt);
                if (Array.isArray(block)) {
                    block.forEach(b => {
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
                        this._translator(
                            messages.wrongInstructionInClass,
                            {SOURCE: src}
                        )
                    );
                }
            }

            return [...moduleBlocks, ...blocks];
        }
        return moduleBlocks;
    },

    /**
     * Extract a scalar value from a class method argument AST node.
     * @param {object} argNode - AST node representing the argument
     * @returns {number|string|boolean|Array|null} The extracted value, or null if not supported
     */
    _extractClassMethodArg (argNode) {
        const type = this._getNodeTypeName(argNode);
        switch (type) {
        case 'StringNode': {
            const unescaped = argNode.unescaped;
            return typeof unescaped === 'object' ? unescaped.value : unescaped;
        }
        case 'IntegerNode':
            return argNode.value;
        case 'FloatNode':
            return argNode.value;
        case 'TrueNode':
            return true;
        case 'FalseNode':
            return false;
        case 'CallNode':
            // Handle unary minus: e.g., -50
            if (argNode.name === '-@' && argNode.receiver) {
                const innerValue = this._extractClassMethodArg(argNode.receiver);
                if (typeof innerValue === 'number') {
                    return -innerValue;
                }
            }
            return null;
        case 'ArrayNode': {
            const elements = argNode.elements;
            if (!elements || elements.length === 0) return null;
            const result = [];
            for (const elem of elements) {
                const val = this._extractClassMethodArg(elem);
                if (val === null) return null;
                result.push(val);
            }
            return result;
        }
        default:
            return null;
        }
    },

    /**
     * Check if an AST node tree contains a SuperNode or ForwardingSuperNode.
     * @param {object} node - AST node to search
     * @returns {boolean} true if super is found
     */
    _nodeContainsSuper (node) {
        if (!node) return false;
        const typeName = this._getNodeTypeName(node);
        if (typeName === 'SuperNode' || typeName === 'ForwardingSuperNode') {
            return true;
        }
        if (node.compactChildNodes) {
            for (const child of node.compactChildNodes()) {
                if (this._nodeContainsSuper(child)) {
                    return true;
                }
            }
        }
        return false;
    }
};

export default ClassVisitor;
