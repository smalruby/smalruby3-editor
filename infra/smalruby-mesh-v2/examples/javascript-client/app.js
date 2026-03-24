/**
 * Mesh v2 Client Application Logic
 * Handles UI interactions and state management
 * Supports both WebSocket and Polling protocols
 */

import { MeshClient, RateLimiter, ChangeDetector } from './mesh-client.bundle.js';

// Application state
const state = {
  client: null,
  connected: false,
  currentGroup: null,
  currentNodeId: null,
  selectedGroupId: null,
  sessionStartTime: null,
  sessionTimerId: null,
  heartbeatTimerId: null,
  heartbeatIntervalSeconds: 15, // Default fallback (stg value)
  messageSubscriptionId: null,
  // Polling protocol state
  pollingTimerId: null,
  pollingIntervalSeconds: 2, // Default fallback
  pollingSince: null, // Cursor for getEventsSince
  sensorPollingTimerId: null, // Polling timer for sensor data updates
  sensorData: {
    temperature: 20,
    brightness: 50,
    distance: 100
  },
  eventHistory: []
};

// Rate limiters (initialized after DOM loads)
let sensorRateLimiter;
let eventRateLimiter;

// Change detector for sensors (initialized after DOM loads)
let sensorChangeDetector;

/**
 * Initialize application on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Mesh v2 Client initializing...');

  // Initialize rate limiters and change detector
  sensorRateLimiter = new RateLimiter(4, 1000); // 4 calls per second
  eventRateLimiter = new RateLimiter(2, 1000); // 2 calls per second
  sensorChangeDetector = new ChangeDetector();

  // Load saved configuration from localStorage
  loadConfiguration();

  // Parse domain from URL parameter
  parseDomainFromURL();

  // Setup event listeners
  setupEventListeners();

  // Setup sensor change listeners
  setupSensorListeners();

  // Update UI
  updateUI();

  // Start rate status update interval
  setInterval(updateRateStatus, 1000);

  console.log('Application ready!');
});

/**
 * Load configuration from localStorage
 */
function loadConfiguration() {
  const savedEndpoint = localStorage.getItem('mesh_endpoint');
  const savedApiKey = localStorage.getItem('mesh_apikey');

  if (savedEndpoint) {
    document.getElementById('appsyncEndpoint').value = savedEndpoint;
  }

  if (savedApiKey) {
    document.getElementById('apiKey').value = savedApiKey;
  }
}

/**
 * Save configuration to localStorage
 */
function saveConfiguration(endpoint, apiKey) {
  localStorage.setItem('mesh_endpoint', endpoint);
  localStorage.setItem('mesh_apikey', apiKey);
}

/**
 * Parse domain from URL parameter ?mesh=domain
 */
function parseDomainFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const meshParam = urlParams.get('mesh');

  if (meshParam) {
    document.getElementById('domain').value = meshParam;
    console.log('Domain from URL:', meshParam);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Connect button
  document.getElementById('connectBtn').addEventListener('click', handleConnect);

  // Group management
  document.getElementById('createGroupBtn').addEventListener('click', handleCreateGroup);
  document.getElementById('listGroupsBtn').addEventListener('click', handleListGroups);
  document.getElementById('joinGroupBtn').addEventListener('click', handleJoinGroup);
  document.getElementById('leaveGroupBtn').addEventListener('click', handleLeaveGroup);
  document.getElementById('dissolveGroupBtn').addEventListener('click', handleDissolveGroup);
  document.getElementById('disconnectBtn').addEventListener('click', handleDisconnect);

  // Events
  document.getElementById('sendEventBtn').addEventListener('click', handleSendEvent);
  document.getElementById('clearEventsBtn').addEventListener('click', handleClearEvents);
}

/**
 * Setup sensor input listeners
 */
function setupSensorListeners() {
  const sensors = [
    { id: 'temperature', valueId: 'tempValue', key: 'temperature' },
    { id: 'brightness', valueId: 'brightnessValue', key: 'brightness' },
    { id: 'distance', valueId: 'distanceValue', key: 'distance' }
  ];

  sensors.forEach(({ id, valueId, key }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(valueId);
    slider.addEventListener('input', (e) => {
      display.textContent = e.target.value;
      state.sensorData[key] = parseInt(e.target.value);
      handleSensorChange(key, state.sensorData[key]);
    });
  });
}

