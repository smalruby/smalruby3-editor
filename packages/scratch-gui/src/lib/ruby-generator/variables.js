// === Smalruby: This file is Smalruby-specific (Ruby variable name helpers for RubyGenerator) ===
import { rubyMarkersOf } from '../ruby-markers.js';

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

    /**
     * Whether a target (the sprite or the stage) has a variable (not a list) of a name.
     * @param {object} owner - The target that has the variable.
     * @param {string} name - The name.
     * @returns {boolean} true if the target has such a variable.
     */
    const hasScalarOfName = function (owner, name) {
        return Object.values((owner && owner.variables) || {}).some((v) => v.name === name && v.type === SCALAR_TYPE);
    };

    /**
     * Whether a list of a target has a variable of the same name beside it (issue #1622).
     * @param {object} owner - The target that has the list.
     * @param {object} variable - The variable or the list.
     * @returns {boolean} true if it is a list and the target has a variable of its name.
     */
    Generator.isListBesideVariable = function (owner, variable) {
        return variable.type === LIST_TYPE && hasScalarOfName(owner, variable.name);
    };

    /**
     * The name (without `@` / `$`) of a variable or a list of a target in Ruby. Scratch can have
     * a variable and a list of the same name, but Ruby has one `@a`: only then the list is
     * `_a_list_`, and the converter makes it the list `a` again (issue #1622). When the target
     * also has something that the user named `_a_list_`, the list is `_a_list2_` (`_a_list3_`
     * when that is taken too), so two things never share one Ruby name (issue #1707). The
     * number comes before the last `_` so that the name is not one of a local variable
     * (`_a_list_2_`).
     * @param {object} owner - The target that has the variable or the list.
     * @param {object} variable - The variable or the list.
     * @returns {string} The name.
     */
    Generator.rubyBaseNameOfVariable = function (owner, variable) {
        if (!this.isListBesideVariable(owner, variable)) return variable.name;
        // Only variables and lists have a Ruby name: a message of the stage named `_a_list_` is not
        // in the way, and the converter does not skip it either.
        const names = new Set(
            Object.values((owner && owner.variables) || {})
                .filter((v) => v.type === SCALAR_TYPE || v.type === LIST_TYPE)
                .map((v) => v.name),
        );
        let name = `_${variable.name}_list_`;
        for (let n = 2; names.has(name); n++) {
            name = `_${variable.name}_list${n}_`;
        }
        return name;
    };

    /**
     * The Ruby name of a variable or a list of a target: `@a`, or `@_a_list_` for a list beside
     * a variable of the same name (`$` on the stage). See `rubyBaseNameOfVariable`.
     * @param {object} owner - The target that has the variable or the list.
     * @param {boolean} isStage - Whether the owner is the stage.
     * @param {object} variable - The variable or the list.
     * @returns {string} The Ruby name.
     */
    Generator.rubyNameOfVariable = function (owner, isStage, variable) {
        return this.makeVariableName(isStage, this.rubyBaseNameOfVariable(owner, variable));
    };

    Generator.variableName = function (id, type = SCALAR_TYPE) {
        let currVar;
        let isStage;
        let owner;
        const target = this.currentTarget;
        const variables = target.variables;
        if (Object.prototype.hasOwnProperty.call(variables, id)) {
            currVar = variables[id];
            isStage = target.isStage;
            owner = target;
        } else if (target.runtime && !target.isStage) {
            const stage = target.runtime.getTargetForStage();
            if (stage && Object.prototype.hasOwnProperty.call(stage.variables, id)) {
                currVar = stage.variables[id];
                isStage = true;
                owner = stage;
            }
        }
        if (currVar && currVar.type === type) {
            return this.rubyNameOfVariable(owner, isStage, currVar);
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
        const marker = `@ruby:lvar:${name}:${scopeIndex}`;
        const comments = (this.cache_ && this.cache_.comments) || {};
        return Object.values(comments).some((comment) => rubyMarkersOf(comment.text).includes(marker));
    };

    Generator.variableNameByName = function (name, type = SCALAR_TYPE) {
        let currVar;
        let isStage;
        let owner;
        const target = this.currentTarget;
        if (target.runtime) {
            const stage = target.runtime.getTargetForStage();
            currVar = stage.lookupVariableByNameAndType(name, type);
            isStage = true;
            owner = stage;
        }
        if (!currVar) {
            currVar = target.lookupVariableByNameAndType(name, type);
            isStage = target.isStage;
            owner = target;
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
            return this.rubyNameOfVariable(owner, isStage, currVar);
        }
        return null;
    };

    Generator.listNameByName = function (name) {
        return this.variableNameByName(name, LIST_TYPE);
    };

    return Generator;
}
