import { KeyOptions, Variable } from './constants';
import { fieldArg, numberArg, registerSendTable } from './send-table';

const GreaterThanMenu = ['LOUDNESS', 'TIMER'];

const upcase = (value) => value.toUpperCase();

/**
 * The hats of event that map one to one onto a block (see `send-table.js`). `when_receive`,
 * `broadcast` (a broadcast message) and the v1 form `self.when(:flag_clicked)` are handlers below.
 */
const EVENT_SENDS = [
    { receiver: 'self', name: 'when_flag_clicked', opcode: 'event_whenflagclicked', hat: true },
    {
        receiver: 'self',
        name: 'when_key_pressed',
        opcode: 'event_whenkeypressed',
        hat: true,
        args: [fieldArg('KEY_OPTION', KeyOptions)],
    },
    { receiver: 'sprite', name: 'when_clicked', opcode: 'event_whenthisspriteclicked', hat: true },
    { receiver: 'stage', name: 'when_clicked', opcode: 'event_whenstageclicked', hat: true },
    {
        receiver: 'self',
        name: 'when_backdrop_switches',
        opcode: 'event_whenbackdropswitchesto',
        hat: true,
        args: [fieldArg('BACKDROP')],
    },
    {
        receiver: 'self',
        name: 'when_greater_than',
        opcode: 'event_whengreaterthan',
        hat: true,
        args: [fieldArg('WHENGREATERTHANMENU', GreaterThanMenu, { normalize: upcase }), numberArg('VALUE', 10)],
    },
];

/**
 * Event converter
 */
const EventConverter = {
    sends: EVENT_SENDS,

    register: function (converter) {
        registerSendTable(converter, EVENT_SENDS);

        converter.registerOnSendWithBlock('self', 'when_receive', 1, 0, (params) => {
            const { args, rubyBlock } = params;

            if (!converter.isString(args[0])) return null;

            const broadcastMsg = converter.lookupOrCreateBroadcastMsg(args[0]);
            const block = converter.createBlock('event_whenbroadcastreceived', 'hat');
            converter.addField(block, 'BROADCAST_OPTION', broadcastMsg.name, {
                id: broadcastMsg.id,
                variableType: Variable.BROADCAST_MESSAGE_TYPE,
            });
            converter.setParent(rubyBlock, block);
            return block;
        });

        const createBroadcastBlockFunc = (params, opcode) => {
            const { args } = params;

            if (!converter.isStringOrBlock(args[0])) return null;

            const menuBlock = converter.createBlock('event_broadcast_menu', 'value', {
                shadow: true,
            });
            let broadcastMsg;
            let inputBlock;
            let shadowBlock;
            if (converter.isString(args[0])) {
                broadcastMsg = converter.lookupOrCreateBroadcastMsg(args[0]);
                inputBlock = menuBlock;
                shadowBlock = menuBlock;
            } else {
                broadcastMsg = converter.defaultBroadcastMsg();
                inputBlock = args[0];
                shadowBlock = menuBlock;
            }
            converter.addField(menuBlock, 'BROADCAST_OPTION', broadcastMsg.name, {
                id: broadcastMsg.id,
                variableType: Variable.BROADCAST_MESSAGE_TYPE,
            });

            const block = converter.createBlock(opcode, 'statement');
            converter.addInput(block, 'BROADCAST_INPUT', inputBlock, shadowBlock);
            return block;
        };
        converter.registerOnSend('self', 'broadcast', 1, (params) =>
            createBroadcastBlockFunc(params, 'event_broadcast'),
        );
        converter.registerOnSend('self', 'broadcast_and_wait', 1, (params) =>
            createBroadcastBlockFunc(params, 'event_broadcastandwait'),
        );

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 1, 0, (params) => {
            const { args } = params;

            if (!converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
                case 'flag_clicked':
                    return converter.callMethod(
                        params.receiver,
                        'when_flag_clicked',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
                case 'clicked':
                    return converter.callMethod(
                        params.receiver,
                        'when_clicked',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
            }

            return null;
        });

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 2, 0, (params) => {
            const { args } = params;

            if (!converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
                case 'key_pressed':
                    return converter.callMethod(
                        params.receiver,
                        'when_key_pressed',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
                case 'backdrop_switches':
                    return converter.callMethod(
                        params.receiver,
                        'when_backdrop_switches',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
                case 'receive':
                    return converter.callMethod(
                        params.receiver,
                        'when_receive',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
            }

            return null;
        });

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 3, 0, (params) => {
            const { args } = params;

            if (!converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
                case 'greater_than':
                    return converter.callMethod(
                        params.receiver,
                        'when_greater_than',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
            }

            return null;
        });
    },
};

export default EventConverter;