/**
 * Check if the error indicates the group/node is no longer valid
 */
function shouldDisconnectOnError(error) {
  if (!error) return false;

  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const errorType = error.graphQLErrors[0].errorType;
    if (['GroupNotFound', 'Unauthorized', 'NodeNotFound'].includes(errorType)) {
      return true;
    }
  }

  if (error.message) {
    const message = error.message.toLowerCase();
    return message.includes('not found') ||
           message.includes('expired') ||
           message.includes('unauthorized');
  }

  return false;
}

/**
 * Whether the current group uses WebSocket protocol
 */
function isWebSocketMode() {
  return state.currentGroup && state.currentGroup.useWebSocket !== false;
}

/**
 * Handle connection to Mesh v2
 */
async function handleConnect() {
  const endpoint = document.getElementById('appsyncEndpoint').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  const domain = document.getElementById('domain').value.trim();

  if (!endpoint || !apiKey) {
    showError('configError', 'Please enter both AppSync endpoint and API key');
    return;
  }

  try {
    saveConfiguration(endpoint, apiKey);

    state.client = new MeshClient({
      endpoint,
      apiKey,
      domain: domain || null
    });

    state.currentNodeId = 'node-' + Math.random().toString(36).substr(2, 9);

    let actualDomain = domain;
    if (!actualDomain) {
      console.log('No domain specified, calling createDomain...');
      actualDomain = await state.client.createDomain();
      document.getElementById('domain').value = actualDomain;
    }

    state.connected = true;
    state.sessionStartTime = Date.now();

    startSessionTimer();

    updateUI();
    document.getElementById('currentDomain').textContent = actualDomain;
    document.getElementById('currentNodeId').textContent = state.currentNodeId;

    showSuccess('configError', 'Connected to Mesh v2!');
    console.log('Connected:', { endpoint, domain: actualDomain, nodeId: state.currentNodeId });
  } catch (error) {
    showError('configError', 'Connection failed: ' + error.message);
    console.error('Connection error:', error);
  }
}

/**
 * Handle create group
 */
async function handleCreateGroup() {
  const groupName = document.getElementById('groupName').value.trim();
  const domain = document.getElementById('domain').value.trim();
  const useWebSocket = document.getElementById('protocolWebSocket').checked;

  if (!groupName) {
    showError('groupError', 'Please enter a group name');
    return;
  }

  try {
    const group = await state.client.createGroup(
      groupName,
      state.currentNodeId,
      domain || null,
      useWebSocket
    );

    console.log('Group created:', group);

    state.currentGroup = group;
    if (group.heartbeatIntervalSeconds) {
      state.heartbeatIntervalSeconds = group.heartbeatIntervalSeconds;
    }
    if (group.pollingIntervalSeconds) {
      state.pollingIntervalSeconds = group.pollingIntervalSeconds;
    }

    // Initialize sensor data for this node
    const initialData = [
      { key: 'temperature', value: state.sensorData.temperature.toString() },
      { key: 'brightness', value: state.sensorData.brightness.toString() },
      { key: 'distance', value: state.sensorData.distance.toString() }
    ];

    await state.client.reportDataByNode(
      state.currentNodeId,
      state.currentGroup.id,
      state.currentGroup.domain,
      initialData
    );

    // Start communication based on protocol
    if (isWebSocketMode()) {
      startWebSocketMode();
    } else {
      startPollingMode();
    }

    startHeartbeat();

    showSuccess('groupSuccess', `Group created: ${group.fullId} (${isWebSocketMode() ? 'WebSocket' : 'Polling'})`);
    updateCurrentGroupUI();

    await handleListGroups();
  } catch (error) {
    showError('groupError', 'Failed to create group: ' + error.message);
    console.error('Create group error:', error);
  }
}

/**
 * Start WebSocket mode (subscription-based)
 */
function startWebSocketMode() {
  state.messageSubscriptionId = state.client.subscribeToMessageInGroup(
    state.currentGroup.id,
    state.currentGroup.domain,
    {
      onDataUpdate: displayOtherNodesData,
      onBatchEvent: handleBatchEventReceived,
      onGroupDissolve: handleGroupDissolved
    }
  );
  console.log('WebSocket mode started');
}

