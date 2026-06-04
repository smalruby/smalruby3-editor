/* eslint-env jest */
import { getSensorValueCollisions, hasSensorValueCollision } from '../../../src/lib/mesh-v2-sensor-collision.js';

// Build a minimal VM-like object matching the REAL block shape: the sensor value
// block stores its selected name in a shadow menu block (meshV2_menu_variableNames)
// wired to its NAME input. Global scalar variables live on the stage.
const makeVm = ({ globals = [], sensorNames = [], lists = [] } = {}) => {
    const variables = {};
    globals.forEach((name, i) => {
        variables[`g${i}`] = { name, type: '' };
    });
    lists.forEach((name, i) => {
        variables[`l${i}`] = { name, type: 'list' };
    });
    const blocks = {};
    sensorNames.forEach((name, i) => {
        const menuId = `m${i}`;
        blocks[`b${i}`] = {
            opcode: 'meshV2_getSensorValue',
            fields: {},
            inputs: { NAME: { name: 'NAME', block: menuId, shadow: menuId } },
        };
        blocks[menuId] = {
            opcode: 'meshV2_menu_variableNames',
            shadow: true,
            fields: { variableNames: { name: 'variableNames', value: name } },
            inputs: {},
        };
    });
    const stage = { isStage: true, variables, blocks: { _blocks: {} } };
    const sprite = { isStage: false, variables: {}, blocks: { _blocks: blocks } };
    return {
        runtime: {
            targets: [stage, sprite],
            getTargetForStage: () => stage,
        },
    };
};

describe('mesh-v2 sensor value collision detection', () => {
    test('no collision when names differ', () => {
        const vm = makeVm({ globals: ['score'], sensorNames: ['other'] });
        expect(hasSensorValueCollision(vm)).toBe(false);
        expect(getSensorValueCollisions(vm)).toEqual([]);
    });

    test('collision when a sensor value name matches a global scalar variable', () => {
        const vm = makeVm({ globals: ['score', 'lives'], sensorNames: ['score'] });
        expect(hasSensorValueCollision(vm)).toBe(true);
        expect(getSensorValueCollisions(vm)).toEqual(['score']);
    });

    test('no collision when there are no sensor value blocks', () => {
        const vm = makeVm({ globals: ['score'], sensorNames: [] });
        expect(hasSensorValueCollision(vm)).toBe(false);
    });

    test('no collision when there are no global variables', () => {
        const vm = makeVm({ globals: [], sensorNames: ['score'] });
        expect(hasSensorValueCollision(vm)).toBe(false);
    });

    test('list variables do not count as a collision', () => {
        const vm = makeVm({ lists: ['score'], sensorNames: ['score'] });
        expect(hasSensorValueCollision(vm)).toBe(false);
    });

    test('empty sensor NAME (no selection) is ignored', () => {
        const vm = makeVm({ globals: [''], sensorNames: [''] });
        expect(hasSensorValueCollision(vm)).toBe(false);
    });

    test('is null/undefined safe', () => {
        expect(hasSensorValueCollision(undefined)).toBe(false);
        expect(hasSensorValueCollision({})).toBe(false);
        expect(hasSensorValueCollision({ runtime: {} })).toBe(false);
    });
});
