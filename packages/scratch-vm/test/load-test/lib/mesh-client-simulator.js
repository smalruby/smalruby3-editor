const {ApolloClient, InMemoryCache, HttpLink, split} = require('@apollo/client/core');
const {GraphQLWsLink} = require('@apollo/client/link/subscriptions');
const {createClient} = require('graphql-ws');
const {getMainDefinition} = require('@apollo/client/utilities');
const ws = require('ws');
const fetch = require('cross-fetch');
const {
    CREATE_GROUP,
    JOIN_GROUP,
    DISSOLVE_GROUP,
    LEAVE_GROUP,
    REPORT_DATA,
    FIRE_EVENTS,
    ON_DATA_UPDATE,
    ON_BATCH_EVENT,
    SEND_MEMBER_HEARTBEAT,
    RENEW_HEARTBEAT
} = require('../../../src/extensions/scratch3_mesh_v2/gql-operations');

class MeshClientSimulator {
    constructor (options) {
        this.groupName = options.groupName;
        this.groupId = options.groupId; // Can be null if joining by name/list
        const randomId = Math.random().toString(36)
            .substr(2, 9);
        this.nodeId = options.nodeName || `node-${randomId}`;
        this.domain = options.domain || 'localhost';
        this.appsyncEndpoint = options.appsyncEndpoint;
        this.apiKey = options.apiKey;
        this.client = null;
        this.subscriptions = [];
        this.onDataUpdateHandler = null;
        this.onEventHandler = null;
        this.isHost = false;
    }

    async connect () {
        const httpLink = new HttpLink({
            uri: this.appsyncEndpoint,
            headers: {
                'x-api-key': this.apiKey
            },
            fetch
        });

        // AppSync Realtime WebSocket URL conversion
        // https://docs.aws.amazon.com/appsync/latest/devguide/realtime-websocket-client.html
        const wsUrl = this.appsyncEndpoint
            .replace('https://', 'wss://')
            .replace('appsync-api', 'appsync-realtime-api');

        const wsLink = new GraphQLWsLink(createClient({
            url: wsUrl,
            webSocketImpl: ws,
            connectionParams: async () => {
                const header = {
                    'host': new URL(this.appsyncEndpoint).host,
                    'x-api-key': this.apiKey
                };
                // headerBase64 is used to satisfy AppSync requirements if needed
                Buffer.from(JSON.stringify(header)).toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/[=]+$/, '');
                await Promise.resolve();
                return {
                    payload: {},
                    headers: {
                        'Authorization': this.apiKey,
                        'x-api-key': this.apiKey
                    }
                };
            }
        }));

        const link = split(
            ({query}) => {
                const definition = getMainDefinition(query);
                return (
                    definition.kind === 'OperationDefinition' &&
                    definition.operation === 'subscription'
                );
            },
            wsLink,
            httpLink
        );

        this.client = new ApolloClient({
            link,
            cache: new InMemoryCache(),
            defaultOptions: {
                watchQuery: {
                    fetchPolicy: 'no-cache',
                    errorPolicy: 'all'
                },
                query: {
                    fetchPolicy: 'no-cache',
                    errorPolicy: 'all',
                    timeout: 30000
                },
                mutate: {
                    errorPolicy: 'all',
                    timeout: 30000
                }
            }
        });

