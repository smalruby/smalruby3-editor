/* global process */
const AWSAppSyncClient = require('aws-appsync').default;
const gqlTag = require('graphql-tag');
const gql = gqlTag.default || gqlTag;

// Production configuration for Smalruby 3 Mesh V2
const GRAPHQL_ENDPOINT = process.env.MESH_GRAPHQL_ENDPOINT || 'https://mpe3yhgk6zdxfhjbay2vqcq5qe.appsync-api.ap-northeast-1.amazonaws.com/graphql';
const REGION = process.env.MESH_AWS_REGION || 'ap-northeast-1';
const API_KEY = process.env.MESH_API_KEY || 'da2-kdkm7p5cfzbr5jsikmoqvddowi';

let client = null;

/* istanbul ignore next */
const createClient = () => {
    if (client) return client;

    client = new AWSAppSyncClient({
        url: GRAPHQL_ENDPOINT,
        region: REGION,
        auth: {
            type: 'API_KEY',
            apiKey: API_KEY
        },
        disableOffline: true
    });

    return client;
};

/* istanbul ignore next */
const getClient = () => client;

module.exports = {
    createClient,
    getClient,
    gql,
    GRAPHQL_ENDPOINT
};