/**
 * Start Polling mode (getEventsSince + listGroupStatuses polling)
 */
function startPollingMode() {
  state.pollingSince = new Date().toISOString();

  const intervalMs = state.pollingIntervalSeconds * 1000;

  // Poll for events
  state.pollingTimerId = setInterval(async () => {
    if (!state.currentGroup || !state.connected) {
      stopPolling();
      return;
    }

    try {
      const events = await state.client.getEventsSince(
        state.currentGroup.id,
        state.currentGroup.domain,
        state.pollingSince
      );

      if (events && events.length > 0) {
        const lastEvent = events[events.length - 1];
        if (lastEvent.cursor) {
          state.pollingSince = lastEvent.cursor;
        }

        events.forEach(event => addEventToHistory(event));

        const nodeIds = [...new Set(events.map(e => e.firedByNodeId))];
        showSuccess('eventSuccess', `Polled ${events.length} events from ${nodeIds.join(', ')}`);
      }

      document.getElementById('lastPollTime').textContent = new Date().toLocaleTimeString();
    } catch (error) {
      console.error('Polling error:', error);
      if (shouldDisconnectOnError(error)) {
        handleGroupDissolved({ message: 'Connection lost (polling)' });
      }
    }
  }, intervalMs);

  // Also poll for sensor data updates
  state.sensorPollingTimerId = setInterval(async () => {
    if (!state.currentGroup || !state.connected) return;

    try {
      const statuses = await state.client.listGroupStatuses(
        state.currentGroup.id,
        state.currentGroup.domain
      );
      displayOtherNodesData(statuses);
    } catch (error) {
      console.error('Sensor polling error:', error);
      if (shouldDisconnectOnError(error)) {
        handleGroupDissolved({ message: 'Connection lost (polling)' });
      }
    }
  }, intervalMs);

  console.log(`Polling mode started (interval: ${state.pollingIntervalSeconds}s)`);
}

/**
 * Stop polling timers
 */
function stopPolling() {
  if (state.pollingTimerId) {
    clearInterval(state.pollingTimerId);
    state.pollingTimerId = null;
  }
  if (state.sensorPollingTimerId) {
    clearInterval(state.sensorPollingTimerId);
    state.sensorPollingTimerId = null;
  }
  state.pollingSince = null;
}

/**
 * Stop all communication (subscription + polling)
 */
function stopCommunication() {
  if (state.messageSubscriptionId) {
    state.client.unsubscribe(state.messageSubscriptionId);
    state.messageSubscriptionId = null;
  }
  stopPolling();
}

/**
 * Handle list groups
 */
async function handleListGroups() {
  const domain = document.getElementById('domain').value.trim();

  try {
    const groups = await state.client.listGroupsByDomain(domain || null);
    console.log('Groups:', groups);
    displayGroupList(groups);
  } catch (error) {
    showError('groupError', 'Failed to list groups: ' + error.message);
    console.error('List groups error:', error);
  }
}

/**
 * Display group list in UI
 */
function displayGroupList(groups) {
  const groupList = document.getElementById('groupList');

  if (!groups || groups.length === 0) {
    groupList.innerHTML = '<p style="color: #999; text-align: center;">No groups available</p>';
    return;
  }

  groupList.innerHTML = groups.map(group => `
    <div class="group-item ${state.selectedGroupId === group.id ? 'selected' : ''}"
         data-group-id="${group.id}"
         data-group-name="${group.name}"
         data-group-domain="${group.domain}"
         data-host-id="${group.hostId}"
         data-expires-at="${group.expiresAt || ''}"
         data-use-websocket="${group.useWebSocket}"
         data-polling-interval="${group.pollingIntervalSeconds || ''}">
      <strong>${group.name}</strong>
      <span class="status ${group.useWebSocket ? 'connected' : 'member'}" style="float: right; font-size: 11px;">
        ${group.useWebSocket ? 'WS' : 'Poll'}
      </span><br>
      <small>ID: ${group.id} | Host: ${group.hostId}</small>
      ${group.expiresAt ? `<br><small style="color: #666;">Expires: ${new Date(group.expiresAt).toLocaleTimeString()}</small>` : ''}
    </div>
  `).join('');

  groupList.querySelectorAll('.group-item').forEach(item => {
    item.addEventListener('click', () => {
      selectGroup(
        item.dataset.groupId,
        item.dataset.groupName,
        item.dataset.groupDomain,
        item.dataset.hostId,
        item.dataset.expiresAt,
        item.dataset.useWebsocket === 'true',
        parseInt(item.dataset.pollingInterval) || null
      );
    });
  });
}

