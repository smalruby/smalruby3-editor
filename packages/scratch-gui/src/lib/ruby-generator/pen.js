/**
 * Define Ruby code generator for Pen Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    const isV1 = () => String(Generator.version) === '1';

    Generator.pen_clear = function () {
        if (isV1()) {
            return 'pen_clear\n';
        }
        return 'Pen.clear\n';
    };

    Generator.pen_stamp = function () {
        if (isV1()) {
            return 'pen_stamp\n';
        }
        return 'pen.stamp\n';
    };

    Generator.pen_penDown = function () {
        if (isV1()) {
            return 'pen_down\n';
        }
        return 'pen.down\n';
    };

    Generator.pen_penUp = function () {
        if (isV1()) {
            return 'pen_up\n';
        }
        return 'pen.up\n';
    };

    Generator.pen_setPenColorToColor = function (block) {
        const color = Generator.valueToCode(block, 'COLOR', Generator.ORDER_NONE) || null;
        if (isV1()) {
            return `self.pen_color = ${color}\n`;
        }
        return `pen.color = ${color}\n`;
    };

    Generator.pen_changePenColorParamBy = function (block) {
        const colorParam = Generator.valueToCode(block, 'COLOR_PARAM', Generator.ORDER_NONE) || null;
        const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || 0;
        if (isV1()) {
            return `self.${colorParam} += ${value}\n`;
        }
        return `pen.${colorParam} += ${value}\n`;
    };

    Generator.pen_setPenColorParamTo = function (block) {
        const colorParam = Generator.valueToCode(block, 'COLOR_PARAM', Generator.ORDER_NONE) || null;
        const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || 0;
        if (isV1()) {
            return `self.pen_${colorParam} = ${value}\n`;
        }
        return `pen.${colorParam} = ${value}\n`;
    };

    Generator.pen_menu_colorParam = function (block) {
        const colorParam = Generator.getFieldValue(block, 'colorParam') || 'color';
        return [colorParam, Generator.ORDER_ATOMIC];
    };

    Generator.pen_changePenSizeBy = function (block) {
        const size = Generator.valueToCode(block, 'SIZE', Generator.ORDER_NONE) || 0;
        if (isV1()) {
            return `self.pen_size += ${size}\n`;
        }
        return `pen.size += ${size}\n`;
    };

    Generator.pen_setPenSizeTo = function (block) {
        const size = Generator.valueToCode(block, 'SIZE', Generator.ORDER_NONE) || 0;
        if (isV1()) {
            return `self.pen_size = ${size}\n`;
        }
        return `pen.size = ${size}\n`;
    };

    return Generator;
}