        await Promise.resolve(); // satisfy require-await
    }

    async createGroup (groupName, maxConnectionTimeSeconds = 600) {
        if (!this.client) throw new Error('Client not initialized');

        try {
            const result = await this.client.mutate({
                mutation: CREATE_GROUP,
                variables: {
                    name: groupName || this.groupId,
                    hostId: this.nodeId,
                    domain: this.domain,
                    maxConnectionTimeSeconds: maxConnectionTimeSeconds
                }
            });

            if (!result.data || !result.data.createGroup) {
                const errorMsg = result.error && result.error.errors ?
                    JSON.stringify(result.error.errors) : 'Unknown error';
                throw new Error(`CreateGroup returned null: ${errorMsg}`);
            }

            const group = result.data.createGroup;
            this.groupId = group.id;
            this.groupName = group.name;
            this.domain = group.domain;
            this.isHost = true;
            console.log(
                `Client ${this.nodeId} created group ${this.groupName} (${this.groupId}) ` +
                `with ${maxConnectionTimeSeconds}s expiry`
            );

            // Send initial heartbeat to keep group alive
            await this.renewHeartbeat();

            return group;
        } catch (error) {
            console.error(`Client ${this.nodeId} failed to create group ${groupName}:`, error.message);
            if (error.graphQLErrors) {
                console.error('GraphQL Errors:', JSON.stringify(error.graphQLErrors, null, 2));
            }
            if (error.networkError) {
                console.error('Network Error:', error.networkError);
            }
            throw error;
        }
    }

    async join () {
        if (!this.client) throw new Error('Client not initialized');

        try {
            const result = await this.client.mutate({
                mutation: JOIN_GROUP,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                    nodeId: this.nodeId
                }
            });
            const node = result.data.joinGroup;
            this.domain = node.domain;
            console.log(`Client ${this.nodeId} joined group ${this.groupId}`);
            return node;
        } catch (error) {
            console.error(`Client ${this.nodeId} failed to join group ${this.groupId}:`, error.message);
            console.error('Full error:', error);
            throw error;
        }
    }

    async subscribeToEvents () {
        if (!this.groupId) throw new Error('Not joined to a group');

        const dataSub = this.client.subscribe({
            query: ON_DATA_UPDATE,
            variables: {groupId: this.groupId, domain: this.domain}
        }).subscribe({
            next: result => {
                if (this.onDataUpdateHandler && result.data && result.data.onDataUpdateInGroup) {
                    this.onDataUpdateHandler(result.data.onDataUpdateInGroup);
                }
            },
            error: err => console.error('Subscription error (data):', err)
        });

        const eventSub = this.client.subscribe({
            query: ON_BATCH_EVENT,
            variables: {groupId: this.groupId, domain: this.domain}
        }).subscribe({
            next: result => {
                if (this.onEventHandler && result.data && result.data.onBatchEventInGroup) {
                    const batch = result.data.onBatchEventInGroup;
                    if (batch && batch.events) {
                        batch.events.forEach(event => this.onEventHandler(event));
                    }
                }
            },
            error: err => console.error('Subscription error (event):', err)
        });

        this.subscriptions.push(dataSub, eventSub);
        await Promise.resolve();
    }

    onDataUpdate (handler) {
        this.onDataUpdateHandler = handler;
    }

    onEvent (handler) {
        this.onEventHandler = handler;
    }

    async updateData (data) {
        // data should be an object, convert to array of {key, value}
        const dataArray = Object.entries(data).map(([key, value]) => ({
            key,
            value: String(value)
        }));

        await Promise.resolve(); // satisfy require-await

        return this.client.mutate({
            mutation: REPORT_DATA,
            variables: {
                groupId: this.groupId,
                domain: this.domain,
                nodeId: this.nodeId,
                data: dataArray
            }
        });
    }

    async publishEvent (event) {
        await Promise.resolve(); // satisfy require-await
        return this.client.mutate({
            mutation: FIRE_EVENTS,
            variables: {
                groupId: this.groupId,
                domain: this.domain,
                nodeId: this.nodeId,
                events: [{
                    name: event.type,
                    payload: JSON.stringify(event.data || {}),
                    timestamp: new Date().toISOString()
                }]
            }
        });
    }

    async sendHeartbeat () {
        await Promise.resolve(); // satisfy require-await
        return this.client.mutate({
            mutation: SEND_MEMBER_HEARTBEAT,
            variables: {
                groupId: this.groupId,
                domain: this.domain,
                nodeId: this.nodeId
            }
        });
    }

    async renewHeartbeat () {
        if (!this.isHost) {
            throw new Error('Only host can renew heartbeat');
        }
        await Promise.resolve(); // satisfy require-await
        return this.client.mutate({
            mutation: RENEW_HEARTBEAT,
            variables: {
                groupId: this.groupId,
                domain: this.domain,
                hostId: this.nodeId
            }
        });
    }

    async dissolveGroup () {
        if (!this.client || !this.isHost) {
            throw new Error('Only host can dissolve group');
        }

        try {
            await this.client.mutate({
                mutation: DISSOLVE_GROUP,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain
                }
            });
            console.log(`Client ${this.nodeId} dissolved group ${this.groupId}`);
        } catch (error) {
            console.error(`Client ${this.nodeId} failed to dissolve group ${this.groupId}:`, error.message);
            throw error;
        }
    }

    async leaveGroup () {
        if (!this.client || this.isHost) {
            throw new Error('Host should use dissolveGroup instead');
        }

        try {
            await this.client.mutate({
                mutation: LEAVE_GROUP,
                variables: {
                    groupId: this.groupId,
                    domain: this.domain,
                    nodeId: this.nodeId
                }
            });
            console.log(`Client ${this.nodeId} left group ${this.groupId}`);
        } catch (error) {
            console.error(`Client ${this.nodeId} failed to leave group ${this.groupId}:`, error.message);
            throw error;
        }
    }

    async disconnect () {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];

        // Cleanup group membership before disconnecting
        if (this.groupId && this.client) {
            try {
                if (this.isHost) {
                    await this.dissolveGroup();
                } else {
                    await this.leaveGroup();
                }
            } catch (error) {
                console.error(`Error during group cleanup:`, error.message);
            }
        }

        if (this.client) {
            this.client.stop();
            await Promise.resolve();
        }
    }
}

module.exports = {MeshClientSimulator};