/**
 * Select a group from the list
 */
function selectGroup(groupId, groupName, domain, hostId, expiresAt, useWebSocket, pollingIntervalSeconds) {
  state.selectedGroupId = groupId;
  state.selectedGroup = { id: groupId, name: groupName, domain, hostId, expiresAt, useWebSocket, pollingIntervalSeconds };

  document.querySelectorAll('.group-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.groupId === groupId);
  });

  console.log('Selected group:', state.selectedGroup);
  updateUI();
}

/**
 * Handle join group
 */
async function handleJoinGroup() {
  if (!state.selectedGroup) {
    showError('groupError', 'Please select a group to join');
    return;
  }

  try {
    const result = await state.client.joinGroup(
      state.selectedGroup.id,
      state.currentNodeId,
      state.selectedGroup.domain
    );

    console.log('Joined group:', result);

    state.currentGroup = {
      id: state.selectedGroup.id,
      name: state.selectedGroup.name,
      domain: state.selectedGroup.domain,
      hostId: state.selectedGroup.hostId,
      fullId: `${state.selectedGroup.id}@${state.selectedGroup.domain}`,
      expiresAt: result.expiresAt,
      useWebSocket: result.useWebSocket !== undefined ? result.useWebSocket : state.selectedGroup.useWebSocket,
      pollingIntervalSeconds: result.pollingIntervalSeconds || state.selectedGroup.pollingIntervalSeconds
    };

    if (result.heartbeatIntervalSeconds) {
      state.heartbeatIntervalSeconds = result.heartbeatIntervalSeconds;
    }
    if (state.currentGroup.pollingIntervalSeconds) {
      state.pollingIntervalSeconds = state.currentGroup.pollingIntervalSeconds;
    }

    // Initialize sensor data
    const initialData = [
      { key: 'temperature', value: state.sensorData.temperature.toString() },
      { key: 'brightness', value: state.sensorData.brightness.toString() },
      { key: 'distance', value: state.sensorData.distance.toString() }
    ];

    await state.client.reportDataByNode(
      state.currentNodeId,
      state.currentGroup.id,
      state.currentGroup.domain,
      initialData
    );

    if (isWebSocketMode()) {
      startWebSocketMode();
    } else {
      startPollingMode();
    }

    stopHeartbeat();
    startHeartbeat();

    showSuccess('groupSuccess', `Joined group: ${state.selectedGroup.name} (${isWebSocketMode() ? 'WebSocket' : 'Polling'})`);
    updateCurrentGroupUI();
  } catch (error) {
    showError('groupError', 'Failed to join group: ' + error.message);
    console.error('Join group error:', error);
  }
}

/**
 * Handle leave group
 */
async function handleLeaveGroup() {
  if (!state.currentGroup) {
    showError('groupError', 'Not in a group');
    return;
  }

  try {
    await state.client.leaveGroup(
      state.currentGroup.id,
      state.currentNodeId,
      state.currentGroup.domain
    );

    stopCommunication();
    stopHeartbeat();

    state.currentGroup = null;
    state.selectedGroupId = null;
    displayOtherNodesData(null);

    showSuccess('groupSuccess', 'Left group successfully');
    updateCurrentGroupUI();
    await handleListGroups();
  } catch (error) {
    showError('groupError', 'Failed to leave group: ' + error.message);
    console.error('Leave group error:', error);
  }
}

/**
 * Handle dissolve group (host only)
 */
async function handleDissolveGroup() {
  if (!state.currentGroup) {
    showError('groupError', 'Not in a group');
    return;
  }

  const isHost = state.currentGroup.hostId === state.currentNodeId;
  if (!isHost) {
    showError('groupError', 'Only the host can dissolve the group');
    return;
  }

  if (!confirm('Are you sure you want to dissolve this group? All members will be removed.')) {
    return;
  }

  try {
    await state.client.dissolveGroup(
      state.currentGroup.id,
      state.currentNodeId,
      state.currentGroup.domain
    );

    stopCommunication();
    stopHeartbeat();

    state.currentGroup = null;
    state.selectedGroupId = null;
    displayOtherNodesData(null);

    showSuccess('groupSuccess', 'Group dissolved successfully');
    updateCurrentGroupUI();
    await handleListGroups();
  } catch (error) {
    showError('groupError', 'Failed to dissolve group: ' + error.message);
    console.error('Dissolve group error:', error);
  }
}

