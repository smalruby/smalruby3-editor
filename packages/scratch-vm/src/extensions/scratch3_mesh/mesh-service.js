/* global process */
/* istanbul ignore file */
const formatMessage = require('format-message');
const Variable = require('../../engine/variable');
const BlockUtility = require('../../engine/block-utility.js');

const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);

const MESH_DOMAIN_MAKER_URL = 'https://api.smalruby.app/mesh-domain';
const TTL = 15 * 60;

const Peer = require('skyway-js');

class MeshService {
    constructor (blocks, meshId, domain) {
        this.blocks = blocks;

        this.runtime = this.blocks.runtime;

        this.meshId = meshId;

        this.peerId_ = null;

        this.domain = domain;

        this.peer = null;

        this.room = null;

        this.connectionState = 'disconnected';

        this.connectTimeoutId = null;

        this.connectTimeoutSeconds = 10;

        this.variables = {};

        this.variableNames = [];

        this.availablePeripherals = {};
    }

    get logPrefix () {
        return 'Mesh Service';
    }

    get peerId () {
        if (this.peerId_) {
            return this.peerId_;
        }

        this.peerId_ = this.makePeerId(this.isHost ? 'h' : 'p');
        return this.peerId_;
    }

    makePeerId (hostOrPeer) {
        return `${this.meshId}_${hostOrPeer}_${this.ttl()}_${this.domain}`;
    }

    ttl () {
        return Math.floor(new Date().getTime() / 1000) + TTL;
    }

