import _ from 'lodash';
import { KeyOptions } from './constants';
import { colorArg, menuInputArg, registerSendTable, textArg } from './send-table';

const DragMode = ['draggable', 'not draggable'];

const TimeNow = '::Time.now';
const TimeNowWday = 'Time.now.wday';

const spriteCall = function (name) {
    return `sprite("${name.toString()}")`;
};

const Stage = 'stage';

// Mouse.x / mouse.x, Timer.value / timer.value
const MouseGetters = [
    { method: 'down?', opcode: 'sensing_mousedown', blockType: 'value_boolean' },
    { method: 'x', opcode: 'sensing_mousex', blockType: 'value' },
    { method: 'y', opcode: 'sensing_mousey', blockType: 'value' },
];

const TimerMethods = [
    { method: 'value', opcode: 'sensing_timer', blockType: 'value' },
    { method: 'reset', opcode: 'sensing_resettimer', blockType: 'statement' },
];

/**
 * The calls of sensing that map one to one onto a block (see `send-table.js`). The v2 forms on a
 * receiver that is a Ruby expression (`mouse.x`, `timer.value`, `stage.volume`, `sprite("A").x`,
 * `Time.now.year`), `gets`, `self.drag_mode = true` and `keyboard.pressed?` are handlers below.
 */
const SENSING_SENDS = [
    { receiver: 'self', name: 'answer', opcode: 'sensing_answer', type: 'value' },
    { receiver: 'self', name: 'loudness', opcode: 'sensing_loudness', type: 'value' },
    { receiver: 'self', name: 'days_since_2000', opcode: 'sensing_dayssince2000', type: 'value' },
    { receiver: 'self', name: 'online?', opcode: 'sensing_online', type: 'value' },
    { receiver: 'self', name: 'user_name', opcode: 'sensing_username', type: 'value' },
    ...MouseGetters.map(({ method, opcode, blockType }) => ({
        receiver: '::Mouse',
        name: method,
        opcode,
        type: blockType,
    })),
    ...TimerMethods.map(({ method, opcode, blockType }) => ({
        receiver: '::Timer',
        name: method,
        opcode,
        type: blockType,
    })),
    {
        receiver: 'sprite',
        name: 'touching?',
        opcode: 'sensing_touchingobject',
        type: 'value_boolean',
        args: [menuInputArg('TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', '_mouse_')],
    },
    {
        receiver: 'sprite',
        name: 'touching_color?',
        opcode: 'sensing_touchingcolor',
        type: 'value_boolean',
        args: [colorArg('COLOR', '#43066f')],
    },
    {
        receiver: 'sprite',
        name: 'color_is_touching_color?',
        opcode: 'sensing_coloristouchingcolor',
        type: 'value_boolean',
        args: [colorArg('COLOR', '#aad315'), colorArg('COLOR2', '#fca3bf')],
    },
    {
        receiver: 'sprite',
        name: 'distance',
        opcode: 'sensing_distanceto',
        type: 'value',
        args: [menuInputArg('DISTANCETOMENU', 'sensing_distancetomenu', 'DISTANCETOMENU', '_mouse_')],
    },
    {
        receiver: 'self',
        name: 'ask',
        opcode: 'sensing_askandwait',
        args: [textArg('QUESTION', "What's your name?")],
    },
    {
        receiver: '::Keyboard',
        name: 'pressed?',
        opcode: 'sensing_keypressed',
        type: 'value_boolean',
        args: [
            menuInputArg('KEY_OPTION', 'sensing_keyoptions', 'KEY_OPTION', 'space', {
                choices: KeyOptions,
                anyBlock: true,
            }),
        ],
    },
];

/**
 * Sensing converter
 */
