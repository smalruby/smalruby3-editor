/**
 * Mesh v2 Client Library
 * JavaScript GraphQL client for AWS AppSync with WebSocket subscriptions
 * and polling protocol support
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

class MeshClient {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.domain = config.domain || null;
    this.connected = false;
    this.subscriptions = new Map();
    this.eventHandlers = new Map();

    // Configure Amplify for AppSync
    Amplify.configure({
      API: {
        GraphQL: {
          endpoint: this.endpoint,
          region: this.extractRegion(this.endpoint),
          defaultAuthMode: 'apiKey',
          apiKey: this.apiKey
        }
      }
    });

    // Create GraphQL client for subscriptions
    this.graphqlClient = generateClient();
  }

  /**
   * Extract AWS region from AppSync endpoint URL
   */
  extractRegion(endpoint) {
    const match = endpoint.match(/https:\/\/\w+\.appsync-api\.([^.]+)\.amazonaws\.com/);
    return match ? match[1] : 'ap-northeast-1';
  }

  /**
   * Execute GraphQL query or mutation
   */
  async execute(query, variables = {}) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();

      if (result.errors) {
        const error = new Error(result.errors[0].message);
        error.graphQLErrors = result.errors;
        throw error;
      }

      return result.data;
    } catch (error) {
      console.error('GraphQL execution error:', error);
      throw error;
    }
  }

  /**
   * Create a domain from source IP
   */
  async createDomain() {
    const query = `
      mutation CreateDomain {
        createDomain
      }
    `;

    const data = await this.execute(query);
    this.domain = data.createDomain;
    return data.createDomain;
  }

  /**
   * Create a new group
   * @param {string} name - Group name
   * @param {string} hostId - Host node ID
   * @param {string} domain - Domain
   * @param {boolean} useWebSocket - Whether to use WebSocket protocol
   * @param {number|null} maxConnectionTimeSeconds - Optional max connection time
   */
  async createGroup(name, hostId, domain, useWebSocket = true, maxConnectionTimeSeconds = null) {
    const query = `
      mutation CreateGroup($name: String!, $hostId: ID!, $domain: String!, $useWebSocket: Boolean!, $maxConnectionTimeSeconds: Int) {
        createGroup(name: $name, hostId: $hostId, domain: $domain, useWebSocket: $useWebSocket, maxConnectionTimeSeconds: $maxConnectionTimeSeconds) {
          id
          domain
          fullId
          name
          hostId
          expiresAt
          heartbeatIntervalSeconds
          useWebSocket
          pollingIntervalSeconds
        }
      }
    `;

    const variables = {
      name,
      hostId,
      domain: domain || this.domain,
      useWebSocket
    };

    if (maxConnectionTimeSeconds !== null) {
      variables.maxConnectionTimeSeconds = maxConnectionTimeSeconds;
    }

    const data = await this.execute(query, variables);
    return data.createGroup;
  }

  /**
   * Renew heartbeat (host only)
   */
  async renewHeartbeat(groupId, hostId, domain) {
    const query = `
      mutation RenewHeartbeat($groupId: ID!, $hostId: ID!, $domain: String!) {
        renewHeartbeat(groupId: $groupId, hostId: $hostId, domain: $domain) {
          groupId
          domain
          expiresAt
          heartbeatIntervalSeconds
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      hostId,
      domain: domain || this.domain
    });

    return data.renewHeartbeat;
  }

  /**
   * List groups by domain
   */
  async listGroupsByDomain(domain) {
    const query = `
      query ListGroupsByDomain($domain: String!) {
        listGroupsByDomain(domain: $domain) {
          id
          domain
          fullId
          name
          hostId
          expiresAt
          heartbeatIntervalSeconds
        }
      }
    `;

    const data = await this.execute(query, {
      domain: domain || this.domain
    });

    return data.listGroupsByDomain;
  }

  /**
   * List all node statuses in a group
   */
  async listGroupStatuses(groupId, domain) {
    const query = `
      query ListGroupStatuses($groupId: ID!, $domain: String!) {
        listGroupStatuses(groupId: $groupId, domain: $domain) {
          nodeId
          groupId
          domain
          data {
            key
            value
          }
          timestamp
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      domain: domain || this.domain
    });

    return data.listGroupStatuses;
  }

  /**
   * Get node status by nodeId
   */
  async getNodeStatus(nodeId) {
    const query = `
      query GetNodeStatus($nodeId: ID!) {
        getNodeStatus(nodeId: $nodeId) {
          nodeId
          groupId
          domain
          data {
            key
            value
          }
          timestamp
        }
      }
    `;

    const data = await this.execute(query, { nodeId });
    return data.getNodeStatus;
  }

  /**
   * List all nodes in a group
   */
  async listNodesInGroup(groupId, domain) {
    const query = `
      query ListNodesInGroup($groupId: ID!, $domain: String!) {
        listNodesInGroup(groupId: $groupId, domain: $domain) {
          id
          name
          groupId
          domain
          expiresAt
          heartbeatIntervalSeconds
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      domain: domain || this.domain
    });

    return data.listNodesInGroup;
  }

  /**
   * Search groups by name prefix (cross-domain)
   * @param {string} namePrefix - hostId prefix (hex lowercase)
   * @param {number|null} limit - Max results
   */
  async searchGroupsByNamePrefix(namePrefix, limit = null) {
    const query = `
      query SearchGroupsByNamePrefix($namePrefix: String!, $limit: Int) {
        searchGroupsByNamePrefix(namePrefix: $namePrefix, limit: $limit) {
          id
          domain
          fullId
          name
          hostId
          expiresAt
          useWebSocket
          pollingIntervalSeconds
        }
      }
    `;

    const variables = { namePrefix };
    if (limit !== null) {
      variables.limit = limit;
    }

    const data = await this.execute(query, variables);
    return data.searchGroupsByNamePrefix;
  }

  /**
   * Get events since a cursor (for polling protocol)
   * @param {string} groupId - Group ID
   * @param {string} domain - Domain
   * @param {string} since - Previous nextSince or event cursor
   */
  async getEventsSince(groupId, domain, since) {
    const query = `
      query GetEventsSince($groupId: ID!, $domain: String!, $since: String!) {
        getEventsSince(groupId: $groupId, domain: $domain, since: $since) {
          name
          firedByNodeId
          groupId
          domain
          payload
          timestamp
          cursor
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      domain: domain || this.domain,
      since
    });

    return data.getEventsSince;
  }

  /**
   * Join a group
   */
  async joinGroup(groupId, nodeId, domain) {
    const query = `
      mutation JoinGroup($groupId: ID!, $nodeId: ID!, $domain: String!) {
        joinGroup(groupId: $groupId, nodeId: $nodeId, domain: $domain) {
          id
          name
          groupId
          domain
          expiresAt
          heartbeatIntervalSeconds
          useWebSocket
          pollingIntervalSeconds
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      nodeId,
      domain: domain || this.domain
    });

    return data.joinGroup;
  }

  /**
   * Send member heartbeat
   */
  async sendMemberHeartbeat(groupId, nodeId, domain) {
    const query = `
      mutation SendMemberHeartbeat($groupId: ID!, $nodeId: ID!, $domain: String!) {
        sendMemberHeartbeat(groupId: $groupId, nodeId: $nodeId, domain: $domain) {
          nodeId
          groupId
          domain
          expiresAt
          heartbeatIntervalSeconds
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      nodeId,
      domain: domain || this.domain
    });

    return data.sendMemberHeartbeat;
  }

  /**
   * Leave a group
   */
  async leaveGroup(groupId, nodeId, domain) {
    const query = `
      mutation LeaveGroup($groupId: ID!, $nodeId: ID!, $domain: String!) {
        leaveGroup(groupId: $groupId, nodeId: $nodeId, domain: $domain) {
          peerId
          groupId
          domain
          message
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      nodeId,
      domain: domain || this.domain
    });

    return data.leaveGroup;
  }

  /**
   * Dissolve a group (host only)
   */
  async dissolveGroup(groupId, hostId, domain) {
    const query = `
      mutation DissolveGroup($groupId: ID!, $hostId: ID!, $domain: String!) {
        dissolveGroup(groupId: $groupId, hostId: $hostId, domain: $domain) {
          groupId
          domain
          groupDissolve {
            groupId
            domain
            message
          }
        }
      }
    `;

    const data = await this.execute(query, {
      groupId,
      hostId,
      domain: domain || this.domain
    });

    return data.dissolveGroup;
  }

  /**
   * Report sensor data
   */
  async reportDataByNode(nodeId, groupId, domain, data) {
    const query = `
      mutation ReportDataByNode($nodeId: ID!, $groupId: ID!, $domain: String!, $data: [SensorDataInput!]!) {
        reportDataByNode(nodeId: $nodeId, groupId: $groupId, domain: $domain, data: $data) {
          groupId
          domain
          nodeStatus {
            nodeId
            groupId
            domain
            data {
              key
              value
            }
            timestamp
          }
        }
      }
    `;

    const result = await this.execute(query, {
      nodeId,
      groupId,
      domain: domain || this.domain,
      data
    });

    return result.reportDataByNode;
  }

  /**
   * Fire multiple events in a batch (WebSocket protocol - triggers subscription)
   */
  async fireEventsByNode(nodeId, groupId, domain, events) {
    const query = `
      mutation FireEventsByNode($nodeId: ID!, $groupId: ID!, $domain: String!, $events: [EventInput!]!) {
        fireEventsByNode(nodeId: $nodeId, groupId: $groupId, domain: $domain, events: $events) {
          groupId
          domain
          batchEvent {
            events {
              name
              firedByNodeId
              groupId
              domain
              payload
              timestamp
            }
            firedByNodeId
            groupId
            domain
            timestamp
          }
        }
      }
    `;

    const result = await this.execute(query, {
      nodeId,
      groupId,
      domain: domain || this.domain,
      events
    });

    return result.fireEventsByNode;
  }

  /**
   * Record events for polling protocol (does NOT trigger subscription)
   * @param {string} nodeId - Node ID
   * @param {string} groupId - Group ID
   * @param {string} domain - Domain
   * @param {Array} events - Array of EventInput
   * @returns {object} RecordEventsPayload with groupId, domain, recordedCount, nextSince
   */
  async recordEventsByNode(nodeId, groupId, domain, events) {
    const query = `
      mutation RecordEventsByNode($nodeId: ID!, $groupId: ID!, $domain: String!, $events: [EventInput!]!) {
        recordEventsByNode(nodeId: $nodeId, groupId: $groupId, domain: $domain, events: $events) {
          groupId
          domain
          recordedCount
          nextSince
        }
      }
    `;

    const result = await this.execute(query, {
      nodeId,
      groupId,
      domain: domain || this.domain,
      events
    });

    return result.recordEventsByNode;
  }

  /**
   * Subscribe to all group messages via unified subscription
   * @param {string} groupId - Group ID
   * @param {string} domain - Domain
   * @param {object} callbacks - Callback functions for each message type
   * @param {Function} callbacks.onDataUpdate - Called when nodeStatus is received
   * @param {Function} callbacks.onBatchEvent - Called when batchEvent is received
   * @param {Function} callbacks.onGroupDissolve - Called when groupDissolve is received
   * @returns {string} Subscription ID
   */
  subscribeToMessageInGroup(groupId, domain, callbacks) {
    console.log('Subscription: onMessageInGroup', { groupId, domain });

    const subscriptionId = `message-${groupId}`;

    // GraphQL subscription query - unified
    const subscription = `
      subscription OnMessageInGroup($groupId: ID!, $domain: String!) {
        onMessageInGroup(groupId: $groupId, domain: $domain) {
          groupId
          domain
          nodeStatus {
            nodeId
            groupId
            domain
            data {
              key
              value
            }
            timestamp
          }
          batchEvent {
            events {
              name
              firedByNodeId
              groupId
              domain
              payload
              timestamp
            }
            firedByNodeId
            groupId
            domain
            timestamp
          }
          groupDissolve {
            groupId
            domain
            message
          }
        }
      }
    `;

    // Subscribe using Amplify
    const sub = this.graphqlClient.graphql({
      query: subscription,
      variables: { groupId, domain: domain || this.domain }
    }).subscribe({
      next: ({ data }) => {
        console.log('Unified subscription data received:', data);

        if (!data || !data.onMessageInGroup) return;

        const message = data.onMessageInGroup;

        // Route to appropriate callback based on which field is non-null
        if (message.nodeStatus && callbacks.onDataUpdate) {
          console.log('Received message type: nodeStatus');
          // When nodeStatus is received, fetch all group statuses
          this.listGroupStatuses(groupId, domain || this.domain)
            .then(statuses => callbacks.onDataUpdate(statuses))
            .catch(error => console.error('Error fetching group statuses:', error));
        } else if (message.batchEvent && callbacks.onBatchEvent) {
          console.log('Received message type: batchEvent');
          callbacks.onBatchEvent(message.batchEvent);
        } else if (message.groupDissolve && callbacks.onGroupDissolve) {
          console.log('Received message type: groupDissolve');
          callbacks.onGroupDissolve(message.groupDissolve);
        }
      },
      error: (error) => {
        console.error('Unified subscription error:', error);
        if (error.errors && error.errors.length > 0) {
          console.error('GraphQL errors:', error.errors);
          error.errors.forEach(err => {
            console.error('- Error:', err.message);
            if (err.path) console.error('  Path:', err.path);
            if (err.locations) console.error('  Locations:', err.locations);
          });
        }
      }
    });

    this.subscriptions.set(subscriptionId, sub);

    return subscriptionId;
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId) {
    if (this.subscriptions.has(subscriptionId)) {
      const subscription = this.subscriptions.get(subscriptionId);
      // Amplify subscriptions have an unsubscribe method
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      this.subscriptions.delete(subscriptionId);
    }
    this.eventHandlers.delete(subscriptionId);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    // Clear all subscriptions
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    }
    this.subscriptions.clear();
    this.eventHandlers.clear();
    this.connected = false;
  }
}

/**
 * Rate limiter utility
 */
class RateLimiter {
  constructor(maxCalls, timeWindow) {
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindow; // in milliseconds
    this.calls = [];
  }

  canMakeCall() {
    const now = Date.now();
    // Remove old calls outside the time window
    this.calls = this.calls.filter(time => now - time < this.timeWindow);

    if (this.calls.length < this.maxCalls) {
      this.calls.push(now);
      return true;
    }

    return false;
  }

  getCallCount() {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.timeWindow);
    return this.calls.length;
  }

  reset() {
    this.calls = [];
  }
}

/**
 * Change detector for sensor data
 */
class ChangeDetector {
  constructor() {
    this.previousValues = new Map();
  }

  hasChanged(key, value) {
    const previous = this.previousValues.get(key);
    const changed = previous !== value;

    if (changed) {
      this.previousValues.set(key, value);
    }

    return changed;
  }

  reset() {
    this.previousValues.clear();
  }
}

// Export classes for use in app.js
export { MeshClient, RateLimiter, ChangeDetector };