/**
 * Handle disconnect
 */
async function handleDisconnect() {
  if (!state.connected) return;

  if (!confirm('Are you sure you want to disconnect? You will leave the current group.')) return;

  try {
    const isHost = state.currentGroup && state.currentGroup.hostId === state.currentNodeId;

    if (isHost) {
      await state.client.dissolveGroup(state.currentGroup.id, state.currentNodeId, state.currentGroup.domain);
    } else if (state.currentGroup) {
      await state.client.leaveGroup(state.currentGroup.id, state.currentNodeId, state.currentGroup.domain);
    }

    stopCommunication();
    if (state.sessionTimerId) {
      clearInterval(state.sessionTimerId);
      state.sessionTimerId = null;
    }
    stopHeartbeat();

    state.currentGroup = null;
    state.selectedGroupId = null;
    state.connected = false;
    state.currentNodeId = null;
    state.sessionStartTime = null;

    const timerEl = document.getElementById('sessionTimer');
    timerEl.textContent = 'Session: --:--';
    timerEl.classList.remove('warning');

    displayOtherNodesData(null);
    document.getElementById('groupList').innerHTML =
      '<p style="color: #999; text-align: center;">No groups available</p>';

    showSuccess('groupSuccess', 'Disconnected successfully');
    updateCurrentGroupUI();
    updateUI();
  } catch (error) {
    showError('groupError', 'Failed to disconnect: ' + error.message);
    console.error('Disconnect error:', error);
  }
}

/**
 * Update current group UI
 */
function updateCurrentGroupUI() {
  const currentGroupInfo = document.getElementById('currentGroupInfo');

  if (!state.currentGroup) {
    currentGroupInfo.innerHTML = '<p><strong>Status:</strong> Not in a group</p>';
    document.getElementById('pollingStatus').style.display = 'none';
    updateUI();
    return;
  }

  const isHost = state.currentGroup.hostId === state.currentNodeId;
  const protocol = isWebSocketMode() ? 'WebSocket' : 'Polling';

  currentGroupInfo.innerHTML = `
    <p><strong>Group:</strong> ${state.currentGroup.name}</p>
    <p><strong>Full ID:</strong> ${state.currentGroup.fullId || state.currentGroup.id}</p>
    <p><strong>Role:</strong> <span class="status ${isHost ? 'host' : 'member'}">${isHost ? 'Host' : 'Member'}</span></p>
    <p><strong>Protocol:</strong> <span class="status ${isWebSocketMode() ? 'connected' : 'member'}">${protocol}</span></p>
    ${!isWebSocketMode() ? `<p><strong>Polling Interval:</strong> ${state.pollingIntervalSeconds}s</p>` : ''}
    ${state.currentGroup.expiresAt ? `<p><strong>Expires At:</strong> ${new Date(state.currentGroup.expiresAt).toLocaleString()}</p>` : ''}
  `;

  document.getElementById('pollingStatus').style.display = isWebSocketMode() ? 'none' : 'block';

  updateUI();
}

/**
 * Handle sensor change
 */
async function handleSensorChange(sensorName, value) {
  if (!state.connected || !state.currentGroup) return;
  if (!sensorChangeDetector.hasChanged(sensorName, value)) return;
  if (!sensorRateLimiter.canMakeCall()) {
    console.warn('Sensor data rate limit exceeded');
    return;
  }

  try {
    await state.client.reportDataByNode(
      state.currentNodeId,
      state.currentGroup.id,
      state.currentGroup.domain,
      [{ key: sensorName, value: value.toString() }]
    );
    console.log('Sensor data sent:', { sensorName, value });
    updateRateStatus();
  } catch (error) {
    showError('sensorError', 'Failed to send sensor data: ' + error.message);
    if (shouldDisconnectOnError(error)) {
      handleGroupDissolved({ message: 'Connection lost' });
    }
  }
}

