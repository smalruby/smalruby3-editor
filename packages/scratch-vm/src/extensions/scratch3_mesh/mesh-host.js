/* global process */
/* istanbul ignore file */
const MeshService = require('./mesh-service');

const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);

class MeshHost extends MeshService {
    constructor (blocks, meshId, domain) {
        super(blocks, meshId, domain);

        this.isHost = true;
    }

    get logPrefix () {
        return 'Mesh Host';
    }

    connect () {
        if (this.connectionState === 'connected') {
            log.info('Already connected');
            return;
        }
        if (this.connectionState === 'connecting') {
            log.info('Now connecting, please wait to connect.');
            return;
        }

        this.setConnectionState('connecting');

        this.openPeer();
        this.peer.on('open', () => {
            debug(() => `Opened peer: peerId=<${this.peerId}>`);

            this.room = this.peer.joinRoom(this.peerId);
            this.room.on('open', this.onRoomOpen.bind(this));
            this.room.on('peerJoin', this.onRoomPeerJoin.bind(this));
            this.room.on('peerLeave', this.onRoomPeerLeave.bind(this));
            this.room.once('log', this.onRoomLog.bind(this));
            this.room.on('data', this.onRoomData.bind(this));
            this.room.on('close', this.onRoomClose.bind(this));
        });

        this.connectTimeoutId =
            setTimeout(this.onConnectTimeout.bind(this), this.connectTimeoutSeconds * 1000);
    }

    onRoomOpen () {
        MeshService.prototype.onRoomOpen.call(this);

        log.info('Connected as Mesh Host.');
    }
}

module.exports = MeshHost;
