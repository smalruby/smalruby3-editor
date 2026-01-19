const {CloudWatchClient, GetMetricDataCommand} = require('@aws-sdk/client-cloudwatch');

class CloudWatchIntegration {
    constructor (region = 'ap-northeast-1') {
        this.client = new CloudWatchClient({region});
    }

    async getMetrics (startTime, endTime, apiId, tableName) {
        // This is a template for fetching AppSync and DynamoDB metrics.
        // In a real scenario, you'd need the specific IDs and names.

        const queries = [];

        if (apiId) {
            queries.push({
                Id: 'appsync_latency',
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/AppSync',
                        MetricName: 'Latency',
                        Dimensions: [{Name: 'GraphQLAPIId', Value: apiId}]
                    },
                    Period: 60,
                    Stat: 'Average'
                }
            });
        }

        if (tableName) {
            queries.push({
                Id: 'dynamodb_write_capacity',
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/DynamoDB',
                        MetricName: 'ConsumedWriteCapacityUnits',
                        Dimensions: [{Name: 'TableName', Value: tableName}]
                    },
                    Period: 60,
                    Stat: 'Sum'
                }
            });
        }

        if (queries.length === 0) return {};

        const command = new GetMetricDataCommand({
            StartTime: startTime,
            EndTime: endTime,
            MetricDataQueries: queries
        });

        try {
            const response = await this.client.send(command);
            return response.MetricDataResults;
        } catch (error) {
            console.error('Failed to fetch CloudWatch metrics:', error);
            return {};
        }
    }
}

module.exports = {CloudWatchIntegration};
