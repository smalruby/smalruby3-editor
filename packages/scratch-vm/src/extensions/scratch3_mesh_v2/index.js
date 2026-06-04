/* global process */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const {v4: uuidv4} = require('uuid');
const Variable = require('../../engine/variable');
const {getDomain, saveDomainToLocalStorage} = require('./utils');
const {hiraganaToHex} = require('./name-search-utils');
const {createClient} = require('./mesh-client');
const MeshV2Service = require('./mesh-service');

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
/* istanbul ignore next */  
const blockIconURI = 'data:image/png;base64,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';

const MESH_V2_HOST_ID = 'meshV2_host';

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

class Scratch3MeshV2Blocks {
    /**
     * @returns {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return 'Mesh V2';
    }

    static get EXTENSION_ID () {
        return 'meshV2';
    }

    /* istanbul ignore next */
    constructor (runtime) {
        debug(() => 'Loading NEW Mesh V2 extension (GraphQL)');
        this.runtime = runtime;
        try {
            this.domain = getDomain();
        } catch (e) {
            log.warn(`Mesh V2: Failed to get domain from URL/localStorage: ${e}`);
            this.domain = null;
        }
        this.nodeId = uuidv4().replaceAll('-', '');
        this.connectionState = 'disconnected';
        this.isExplicitDisconnect = false;

        try {
            createClient();
            this.meshService = new MeshV2Service(this, this.nodeId, this.domain);
            this.meshService.setDisconnectCallback(reason => {
                // Check if error is caused by network filter (HTTP 503 from proxy like i-Filter)
                const errorType = this.meshService &&
                    this.meshService.lastError &&
                    this.meshService.isNetworkFilterError(this.meshService.lastError) ?
                    'networkFilter' :
                    null;

                if (reason === 'GroupNotFound' || reason === 'expired') {
                    // Pass errorType to setConnectionState for network filter error handling
                    this.setConnectionState('error', errorType);
                } else {
                    this.setConnectionState('disconnected');
                }
            });
            log.info(`Mesh V2: Initialized with domain ${this.domain || 'null (auto)'} and nodeId ${this.nodeId}`);

            if (this.runtime.extensionManager && this.runtime.extensionManager.isExtensionLoaded('mesh')) {
                log.warn('Mesh V2: WARNING - Old Mesh extension (SkyWay) is also loaded. ' +
                    'This may cause conflicts and unwanted network traffic.');
            }
        } catch (error) {
            log.error(`Failed to initialize Mesh V2: ${error}`);
        }

        this.runtime.registerPeripheralExtension(Scratch3MeshV2Blocks.EXTENSION_ID, this);
    }

