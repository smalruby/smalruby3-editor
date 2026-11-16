import _ from 'lodash';
import { numberArg, registerSendTable } from './send-table';

const Pen = 'pen';

const colorParamMenu = (value) => ({ COLOR_PARAM: ['pen_menu_colorParam', 'colorParam', value] });

const ColorParams = ['saturation', 'brightness', 'transparency'];

/**
 * The calls of pen that map one to one onto a block (see `send-table.js`): the v2 form on the
 * Ruby expression `pen` (`pen.down`) and the v1 form (`pen_down`). `pen.color =` (a number or a
 * color) and `pen.size += 1` are handlers below.
 */
const PEN_SENDS = [
    { receiver: '::Pen', name: 'clear', opcode: 'pen_clear' },
    { receiver: Pen, name: 'clear', opcode: 'pen_clear', changesReceiver: true },
    { receiver: 'self', name: 'pen_clear', opcode: 'pen_clear' },
    { receiver: Pen, name: 'stamp', opcode: 'pen_stamp', changesReceiver: true },
    { receiver: 'sprite', name: 'pen_stamp', opcode: 'pen_stamp' },
    { receiver: Pen, name: 'down', opcode: 'pen_penDown', changesReceiver: true },
    { receiver: 'sprite', name: 'pen_down', opcode: 'pen_penDown' },
    { receiver: Pen, name: 'up', opcode: 'pen_penUp', changesReceiver: true },
    { receiver: 'sprite', name: 'pen_up', opcode: 'pen_penUp' },
    ...ColorParams.flatMap((param) => [
        {
            receiver: Pen,
            name: `${param}=`,
            opcode: 'pen_setPenColorParamTo',
            changesReceiver: true,
            menus: colorParamMenu(param),
            args: [numberArg('VALUE', 50)],
        },
        {
            receiver: 'sprite',
            name: `pen_${param}=`,
            opcode: 'pen_setPenColorParamTo',
            menus: colorParamMenu(param),
            args: [numberArg('VALUE', 50)],
        },
    ]),
    { receiver: Pen, name: 'size=', opcode: 'pen_setPenSizeTo', changesReceiver: true, args: [numberArg('SIZE', 1)] },
    { receiver: 'sprite', name: 'pen_size=', opcode: 'pen_setPenSizeTo', args: [numberArg('SIZE', 1)] },
];

/**
 * Pen converter
 */
