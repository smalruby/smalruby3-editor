// === Smalruby: This file is Smalruby-specific (the structure of class / module / initialize, analysis stage) ===
import { backdropLibraryNames, costumeLibraryNames, soundLibraryNames, spriteLibraryNames } from './converter-errors';
import { forEachNode, nodeTypeName } from './node-walk';

// The structure of `class` / `module` / `def initialize` (docs/ruby-editor/converter-stages.md):
// what the analysis stage decides from the tree alone, before converting. The conversion
// (`class-visitor.js` / `module-visitor.js` / `initialize-handler.js`) reads it, makes the blocks
// and the comments, and throws the errors kept here at the same points as it did when it looked at
// the body itself, so that the first error of a program stays the same.
//
// An error is `{ node, message, values }`: `message` is the key of `messages` (converter-errors.js).
// What needs the converter (the version, the target, the modules defined so far or in other
// sprites, the procedures defined so far) is left to the conversion.

// The class methods `set_xxx` of a sprite class, and the attribute each one sets.
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
    set_sounds: 'sounds',
};
// The class methods `set_xxx` of the Stage class.
const STAGE_SET_METHODS = {
    set_name: 'name',
    set_current_backdrop: 'current_backdrop',
    set_backdrops: 'backdrops',
    set_sounds: 'sounds',
};
// Rejected in version 2 (`def initialize` sets the variables and the lists).
const REJECTED_SET_METHODS = new Set(['set_variables', 'set_lists']);
// Only in a sprite class (an error in the Stage class).
const SPRITE_ONLY_METHODS = new Set([
    'set_sprite',
    'set_x',
    'set_y',
    'set_direction',
    'set_visible',
    'set_size',
    'set_current_costume',
    'set_rotation_style',
    'set_costumes',
]);
// Only in the Stage class (an error in a sprite class).
const STAGE_ONLY_METHODS = new Set(['set_current_backdrop', 'set_backdrops']);
// The order of the attributes in the comment `@ruby:class:...`.
const SPRITE_ATTR_ORDER = [
    'sprite',
    'name',
    'x',
    'y',
    'direction',
    'visible',
    'size',
    'current_costume',
    'rotation_style',
    'costumes',
    'sounds',
];
const STAGE_ATTR_ORDER = ['name', 'current_backdrop', 'backdrops', 'sounds'];
const ATTR_METHODS = new Set(['attr_accessor', 'attr_reader', 'attr_writer']);
// The superclasses the Stage class takes.
const STAGE_SUPERCLASSES = new Set(['::Smalruby3::Stage', 'Smalruby3::Stage']);

/**
 * The value of a prism string (`unescaped` of a symbol or a string), as prism gives it.
 * @param {*} unescaped - The `unescaped` of the node.
 * @returns {*} The string.
 */
const unescapedOf = (unescaped) => (typeof unescaped === 'object' ? unescaped.value : unescaped);

/**
 * The arguments of a call.
 * @param {object} node - A CallNode (or a SuperNode).
 * @returns {?Array<object>} The arguments, or null when there is none.
 */
const argumentsOf = (node) => (node.arguments_ ? node.arguments_.arguments_ : null);

/**
 * The full path of a constant: `Foo`, `Foo::Bar`, `::Smalruby3::Sprite`. Another node (the
 * superclass `Foo.new`) gives its `name`.
 * @param {object} node - A prism node.
 * @returns {string} The path.
 */
const constantNodePath = (node) => {
    const typeName = nodeTypeName(node);
    if (typeName === 'ConstantReadNode') {
        return node.name;
    }
    if (typeName === 'ConstantPathNode') {
        if (node.parent) {
            return `${constantNodePath(node.parent)}::${node.name}`;
        }
        // Leading :: (root scope)
        return `::${node.name}`;
    }
    return String(node.name || '');
};

/**
 * The value of the argument of a class method `set_xxx`.
 * @param {object} argNode - The argument.
 * @returns {number|string|boolean|Array|null} The value, or null when it is not a literal.
 */
const classMethodArgValue = (argNode) => {
    const type = nodeTypeName(argNode);
    switch (type) {
        case 'StringNode':
            return unescapedOf(argNode.unescaped);
        case 'IntegerNode':
        case 'FloatNode':
            return argNode.value;
        case 'TrueNode':
            return true;
        case 'FalseNode':
            return false;
        case 'CallNode':
            // Unary minus: -50
            if (argNode.name === '-@' && argNode.receiver) {
                const innerValue = classMethodArgValue(argNode.receiver);
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
                const val = classMethodArgValue(elem);
                if (val === null) return null;
                result.push(val);
            }
            return result;
        }
        default:
            return null;
    }
};

