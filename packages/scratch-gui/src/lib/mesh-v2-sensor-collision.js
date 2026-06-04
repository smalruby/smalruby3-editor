// Issue #707: detect when the Mesh v2 "sensor value" block looks up a name that
// is also one of this project's own global (stage scalar) variables.
//
// Since the sensor value block now reads this node's own variables too
// (self-inclusive behavior), such a collision means the value the block returns
// may have changed for projects authored before this change. When a collision is
// first detected we show a one-time, non-blocking notice.

const SENSOR_VALUE_OPCODE = 'meshV2_getSensorValue';
// scratch-vm Variable.SCALAR_TYPE is the empty string.
const SCALAR_TYPE = '';

/**
 * Collect the names of the project's global scalar variables (stored on the stage).
 * @param {object} vm - The Scratch VM instance.
 * @returns {Set<string>} Set of global scalar variable names.
 */
const getGlobalScalarVariableNames = (vm) => {
    const names = new Set();
    const stage = vm && vm.runtime && vm.runtime.getTargetForStage && vm.runtime.getTargetForStage();
    if (!stage || !stage.variables) return names;
    for (const id in stage.variables) {
        const variable = stage.variables[id];
        if (variable && variable.type === SCALAR_TYPE && typeof variable.name === 'string') {
            names.add(variable.name);
        }
    }
    return names;
};

/**
 * Collect the literal NAME values selected on every Mesh v2 sensor value block,
 * across all targets. Reporter-driven lookups (a block plugged into NAME) are
 * not literals and cannot be matched statically, so they are skipped.
 * @param {object} vm - The Scratch VM instance.
 * @returns {Set<string>} Set of sensor value lookup names.
 */
const getSensorValueLookupNames = (vm) => {
    const names = new Set();
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
        const blocks = target && target.blocks && target.blocks._blocks;
        if (!blocks) continue;
        for (const blockId in blocks) {
            const block = blocks[blockId];
            if (block && block.opcode === SENSOR_VALUE_OPCODE && block.fields && block.fields.NAME) {
                const value = block.fields.NAME.value;
                if (typeof value === 'string' && value !== '') names.add(value);
            }
        }
    }
    return names;
};

/**
 * Return the names that are both a global scalar variable and a sensor value
 * lookup in the current project.
 * @param {object} vm - The Scratch VM instance.
 * @returns {Array<string>} Colliding names (empty when there is no collision).
 */
const getSensorValueCollisions = (vm) => {
    const lookups = getSensorValueLookupNames(vm);
    if (lookups.size === 0) return [];
    const globals = getGlobalScalarVariableNames(vm);
    const collisions = [];
    for (const name of lookups) {
        if (globals.has(name)) collisions.push(name);
    }
    return collisions;
};

/**
 * Whether the current project has any sensor-value / global-variable collision.
 * @param {object} vm - The Scratch VM instance.
 * @returns {boolean} True when at least one name collides.
 */
const hasSensorValueCollision = (vm) => getSensorValueCollisions(vm).length > 0;

export { getSensorValueCollisions, hasSensorValueCollision, getGlobalScalarVariableNames, getSensorValueLookupNames };
