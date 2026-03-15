// === Smalruby: This file is Smalruby-specific (Ruby variable name helpers for RubyGenerator) ===

const SCALAR_TYPE = '';
const LIST_TYPE = 'list';

const escapeIdentityRegexp =
    /[\x00-\x1f\x7f-\x9f !"#$%&'()*+,-./:;<=>?@[\\\]^`{|}~]/g; // eslint-disable-line no-control-regex

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
            return this.makeVariableName(isStage, currVar.name);
        }
        return null;
    };

    Generator.listNameByName = function (name) {
        return this.variableNameByName(name, LIST_TYPE);
    };

    return Generator;
}