/**
 * The value that `def initialize` sets to a variable or a list.
 * @param {object} valueNode - The value.
 * @returns {number|string|boolean|Array|null} The value, or null when it is not a literal (or a
 *   flat array of literals).
 */
const initializeValueOf = (valueNode) => {
    const type = nodeTypeName(valueNode);
    switch (type) {
        case 'IntegerNode':
        case 'FloatNode':
            return valueNode.value;
        case 'StringNode':
            return unescapedOf(valueNode.unescaped);
        case 'TrueNode':
            return true;
        case 'FalseNode':
            return false;
        case 'NilNode':
            return '';
        case 'CallNode':
            // Negative numbers: -10 (a CallNode named '-@')
            if (valueNode.name === '-@') {
                const inner = initializeValueOf(valueNode.receiver);
                if (typeof inner === 'number') return -inner;
            }
            return null;
        case 'ArrayNode': {
            const elements = valueNode.elements || [];
            const result = [];
            for (const elem of elements) {
                const val = initializeValueOf(elem);
                if (val === null) return null;
                if (Array.isArray(val)) return null; // No nested arrays
                result.push(val);
            }
            return result;
        }
        default:
            return null;
    }
};

/**
 * Whether there is a `super` anywhere under a node (in a `when`, a nested `def`, ...).
 * @param {object} node - A prism node.
 * @returns {boolean} true if there is.
 */
const containsSuper = (node) => {
    let found = false;
    forEachNode(node, {
        enter(_child, type) {
            if (type === 'SuperNode' || type === 'ForwardingSuperNode') found = true;
        },
    });
    return found;
};

/**
 * The structure of one `def initialize` of a class.
 * @param {object} defNode - The DefNode.
 * @param {boolean} isStage - Whether the class is the Stage class.
 * @param {object} attrs - The attributes of the class (`attr_accessor` / ...): name -> kind.
 * @returns {object} `{node, parameters, hasSuper, superArgs, statements, attrNames}`.
 */
const initializeStructureOf = (defNode, isStage, attrs) => {
    let bodyStmts = [];
    if (defNode.body && defNode.body.body) {
        bodyStmts = Array.isArray(defNode.body.body) ? defNode.body.body : [defNode.body.body];
    }
    // `super` / `super(...)` on the first line
    let hasSuper = false;
    let superArgs = null;
    let startIndex = 0;
    if (bodyStmts.length > 0) {
        const firstType = nodeTypeName(bodyStmts[0]);
        if (firstType === 'SuperNode') {
            hasSuper = true;
            const args = argumentsOf(bodyStmts[0]);
            if (args && args.length > 0) superArgs = [...args];
            startIndex = 1;
        } else if (firstType === 'ForwardingSuperNode') {
            hasSuper = true;
            startIndex = 1;
        }
    }
    // Each line sets a variable or a list of the class: `@a` in a sprite, `$a` in the Stage.
    // The variables of attr_accessor / attr_reader / attr_writer set here are named in the comment,
    // since the generator does not write them in initialize otherwise (issue #1839).
    const attrNames = [];
    const statements = bodyStmts.slice(startIndex).map((stmt) => {
        const stmtType = nodeTypeName(stmt);
        const isInstance = stmtType === 'InstanceVariableWriteNode';
        if (!isInstance && stmtType !== 'GlobalVariableWriteNode') {
            return { node: stmt, error: { message: 'invalidInitializeBody', truncated: true } };
        }
        if (isInstance === isStage) {
            const values = isStage ? { PREFIX: '$', CLASS_TYPE: 'Stage' } : { PREFIX: '@', CLASS_TYPE: 'sprite' };
            return { node: stmt, error: { message: 'wrongVariableScopeInInitialize', values } };
        }
        const name = String(stmt.name).slice(1);
        if (isInstance && Object.prototype.hasOwnProperty.call(attrs, name) && !attrNames.includes(name)) {
            attrNames.push(name);
        }
        const value = initializeValueOf(stmt.value);
        if (value === null) {
            return { node: stmt, error: { message: 'invalidInitializeBody', truncated: true } };
        }
        return { node: stmt, rubyName: `${isInstance ? '@' : '$'}${name}`, value, isList: Array.isArray(value) };
    });
    return { node: defNode, parameters: defNode.parameters || null, hasSuper, superArgs, statements, attrNames };
};

