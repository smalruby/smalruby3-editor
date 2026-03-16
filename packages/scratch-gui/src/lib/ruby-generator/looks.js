/**
 * Define Ruby code generator for Looks Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.looks_sayforsecs = function (block) {
        const message = Generator.valueToCode(block, 'MESSAGE', Generator.ORDER_NONE) || Generator.quote_('');
        const secs = Generator.valueToCode(block, 'SECS', Generator.ORDER_NONE) || '0';
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            let methodName = null;
            let argumentType = null;
            for (const part of commentParts) {
                if (part.startsWith('@ruby:method:')) {
                    methodName = part.substring(13);
                } else if (part.startsWith('@ruby:argument:1:type:')) {
                    argumentType = part.substring(22);
                }
            }

            if (methodName && ['print', 'puts', 'p'].includes(methodName) && secs === '1') {
                let argument = message;
                if (argumentType && (argumentType === 'Integer' || argumentType === 'Float')) {
                    if (argument.startsWith('"') && argument.endsWith('"')) {
                        argument = argument.slice(1, -1);
                    } else if (argument.startsWith("'") && argument.endsWith("'")) {
                        argument = argument.slice(1, -1);
                    }
                }
                return `${methodName}(${argument})\n`;
            }
        }
        return `say(${message}, ${secs})\n`;
    };

    Generator.looks_say = function (block) {
        const sayComment = Generator.getCommentText(block);
        if (sayComment && sayComment.startsWith('@ruby:symbol:')) {
            const symbolName = sayComment.slice('@ruby:symbol:'.length);
            return `say(:${symbolName})\n`;
        }
        const message = Generator.valueToCode(block, 'MESSAGE', Generator.ORDER_NONE) || Generator.quote_('');
        return `say(${message})\n`;
    };

    Generator.looks_thinkforsecs = function (block) {
        const message = Generator.valueToCode(block, 'MESSAGE', Generator.ORDER_NONE) || Generator.quote_('');
        const secs = Generator.valueToCode(block, 'SECS', Generator.ORDER_NONE) || '0';
        return `think(${message}, ${secs})\n`;
    };

    Generator.looks_think = function (block) {
        const thinkComment = Generator.getCommentText(block);
        if (thinkComment && thinkComment.startsWith('@ruby:symbol:')) {
            const symbolName = thinkComment.slice('@ruby:symbol:'.length);
            return `think(:${symbolName})\n`;
        }
        const message = Generator.valueToCode(block, 'MESSAGE', Generator.ORDER_NONE) || Generator.quote_('');
        return `think(${message})\n`;
    };

    Generator.looks_switchcostumeto = function (block) {
        const costume = Generator.valueToCode(block, 'COSTUME', Generator.ORDER_NONE) || null;
        return `switch_costume(${costume})\n`;
    };

    Generator.looks_costume = function (block) {
        const costume = Generator.quote_(Generator.getFieldValue(block, 'COSTUME') || null);
        return [costume, Generator.ORDER_ATOMIC];
    };

    Generator.looks_nextcostume = function () {
        return 'next_costume\n';
    };

    Generator.looks_switchbackdropto = function (block) {
        const backdrop = Generator.valueToCode(block, 'BACKDROP', Generator.ORDER_NONE) || null;
        return `switch_backdrop(${backdrop})\n`;
    };

    Generator.looks_backdrops = function (block) {
        const backdrop = Generator.quote_(Generator.getFieldValue(block, 'BACKDROP') || null);
        return [backdrop, Generator.ORDER_ATOMIC];
    };

    Generator.looks_nextbackdrop = function () {
        return 'next_backdrop\n';
    };

    Generator.looks_changesizeby = function (block) {
        const change = Generator.valueToCode(block, 'CHANGE', Generator.ORDER_NONE) || '0';
        const changeNum = parseFloat(change);
        if (!isNaN(changeNum) && changeNum < 0) {
            return `self.size -= ${-changeNum}\n`;
        }
        return `self.size += ${change}\n`;
    };

    Generator.looks_setsizeto = function (block) {
        const size = Generator.valueToCode(block, 'SIZE', Generator.ORDER_NONE) || '0';
        return `self.size = ${size}\n`;
    };

    Generator.looks_changeeffectby = function (block) {
        const effect = Generator.quote_(Generator.getFieldValue(block, 'EFFECT').toLowerCase() || '');
        const change = Generator.valueToCode(block, 'CHANGE', Generator.ORDER_NONE) || '0';
        return `change_effect_by(${effect}, ${change})\n`;
    };

    Generator.looks_seteffectto = function (block) {
        const effect = Generator.quote_(Generator.getFieldValue(block, 'EFFECT').toLowerCase() || '');
        const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '0';
        return `set_effect(${effect}, ${value})\n`;
    };

    Generator.looks_cleargraphiceffects = function () {
        return 'clear_graphic_effects\n';
    };

    Generator.looks_show = function () {
        return 'show\n';
    };

    Generator.looks_hide = function () {
        return 'hide\n';
    };

    Generator.looks_gotofrontback = function (block) {
        const frontBack = Generator.quote_(Generator.getFieldValue(block, 'FRONT_BACK') || 'front');
        return `go_to_layer(${frontBack})\n`;
    };

    Generator.looks_goforwardbackwardlayers = function (block) {
        const layer = Generator.valueToCode(block, 'NUM', Generator.ORDER_NONE) || 0;
        const forwardBackward = Generator.quote_(Generator.getFieldValue(block, 'FORWARD_BACKWARD') || 'forward');
        return `go_layers(${layer}, ${forwardBackward})\n`;
    };

    Generator.looks_costumenumbername = function (block) {
        const numberName = Generator.getFieldValue(block, 'NUMBER_NAME') || 'number';
        return [`costume_${numberName}`, Generator.ORDER_ATOMIC];
    };

    Generator.looks_backdropnumbername = function (block) {
        const numberName = Generator.getFieldValue(block, 'NUMBER_NAME') || 'number';
        return [`backdrop_${numberName}`, Generator.ORDER_ATOMIC];
    };

    Generator.looks_size = function () {
        return ['size', Generator.ORDER_ATOMIC];
    };

    Generator.looks_switchbackdroptoandwait = function (block) {
        const backdrop = Generator.valueToCode(block, 'BACKDROP', Generator.ORDER_NONE) || null;
        return `switch_backdrop_and_wait(${backdrop})\n`;
    };

    return Generator;
}
