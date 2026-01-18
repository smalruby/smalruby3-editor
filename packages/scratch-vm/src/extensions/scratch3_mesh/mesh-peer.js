/* istanbul ignore file */
const MeshService = require('./mesh-service');

const log = require('../../util/log');

class MeshPeer extends MeshService {
    get logPrefix () {
        return 'Mesh Peer';
    }

    connect (hostPeerId) {
        if (this.connectionState === 'connected') {
            log.info('Already connected');
            return;
        }
        if (this.connectionState === 'connecting') {
            log.info('Now connecting, please wait to connect.');
            return;
        }

        this.peer.fetchPeerExists(hostPeerId).then(isExist => {
            if (!isExist) {
                this.setConnectionState('request_error');

                log.error(`Not exists host: ${hostPeerId}`);
                return;
            }

            const [hostMeshId, hostOrPeer, ttl, ...domains] = hostPeerId.split('_');
            const domain = domains.join('_');

            const now = Math.floor(new Date().getTime() / 1000);
            if (!hostMeshId || hostMeshId.trim() === '' || hostOrPeer !== 'h' ||
                Number(ttl) - now < 0 || domain !== this.domain) {
                this.setConnectionState('request_error');

                log.error('Not select Host Mesh ID');
                return;
            }

            this.hostMeshId = hostMeshId;
            this.hostPeerId = hostPeerId;

            this.setConnectionState('connecting');

            this.room = this.peer.joinRoom(this.hostPeerId);
            this.room.on('open', this.onRoomOpen.bind(this));
            this.room.on('peerJoin', this.onRoomPeerJoin.bind(this));
            this.room.on('peerLeave', this.onRoomPeerLeave.bind(this));
            this.room.once('log', this.onRoomLog.bind(this));
            this.room.on('data', this.onRoomData.bind(this));
            this.room.on('close', this.onRoomClose.bind(this));

            this.connectTimeoutId =
                setTimeout(this.onConnectTimeout.bind(this), this.connectTimeoutSeconds * 1000);
        });
    }

    onRoomOpen () {
        MeshService.prototype.onRoomOpen.call(this);

        log.info('Connected as Mesh Peer.');

        this.sendVariables(this.getGlobalVariables());
    }

    onRoomPeerLeave (peerId) {
        MeshService.prototype.onRoomPeerLeave.call(this, peerId);

        if (peerId !== this.room.name) {
            return;
        }

        this.disconnect();
    }
}

module.exports = MeshPeer;
