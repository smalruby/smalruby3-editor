import _ from 'lodash';

const Pen = 'pen';

/**
 * Pen converter
 */
const PenConverter = {
    register: function (converter) {
        converter.registerOnSend('::Pen', 'clear', 0, () => converter.createBlock('pen_clear', 'statement'));

        // v2: pen.clear
        converter.registerOnSend(Pen, 'clear', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(receiver, 'pen_clear', 'statement');
        });

        // backward compatibility
        converter.registerOnSend('self', 'pen_clear', 0, () => converter.createBlock('pen_clear', 'statement'));

        converter.registerOnSend('sprite', Pen, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(Pen, node);
        });

        converter.registerOnSend(Pen, 'stamp', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(receiver, 'pen_stamp', 'statement');
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_stamp', 0, () => converter.createBlock('pen_stamp', 'statement'));

        converter.registerOnSend(Pen, 'down', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(receiver, 'pen_penDown', 'statement');
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_down', 0, () => converter.createBlock('pen_penDown', 'statement'));

        converter.registerOnSend(Pen, 'up', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(receiver, 'pen_penUp', 'statement');
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_up', 0, () => converter.createBlock('pen_penUp', 'statement'));

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

        converter.registerOnSend(Pen, 'saturation=', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'pen_setPenColorParamTo', 'statement');
            converter.addFieldInput(block, 'COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'saturation', 'color');
            converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
            return block;
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_saturation=', 1, (params) => {
            const { args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('pen_setPenColorParamTo', 'statement');
            converter.addFieldInput(block, 'COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'saturation', 'color');
            converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
            return block;
        });

        converter.registerOnSend(Pen, 'brightness=', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'pen_setPenColorParamTo', 'statement');
            converter.addFieldInput(block, 'COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'brightness', 'color');
            converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
            return block;
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_brightness=', 1, (params) => {
            const { args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('pen_setPenColorParamTo', 'statement');
            converter.addFieldInput(block, 'COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'brightness', 'color');
            converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
            return block;
        });

        converter.registerOnSend(Pen, 'transparency=', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'pen_setPenColorParamTo', 'statement');
            converter.addFieldInput(
                block,
                'COLOR_PARAM',
                'pen_menu_colorParam',
                'colorParam',
                'transparency',
                'color',
            );
            converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
            return block;
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_transparency=', 1, (params) => {
            const { args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('pen_setPenColorParamTo', 'statement');
            converter.addFieldInput(
                block,
                'COLOR_PARAM',
                'pen_menu_colorParam',
                'colorParam',
                'transparency',
                'color',
            );
            converter.addNumberInput(block, 'VALUE', 'math_number', args[0], 50);
            return block;
        });

        converter.registerOnSend(Pen, 'size=', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'pen_setPenSizeTo', 'statement');
            converter.addNumberInput(block, 'SIZE', 'math_number', args[0], 1);
            return block;
        });

        // backward compatibility
        converter.registerOnSend('sprite', 'pen_size=', 1, (params) => {
            const { args } = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('pen_setPenSizeTo', 'statement');
            converter.addNumberInput(block, 'SIZE', 'math_number', args[0], 1);
            return block;
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