    scan (hostMeshId) {
        try {
            debug(() => `Scan: hostMeshId=<${hostMeshId}>`);

            this.setDomain()
                .then(() => {
                    this.setConnectionState('scanning');

                    this.availablePeripherals = {};
                    this.availablePeripherals[hostMeshId] = {
                        name: formatMessage({
                            id: 'mesh.hostPeripheralName',
                            default: 'Become Mesh Host [{ MESH_ID }]',
                            description: 'label for becoming Host Mesh in connect modal for Mesh extension'
                        }, {MESH_ID: this.blocks.makeMeshIdLabel(this.meshId)}),
                        peripheralId: hostMeshId,
                        rssi: 0
                    };

                    this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_LIST_UPDATE);

                    this.openPeerThenListAllPeers();
                })
                .catch(error => {
                    log.error(`Failed to scan: reason=<${error}>`);
                    this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR);
                });
        } catch (error) {
            log.error(`Failed to scan: reason=<${error}>`);
            this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR);
        }
    }

    setDomain () {
        if (this.domain) {
            return Promise.resolve();
        }

        const urlParams = new URLSearchParams(window.location.search);
        this.domain = (urlParams.get('mesh') || '')
            .replace(/[^a-zA-Z0-9_-]/g, x => x.codePointAt(0).toString(16)).slice(0, 10); /* 最大10文字 */
        if (this.domain) {
            return Promise.resolve();
        }

        return fetch(MESH_DOMAIN_MAKER_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed Mesh Domain Maker: ${response.statusText}(${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                this.domain = data.domain;
                return Promise.resolve();
            });
    }

    connect () {
    }

    isConnected () {
        return this.connectionState === 'connected';
    }

    requestDisconnect () {
        debug(() => 'MeshService.requestDisconnect');

        this.setConnectionState('disconnecting');
        this.disconnect();
    }

    disconnect () {
        debug(() => 'MeshService.disconnect');

        if (this.connectionState === 'disconnected') {
            log.info('Already disconnected.');
            return;
        }

        if (this.connectTimeoutId) {
            clearTimeout(this.connectTimeoutId);
            this.connectTimeoutId = null;
        }

        this.setConnectionState('disconnected');

        this.peer.destroy();
    }

    setConnectionState (connectionState) {
        const prevConnectionState = this.connectionState;

        debug(() => `set connection state: from=<${prevConnectionState}> to=<${connectionState}>`);

        this.connectionState = connectionState;

        switch (this.connectionState) {
        case 'connected':
            clearTimeout(this.connectTimeoutId);
            this.connectTimeoutId = null;
            this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_CONNECTED);
            break;
        case 'disconnected':
            if (prevConnectionState === 'scanning' || prevConnectionState === 'connecting') {
                this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR);
            } else if (prevConnectionState !== 'disconnecting' && prevConnectionState !== 'disconnected') {
                this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_CONNECTION_LOST_ERROR);
            }
            this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_DISCONNECTED);
            break;
        case 'request_error':
            this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR);
            break;
        }
    }

    openPeer () {
        if (this.peer) {
            debug(() => 'service: peer destroy');
            this.peer.destroy();
        }

        let debugLevel = 0;
        if (process.env.DEBUG) {
            debugLevel = 3;
        }
        this.peer = new Peer(this.peerId, {
            key: 'a9023dec-9791-4949-add5-d5306a45ad95',
            debug: debugLevel
        });
        this.peer.on('close', this.onPeerClose.bind(this));
        this.peer.on('error', this.onPeerError.bind(this));
    }

    openPeerThenListAllPeers () {
        if (this.peer) {
            if (this.peer.open) {
                this.peer.listAllPeers(this.updateAvailablePeripherals.bind(this));
            } else {
                log.info('Now listing, please wait to list.');
            }
        } else {
            this.openPeer();
            this.peer.on('open', () => {
                debug(() => `Opened peer: peerId=<${this.peerId}>`);
                this.peer.listAllPeers(this.updateAvailablePeripherals.bind(this));
            });
        }
    }

    updateAvailablePeripherals (peers) {
        const now = Math.floor(new Date().getTime() / 1000);
        peers.forEach(peerId => {
            const [meshId, hostOrPeer, ttl, ...domains] = peerId.split('_');
            const domain = domains.join('_');
            debug(() => `service: peer updateAvailablePeripherals=<${[meshId, hostOrPeer, ttl, domain]}>`);

            if (this.meshId === meshId || hostOrPeer !== 'h' || domain !== this.domain) {
                debug(() => `service: peer skip add availablePeripherals reason=<not host>`);
                return;
            }

            const t = Number(ttl) - now;
            if (t >= 15 * 60) {
                debug(() => `service: peer skip add availablePeripherals reason=<timeout> t=<${t}>`);
                return;
            }

            let rssi;
            if (t >= 4 * 60) {
                rssi = 0;
            } else if (t >= 3 * 60) {
                rssi = -20;
            } else if (t >= 2 * 60) {
                rssi = -40;
            } else if (t >= 1 * 60) {
                rssi = -60;
            } else {
                rssi = -80;
            }
            this.availablePeripherals[meshId] = {
                name: formatMessage({
                    id: 'mesh.clientPeripheralName',
                    default: 'Join Mesh [{ MESH_ID }]',
                    description: 'label for "Join Mesh" in connect modal for Mesh extension'
                }, {MESH_ID: this.blocks.makeMeshIdLabel(meshId)}),
                peripheralId: peerId,
                rssi: rssi
            };
        });

        this.emitPeripheralEvent(this.runtime.constructor.PERIPHERAL_LIST_UPDATE);
    }

    onPeerClose () {
        debug(() => 'Closed peer');

        if (this.room) {
            this.room.close();
        }

        if (this.connectionState !== 'disconnected') {
            this.disconnect();
        }

        this.peer = null;
    }

    onPeerError (error) {
        debug(() => `Occured error: ${JSON.stringify(error)}`);

        log.error(`Error: type=<${error.type}> message=<${error.message}>`);

        if (this.connectionState === 'disconnected') {
            return;
        }

        this.disconnect();
    }

    onConnectTimeout () {
        this.connectTimeoutId = null;
        if (!this.isConnected()) {
            this.peer.destroy();
        }
    }

    getGlobalVariables () {
        const variables = {};
        const stage = this.runtime.getTargetForStage();
        for (const varId in stage.variables) {
            const currVar = stage.variables[varId];
            if (currVar.type === Variable.SCALAR_TYPE) {
                variables[currVar.name] = {
                    name: currVar.name,
                    value: currVar.value,
                    owner: this.meshId
                };
            }
        }
        return variables;
    }

    onRoomOpen () {
        debug(() => `Opened room: ${this.room.name}`);
        this.setConnectionState('connected');
    }

    onRoomPeerJoin (peerId) {
        debug(() => `Joined peer to our room: name=<${this.room.name}> peerId=<${peerId}>`);

        this.sendVariables(this.getGlobalVariables());
    }

    onRoomPeerLeave (peerId) {
        debug(() => `Leaved peer from our room: room=<${this.room.name}> peerId=<${peerId}>`);
    }

    onRoomLog (logs) {
        debug(() => `Received logs: num logs=<${logs.length}>`);
        for (const logStr of logs) {
            log.info(logStr);
        }
    }

    onRoomData ({src, data}) {
        debug(() => `Received Room data: src=<${src}> data=<${data}>`);
        try {
            const message = JSON.parse(data);

            const actionMethodName = `${message.type}Action`;
            if (this[actionMethodName]) {
                debug(() => `Process Room data: src=${src} ` +
                      `owner=${message.owner} type=${message.type} data=<${JSON.stringify(message.data)}>`);

                this[actionMethodName](message.owner, message.data);
            } else {
                log.error(`Unknown Room data type: type=<${message.type}> src=<${src}>`);
            }
        } catch (error) {
            log.error(`Failed to process Room data: ${error}`);
            return;
        }
    }

    onRoomClose () {
        debug(() => `Closed room: name=<${this.room.name}>`);

        this.room = null;
    }

    emitPeripheralEvent (event) {
        debug(() => `Emit Peripheral event: event=<${event}>`);

        if (event === this.runtime.constructor.PERIPHERAL_LIST_UPDATE) {
            return new Promise(() => this.runtime.emit(event, this.availablePeripherals));
        }
        return new Promise(() => this.runtime.emit(event, {
            extensionId: this.blocks.constructor.EXTENSION_ID
        }));
    }

    setVariable (name, value, owner) {
        if (this.variables[name]) {
            log.info(`Update variable: name=<${name}> value=<${value}> from=<${this.getVariable(name)}> ` +
                     `owner=<${owner}>`);
        } else {
            log.info(`Create variable: name=<${name}> value=<${value}> ` +
                     `owner=<${owner}>`);
        }

        if (!this.variableNames.includes(name)) {
            this.variableNames.push(name);
        }

        this.variables[name] = {
            name: name,
            value: value,
            owner: owner
        };
    }

    getVariable (name) {
        const variable = this.variables[name];
        if (!variable) {
            return '';
        }
        return variable.value;
    }

    sendMessage (message) {
        debug(() => `Send message to room: ` +
              `name=<${this.room.name}> message=<${JSON.stringify(message)}>`);
        try {
            this.room.send(JSON.stringify(message));
        } catch (error) {
            log.error(`Failed to send message: error=<${error}> message=<${JSON.stringify(message)}>`);
        }
    }

    sendBroadcastMessage (name) {
        this.sendMessage({
            owner: this.meshId,
            type: 'broadcast',
            data: {
                name: name
            }
        });
    }

    sendVariableMessage (name, value) {
        this.sendMessage({
            owner: this.meshId,
            type: 'variable',
            data: {
                name: name,
                value: value
            }
        });
    }

    sendVariables (variables) {
        if (!this.room) {
            log.error('Failed to send variables: reason=<not join room>');
            return;
        }

        const message = {
            owner: this.meshId,
            type: 'variables',
            data: variables
        };

        debug(() => `Send Room message: ` +
              `message=<${JSON.stringify(message)}>`);

        this.room.send(JSON.stringify(message));
    }

    variableAction (owner, data) {
        const variable = data;

        debug(() => `Process variable: owner=<${owner}> variable=<${JSON.stringify(variable)}>`);

        this.setVariable(variable.name, variable.value, owner);
    }

    variablesAction (owner, data) {
        const variables = data;

        debug(() => `Process variables: owner=<${owner}> variables=<${JSON.stringify(variables)}>`);

        Object.keys(variables).forEach(name => {
            const variable = variables[name];
            this.setVariable(variable.name, variable.value, variable.owner);
        });
    }

    broadcastAction (owner, data) {
        const broadcast = data;

        debug(() => `Process broadcast: owner=<${owner}> broadcast=<${JSON.stringify(broadcast)}>`);

        const args = {
            BROADCAST_OPTION: {
                id: null,
                name: broadcast.name
            }
        };
        const util = BlockUtility.lastInstance();
        if (!util.sequencer) {
            util.sequencer = this.runtime.sequencer;
        }
        this.blocks.opcodeFunctions.event_broadcast(args, util);
    }
}

module.exports = MeshService;