/**
 * The structure of a class: what its body sets (`set_xxx`, `attr_xxx`, `include`, `def initialize`),
 * the errors of its body that the tree alone shows, and the comment `@ruby:class:...`.
 * @param {object} node - A ClassNode.
 * @returns {object} The structure (see `docs/ruby-editor/converter-stages.md`).
 */
const classStructureOf = (node) => {
    const className = node.name;
    const isSpriteIndexName = /^Sprite\d+$/.test(className);
    const isStage = className === 'Stage';
    const body = node.body && node.body.body ? node.body.body : null;
    const statements = body || [];
    const isCall = (stmt) => nodeTypeName(stmt) === 'CallNode' && !stmt.receiver;

    // The superclass: the Stage class takes none, ::Smalruby3::Stage or Smalruby3::Stage, and keeps none.
    let superclassPath = node.superclass ? constantNodePath(node.superclass) : null;
    let superclassError = null;
    if (isStage && superclassPath !== null) {
        if (!STAGE_SUPERCLASSES.has(superclassPath)) {
            superclassError = { node: node.superclass, message: 'invalidStageSuperclass' };
        }
        superclassPath = null;
    }

    // attr_accessor / attr_reader / attr_writer: { name: 'accessor' | 'reader' | 'writer' }
    const attrs = Object.create(null);
    const attrVariables = [];
    const skipped = new Set();
    statements.forEach((stmt) => {
        const args = argumentsOf(stmt);
        if (!isCall(stmt) || !ATTR_METHODS.has(stmt.name) || !args || args.length < 1) return;
        const kind = stmt.name.replace('attr_', '');
        args.forEach((argNode) => {
            if (nodeTypeName(argNode) === 'SymbolNode') {
                const name = unescapedOf(argNode.unescaped);
                attrs[name] = kind;
                attrVariables.push(name);
            }
        });
        skipped.add(stmt);
    });

    // set_xxx: the attributes of the sprite or the Stage
    const setMethods = isStage ? STAGE_SET_METHODS : SPRITE_SET_METHODS;
    const info = Object.create(null);
    const setMethodNames = new Set();
    let setError = null;
    for (const stmt of statements) {
        const args = argumentsOf(stmt);
        if (!isCall(stmt) || !args || args.length !== 1) continue;
        if (isStage && SPRITE_ONLY_METHODS.has(stmt.name)) {
            setError = { node: stmt, message: 'spriteMethodInStageClass', values: { METHOD: stmt.name } };
        } else if (!isStage && STAGE_ONLY_METHODS.has(stmt.name)) {
            setError = { node: stmt, message: 'stageMethodInSpriteClass', values: { METHOD: stmt.name } };
        } else if (REJECTED_SET_METHODS.has(stmt.name)) {
            setError = { node: stmt, message: 'setVariablesListsNotSupported', values: { METHOD: stmt.name } };
        }
        if (setError) break;
        if (setMethods[stmt.name]) {
            const value = classMethodArgValue(args[0]);
            if (value !== null) {
                info[setMethods[stmt.name]] = value;
                setMethodNames.add(stmt.name);
            }
        }
    }
    // Every call of a set_xxx that gave an attribute is left out of the blocks, even one whose
    // value is not a literal.
    statements.forEach((stmt) => {
        if (isCall(stmt) && setMethodNames.has(stmt.name)) skipped.add(stmt);
    });

    // include / extend, in the order of the lines (whether the module exists is for the conversion)
    const includeStatements = [];
    statements.forEach((stmt) => {
        if (!isCall(stmt)) return;
        if (stmt.name === 'extend') {
            includeStatements.push({ node: stmt, kind: 'extend' });
            return;
        }
        const args = argumentsOf(stmt);
        if (stmt.name === 'include' && args && args.length === 1 && nodeTypeName(args[0]) === 'ConstantReadNode') {
            includeStatements.push({ node: stmt, kind: 'include', name: args[0].name });
            skipped.add(stmt);
        }
    });
    const includes = includeStatements.filter((s) => s.kind === 'include').map((s) => s.name);

    // The methods that call super (the method of the same name of an included module is renamed)
    const superMethods = statements
        .filter((stmt) => nodeTypeName(stmt) === 'DefNode' && !stmt.receiver && containsSuper(stmt))
        .map((stmt) => stmt.name);

    // set_sprite is not used with set_costumes / set_sounds, and the names are in the libraries
    const has = (prop) => Object.prototype.hasOwnProperty.call(info, prop);
    let assetError = null;
    const libraryError = (prop, names, message) => {
        if (assetError || !has(prop) || !Array.isArray(info[prop])) return;
        const name = info[prop].find((n) => !names.has(n));
        if (typeof name !== 'undefined') assetError = { node, message, values: { NAME: name } };
    };
    if (!isStage && has('sprite') && (has('costumes') || has('sounds'))) {
        assetError = { node, message: 'spriteAndCostumesSoundsExclusive' };
    } else if (has('sprite') && !spriteLibraryNames.has(info.sprite)) {
        assetError = { node, message: 'invalidSpriteName', values: { NAME: info.sprite } };
    }
    libraryError('costumes', costumeLibraryNames, 'invalidCostumeName');
    libraryError('backdrops', backdropLibraryNames, 'invalidBackdropName');
    libraryError('sounds', soundLibraryNames, 'invalidSoundName');

    // The comment `@ruby:class:<=superclass,attributes,attr_xxx=...,include=...`
    const attrOrder = isStage ? STAGE_ATTR_ORDER : SPRITE_ATTR_ORDER;
    const attributeNames = Object.keys(info);
    if (!isSpriteIndexName && !isStage && !has('name')) {
        attributeNames.push('name');
    }
    attributeNames.sort((a, b) => attrOrder.indexOf(a) - attrOrder.indexOf(b));
    const commentParts = [];
    if (superclassPath) {
        // The superclass is written as <=path, with :: as /
        const encoded = superclassPath.startsWith('::')
            ? `//${superclassPath.slice(2).replace(/::/g, '/')}`
            : superclassPath.replace(/::/g, '/');
        commentParts.push(`<=${encoded}`);
    }
    attributeNames.forEach((attr) => {
        if (attr === 'name' && !isSpriteIndexName && !isStage) {
            commentParts.push(`name=${className}`);
        } else if (attr === 'sprite') {
            commentParts.push(`sprite=${info.sprite}`);
        } else {
            commentParts.push(attr);
        }
    });
    const attrByKind = { accessor: [], reader: [], writer: [] };
    Object.entries(attrs).forEach(([name, kind]) => attrByKind[kind].push(name));
    Object.entries(attrByKind).forEach(([kind, names]) => {
        if (names.length > 0) commentParts.push(`attr_${kind}=${names.join('+')}`);
    });
    includes.forEach((moduleName) => commentParts.push(`include=${moduleName}`));
    const comment = commentParts.length > 0 ? `@ruby:class:${commentParts.join(',')}` : '@ruby:class';

    // The attributes that the target takes (a class with none keeps the ones of the class before)
    let classInfo = null;
    if (attributeNames.length > 0) {
        if (!has('name') && !isSpriteIndexName && !isStage) {
            info.name = className;
        }
        classInfo = info;
    }

    // def initialize (with or without a receiver) sets the variables and the lists
    const initializes = statements
        .filter((stmt) => nodeTypeName(stmt) === 'DefNode' && stmt.name === 'initialize')
        .map((stmt) => {
            skipped.add(stmt);
            return initializeStructureOf(stmt, isStage, attrs);
        });

    return {
        isStage,
        isSpriteIndexName,
        superclassPath,
        superclassError,
        attrs,
        attrVariables,
        setError,
        includeStatements,
        superMethods,
        assetError,
        comment,
        classInfo,
        initializes,
        hasBody: body !== null,
        // The lines left to convert: not the set_xxx, attr_xxx, include and def initialize
        bodyStatements: statements.filter((stmt) => !skipped.has(stmt)),
    };
};

/**
 * The structure of a module: the lines of its body (each must be a `def`; the conversion checks).
 * @param {object} node - A ModuleNode.
 * @returns {object} `{statements}`.
 */
const moduleStructureOf = (node) => ({
    statements: node.body && node.body.body ? [...node.body.body] : [],
});

export { classStructureOf, constantNodePath, moduleStructureOf };
