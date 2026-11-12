// === Smalruby: This file is Smalruby-specific (Ruby variable name helpers for RubyGenerator) ===

const SCALAR_TYPE = '';
const LIST_TYPE = 'list';

// A Ruby local variable is kept as a target variable named `_<name>_<scope index>_`
// (see `_lookupOrCreateVariable` in ruby-to-blocks-converter/variable-utils.js).
const LOCAL_VARIABLE_PATTERN = /^_((?![A-Z])[\p{L}_][\p{L}\p{N}_]*)_(\d+)_$/u;

const escapeIdentityRegexp = /[\x00-\x1f\x7f-\x9f !"#$%&'()*+,-./:;<=>?@[\\\]^`{|}~]/g; // eslint-disable-line no-control-regex

/**
 * Register variable name resolution and escaping methods on the RubyGenerator.
 * Handles: variableName, listName, variableNameByName, listNameByName,
 * makeVariableName, escapeVariableName, escapeMethodName.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    Generator.escapeVariableName = function (s) {
        return s.replace(escapeIdentityRegexp, '_');
    };

    Generator.escapeMethodName = Generator.escapeVariableName;

    Generator.makeVariableName = function (isStage, name) {
        const prefix = isStage ? '$' : '@';
        return `${prefix}${name.replace(escapeIdentityRegexp, '_')}`;
    };

    Generator.variableName = function (id, type = SCALAR_TYPE) {
        let currVar;
        let isStage;
        const target = this.currentTarget;
        const variables = target.variables;
        if (Object.prototype.hasOwnProperty.call(variables, id)) {
            currVar = variables[id];
            isStage = target.isStage;
        } else if (target.runtime && !target.isStage) {
            const stage = target.runtime.getTargetForStage();
            if (stage && Object.prototype.hasOwnProperty.call(stage.variables, id)) {
                currVar = stage.variables[id];
                isStage = true;
            }
        }
        if (currVar && currVar.type === type) {
            return this.makeVariableName(isStage, currVar.name);
        }
        return null;
    };

    Generator.listName = function (id) {
        return this.variableName(id, LIST_TYPE);
    };

    /**
     * Whether a block of the current target keeps `@ruby:lvar:<name>:<scope index>`, i.e. the
     * converter made the variable from a Ruby local variable.
     * @param {string} name - The local variable's name in Ruby.
     * @param {string} scopeIndex - The scope index in the internal name.
     * @returns {boolean} True if such a comment exists.
     */
    Generator.hasLocalVariableComment = function (name, scopeIndex) {
        // `name` matches LOCAL_VARIABLE_PATTERN (identifier characters only), so it needs no escaping.
        const token = new RegExp(`(?:^|[,\\s])@ruby:lvar:${name}:${scopeIndex}(?=$|[,\\s])`, 'u');
        const comments = (this.cache_ && this.cache_.comments) || {};
        return Object.values(comments).some(
            (comment) => typeof comment.text === 'string' && token.test(comment.text),
        );
    };

    Generator.variableNameByName = function (name, type = SCALAR_TYPE) {
        let currVar;
        let isStage;
        const target = this.currentTarget;
        if (target.runtime) {
            const stage = target.runtime.getTargetForStage();
            currVar = stage.lookupVariableByNameAndType(name, type);
            isStage = true;
        }
        if (!currVar) {
            currVar = target.lookupVariableByNameAndType(name, type);
            isStage = target.isStage;
        }
        if (currVar && currVar.type === type) {
            // A field (e.g. koshien `map_from`'s MAP, a `reverse!` receiver) only keeps the
            // variable's name, so a local variable has no `@ruby:lvar` comment to restore it.
            // The name alone can't tell a local from `@_x_1_` / `$_x_1_` (or a variable made in the
            // blocks named `_x_1_`), so it is a local only if another block keeps its `@ruby:lvar`.
            const localMatch = currVar.name.match(LOCAL_VARIABLE_PATTERN);
            if (localMatch && this.hasLocalVariableComment(localMatch[1], localMatch[2])) {
                return localMatch[1];
            }
            return this.makeVariableName(isStage, currVar.name);
        }
        return null;
    };

    Generator.listNameByName = function (name) {
        return this.variableNameByName(name, LIST_TYPE);
    };

    return Generator;
}
