/* istanbul ignore file */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const log = require('../../util/log');
const formatMessage = require('format-message');
const {v4: uuidv4} = require('uuid');
const Variable = require('../../engine/variable');
const MeshHost = require('./mesh-host');
const MeshPeer = require('./mesh-peer');

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
// eslint-disable-next-line max-len
const blockIconURI = 'data:image/png;base64,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';

const MESH_HOST_PERIPHERAL_ID = 'mesh_host';

const MESH_ID_LABEL_CHARACTERS = {
    0: 'い',
    1: 'し',
    2: 'か',
    3: 'た',
    4: 'う',
    5: 'ん',
    6: 'て',
    7: 'と',
    8: 'の',
    9: 'つ',
    a: 'は',
    b: 'こ',
    c: 'に',
    d: 'な',
    e: 'く',
    f: 'き'
};

/**
 * Host for the Mesh-related blocks
 * @param {object} runtime - the runtime instantiating this block package.
 * @class
 */
class Scratch3MeshBlocks {
    /**
     * @returns {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return 'Mesh';
    }

    /**
     * @returns {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return 'mesh';
    }

    constructor (runtime) {
        log.info('Loading OLD Mesh extension (SkyWay)');
        /**
         * The runtime instantiating this block package.
         * @type {object}
         */
        this.runtime = runtime;

        /**
         * Mesh ID
         * @type {string}
         */
        this.meshId = uuidv4().replaceAll('-', ''); /* NOTE: IDのバイト数を短くするため "-" を削っている */

        /**
         * Mesh Object
         * @type {MeshHost|MeshPeer}
         */
        this.meshService = new MeshPeer(this, this.meshId, null);

