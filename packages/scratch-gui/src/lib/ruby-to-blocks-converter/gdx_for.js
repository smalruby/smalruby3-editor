import { menuArg, registerSendTable } from './send-table';

const GdxFor = 'gdx_for';

// A menu of the extension: any string as it is, or a value block in place of the menu.
const gdxMenu = (input, menu) => menuArg(input, `gdxfor_menu_${menu}`, menu, { orBlock: true });

// The calls of `gdx_for.xxx` that map one to one onto a block (send-table.js).
const GDX_FOR_CALLS = [
    { name: 'acceleration', opcode: 'gdxfor_getAcceleration', args: [gdxMenu('DIRECTION', 'axisOptions')] },
    { name: 'force', opcode: 'gdxfor_getForce' },
    { name: 'tilted?', opcode: 'gdxfor_isTilted', args: [gdxMenu('TILT', 'tiltAnyOptions')] },
    { name: 'tilt_angle', opcode: 'gdxfor_getTilt', args: [gdxMenu('TILT', 'tiltOptions')] },
    { name: 'falling?', opcode: 'gdxfor_isFreeFalling' },
    { name: 'spin_speed', opcode: 'gdxfor_getSpinSpeed', args: [gdxMenu('DIRECTION', 'axisOptions')] },
].map((row) => ({ type: 'value', ...row }));

const GDX_FOR_SENDS = [
    ...GDX_FOR_CALLS,
    { name: 'when_gesture', opcode: 'gdxfor_whenGesture', hat: true, args: [gdxMenu('GESTURE', 'gestureOptions')] },
    {
        name: 'when_sensor',
        opcode: 'gdxfor_whenForcePushedOrPulled',
        hat: true,
        args: [gdxMenu('PUSH_PULL', 'pushPullOptions')],
    },
    { name: 'when_tilted', opcode: 'gdxfor_whenTilted', hat: true, args: [gdxMenu('TILT', 'tiltAnyOptions')] },
]
    .map((row) => ({ receiver: GdxFor, changesReceiver: true, ...row }))
    // backward compatibility: the same calls named `gdx_for_xxx`, without the receiver.
    .concat(GDX_FOR_CALLS.map((row) => ({ ...row, receiver: 'self', name: `gdx_for_${row.name}` })));

/**
 * GdxFor converter
 */
const GdxForConverter = {
    sends: GDX_FOR_SENDS,

    register: function (converter) {
        // Create the initial Ruby expression block
        converter.registerOnSend('self', GdxFor, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(GdxFor, node);
        });

        registerSendTable(converter, GDX_FOR_SENDS);

        // Backward compatibility - old event handlers
        converter.registerOnSendWithBlock('self', 'when', 2, 0, (params) => {
            const { args, rubyBlock } = params;

            if (args[0].type !== 'sym' || !converter.isStringOrBlock(args[1])) return null;

            let block;
            switch (args[0].value) {
                case 'gdx_for_gesture': {
                    block = converter.createBlock('gdxfor_whenGesture', 'hat');
                    converter.addInput(
                        block,
                        'GESTURE',
                        converter.createFieldBlock('gdxfor_menu_gestureOptions', 'gestureOptions', args[1]),
                    );
                    converter.setParent(rubyBlock, block);
                    break;
                }

                case 'gdx_force_sensor': {
                    block = converter.createBlock('gdxfor_whenForcePushedOrPulled', 'hat');
                    converter.addInput(
                        block,
                        'PUSH_PULL',
                        converter.createFieldBlock('gdxfor_menu_pushPullOptions', 'pushPullOptions', args[1]),
                    );
                    converter.setParent(rubyBlock, block);
                    break;
                }

                case 'gdx_for_tilted': {
                    block = converter.createBlock('gdxfor_whenTilted', 'hat');
                    converter.addInput(
                        block,
                        'TILT',
                        converter.createFieldBlock('gdxfor_menu_tiltAnyOptions', 'tiltAnyOptions', args[1]),
                    );
                    converter.setParent(rubyBlock, block);
                    break;
                }
            }

            return block;
        });
    },
};

export default GdxForConverter;
