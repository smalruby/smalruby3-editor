const {MeshClientSimulator} = require('./lib/mesh-client-simulator');
const {LoadTestMetrics} = require('./lib/load-test-metrics');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run Data Update Load Test.
 * @param {object} config - Test configuration.
 * @returns {Promise<object>} - Test results.
 */
const runDataUpdateLoadTest = async function (config) {
    const {
        groupCount = 1,
        nodesPerGroup = 4,
        updatesPerSecondPerNode = 4,
        durationMinutes = 5,
        groupId = 'load-test-group-default'
    } = config;

    const clients = [];
    const metrics = new LoadTestMetrics();

    console.log(`Setting up ${groupCount * nodesPerGroup} clients...`);
    for (let g = 0; g < groupCount; g++) {
        const currentGroupId = groupId + (groupCount > 1 ? `-${g}` : '');
        for (let n = 0; n < nodesPerGroup; n++) {
            const client = new MeshClientSimulator({
                groupId: currentGroupId,
                nodeName: `node-${g}-${n}`,
                appsyncEndpoint: process.env.MESH_GRAPHQL_ENDPOINT || process.env.APPSYNC_ENDPOINT,
                apiKey: process.env.MESH_API_KEY || process.env.APPSYNC_API_KEY,
                domain: `test-domain-${Date.now()}`
            });
            clients.push(client);
        }
    }

    console.log('Connecting clients...');
    const batchSize = 10;

    // First client (host) creates the group
    console.log('Host (client 0) creating group...');
    await clients[0].connect();
    const createdGroup = await clients[0].createGroup(clients[0].groupId);
    const actualGroupId = createdGroup.id;
    const actualDomain = createdGroup.domain;
    console.log(`Host created group: ${actualGroupId} in domain: ${actualDomain}`);

    // Update all other clients with the actual group ID and domain
    for (let i = 1; i < clients.length; i++) {
        clients[i].groupId = actualGroupId;
        clients[i].domain = actualDomain;
    }

    // Remaining clients join the group
    for (let i = 1; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, Math.min(i + batchSize, clients.length));
        await Promise.all(batch.map(c => c.connect()));
        await Promise.all(batch.map(c => c.join()));
        console.log(`${Math.min(i + batchSize, clients.length)}/${clients.length} clients connected and joined`);
        if (i + batchSize < clients.length) await sleep(100);
    }

    console.log('Starting load test...');
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    const updateInterval = 1000 / updatesPerSecondPerNode;

    /**
     * Run Client Updates.
     * @param {object} client - MeshClientSimulator instance.
     * @param {number} intervalMs - Interval between updates.
     * @param {number} clientEndTime - End time for the test.
     * @param {object} clientMetrics - LoadTestMetrics instance.
     * @returns {Promise<void>} - Completion.
     */
    const runClientUpdates = async function (client, intervalMs, clientEndTime, clientMetrics) {
        while (Date.now() < clientEndTime) {
            const clientStartTime = Date.now();
            try {
                await client.updateData({
                    load_test_value: Math.random(),
                    timestamp: Date.now()
                });
                const responseTime = Date.now() - clientStartTime;
                clientMetrics.recordDataUpdate(client.groupId, responseTime);
            } catch (error) {
                const responseTime = Date.now() - clientStartTime;
                clientMetrics.recordError(error, responseTime);
            }

            const elapsed = Date.now() - clientStartTime;
            const waitTime = Math.max(0, intervalMs - elapsed);
            await sleep(waitTime);
        }
    };

    const updatePromises = clients.map(client => runClientUpdates(client, updateInterval, endTime, metrics));

    // Progress reporting
    const progressInterval = setInterval(() => {
        console.log(JSON.stringify(metrics.getCurrentStats()));
    }, 5000);

    await Promise.all(updatePromises);
    clearInterval(progressInterval);

    console.log('Disconnecting clients...');
    for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        await Promise.all(batch.map(c => c.disconnect()));
    }

    return metrics.generateReport();
};

/**
 * Main function.
 * @returns {Promise<void>} - Completion.
 */
const main = async function () {
    console.log('=== MESH v2 データ更新負荷テスト ===\n');

    if (!process.env.MESH_GRAPHQL_ENDPOINT && !process.env.APPSYNC_ENDPOINT) {
        console.error('Error: MESH_GRAPHQL_ENDPOINT or APPSYNC_ENDPOINT environment variable is required.');
        process.exit(1);
    }

    // 1.1 基本負荷テスト
    console.log('1.1 基本負荷テスト (4ノード、4回/秒/ノード、1分間)');
    const basicResult = await runDataUpdateLoadTest({
        groupCount: 1,
        nodesPerGroup: 4,
        updatesPerSecondPerNode: 4,
        durationMinutes: 1,
        groupId: `basic-test-${Date.now()}`
    });
    console.log('結果:', JSON.stringify(basicResult, null, 2));
};

if (require.main === module) {
    main().catch(console.error);
}