    /**
     * Set the domain for the mesh service.
     * @param {string} domain - The new domain.
     * @returns {string|null} - Error message if failed, null if success.
     */
    setDomain (domain) {
        if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
            return formatMessage({
                id: 'mesh.domainConnectedAlert',
                default: 'Mesh V2 is connected. To change the domain, please disconnect first.',
                description: 'Alert message when trying to change domain while connected'
            });
        }
        this.domain = domain;
        saveDomainToLocalStorage(domain);
        if (this.meshService) {
            this.meshService.domain = domain;
        }
        debug(() => `Mesh V2: Domain set to ${domain || 'null (auto)'}`);
        return null;
    }

    makeMeshIdLabel (meshId) {
        if (!meshId) return '';
        const label = meshId.slice(0, 6);
        return [...label].map(c => MESH_ID_LABEL_CHARACTERS[c]).join('');
    }

    /**
     * Calculate RSSI based on time remaining until expiresAt
     * @param {object} group - Group object containing createdAt and expiresAt
     * @returns {number} RSSI value in range -100 to 0 (higher = stronger signal)
     */
    calculateRssi (group) {
        if (!group || !group.expiresAt || !group.createdAt) return 0;
        const now = Date.now();
        const expiresAtMs = new Date(group.expiresAt).getTime();
        const createdAtMs = new Date(group.createdAt).getTime();
        const timeRemaining = expiresAtMs - now;
        const maxConnectionTimeMs = expiresAtMs - createdAtMs;

        // Calculate percentage: more time remaining = higher percentage
        // Range: 0-100
        const percentage = Math.max(0, Math.min(100, (timeRemaining / maxConnectionTimeMs) * 100));

        // Convert to signal strength range (-100 to 0)
        // Higher percentage = stronger signal (closer to 0)
        return Math.round(percentage - 100);
    }

    /* istanbul ignore next */
    getInfo () {
        return {
            id: Scratch3MeshV2Blocks.EXTENSION_ID,
            name: formatMessage({
                id: 'meshV2.categoryName',
                default: 'Mesh',
                description: 'Label for the meshV2 extension category'
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

    /* istanbul ignore next */
    getSensorValue (args) {
        if (!this.meshService) return '';
        return this.meshService.getRemoteVariable(args.NAME) || '';
    }

    /* istanbul ignore next */
    getVariableNamesMenuItems () {
        if (!this.meshService) return [' '];
        // Include this project's own global variables so the dropdown is useful
        // immediately (e.g. the preset variable) before any network round-trip,
        // in addition to names received from other nodes.
        const ownNames = this.meshService.getGlobalVariables().map(v => v.key);
        const remoteNames = Object.values(this.meshService.remoteData)
            .reduce((acc, nodeData) => acc.concat(Object.keys(nodeData)), []);
        return [' '].concat([...new Set([...ownNames, ...remoteNames])]);
    }

    /* istanbul ignore next */
    scan () {
        if (!this.meshService) return;
        this.meshService.listGroups().then(groups => {
            this.discoveredGroups = groups;
            debug(() => `Mesh V2: Listed ${groups.length} groups`);

            // Filter out expired groups
            const now = Date.now();
            const validGroups = groups.filter(group => {
                if (!group.expiresAt) return true; // Keep groups with no expiry (should not happen)
                const expiresAtMs = new Date(group.expiresAt).getTime();
                const isValid = expiresAtMs > now;
                if (!isValid) {
                    log.warn('Mesh V2: Filtering out expired group:', {
                        id: group.id,
                        name: group.name,
                        expiresAt: group.expiresAt,
                        now: new Date(now).toISOString()
                    });
                }
                return isValid;
            });

            const peripherals = validGroups.map(group => ({
                peripheralId: group.id,
                name: `【${this.makeMeshIdLabel(group.name)}】`,
                rssi: this.calculateRssi(group),
                domain: group.domain
            }));

            this.runtime.emit(this.runtime.constructor.PERIPHERAL_LIST_UPDATE, peripherals);
        })
            /* istanbul ignore next */
            .catch(err => {
                log.error(`Mesh V2: Scan failed: ${err}`);
                // Check if error is caused by network filter (HTTP 503)
                debug(() => `Mesh V2: Checking lastError: ${this.meshService?.lastError}`);
                const errorType = this.meshService &&
                    this.meshService.lastError &&
                    this.meshService.isNetworkFilterError(this.meshService.lastError) ?
                    'networkFilter' :
                    null;
                debug(() => `Mesh V2: Setting error state with errorType: ${errorType}`);
                // Set error state to trigger error UI
                this.setConnectionState('error', errorType);
            });
    }

    /**
     * Search groups by hiragana name prefix across all domains.
     * @param {string} hiraganaStr - Hiragana string (6 chars).
     * @returns {Promise} Resolves when search results are emitted.
     */
    /* istanbul ignore next */
    searchByName (hiraganaStr) {
        if (!this.meshService) return Promise.reject(new Error('No mesh service'));

        const hexPrefix = hiraganaToHex(hiraganaStr);
        if (!hexPrefix) return Promise.reject(new Error('Invalid hiragana input'));

        return this.meshService.searchGroupsByNamePrefix(hexPrefix).then(groups => {
            debug(() => `Mesh V2: Name search found ${groups.length} groups for prefix ${hexPrefix}`);

            // Merge into discoveredGroups (avoid duplicates)
            const existingIds = new Set((this.discoveredGroups || []).map(g => g.id));
            groups.forEach(group => {
                if (!existingIds.has(group.id)) {
                    this.discoveredGroups = (this.discoveredGroups || []).concat([group]);
                }
            });

            // Filter expired and emit
            const now = Date.now();
            const validGroups = groups.filter(group => {
                if (!group.expiresAt) return true;
                return new Date(group.expiresAt).getTime() > now;
            });

            const peripherals = validGroups.map(group => ({
                peripheralId: group.id,
                name: `【${this.makeMeshIdLabel(group.name)}】`,
                rssi: this.calculateRssi(group),
                domain: group.domain
            }));

            return peripherals;
        });
    }

    /* istanbul ignore next */
    connect (id) {
        this.setOpcodeFunctionHOC();
        this.setVariableFunctionHOC();

        if (!this.meshService) return;

        this.setConnectionState('connecting');

        if (id === MESH_V2_HOST_ID) {
            this.meshService.createGroup(this.nodeId).then(() => {
                this.setConnectionState('connected');
            })
                /* istanbul ignore next */
                .catch(err => {
                    log.error(`Mesh V2: Connect (host) failed: ${err}`);
                    this.setConnectionState('error');
                });
        } else {
            const group = this.discoveredGroups && this.discoveredGroups.find(g => g.id === id);

            // Validate expiration before joining
            if (group && group.expiresAt) {
                const expiresAtMs = new Date(group.expiresAt).getTime();
                if (expiresAtMs <= Date.now()) {
                    log.error('Mesh V2: Cannot join expired group');
                    this.setConnectionState('error');
                    return;
                }
            }

            const domain = group ? group.domain : null;
            const groupName = group ? group.name : id;
            this.meshService.joinGroup(id, domain, groupName).then(() => {
                this.setConnectionState('connected');
            })
                /* istanbul ignore next */
                .catch(err => {
                    log.error(`Mesh V2: Connect (peer) failed: ${err}`);
                    this.setConnectionState('error');
                });
        }
    }

    /**
     * Set the connection state and emit appropriate events.
     * @param {string} state - The new connection state ('disconnected', 'scanning', 'connecting', 'connected', 'error')
     * @param {string|null} errorType - Optional error type ('networkFilter' when blocked by proxy like i-Filter)
     */
    setConnectionState (state, errorType = null) {
        const prevState = this.connectionState;
        const errorInfo = errorType ? ` (errorType: ${errorType})` : '';
        log.info(`Mesh V2: Connection state transition: ${prevState} -> ${state}${errorInfo}`);
        this.connectionState = state;

        if (state !== 'disconnected') {
            this.isExplicitDisconnect = false;
        }

        switch (state) {
        case 'connected':
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTED);
            break;
        case 'error':
            // Emit error event with errorType for GUI to handle network filter errors
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                extensionId: Scratch3MeshV2Blocks.EXTENSION_ID,
                errorType: errorType // 'networkFilter' when blocked by proxy (e.g., i-Filter)
            });
            if (prevState === 'connected' && !this.isExplicitDisconnect) {
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTION_LOST_ERROR, {
                    extensionId: Scratch3MeshV2Blocks.EXTENSION_ID
                });
            }
            // Always emit disconnected to ensure GUI (Blocks.jsx) refreshes its status icon
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED, {
                extensionId: Scratch3MeshV2Blocks.EXTENSION_ID
            });
            break;
        case 'disconnected':
            // Emit error event if we were connecting
            if (prevState === 'connecting') {
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                    extensionId: Scratch3MeshV2Blocks.EXTENSION_ID
                });
            }
            if (prevState === 'connected' && !this.isExplicitDisconnect) {
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTION_LOST_ERROR, {
                    extensionId: Scratch3MeshV2Blocks.EXTENSION_ID
                });
            }
            // Always emit disconnected event
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED, {
                extensionId: Scratch3MeshV2Blocks.EXTENSION_ID
            });
            break;
        }
    }

    /* istanbul ignore next */
    disconnect () {
        if (this.meshService) {
            this.isExplicitDisconnect = true;
            this.setConnectionState('disconnected');
            this.meshService.leaveGroup();
        }
    }

    /* istanbul ignore next */
    isConnected () {
        return !!(this.meshService && this.meshService.groupId);
    }

    formatExpiresAt (expiresAt) {
        if (!expiresAt) return '';
        const date = new Date(expiresAt);
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    /* istanbul ignore next */
    connectedMessage () {
        if (this.meshService && this.meshService.groupId) {
            const meshIdLabel = this.makeMeshIdLabel(this.meshService.groupName);

            if (this.meshService.isHost) {
                return formatMessage({
                    id: 'mesh.registeredHost',
                    default: 'Registered Host Mesh [{ MESH_ID }]',
                    description: 'label for registered Host Mesh in connect modal for Mesh extension'
                }, {
                    MESH_ID: meshIdLabel
                });
            }
            return formatMessage({
                id: 'mesh.joinedMesh',
                default: 'Joined Mesh [{ MESH_ID }]',
                description: 'label for joined Mesh in connect modal for Mesh extension'
            }, {MESH_ID: meshIdLabel});
        }
        return formatMessage({
            id: 'mesh.notConnected',
            default: 'Not connected',
            description: 'label for not connected in connect modal for Mesh extension'
        });
    }

    /* istanbul ignore next */
    menuMessage () {
        const domainDisplay = this.domain || formatMessage({
            id: 'mesh.domainNotSet',
            default: 'Not set',
            description: 'label for domain not set in mesh menu'
        });

        if (this.meshService && this.meshService.groupId) {
            const meshIdLabel = this.makeMeshIdLabel(this.meshService.groupName);
            const expiresAt = this.formatExpiresAt(this.meshService.expiresAt);

            return {
                domain: domainDisplay,
                group: `✔【${meshIdLabel}】`,
                expiresAt: `⏳ ${expiresAt}`
            };
        }

        return {
            domain: domainDisplay,
            group: formatMessage({
                id: 'mesh.notJoined',
                default: '!Not joined',
                description: 'label for not joined group in mesh menu'
            }),
            expiresAt: null
        };
    }

    // HOC logic
    /* istanbul ignore next */
    setOpcodeFunctionHOC () {
        if (this.opcodeFunctions) return;

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

    /* istanbul ignore next */
    broadcast (args, util) {
        this.opcodeFunctions.event_broadcast(args, util);
        if (this.meshService) {
            this.meshService.fireEvent(args.BROADCAST_OPTION.name);
        }
    }

    /* istanbul ignore next */
    broadcastAndWait (args, util) {
        const first = !util.stackFrame.startedThreads;
        this.opcodeFunctions.event_broadcastandwait(args, util);
        if (first && this.meshService) {
            this.meshService.fireEvent(args.BROADCAST_OPTION.name);
        }
    }

    /* istanbul ignore next */
    setVariableTo (args, util) {
        this.opcodeFunctions.data_setvariableto(args, util);
        this.syncVariable(args);
    }

    /* istanbul ignore next */
    changeVariableBy (args, util) {
        this.opcodeFunctions.data_changevariableby(args, util);
        this.syncVariable(args);
    }

    /* istanbul ignore next */
    syncVariable (args) {
        if (!this.meshService) return;
        const stage = this.runtime.getTargetForStage();
        let variable = stage.lookupVariableById(args.VARIABLE.id);
        if (!variable) {
            variable = stage.lookupVariableByNameAndType(args.VARIABLE.name, Variable.SCALAR_TYPE);
        }
        if (variable && variable.type === Variable.SCALAR_TYPE) {
            // Send as array of SensorDataInput
            this.meshService.sendData([{key: variable.name, value: String(variable.value)}]);
        }
    }

    /* istanbul ignore next */
    setVariableFunctionHOC () {
        if (this.variableFunctions) return;

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

    /* istanbul ignore next */
    createNewGlobalVariable (variableName, optVarId, optVarType) {
        const variable = this.variableFunctions.runtime.createNewGlobalVariable(variableName, optVarId, optVarType);
        if (this.meshService && variable.type === Variable.SCALAR_TYPE) {
            this.meshService.sendData([{key: variable.name, value: String(variable.value)}]);
        }
        return variable;
    }

    /* istanbul ignore next */
    lookupOrCreateVariable (id, name) {
        const stage = this.runtime.getTargetForStage();
        let variable = stage.lookupVariableById(id);
        if (variable) return variable;

        variable = stage.lookupVariableByNameAndType(name, Variable.SCALAR_TYPE);
        if (variable) return variable;

        const newVariable = new Variable(id, name, Variable.SCALAR_TYPE, false);
        stage.variables[id] = newVariable;
        if (this.meshService) {
            this.meshService.sendData([{key: newVariable.name, value: String(newVariable.value)}]);
        }
        return newVariable;
    }

    /* istanbul ignore next */
    createVariable (id, name, type, isCloud) {
        const stage = this.runtime.getTargetForStage();
        if (!Object.prototype.hasOwnProperty.call(stage.variables, id)) {
            this.variableFunctions.stage.createVariable(id, name, type, isCloud);
            if (this.meshService && type === Variable.SCALAR_TYPE) {
                const variable = stage.variables[id];
                this.meshService.sendData([{key: variable.name, value: String(variable.value)}]);
            }
        }
    }

    /* istanbul ignore next */
    setVariableValue (id, newValue) {
        const stage = this.runtime.getTargetForStage();
        if (Object.prototype.hasOwnProperty.call(stage.variables, id)) {
            const variable = stage.variables[id];
            this.variableFunctions.stage.setVariableValue(id, newValue);
            if (this.meshService && variable.type === Variable.SCALAR_TYPE) {
                this.meshService.sendData([{key: variable.name, value: String(newValue)}]);
            }
        }
    }

    /* istanbul ignore next */
    renameVariable (id, newName) {
        const stage = this.runtime.getTargetForStage();
        if (Object.prototype.hasOwnProperty.call(stage.variables, id)) {
            const variable = stage.variables[id];
            this.variableFunctions.stage.renameVariable(id, newName);
            if (this.meshService && variable.type === Variable.SCALAR_TYPE) {
                this.meshService.sendData([{key: newName, value: String(variable.value)}]);
            }
        }
    }
}

module.exports = Scratch3MeshV2Blocks;