/**
 * Handle send single event
 */
async function handleSendEvent() {
  if (!state.currentGroup) {
    showError('eventError', 'Not in a group');
    return;
  }

  const name = document.getElementById('eventName').value.trim();
  const payload = document.getElementById('eventPayload').value.trim();

  if (!name) {
    showError('eventError', 'Please enter an event name');
    return;
  }

  if (!eventRateLimiter.canMakeCall()) {
    showError('eventError', 'Event rate limit exceeded (2 per second)');
    return;
  }

  const events = [
    { eventName: name, payload: payload || null, firedAt: new Date().toISOString() }
  ];

  try {
    if (isWebSocketMode()) {
      await state.client.fireEventsByNode(
        state.currentNodeId, state.currentGroup.id, state.currentGroup.domain, events
      );
    } else {
      const result = await state.client.recordEventsByNode(
        state.currentNodeId, state.currentGroup.id, state.currentGroup.domain, events
      );
      if (result.nextSince) {
        state.pollingSince = result.nextSince;
      }
    }

    showSuccess('eventSuccess', `Sent event: ${name} (${isWebSocketMode() ? 'WS' : 'Poll'})`);
    document.getElementById('eventName').value = '';
    document.getElementById('eventPayload').value = '';
  } catch (error) {
    showError('eventError', `Failed to send event: ${error.message}`);
    if (shouldDisconnectOnError(error)) {
      handleGroupDissolved({ message: 'Connection lost' });
    }
  }
}

function addEventToHistory(event) {
  state.eventHistory.unshift(event);
  if (state.eventHistory.length > 20) {
    state.eventHistory = state.eventHistory.slice(0, 20);
  }
  displayEventHistory();
}

function displayEventHistory() {
  const eventHistory = document.getElementById('eventHistory');

  if (state.eventHistory.length === 0) {
    eventHistory.innerHTML = '<p style="color: #999; text-align: center;">No events yet</p>';
    return;
  }

  eventHistory.innerHTML = state.eventHistory.map(event => `
    <div class="event-item">
      <div class="event-name">${event.name}</div>
      <div>From: ${event.firedByNodeId}</div>
      ${event.payload ? `<div>Payload: ${event.payload}</div>` : ''}
      <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
    </div>
  `).join('');
}

function handleClearEvents() {
  state.eventHistory = [];
  displayEventHistory();
}

function handleBatchEventReceived(batchEvent) {
  if (!batchEvent || !batchEvent.events) return;
  batchEvent.events.forEach(event => addEventToHistory(event));
  showSuccess('eventSuccess', `Received batch of ${batchEvent.events.length} events from ${batchEvent.firedByNodeId}`);
}

function handleGroupDissolved(dissolveData) {
  console.log('Group has been dissolved:', dissolveData);

  stopCommunication();
  stopHeartbeat();

  state.currentGroup = null;
  state.selectedGroupId = null;

  displayOtherNodesData(null);
  updateCurrentGroupUI();

  showError('groupError', `Group has been dissolved: ${dissolveData.message}`);
}

function displayOtherNodesData(statuses) {
  const otherNodesData = document.getElementById('otherNodesData');

  if (!statuses || statuses.length === 0) {
    otherNodesData.innerHTML = '<p style="color: #999; text-align: center;">No other nodes in group</p>';
    return;
  }

  const otherNodes = statuses.filter(status => status.nodeId !== state.currentNodeId);

  if (otherNodes.length === 0) {
    otherNodesData.innerHTML = '<p style="color: #999; text-align: center;">No other nodes in group</p>';
    return;
  }

  otherNodesData.innerHTML = otherNodes.map(status => `
    <div class="node-data">
      <h4>Node: ${status.nodeId}</h4>
      ${status.data && status.data.length > 0 ? status.data.map(item => `
        <div><strong>${item.key}:</strong> ${item.value}</div>
      `).join('') : '<div>No data</div>'}
      <div style="color: #999; font-size: 11px; margin-top: 5px;">
        Updated: ${new Date(status.timestamp).toLocaleTimeString()}
      </div>
    </div>
  `).join('');
}

function updateRateStatus() {
  document.getElementById('sensorRateStatus').textContent =
    `${sensorRateLimiter.getCallCount()}/4 per second`;
}