const PenConverter = {
    sends: PEN_SENDS,

    register: function (converter) {
        registerSendTable(converter, PEN_SENDS);

        converter.registerOnSend('sprite', Pen, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(Pen, node);
        });

        converter.registerOnSend(Pen, 'color=', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isNumberOrBlock(args[0]) && !converter.isColorOrBlock(args[0])) return null;

            if (converter.isNumberOrBlock(args[0])) {
                const block = converter.changeRubyExpressionBlock(receiver, 'pen_setPenColorParamTo', 'statement');
                converter.addFieldInput(block, 'COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'color', 'color');
                converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
                return block;
            }

            const block = converter.changeRubyExpressionBlock(receiver, 'pen_setPenColorToColor', 'statement');
            converter.addColorFieldInput(block, 'COLOR', args[0], '#43066f');
            return block;
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_color=', 1, (params) => {
            const { args } = params;

            if (converter.isNumberOrBlock(args[0])) {
                const block = converter.createBlock('pen_setPenColorParamTo', 'statement');
                converter.addFieldInput(block, 'COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'color', 'color');
                converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
                return block;
            } else if (converter.isColorOrBlock(args[0])) {
                const block = converter.createBlock('pen_setPenColorToColor', 'statement');
                converter.addColorFieldInput(block, 'COLOR', args[0], '#43066f');
                return block;
            }
            return null;
        });

        // backward compatibility getters for +=
        ['color', 'saturation', 'brightness', 'transparency', 'size'].forEach((methodName) => {
            converter.registerOnSend('sprite', `pen_${methodName}`, 0, (params) => {
                const { node } = params;
                return converter.createRubyStatementBlock(`self.pen_${methodName}`, node);
            });
        });

        // backward compatibility getters for v1 book code: self.color += 10
        ['color', 'saturation', 'brightness', 'transparency'].forEach((methodName) => {
            converter.registerOnSend('self', methodName, 0, (params) => {
                const { node } = params;
                return converter.createRubyStatementBlock(`self.${methodName}`, node);
            });
        });

        // for +=
        ['color', 'saturation', 'brightness', 'transparency', 'size'].forEach((methodName) => {
            converter.registerOnSend(Pen, methodName, 0, (params) => {
                const { receiver, node } = params;

                return converter.changeRubyExpression(receiver, node);
            });
        });

        // pen.size += 1, self.pen_size += 1 (and v1's self.color += 10)
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (converter.isRubyExpression(lh) && operator === '+' && converter._isNumberOrBlock(rh)) {
                const code = converter.getRubyExpression(lh);
                switch (code) {
                    case 'pen.size':
                    case 'pen_size':
                        block = converter.changeRubyExpressionBlock(lh, 'pen_changePenSizeBy', 'statement');
                        converter.addNumberInput(block, 'SIZE', 'math_number', rh, 1);
                        break;
                    case 'pen.color':
                    case 'pen_color':
                    case 'pen.saturation':
                    case 'pen_saturation':
                    case 'pen.brightness':
                    case 'pen_brightness':
                    case 'pen.transparency':
                    case 'pen_transparency':
                        block = converter.changeRubyExpressionBlock(lh, 'pen_changePenColorParamBy', 'statement');

                        converter.addFieldInput(
                            block,
                            'COLOR_PARAM',
                            'pen_menu_colorParam',
                            'colorParam',
                            code.replace('pen.', '').replace('pen_', ''),
                            'color',
                        );
                        converter.addNumberInput(block, 'VALUE', 'math_number', rh, 10);
                        break;
                }
            } else if (converter._isRubyStatement(lh) && operator === '+' && converter._isNumberOrBlock(rh)) {
                const code = converter._getRubyStatement(lh);
                switch (code) {
                    case 'self.pen_size':
                        block = converter._changeBlock(lh, 'pen_changePenSizeBy', 'statement');
                        delete converter._context.blocks[block.inputs.STATEMENT.block];
                        delete block.inputs.STATEMENT;

                        converter._addNumberInput(block, 'SIZE', 'math_number', rh, 1);
                        break;
                    case 'self.pen_color':
                    case 'self.pen_saturation':
                    case 'self.pen_brightness':
                    case 'self.pen_transparency':
                        block = converter._changeBlock(lh, 'pen_changePenColorParamBy', 'statement');
                        delete converter._context.blocks[block.inputs.STATEMENT.block];
                        delete block.inputs.STATEMENT;

                        converter._addFieldInput(
                            block,
                            'COLOR_PARAM',
                            'pen_menu_colorParam',
                            'colorParam',
                            code.replace('self.pen_', ''),
                            'color',
                        );
                        converter._addNumberInput(block, 'VALUE', 'math_number', rh, 10);
                        break;
                    // backward compatibility for v1 book code: self.color += 10
                    case 'self.color':
                    case 'self.saturation':
                    case 'self.brightness':
                    case 'self.transparency':
                        block = converter._changeBlock(lh, 'pen_changePenColorParamBy', 'statement');
                        delete converter._context.blocks[block.inputs.STATEMENT.block];
                        delete block.inputs.STATEMENT;

                        converter._addFieldInput(
                            block,
                            'COLOR_PARAM',
                            'pen_menu_colorParam',
                            'colorParam',
                            code.replace('self.', ''),
                            'color',
                        );
                        converter._addNumberInput(block, 'VALUE', 'math_number', rh, 10);
                        break;
                }
            }
            return block;
        });
    },
};

export default PenConverter;