        this.runtime.registerPeripheralExtension(Scratch3MeshBlocks.EXTENSION_ID, this);
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        return {
            id: Scratch3MeshBlocks.EXTENSION_ID,
            name: Scratch3MeshBlocks.EXTENSION_NAME,
            blockIconURI: blockIconURI,
            showStatusButton: true,
            blocks: [
                {
                    opcode: 'getSensorValue',
                    text: formatMessage({
                        id: 'mesh.sensorValue',
                        default: '[NAME] sensor value',
                        description: 'Any global variables from other projects'
                    }),
                    blockType: BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: ArgumentType.STRING,
                            menu: 'variableNames',
                            defaultValue: ''
                        }
                    }
                }
            ],
            menus: {
                variableNames: {
                    acceptReporters: true,
                    items: 'getVariableNamesMenuItems'
                }
            }
        };
    }

    getSensorValue (args) {
        return this.meshService.getVariable(args.NAME);
    }

    getVariableNamesMenuItems () {
        return [' '].concat(this.meshService.variableNames);
    }

    /**
     * Called by the runtime when user wants to scan for a peripheral.
     */
    scan () {
        if (this.meshService.isHost) {
            this.meshService.disconnect();
            this.meshService = new MeshPeer(this, this.meshId, null);
        }

        this.meshService.scan(MESH_HOST_PERIPHERAL_ID);
    }

    /**
     * Called by the runtime when user wants to connect to a certain peripheral.
     * @param {string} peerId - the Peer ID of the peripheral to connect to.
     */
    connect (peerId) {
        this.setOpcodeFunctionHOC();
        this.setVariableFunctionHOC();

        if (peerId === MESH_HOST_PERIPHERAL_ID) {
            this.meshService.disconnect();

            this.meshService = new MeshHost(this, this.meshId, this.meshService.domain);
            this.meshService.connect();
        } else {
            this.meshService.connect(peerId);
        }
    }

    /**
     * Disconnect from the Mesh.
     */
    disconnect () {
        this.meshService.requestDisconnect();
    }

    /**
     * Return true if connected to the Mesh
     * @returns {boolean} - whether the Mesh is connected.
     */
    isConnected () {
        return this.meshService.isConnected();
    }

    /**
     * Return connected message if connected to the Mesh
     * @returns {string} - connected message.
     */
    connectedMessage () {
        let message;
        if (this.meshService.isHost) {
            message = formatMessage({
                id: 'mesh.registeredHost',
                default: 'Registered Host Mesh [{ MESH_ID }]',
                description: 'label for registered Host Mesh in connect modal for Mesh extension'
            }, {MESH_ID: this.makeMeshIdLabel(this.meshService.meshId)});
        } else {
            message = formatMessage({
                id: 'mesh.joinedMesh',
                default: 'Joined Mesh [{ MESH_ID }]',
                description: 'label for joined Mesh in connect modal for Mesh extension'
            }, {MESH_ID: this.makeMeshIdLabel(this.meshService.hostMeshId)});
        }
        return message;
    }

    makeMeshIdLabel (meshId) {
        const label = meshId.slice(0, 6);
        return [...label].map(c => MESH_ID_LABEL_CHARACTERS[c]).join('');
    }

    setOpcodeFunctionHOC () {
        if (this.opcodeFunctions) {
            return;
        }

        this.opcodeFunctions = {
            event_broadcast: this.runtime.getOpcodeFunction('event_broadcast'),
            event_broadcastandwait: this.runtime.getOpcodeFunction('event_broadcastandwait'),
            data_setvariableto: this.runtime.getOpcodeFunction('data_setvariableto'),
            data_changevariableby: this.runtime.getOpcodeFunction('data_changevariableby')
        };

        this.runtime._primitives.event_broadcast = this.broadcast.bind(this);
        this.runtime._primitives.event_broadcastandwait = this.broadcastAndWait.bind(this);
        this.runtime._primitives.data_setvariableto = this.setVariableTo.bind(this);
        this.runtime._primitives.data_changevariableby = this.changeVariableBy.bind(this);
    }

    broadcast (args, util) {
        try {
            log.log('event_broadcast in mesh');

            this.opcodeFunctions.event_broadcast(args, util);
            this.meshService.sendBroadcastMessage(args.BROADCAST_OPTION.name);
        } catch (error) {
            log.error(`Failed to execute event_broadcast: ${error}`);
        }
    }

    broadcastAndWait (args, util) {
        try {
            log.log('event_broadcastandwait in mesh');

            const first = !util.stackFrame.startedThreads;
            this.opcodeFunctions.event_broadcastandwait(args, util);
            if (first) {
                this.meshService.sendBroadcastMessage(args.BROADCAST_OPTION.name);
            }
        } catch (error) {
            log.error(`Failed to execute event_broadcastandwait: ${error}`);
        }
    }

    setVariableTo (args, util) {
        try {
            log.log('data_setvariableto in mesh');

            this.opcodeFunctions.data_setvariableto(args, util);
            this.sendVariableByOpcodeFunction(args);
        } catch (error) {
            log.error(`Failed to execute data_setvariableto: ${error}`);
        }
    }

    changeVariableBy (args, util) {
        try {
            log.log('data_changevariableby in mesh');

            this.opcodeFunctions.data_changevariableby(args, util);
            this.sendVariableByOpcodeFunction(args);
        } catch (error) {
            log.error(`Failed to execute data_changevariableby: ${error}`);
        }
    }

    sendVariableByOpcodeFunction (args) {
        const stage = this.runtime.getTargetForStage();
        let variable = stage.lookupVariableById(args.VARIABLE.id);
        if (!variable) {
            variable = stage.lookupVariableByNameAndType(args.VARIABLE.name, Variable.SCALAR_TYPE);
        }
        if (!variable) {
            return;
        }

        this.meshService.sendVariableMessage(variable.name, variable.value);
    }

    setVariableFunctionHOC () {
        if (this.variableFunctions) {
            return;
        }

        const stage = this.runtime.getTargetForStage();
        this.variableFunctions = {
            runtime: {
                createNewGlobalVariable: this.runtime.createNewGlobalVariable.bind(this.runtime)
            },
            stage: {
                lookupOrCreateVariable: stage.lookupOrCreateVariable.bind(stage),
                createVariable: stage.createVariable.bind(stage),
                setVariableValue: stage.setVariableValue.bind(stage),
                renameVariable: stage.renameVariable.bind(stage)
            }
        };

        this.runtime.createNewGlobalVariable = this.createNewGlobalVariable.bind(this);

        stage.lookupOrCreateVariable = this.lookupOrCreateVariable.bind(this);
        stage.createVariable = this.createVariable.bind(this);
        stage.setVariableValue = this.setVariableValue.bind(this);
        stage.renameVariable = this.renameVariable.bind(this);
    }

    createNewGlobalVariable (variableName, optVarId, optVarType) {
        log.log('runtime.createNewGlobalVariable in mesh');

        const variable = this.variableFunctions.runtime.createNewGlobalVariable(variableName, optVarId, optVarType);
        if (variable.type === Variable.SCALAR_TYPE) {
            this.meshService.sendVariableMessage(variable.name, variable.value);
        }
        return variable;
    }

    lookupOrCreateVariable (id, name) {
        log.log('stage.lookupOrCreateVariable in mesh');

        const stage = this.runtime.getTargetForStage();
        let variable = stage.lookupVariableById(id);
        if (variable) return variable;

        variable = stage.lookupVariableByNameAndType(name, Variable.SCALAR_TYPE);
        if (variable) return variable;

        // No variable with this name exists - create it locally.
        const newVariable = new Variable(id, name, Variable.SCALAR_TYPE, false);
        stage.variables[id] = newVariable;
        this.meshService.sendVariableMessage(newVariable.name, newVariable.value);
        return newVariable;
    }

    createVariable (id, name, type, isCloud) {
        log.log('stage.createVariable in mesh');

        const stage = this.runtime.getTargetForStage();
        if (!Object.prototype.hasOwnProperty.call(stage.variables, id)) {
            this.variableFunctions.stage.createVariable(id, name, type, isCloud);
            if (type === Variable.SCALAR_TYPE) {
                const variable = stage.variables[id];
                this.meshService.sendVariableMessage(variable.name, variable.value);
            }
        }
    }

    setVariableValue (id, newValue) {
        log.log('stage.setVariableValue in mesh');

        const stage = this.runtime.getTargetForStage();
        if (Object.prototype.hasOwnProperty.call(stage.variables, id)) {
            const variable = stage.variables[id];
            if (variable.id === id) {
                this.variableFunctions.stage.setVariableValue(id, newValue);
                if (variable.type === Variable.SCALAR_TYPE) {
                    this.meshService.sendVariableMessage(variable.name, variable.value);
                }
            }
        }
    }

    renameVariable (id, newName) {
        log.log('stage.renameVariable in mesh');

        const stage = this.runtime.getTargetForStage();
        if (Object.prototype.hasOwnProperty.call(stage.variables, id)) {
            const variable = stage.variables[id];
            if (variable.id === id) {
                this.variableFunctions.stage.renameVariable(id, newName);
                if (variable.type === Variable.SCALAR_TYPE) {
                    this.meshService.sendVariableMessage(variable.name, variable.value);
                }
            }
        }
    }
}

module.exports = Scratch3MeshBlocks;
