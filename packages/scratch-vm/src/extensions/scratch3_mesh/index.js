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
 
const blockIconURI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAxXpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjabVDBDcMgDPwzRUcAnwEzDmlSqRt0/BrsREmUQxy2zzrAYft9P+E1QIkD5yqllRIV3LhR10CioU9OkSdPZJc0v9TDIZCWoCcsleL9ez0dBnZ0jfLJSN4uLFehsfvLzcgvwngRabC6UXMjkAnJDbp9K5Ym9fyFZYtXiO0wSJp9HeTaLeeq01uz3gOiDQlRGRDrwdgloM9gcNbGsToYVTmh+Et0IE9z2hH+8SZZMqAKKK4AAAGFaUNDUElDQyBwcm9maWxlAAB4nH2Rv0vDQBzFX9NKRSod7CDikKGKg11URLdahSJUCLVCqw4ml/6CJg1Jiouj4Fpw8Mdi1cHFWVcHV0EQ/AHiHyBOii5S4vfSQosYD4778O7e4+4dIDQqTLMCcUDTbTOdTIjZ3KoYfIWAAMIYw6zMLGNOklLwHF/38PH1LsazvM/9OfrVvMUAn0gcZ4ZpE28QT2/aBud94ggrySrxOfG4SRckfuS60uI3zkWXBZ4ZMTPpeeIIsVjsYqWLWcnUiKeIo6qmU76QbbHKeYuzVqmx9j35C0N5fWWZ6zSHkcQiliBBhIIayqjARoxWnRQLadpPePiHXL9ELoVcZTByLKAKDbLrB/+D391ahcmJVlIoAfS8OM7HCBDcBZp1x/k+dpzmCeB/Bq70jr/aAGY+Sa93tOgREN4GLq47mrIHXO4Ag0+GbMqu5KcpFArA+xl9Uw4YuAX61lq9tfdx+gBkqKvUDXBwCIwWKXvd49293b39e6bd3w/JC3LJP8T2PgAADXppVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDQuNC4wLUV4aXYyIj4KIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgIHhtbG5zOkdJTVA9Imh0dHA6Ly93d3cuZ2ltcC5vcmcveG1wLyIKICAgIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICB4bXBNTTpEb2N1bWVudElEPSJnaW1wOmRvY2lkOmdpbXA6NDE5MDI4YjgtZTBjZC00NWM1LWE1MzUtZjQ0M2NkMDE5NDdmIgogICB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmJjYjRjZDMxLWY3NTUtNGJhYS1hYzA2LTY5YmJlMmU5MWMwZCIKICAgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjQyMTE5YTc1LTY1ZWEtNGQ2MC05N2IzLTNhMTJjMjg1ZWRkNSIKICAgZGM6Rm9ybWF0PSJpbWFnZS9wbmciCiAgIEdJTVA6QVBJPSIyLjAiCiAgIEdJTVA6UGxhdGZvcm09Ik1hYyBPUyIKICAgR0lNUDpUaW1lU3RhbXA9IjE3NzAyMjAwMzY0MjA5NTgiCiAgIEdJTVA6VmVyc2lvbj0iMi4xMC4zOCIKICAgdGlmZjpPcmllbnRhdGlvbj0iMSIKICAgeG1wOkNyZWF0b3JUb29sPSJHSU1QIDIuMTAiCiAgIHhtcDpNZXRhZGF0YURhdGU9IjIwMjY6MDI6MDVUMDA6NDc6MTYrMDk6MDAiCiAgIHhtcDpNb2RpZnlEYXRlPSIyMDI2OjAyOjA1VDAwOjQ3OjE2KzA5OjAwIj4KICAgPHhtcE1NOkhpc3Rvcnk+CiAgICA8cmRmOlNlcT4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiCiAgICAgIHN0RXZ0OmNoYW5nZWQ9Ii8iCiAgICAgIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ZGI1NmEwYWEtYmY3ZC00MWZlLWEzN2UtZDU1YmJkOWMzMDVjIgogICAgICBzdEV2dDpzb2Z0d2FyZUFnZW50PSJHaW1wIDIuMTAgKE1hYyBPUykiCiAgICAgIHN0RXZ0OndoZW49IjIwMjYtMDItMDVUMDA6NDc6MTYrMDk6MDAiLz4KICAgIDwvcmRmOlNlcT4KICAgPC94bXBNTTpIaXN0b3J5PgogIDwvcmRmOkRlc2NyaXB0aW9uPgogPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgIAo8P3hwYWNrZXQgZW5kPSJ3Ij8+1BlgBgAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEgAACxIB0t1+/AAAAAd0SU1FB+oCBA8vEIpeOUcAAA/dSURBVHja7Vx7cFNXev+de+7V1cuWbWHjtwFTDAYCTVggDIlfBBIShyHTxKSbDduhmaTJpulmWtJ2p2067aTJbtvpNp0lm3bTnU2aIRAnG8JAsmUsIBACYdmAE/MwG2yCbb2MHlfSlXQfp3/E9lq2ZMnGApH6m9F4dH3Pud/53fM9z/cJmKEZupFErsdDmpqa7LIs5yuKwrL9LI7jiNlsjlNKnR0dHVq2n8dn+wGNjY0mQsh/VFZW3mm1WrO+IFVVicvl8imK8h0Ap296AMPhsKG0tHTBQw89VF5RUYF4PA5d11OLBJmaUBBCQCmFpml46623Sk6fPl18PaQr6wAqigKDwaAXFhYiFArhvffeQzgcTiV+sNvtMJlMYGzy0l5fX4+FCxfCarXquq6zbwSAo8nr9eLcuXPQtNSSPDg4iOLi4knvRF3XUVRUhLq6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';

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
 * @param {Runtime} runtime - the runtime instantiating this block package.
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
         * @type {Runtime}
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
            name: formatMessage({
                id: 'mesh.categoryName',
                default: 'Old Mesh',
                description: 'Label for the mesh extension category'
            }),
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