const SensingConverter = {
    sends: SENSING_SENDS,

    register: function (converter) {
        registerSendTable(converter, SENSING_SENDS);

        // v2: mouse.xxx (lowercase receiver)
        converter.registerOnSend('sprite', 'mouse', 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock('mouse', node);
        });
        MouseGetters.forEach(({ method, opcode, blockType }) => {
            converter.registerOnSend('mouse', method, 0, (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(receiver, opcode, blockType);
            });
        });

        // v2: timer.xxx (lowercase receiver)
        converter.registerOnSend('sprite', 'timer', 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock('timer', node);
        });
        TimerMethods.forEach(({ method, opcode, blockType }) => {
            converter.registerOnSend('timer', method, 0, (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(receiver, opcode, blockType);
            });
        });

        // stage - returns Ruby expression
        converter.registerOnSend('self', Stage, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(Stage, node);
        });

        const stageGetters = [
            { method: 'backdrop_number', property: 'backdrop #' },
            { method: 'backdrop_name', property: 'backdrop name' },
            { method: 'volume', property: 'volume' },
        ];
        stageGetters.forEach(({ method, property }) => {
            converter.registerOnSend(Stage, method, 0, (params) => {
                const { receiver } = params;

                const block = converter.changeRubyExpressionBlock(receiver, 'sensing_of', 'value');
                converter.addField(block, 'PROPERTY', property);
                converter.addFieldInput(block, 'OBJECT', 'sensing_of_object_menu', 'OBJECT', '_stage_');
                return block;
            });
        });

        converter.registerOnSend(Stage, 'variable', 1, (params) => {
            const { receiver, args } = params;

            if (!converter.isString(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'sensing_of', 'value');
            converter.addField(block, 'PROPERTY', args[0]);
            converter.addFieldInput(block, 'OBJECT', 'sensing_of_object_menu', 'OBJECT', '_stage_');
            return block;
        });

        // Gets method (all targets)
        converter.registerOnSend('self', 'gets', 0, () => {
            const askBlock = converter.createBlock('sensing_askandwait', 'statement');
            converter.addTextInput(askBlock, 'QUESTION', '', '');
            askBlock.comment = converter.createComment('@ruby:method:gets', askBlock.id);

            const answerBlock = converter.createBlock('sensing_answer', 'value');
            answerBlock.comment = converter.createComment('@ruby:method:gets', answerBlock.id);

            return [askBlock, answerBlock];
        });

        // Drag mode method (sprite only)
        converter.registerOnSend('sprite', 'drag_mode=', 1, (params) => {
            const { args } = params;

            const validDragMode = converter.isString(args[0]) && DragMode.indexOf(args[0].toString()) >= 0;
            const validBoolean = converter._isTrue(args[0]) || converter._isFalse(args[0]);

            if (!validDragMode && !validBoolean) return null;

            const block = converter.createBlock('sensing_setdragmode', 'statement');
            let dragMode = args[0];
            if (converter._isTrue(dragMode)) {
                dragMode = 'draggable';
            } else if (converter._isFalse(dragMode)) {
                dragMode = 'not draggable';
            }
            // Only the literal's value picks the field: drop its `1 = 1` / `0 < 0` block.
            converter.discardValue(args[0]);
            converter.addField(block, 'DRAG_MODE', dragMode);
            return block;
        });

        // v2: keyboard.pressed?(key) (lowercase receiver)
        converter.registerOnSend('sprite', 'keyboard', 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock('keyboard', node);
        });
        converter.registerOnSend('keyboard', 'pressed?', 1, (params) => {
            const { receiver, args } = params;

            const validKey = converter.isString(args[0]) && KeyOptions.indexOf(args[0].toString()) >= 0;
            const isBlockArg = converter.isBlock(args[0]);

            if (!validKey && !isBlockArg) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'sensing_keypressed', 'value_boolean');
            converter.addFieldInput(block, 'KEY_OPTION', 'sensing_keyoptions', 'KEY_OPTION', args[0], 'space');
            return block;
        });

        converter.registerOnSend('::Time', 'now', 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(TimeNow, node);
        });

        const timeNowMethods = [
            { method: 'year', currentMenu: 'YEAR' },
            { method: 'month', currentMenu: 'MONTH' },
            { method: 'day', currentMenu: 'DATE' },
            { method: 'hour', currentMenu: 'HOUR' },
            { method: 'min', currentMenu: 'MINUTE' },
            { method: 'sec', currentMenu: 'SECOND' },
        ];
        timeNowMethods.forEach(({ method, currentMenu }) => {
            converter.registerOnSend(TimeNow, method, 0, (params) => {
                const { receiver } = params;

                const block = converter.changeRubyExpressionBlock(receiver, 'sensing_current', 'value');
                converter.addField(block, 'CURRENTMENU', currentMenu);
                return block;
            });
        });

        // Special handling for wday - changes expression to TimeNowWday
        converter.registerOnSend(TimeNow, 'wday', 0, (params) => {
            const { receiver, node } = params;

            return converter.changeRubyExpression(receiver, node, TimeNowWday);
        });

        // Special handling for wday + 1 (DAYOFWEEK)
        converter.registerOnSend(TimeNowWday, '+', 1, (params) => {
            const { receiver, args } = params;

            if (!converter.isNumber(args[0]) || args[0].toString() !== '1') return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'sensing_current', 'value');
            converter.addField(block, 'CURRENTMENU', 'DAYOFWEEK');
            return block;
        });

        converter.registerOnSend('self', 'sprite', 1, (params) => {
            const { args, node } = params;

            if (!converter.isString(args[0])) return null;

            return converter.createRubyExpressionBlock(spriteCall(args[0]), node);
        });

        // Sprite property getters
        const spriteGetters = [
            { method: 'x', property: 'x position' },
            { method: 'y', property: 'y position' },
            { method: 'direction', property: 'direction' },
            { method: 'costume_number', property: 'costume #' },
            { method: 'costume_name', property: 'costume name' },
            { method: 'size', property: 'size' },
            { method: 'volume', property: 'volume' },
        ];

        spriteGetters.forEach(({ method, property }) => {
            converter.registerOnSend('sprite_call', method, 0, (params) => {
                const { receiver } = params;

                const spriteName = converter._getSpriteCallName(receiver);
                if (!spriteName) return null;

                const block = converter.changeRubyExpressionBlock(receiver, 'sensing_of', 'value');
                converter.addField(block, 'PROPERTY', property);
                converter.addFieldInput(block, 'OBJECT', 'sensing_of_object_menu', 'OBJECT', spriteName);
                return block;
            });
        });

        // Sprite variable method
        converter.registerOnSend('sprite_call', 'variable', 1, (params) => {
            const { receiver, args } = params;

            if (!converter.isString(args[0])) return null;

            const spriteName = converter._getSpriteCallName(receiver);
            if (!spriteName) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'sensing_of', 'value');
            converter.addField(block, 'PROPERTY', args[0]);
            converter.addFieldInput(block, 'OBJECT', 'sensing_of_object_menu', 'OBJECT', spriteName);
            return block;
        });
    },
};

export default SensingConverter;