function startHeartbeat() {
  if (state.heartbeatTimerId) clearInterval(state.heartbeatTimerId);

  console.log(`Starting heartbeat timer (${state.heartbeatIntervalSeconds}s)...`);
  document.getElementById('heartbeatStatus').style.display = 'block';

  state.heartbeatTimerId = setInterval(async () => {
    if (!state.currentGroup || !state.connected) {
      stopHeartbeat();
      return;
    }

    const isHost = state.currentGroup.hostId === state.currentNodeId;

    try {
      const result = isHost
        ? await state.client.renewHeartbeat(state.currentGroup.id, state.currentNodeId, state.currentGroup.domain)
        : await state.client.sendMemberHeartbeat(state.currentGroup.id, state.currentNodeId, state.currentGroup.domain);

      document.getElementById('lastHeartbeatTime').textContent = new Date().toLocaleTimeString();

      if (result.expiresAt) {
        state.currentGroup.expiresAt = result.expiresAt;
      }

      if (result.heartbeatIntervalSeconds && result.heartbeatIntervalSeconds !== state.heartbeatIntervalSeconds) {
        console.log(`Heartbeat interval changed: ${state.heartbeatIntervalSeconds}s -> ${result.heartbeatIntervalSeconds}s`);
        state.heartbeatIntervalSeconds = result.heartbeatIntervalSeconds;
        startHeartbeat();
      }
    } catch (error) {
      console.error('Heartbeat failed:', error);
      if (shouldDisconnectOnError(error)) {
        handleGroupDissolved({ message: 'Session expired or group lost' });
      }
    }
  }, state.heartbeatIntervalSeconds * 1000);
}

function stopHeartbeat() {
  if (state.heartbeatTimerId) {
    clearInterval(state.heartbeatTimerId);
    state.heartbeatTimerId = null;
    document.getElementById('heartbeatStatus').style.display = 'none';
  }
}

function startSessionTimer() {
  if (state.sessionTimerId) clearInterval(state.sessionTimerId);

  state.sessionTimerId = setInterval(() => {
    let remaining;

    if (state.currentGroup && state.currentGroup.expiresAt) {
      remaining = new Date(state.currentGroup.expiresAt).getTime() - Date.now();
    } else if (state.sessionStartTime) {
      // Fallback: 35 minutes (matches prod MESH_MAX_CONNECTION_TIME_SECONDS=2100)
      remaining = (35 * 60 * 1000) - (Date.now() - state.sessionStartTime);
    } else {
      return;
    }

    if (remaining <= 0) {
      handleSessionTimeout();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    const timerEl = document.getElementById('sessionTimer');
    timerEl.textContent = `Session: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    timerEl.classList.toggle('warning', remaining <= 5 * 60 * 1000);
  }, 1000);
}

function handleSessionTimeout() {
  alert('Session timeout. Please reconnect.');

  if (state.currentGroup) {
    const isHost = state.currentGroup.hostId === state.currentNodeId;
    if (isHost) {
      handleDissolveGroup().catch(console.error);
    } else {
      state.currentGroup = null;
    }
  }

  stopHeartbeat();
  stopCommunication();

  if (state.client) state.client.disconnect();

  state.connected = false;
  state.sessionStartTime = null;
  updateUI();
}

function updateUI() {
  const connected = state.connected;
  const inGroup = connected && state.currentGroup;

  const statusEl = document.getElementById('connectionStatus');
  statusEl.textContent = connected ? 'Connected' : 'Disconnected';
  statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;

  document.getElementById('disconnectBtn').style.display = connected ? 'block' : 'none';

  document.getElementById('createGroupBtn').disabled = !connected;
  document.getElementById('listGroupsBtn').disabled = !connected;
  document.getElementById('joinGroupBtn').disabled = !connected || !state.selectedGroupId;

  const isHost = inGroup && state.currentGroup.hostId === state.currentNodeId;
  document.getElementById('dissolveGroupBtn').disabled = !isHost;

  const leaveBtn = document.getElementById('leaveGroupBtn');
  leaveBtn.style.display = (inGroup && !isHost) ? 'inline-block' : 'none';

  document.getElementById('sendEventBtn').disabled = !inGroup;

  updateRateStatus();
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
