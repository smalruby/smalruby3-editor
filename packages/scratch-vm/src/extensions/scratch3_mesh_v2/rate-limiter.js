const log = require('../../util/log');

/* istanbul ignore next */
class RateLimiter {
    /**
     * @param {number} intervalMs - Minimum interval between requests in milliseconds.
     * @param {object} options - Optional parameters.
     * @param {boolean} options.enableMerge - Whether to merge data in the queue (default: false).
     * @param {string} options.mergeKeyField - Field name to use as merge key (default: 'key').
     */
    constructor (intervalMs, options = {}) {
        this.intervalMs = intervalMs;
        this.queue = [];
        this.lastSendTime = 0;
        this.processing = false;

        // New options for data merging
        this.enableMerge = options.enableMerge || false;
        this.mergeKeyField = options.mergeKeyField || 'key';
        this.requestCount = 0;

        // Statistics
        this.stats = {
            totalSent: 0,
            totalMerged: 0,
            lastReportTime: Date.now()
        };
    }

    /**
     * Add a request to the queue.
     * @param {any} data - Data to send.
     * @param {Function} sendFunction - Asynchronous function to send data.
     * @returns {Promise} - Resolves with the result of sendFunction.
     */
    send (data, sendFunction) {
        return new Promise((resolve, reject) => {
            if (this.enableMerge && Array.isArray(data)) {
                // Merge mode: Update item in queue if same key exists
                this.mergeIntoQueue(data, sendFunction, resolve, reject);
            } else {
                // Normal mode: Always push to queue
                this.queue.push({data, resolve, reject, sendFunction});
            }

            log.debug(`RateLimiter: ${this.enableMerge ? 'Processed' : 'Added'} to queue ` +
                `(size: ${this.queue.length}, enableMerge: ${this.enableMerge})`);

            this.processQueue();
        });
    }

    /**
     * Merge data into existing queue item if possible.
     * @param {Array} dataArray - New data to merge.
     * @param {Function} sendFunction - Function associated with the data.
     * @param {Function} resolve - Promise resolve callback.
     * @param {Function} reject - Promise reject callback.
     */
    mergeIntoQueue (dataArray, sendFunction, resolve, reject) {
        let merged = false;

        // Find the last item in queue with same sendFunction
        for (let i = this.queue.length - 1; i >= 0; i--) {
            const queueItem = this.queue[i];

            if (queueItem.sendFunction === sendFunction) {
                const existingData = queueItem.data;
                const mergedData = this.mergeData(existingData, dataArray);

                log.debug(`RateLimiter: Merging data - ` +
                    `before: ${JSON.stringify(existingData)}, ` +
                    `after: ${JSON.stringify(mergedData)}`);

                queueItem.data = mergedData;

                // Use arrays to manage resolve/reject callbacks to avoid stack overflow
                if (!queueItem.resolvers) {
                    // Convert existing resolve/reject to arrays
                    queueItem.resolvers = [queueItem.resolve];
                    queueItem.rejecters = [queueItem.reject];

                    // Set new resolve/reject handlers that call all functions in the arrays
                    queueItem.resolve = result => {
                        queueItem.resolvers.forEach(r => r(result));
                    };
                    queueItem.reject = error => {
                        queueItem.rejecters.forEach(r => r(error));
                    };
                }

                // Add new callbacks to the arrays
                queueItem.resolvers.push(resolve);
                queueItem.rejecters.push(reject);

                merged = true;
                break;
            }
        }

        if (merged) {
            this.stats.totalMerged++;
            this.reportStatsIfNeeded();
        } else {
            this.queue.push({data: dataArray, resolve, reject, sendFunction});
        }
    }

    /**
     * Report statistics periodically.
     * @private
     */
    reportStatsIfNeeded () {
        const now = Date.now();
        const elapsed = now - this.stats.lastReportTime;

        // Output statistics every 10 seconds
        if (elapsed >= 10000) {
            log.info(`RateLimiter Stats (last ${(elapsed / 1000).toFixed(1)}s): ` +
                `sent=${this.stats.totalSent}, merged=${this.stats.totalMerged}, ` +
                `queue=${this.queue.length}`);

            this.stats.totalSent = 0;
            this.stats.totalMerged = 0;
            this.stats.lastReportTime = now;
        }
    }

    /**
     * Merge two arrays of data using mergeKeyField.
     * @param {Array} existingData - Existing data items.
     * @param {Array} newData - New data items.
     * @returns {Array} - Merged data items.
     */
    mergeData (existingData, newData) {
        const dataMap = new Map();

        // Add existing data
        if (Array.isArray(existingData)) {
            existingData.forEach(item => {
                if (item && typeof item === 'object' && this.mergeKeyField in item) {
                    dataMap.set(item[this.mergeKeyField], item);
                }
            });
        }

        // Overwrite with new data
        if (Array.isArray(newData)) {
            newData.forEach(item => {
                if (item && typeof item === 'object' && this.mergeKeyField in item) {
                    dataMap.set(item[this.mergeKeyField], item);
                }
            });
        }

        return Array.from(dataMap.values());
    }

    /**
     * Wait for all current requests in the queue to complete.
     * @returns {Promise<void>} - A promise that resolves when the queue is empty.
     */
    waitForCompletion () {
        if (!this.processing && this.queue.length === 0) return Promise.resolve();
        
        return new Promise(resolve => {
            const check = () => {
                if (!this.processing && this.queue.length === 0) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    /**
     * Process the queue sequentially respecting the interval.
     * @private
     */
    async processQueue () {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLastSend = now - this.lastSendTime;

            if (timeSinceLastSend < this.intervalMs) {
                // Wait for the interval to pass
                await new Promise(resolve => setTimeout(resolve, this.intervalMs - timeSinceLastSend));
            }

            const item = this.queue.shift();
            this.requestCount++;
            log.debug(`RateLimiter: Sending request #${this.requestCount} ` +
                `(queue remaining: ${this.queue.length})`);

            try {
                const result = await item.sendFunction(item.data);
                this.lastSendTime = Date.now();
                this.stats.totalSent++;
                this.reportStatsIfNeeded();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }

        this.processing = false;
    }
}

module.exports = RateLimiter;
