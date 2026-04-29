/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { RENEW_HEARTBEAT, SEND_MEMBER_HEARTBEAT } = require('./gql-operations');

/**
 * Heartbeat manager. Host は renewHeartbeat、Member は sendMemberHeartbeat を
 * 一定間隔で送信し、グループ/ノードの TTL を延長する。サーバーが新しい間隔を
 * 返した場合はそれに追従する。
 *
 * Connection timer は heartbeat の `expiresAt` を見て、グループが
 * 失効する直前に leaveGroup を呼んで自動切断する。
 *
 * Mixed into MeshV2Service.prototype.
 */
const HeartbeatManagerMixin = {
    startHeartbeat() {
        this.stopHeartbeat();
        if (!this.groupId) return;

        debug(
            () =>
                `Mesh V2: Starting heartbeat timer (Role: ${this.isHost ? 'Host' : 'Member'}, ` +
                `Interval: ${this.isHost ? this.hostHeartbeatInterval : this.memberHeartbeatInterval}s)`,
        );
        const interval = (this.isHost ? this.hostHeartbeatInterval : this.memberHeartbeatInterval) * 1000;

        this.heartbeatTimer = setInterval(() => {
            if (this.isHost) {
                this.renewHeartbeat();
            } else {
                this.sendMemberHeartbeat();
            }
        }, interval);
    },

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            debug(() => 'Mesh V2: Stopping heartbeat timer');
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    },

    async renewHeartbeat() {
        if (!this.groupId || !this.client || !this.isHost) return;

        try {
            this.costTracking.mutationCount++;
            this.costTracking.heartbeatCount++;
            const result = await this.client.mutate({
                mutation: RENEW_HEARTBEAT,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                    hostId: this.meshId,
                },
            });

            this.expiresAt = result.data.renewHeartbeat.expiresAt;
            debug(() => `Mesh V2: Heartbeat renewed. Expires at: ${this.expiresAt}`);

            if (result.data.renewHeartbeat.heartbeatIntervalSeconds) {
                const newInterval = result.data.renewHeartbeat.heartbeatIntervalSeconds;
                if (newInterval !== this.hostHeartbeatInterval) {
                    this.hostHeartbeatInterval = newInterval;
                    this.startHeartbeat(); // Restart with new interval
                }
            }
            this.startConnectionTimer();
            return result.data.renewHeartbeat;
        } catch (error) {
            log.error(`Mesh V2: Heartbeat renewal failed: ${error}`);
            const reason = this.shouldDisconnectOnError(error);
            if (reason) {
                this.cleanupAndDisconnect(reason);
            }
        }
    },

    async sendMemberHeartbeat() {
        if (!this.groupId || !this.client || this.isHost) return;

        try {
            this.costTracking.mutationCount++;
            this.costTracking.heartbeatCount++;
            const result = await this.client.mutate({
                mutation: SEND_MEMBER_HEARTBEAT,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                    nodeId: this.meshId,
                },
            });

            debug(() => 'Mesh V2: Member heartbeat sent');
            if (result.data.sendMemberHeartbeat.expiresAt) {
                this.expiresAt = result.data.sendMemberHeartbeat.expiresAt;
            }

            return result.data.sendMemberHeartbeat;
        } catch (error) {
            log.error(`Mesh V2: Member heartbeat failed: ${error}`);
            const reason = this.shouldDisconnectOnError(error);
            if (reason) {
                this.cleanupAndDisconnect(reason);
            }
        }
    },

    startConnectionTimer() {
        this.stopConnectionTimer();
        if (!this.expiresAt) return;

        const timeout = new Date(this.expiresAt).getTime() - Date.now();
        if (timeout <= 0) {
            log.warn('Mesh V2: Group is already expired');
            this.leaveGroup();
            return;
        }

        const timeoutMinutes = Math.round(timeout / 60000);
        this.connectionTimer = setTimeout(() => {
            log.warn(`Mesh V2: Connection timeout (${timeoutMinutes} minutes)`);
            this.leaveGroup();
        }, timeout);
    },

    stopConnectionTimer() {
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
    },
};

module.exports = { HeartbeatManagerMixin };
