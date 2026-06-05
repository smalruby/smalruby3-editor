/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const Variable = require('../../engine/variable');
const { REPORT_DATA } = require('./gql-operations');

/**
 * Outgoing data sender. Scratch のグローバル変数を `reportDataByNode`
 * mutation で他ノードに伝播する。
 *
 * 二段デルタ送信:
 *   - sendData → latestQueuedData による「キュー時点のデルタ」フィルタ
 *   - _reportData → lastSentData による「サーバー反映済みのデルタ」フィルタ
 * これにより、値が短時間で行ったり来たりしても重複 mutation を抑える。
 *
 * `getRemoteVariable` は他ノードから受信した値を最新タイムスタンプで読む。
 *
 * Mixed into MeshV2Service.prototype.
 */
const DataSenderMixin = {
    async sendData(dataArray) {
        if (!this.groupId || !this.client) return;

        // Delta transmission: Filter out items that haven't changed since they were LAST QUEUED.
        // This avoids redundant mutations if values change back within the rate-limit interval.
        const filteredData = dataArray.filter(item => this.latestQueuedData[item.key] !== item.value);

        debug(
            () =>
                `Mesh V2: sendData called with ${dataArray.length} items, ` +
                `${filteredData.length} items changed: ${JSON.stringify(filteredData)}`,
        );

        if (filteredData.length === 0) {
            return;
        }

        // Update latestQueuedData IMMEDIATELY before sending to RateLimiter
        filteredData.forEach(item => {
            this.latestQueuedData[item.key] = item.value;
        });

        // Issue #713: seed own values into remoteData immediately so the
        // "sensor value" block can read this node's own variables without
        // waiting for the AppSync echo round-trip (RateLimiter 1s + network).
        // Local broadcast fires synchronously, so the echo would arrive too
        // late for a when_receive handler reading its own just-set variable.
        // The seed uses the client clock; handleDataUpdate normalizes the
        // timestamp to server time when the echo arrives, so cross-node
        // timestamp comparison self-heals within ~1-2s even with clock skew.
        this._seedLocalData(filteredData);

        try {
            // Save Promise to track completion (including queue time)
            this.lastDataSendPromise = this.dataRateLimiter.send(filteredData, this._reportDataBound);
            await this.lastDataSendPromise;
        } catch (error) {
            log.error(`Mesh V2: Failed to send data: ${error}`);
            const reason = this.shouldDisconnectOnError(error);
            if (reason) {
                this.cleanupAndDisconnect(reason);
            }
        }
    },

    /**
     * Internal method to send data to the server.
     * Used as sendFunction in dataRateLimiter.
     * @param {Array} payload - Array of {key, value} objects.
     * @returns {Promise} - Resolves with the mutation result.
     * @private
     */
    async _reportData(payload) {
        if (!this.groupId || !this.client) return;

        // Final delta check: Filter out items that haven't changed since the LAST SUCCESSFUL transmission.
        // This handles cases where values changed back while an earlier mutation was in flight.
        const finalPayload = payload.filter(item => this.lastSentData[item.key] !== item.value);

        if (finalPayload.length === 0) {
            debug(() => 'Mesh V2: Skipping mutation as all data is already up-to-date on server');
            return {
                data: {
                    reportDataByNode: {
                        nodeStatus: {
                            data: payload, // Return original payload to satisfy caller expectation
                        },
                    },
                },
            };
        }

        try {
            this.costTracking.mutationCount++;
            this.costTracking.reportDataCount++;

            log.info(`Mesh V2: Sending ${finalPayload.length} data items to group ${this.groupId}`);

            // Save Promise to track completion
            this.lastDataSendPromise = this.client.mutate({
                mutation: REPORT_DATA,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                    nodeId: this.meshId,
                    data: finalPayload,
                },
            });

            const result = await this.lastDataSendPromise;

            // Update last sent data on success
            finalPayload.forEach(item => {
                this.lastSentData[item.key] = item.value;
            });

            return result;
        } catch (error) {
            log.error(`Mesh V2: Failed to report data: ${error}`);
            const reason = this.shouldDisconnectOnError(error);
            if (reason) {
                this.cleanupAndDisconnect(reason);
                // Do not re-throw: sendData will catch this and would call
                // cleanupAndDisconnect again, causing duplicate cost summaries.
                return;
            }
            throw error;
        }
    },

    /**
     * Seed this node's own values into remoteData with a local timestamp.
     * Allows getRemoteVariable to return own values immediately; values from
     * other nodes still win when they carry a newer timestamp.
     * @param {Array} items - Array of {key, value} objects being queued.
     * @private
     */
    _seedLocalData(items) {
        if (!this.remoteData[this.meshId]) {
            this.remoteData[this.meshId] = {};
        }
        items.forEach(item => {
            this.remoteData[this.meshId][item.key] = {
                value: item.value,
                timestamp: Date.now(),
            };
        });
    },

    /**
     * Get all global scalar variables.
     * @returns {Array} Array of {key, value} objects.
     */
    getGlobalVariables() {
        const stage = this.runtime.getTargetForStage();
        if (!stage || !stage.variables) return [];

        const variables = [];
        for (const varId in stage.variables) {
            const currVar = stage.variables[varId];
            if (currVar.type === Variable.SCALAR_TYPE) {
                variables.push({
                    key: currVar.name,
                    value: String(currVar.value),
                });
            }
        }
        return variables;
    },

    /**
     * Send all global variables to other nodes in the group.
     * @returns {Promise<void>} A promise that resolves when variables are queued for sending.
     */
    async sendAllGlobalVariables() {
        if (!this.groupId || !this.client) return;

        const allVariables = this.getGlobalVariables();
        if (allVariables.length === 0) {
            debug(() => 'Mesh V2: No global variables to send');
            return;
        }

        await this.sendData(allVariables);
        debug(() => `Mesh V2: Sent ${allVariables.length} global variables`);
    },

    getRemoteVariable(name) {
        let latestValue = null;
        let latestTimestamp = 0;

        // Search across all nodes for the variable name
        for (const nodeId in this.remoteData) {
            if (Object.prototype.hasOwnProperty.call(this.remoteData[nodeId], name)) {
                const data = this.remoteData[nodeId][name];
                if (data.timestamp > latestTimestamp) {
                    latestTimestamp = data.timestamp;
                    latestValue = data.value;
                }
            }
        }
        return latestValue;
    },
};

module.exports = { DataSenderMixin };
