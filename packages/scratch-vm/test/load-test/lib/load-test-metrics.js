class LoadTestMetrics {
    constructor () {
        this.startTime = Date.now();
        this.results = {
            successCount: 0,
            errorCount: 0,
            responseTimes: [],
            errors: [],
            dataUpdates: 0,
            eventPublishes: 0,
            eventDeliveries: [],
            crosstalk: []
        };
    }

    recordSuccess (responseTime) {
        this.results.successCount++;
        this.results.responseTimes.push(responseTime);
    }

    recordError (error, responseTime) {
        this.results.errorCount++;
        this.results.responseTimes.push(responseTime);
        this.results.errors.push({
            message: error.message,
            timestamp: Date.now()
        });
    }

    recordDataUpdate (groupName, responseTime) {
        this.results.dataUpdates++;
        this.recordSuccess(responseTime);
    }

    recordEventPublish (groupName, responseTime) {
        this.results.eventPublishes++;
        this.recordSuccess(responseTime);
    }

    recordEventDelivery (groupName, delay) {
        this.results.eventDeliveries.push({
            groupName,
            delay,
            timestamp: Date.now()
        });
    }

    recordCrosstalk (type, expectedGroup, actualGroup) {
        this.results.crosstalk.push({
            type,
            expectedGroup,
            actualGroup,
            timestamp: Date.now()
        });
    }

    getCurrentStats () {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const totalReqs = this.results.successCount + this.results.errorCount;
        const tps = elapsed > 0 ? (totalReqs / elapsed).toFixed(2) : 0;

        return {
            elapsed: elapsed.toFixed(1),
            totalRequests: totalReqs,
            success: this.results.successCount,
            errors: this.results.errorCount,
            tps: tps
        };
    }

    generateReport () {
        const sortedTimes = [...this.results.responseTimes].sort((a, b) => a - b);
        const count = sortedTimes.length;

        const getPercentile = p => {
            if (count === 0) return 0;
            const idx = Math.floor((p / 100) * count);
            return sortedTimes[Math.min(idx, count - 1)];
        };

        const avg = count > 0 ? sortedTimes.reduce((a, b) => a + b, 0) / count : 0;

        return {
            summary: {
                durationSeconds: (Date.now() - this.startTime) / 1000,
                totalRequests: count + this.results.errorCount,
                successCount: this.results.successCount,
                errorCount: this.results.errorCount,
                errorRate: count + this.results.errorCount > 0 ?
                    `${(this.results.errorCount / (count + this.results.errorCount) * 100).toFixed(2)}%` :
                    '0%',
                tps: ((count + this.results.errorCount) / ((Date.now() - this.startTime) / 1000)).toFixed(2)
            },
            latency: {
                avg: avg.toFixed(2),
                p50: getPercentile(50),
                p95: getPercentile(95),
                p99: getPercentile(99),
                max: count > 0 ? sortedTimes[count - 1] : 0
            },
            events: {
                delivered: this.results.eventDeliveries.length,
                avgDeliveryDelay: this.results.eventDeliveries.length > 0 ?
                    (this.results.eventDeliveries.reduce((a, b) => a + b.delay, 0) /
                        this.results.eventDeliveries.length).toFixed(2) :
                    0
            },
            crosstalk: {
                count: this.results.crosstalk.length,
                details: this.results.crosstalk
            }
        };
    }
}

module.exports = {LoadTestMetrics};
