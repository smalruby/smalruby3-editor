/**
 * Mesh v2 Client Application Logic
 * Handles UI interactions and state management
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
  heartbeatIntervalSeconds: 60, // Default 60 seconds
  messageSubscriptionId: null,
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
  // Temperature
  const tempSlider = document.getElementById('temperature');
  const tempValue = document.getElementById('tempValue');
  tempSlider.addEventListener('input', (e) => {
    tempValue.textContent = e.target.value;
    state.sensorData.temperature = parseInt(e.target.value);
    handleSensorChange('temperature', state.sensorData.temperature);
  });

  // Brightness
  const brightnessSlider = document.getElementById('brightness');
  const brightnessValue = document.getElementById('brightnessValue');
  brightnessSlider.addEventListener('input', (e) => {
    brightnessValue.textContent = e.target.value;
    state.sensorData.brightness = parseInt(e.target.value);
    handleSensorChange('brightness', state.sensorData.brightness);
  });

  // Distance
  const distanceSlider = document.getElementById('distance');
  const distanceValue = document.getElementById('distanceValue');
  distanceSlider.addEventListener('input', (e) => {
    distanceValue.textContent = e.target.value;
    state.sensorData.distance = parseInt(e.target.value);
    handleSensorChange('distance', state.sensorData.distance);
  });
}

/**
 * Check if the error indicates the group/node is no longer valid
 * @param {Error} error - The error to check
 * @returns {boolean} true if should disconnect
 */
function shouldDisconnectOnError(error) {
  if (!error) return false;

  // Check GraphQL errorType if available
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const errorType = error.graphQLErrors[0].errorType;
    if (['GroupNotFound', 'Unauthorized', 'NodeNotFound'].includes(errorType)) {
      return true;
    }
  }

  // Fallback: check message string
  if (error.message) {
    const message = error.message.toLowerCase();
    return message.includes('not found') || 
           message.includes('expired') || 
           message.includes('unauthorized');
  }

  return false;
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
    // Save configuration
    saveConfiguration(endpoint, apiKey);

    // Create client
    state.client = new MeshClient({
      endpoint,
      apiKey,
      domain: domain || null
    });

    // Generate node ID
    state.currentNodeId = 'node-' + Math.random().toString(36).substr(2, 9);

    let actualDomain = domain;
    if (!actualDomain) {
      console.log('No domain specified, calling createDomain...');
      actualDomain = await state.client.createDomain();
      document.getElementById('domain').value = actualDomain;
    }

    // Mark as connected
    state.connected = true;
    state.sessionStartTime = Date.now();

    // Start session timer
    startSessionTimer();

    // Update UI
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

  if (!groupName) {
    showError('groupError', 'Please enter a group name');
    return;
  }

  try {
    const group = await state.client.createGroup(
      groupName,
      state.currentNodeId,
      domain || null
    );

    console.log('Group created:', group);

    // Join the created group automatically
    state.currentGroup = group;
    if (group.heartbeatIntervalSeconds) {
      state.heartbeatIntervalSeconds = group.heartbeatIntervalSeconds;
    }

    // Initialize sensor data for this node
    // This immediately shares current sensor state with other group members
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

    // Subscribe to all group messages via unified subscription
    state.messageSubscriptionId = state.client.subscribeToMessageInGroup(
      state.currentGroup.id,
      state.currentGroup.domain,
      {
        onDataUpdate: displayOtherNodesData,
        onBatchEvent: handleBatchEventReceived,
        onGroupDissolve: handleGroupDissolved
      }
    );

    // Start heartbeat for host
    startHeartbeat();

    showSuccess('groupSuccess', `Group created: ${group.fullId}`);
    updateCurrentGroupUI();

    // Refresh group list
    await handleListGroups();
  } catch (error) {
    showError('groupError', 'Failed to create group: ' + error.message);
    console.error('Create group error:', error);
  }
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
         data-expires-at="${group.expiresAt || ''}">
      <strong>${group.name}</strong><br>
      <small>ID: ${group.id} | Host: ${group.hostId}</small>
      ${group.expiresAt ? `<br><small style="color: #666;">Expires: ${new Date(group.expiresAt).toLocaleTimeString()}</small>` : ''}
    </div>
  `).join('');

  // Add click listeners to all group items
  groupList.querySelectorAll('.group-item').forEach(item => {
    item.addEventListener('click', () => {
      const groupId = item.dataset.groupId;
      const groupName = item.dataset.groupName;
      const domain = item.dataset.groupDomain;
      const hostId = item.dataset.hostId;
      const expiresAt = item.dataset.expiresAt;
      selectGroup(groupId, groupName, domain, hostId, expiresAt);
    });
  });
}

/**
 * Select a group from the list
 */
function selectGroup(groupId, groupName, domain, hostId, expiresAt) {
  state.selectedGroupId = groupId;
  state.selectedGroup = { id: groupId, name: groupName, domain, hostId, expiresAt };

  // Update UI - remove selected from all, add to clicked item
  document.querySelectorAll('.group-item').forEach(item => {
    if (item.dataset.groupId === groupId) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  console.log('Selected group:', state.selectedGroup);

  // Update button states
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

    // Use selected group info and join result (expiresAt) to set current group
    state.currentGroup = {
      id: state.selectedGroup.id,
      name: state.selectedGroup.name,
      domain: state.selectedGroup.domain,
      hostId: state.selectedGroup.hostId,
      fullId: `${state.selectedGroup.id}@${state.selectedGroup.domain}`,
      expiresAt: result.expiresAt
    };

    if (result.heartbeatIntervalSeconds) {
      state.heartbeatIntervalSeconds = result.heartbeatIntervalSeconds;
    }

    // Initialize sensor data for this node
    // This immediately shares current sensor state with other group members
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

    // Subscribe to all group messages via unified subscription
    state.messageSubscriptionId = state.client.subscribeToMessageInGroup(
      state.currentGroup.id,
      state.currentGroup.domain,
      {
        onDataUpdate: displayOtherNodesData,
        onBatchEvent: handleBatchEventReceived,
        onGroupDissolve: handleGroupDissolved
      }
    );

    // Stop heartbeat if it was running (e.g. from a previously created group)
    stopHeartbeat();
    startHeartbeat();

    showSuccess('groupSuccess', `Joined group: ${state.selectedGroup.name}`);
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
    const result = await state.client.leaveGroup(
      state.currentGroup.id,
      state.currentNodeId,
      state.currentGroup.domain
    );

    console.log('Left group:', result);

    // Unsubscribe from all group messages
    if (state.messageSubscriptionId) {
      state.client.unsubscribe(state.messageSubscriptionId);
      state.messageSubscriptionId = null;
    }

    stopHeartbeat();

    state.currentGroup = null;
    state.selectedGroupId = null;

    // Clear other nodes display
    displayOtherNodesData(null);

    showSuccess('groupSuccess', 'Left group successfully');
    updateCurrentGroupUI();

    // Refresh group list
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

  // Check if current node is host
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

    console.log('Group dissolved');

    // Unsubscribe from all group messages
    if (state.messageSubscriptionId) {
      state.client.unsubscribe(state.messageSubscriptionId);
      state.messageSubscriptionId = null;
    }

    stopHeartbeat();

    state.currentGroup = null;
    state.selectedGroupId = null;

    // Clear other nodes display
    displayOtherNodesData(null);

    showSuccess('groupSuccess', 'Group dissolved successfully');
    updateCurrentGroupUI();

    // Refresh group list
    await handleListGroups();
  } catch (error) {
    showError('groupError', 'Failed to dissolve group: ' + error.message);
    console.error('Dissolve group error:', error);
  }
}

/**
 * Handle disconnect
 * Disconnects from the mesh network and cleans up subscriptions
 */
async function handleDisconnect() {
  if (!state.connected) {
    return;
  }

  if (!confirm('Are you sure you want to disconnect? You will leave the current group.')) {
    return;
  }

  try {
    // Check if current node is host
    const isHost = state.currentGroup && state.currentGroup.hostId === state.currentNodeId;

    if (isHost) {
      // Host: dissolve the group
      await state.client.dissolveGroup(
        state.currentGroup.id,
        state.currentNodeId,
        state.currentGroup.domain
      );
      console.log('Group dissolved by disconnect');
    } else if (state.currentGroup) {
      // Member: leave the group
      await state.client.leaveGroup(
        state.currentGroup.id,
        state.currentNodeId,
        state.currentGroup.domain
      );
      console.log('Left group by disconnect');
    }

    // Unsubscribe from all group messages
    if (state.messageSubscriptionId) {
      state.client.unsubscribe(state.messageSubscriptionId);
      state.messageSubscriptionId = null;
    }

    // Stop session timer
    if (state.sessionTimerId) {
      clearInterval(state.sessionTimerId);
      state.sessionTimerId = null;
    }

    stopHeartbeat();

    // Clear state
    state.currentGroup = null;
    state.selectedGroupId = null;
    state.connected = false;
    state.currentNodeId = null;
    state.currentDomain = null;
    state.sessionStartTime = null;

    // Reset session timer display
    const timerEl = document.getElementById('sessionTimer');
    timerEl.textContent = 'Session: --:--';
    timerEl.classList.remove('warning');

    // Clear other nodes display
    displayOtherNodesData(null);

    // Clear group list
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
    updateUI();
    return;
  }

  const isHost = state.currentGroup.hostId === state.currentNodeId;

  currentGroupInfo.innerHTML = `
    <p><strong>Group:</strong> ${state.currentGroup.name}</p>
    <p><strong>Full ID:</strong> ${state.currentGroup.fullId || state.currentGroup.id}</p>
    <p><strong>Role:</strong> <span class="status ${isHost ? 'host' : 'member'}">${isHost ? 'Host' : 'Member'}</span></p>
    ${state.currentGroup.expiresAt ? `<p><strong>Expires At:</strong> ${new Date(state.currentGroup.expiresAt).toLocaleString()}</p>` : ''}
  `;

  updateUI();
}

/**
 * Handle sensor change
 */
async function handleSensorChange(sensorName, value) {
  if (!state.connected || !state.currentGroup) {
    return;
  }

  // Check if value actually changed
  if (!sensorChangeDetector.hasChanged(sensorName, value)) {
    return;
  }

  // Check rate limit
  if (!sensorRateLimiter.canMakeCall()) {
    console.warn('Sensor data rate limit exceeded');
    return;
  }

  try {
    // Send sensor data
    const data = [
      { key: sensorName, value: value.toString() }
    ];

    await state.client.reportDataByNode(
      state.currentNodeId,
      state.currentGroup.id,
      state.currentGroup.domain,
      data
    );

    console.log('Sensor data sent:', { sensorName, value });

    // Update rate status
    updateRateStatus();
  } catch (error) {
    showError('sensorError', 'Failed to send sensor data: ' + error.message);
    console.error('Sensor data error:', error);
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

  // Check rate limit
  if (!eventRateLimiter.canMakeCall()) {
    showError('eventError', 'Event rate limit exceeded (2 per second)');
    return;
  }

  const events = [
    { eventName: name, payload: payload || null, firedAt: new Date().toISOString() }
  ];

  try {
    const result = await state.client.fireEventsByNode(
      state.currentNodeId,
      state.currentGroup.id,
      state.currentGroup.domain,
      events
    );

    console.log('Event sent:', result);
    showSuccess('eventSuccess', `Sent event: ${name}`);
    
    // Clear inputs
    document.getElementById('eventName').value = '';
    document.getElementById('eventPayload').value = '';
  } catch (error) {
    console.error('Failed to send event:', error);
    showError('eventError', `Failed to send event: ${error.message}`);
    
    if (shouldDisconnectOnError(error)) {
      handleGroupDissolved({ message: 'Connection lost' });
    }
  }
}

/**
 * Add event to history
 */
function addEventToHistory(event) {
  state.eventHistory.unshift(event);

  // Keep only last 20 events
  if (state.eventHistory.length > 20) {
    state.eventHistory = state.eventHistory.slice(0, 20);
  }

  displayEventHistory();
}

/**
 * Display event history
 */
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

/**
 * Handle clear events
 */
function handleClearEvents() {
  state.eventHistory = [];
  displayEventHistory();
}

/**
 * Handle batch event received from subscription
 */
function handleBatchEventReceived(batchEvent) {
  console.log('Batch event received from subscription:', batchEvent);

  if (!batchEvent || !batchEvent.events) return;

  // Add each event to history
  batchEvent.events.forEach(event => {
    addEventToHistory(event);
  });

  showSuccess('eventSuccess', `Received batch of ${batchEvent.events.length} events from ${batchEvent.firedByNodeId}`);
}

/**
 * Handle group dissolution notification
 */
function handleGroupDissolved(dissolveData) {
  console.log('Group has been dissolved:', dissolveData);

  // Unsubscribe from all group messages
  if (state.messageSubscriptionId) {
    state.client.unsubscribe(state.messageSubscriptionId);
    state.messageSubscriptionId = null;
  }

  stopHeartbeat();
  
      // Clear group state
      state.currentGroup = null;
      state.selectedGroupId = null;
    // Clear UI
  displayOtherNodesData(null);
  updateCurrentGroupUI();

  // Show notification
  showError('groupError', `Group has been dissolved: ${dissolveData.message}`);
}

/**
 * Display other nodes' sensor data
 */
function displayOtherNodesData(statuses) {
  const otherNodesData = document.getElementById('otherNodesData');

  if (!statuses || statuses.length === 0) {
    otherNodesData.innerHTML = '<p style="color: #999; text-align: center;">No other nodes in group</p>';
    return;
  }

  // Filter out current node
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

/**
 * Update rate limit status displays
 */
function updateRateStatus() {
  document.getElementById('sensorRateStatus').textContent =
    `${sensorRateLimiter.getCallCount()}/4 per second`;
}

/**
 * Start heartbeat timer
 * Renews the group heartbeat periodically using server-provided interval
 */
function startHeartbeat() {
  if (state.heartbeatTimerId) {
    clearInterval(state.heartbeatTimerId);
  }

  console.log(`Starting heartbeat timer (${state.heartbeatIntervalSeconds}s)...`);
  document.getElementById('heartbeatStatus').style.display = 'block';

  state.heartbeatTimerId = setInterval(async () => {
    if (!state.currentGroup || !state.connected) {
      stopHeartbeat();
      return;
    }

    const isHost = state.currentGroup.hostId === state.currentNodeId;

    try {
      let result;
      if (isHost) {
        result = await state.client.renewHeartbeat(
          state.currentGroup.id,
          state.currentNodeId,
          state.currentGroup.domain
        );
        console.log('Host heartbeat renewed, expires at:', result.expiresAt);
      } else {
        result = await state.client.sendMemberHeartbeat(
          state.currentGroup.id,
          state.currentNodeId,
          state.currentGroup.domain
        );
        console.log('Member heartbeat sent, expires at:', result.expiresAt);
      }

      document.getElementById('lastHeartbeatTime').textContent = new Date().toLocaleTimeString();

      // Update session timer with new expiration if possible
      if (result.expiresAt) {
        state.currentGroup.expiresAt = result.expiresAt;
      }

      // Check if interval has changed
      if (result.heartbeatIntervalSeconds && result.heartbeatIntervalSeconds !== state.heartbeatIntervalSeconds) {
        console.log(`Heartbeat interval changed: ${state.heartbeatIntervalSeconds}s -> ${result.heartbeatIntervalSeconds}s`);
        state.heartbeatIntervalSeconds = result.heartbeatIntervalSeconds;
        startHeartbeat(); // Restart with new interval
      }
    } catch (error) {
      console.error('Heartbeat failed:', error);
      if (shouldDisconnectOnError(error)) {
        handleGroupDissolved({ message: 'Session expired or group lost' });
      }
    }
  }, state.heartbeatIntervalSeconds * 1000);
}

/**
 * Stop heartbeat timer
 */
function stopHeartbeat() {
  if (state.heartbeatTimerId) {
    console.log('Stopping heartbeat timer');
    clearInterval(state.heartbeatTimerId);
    state.heartbeatTimerId = null;
    document.getElementById('heartbeatStatus').style.display = 'none';
  }
}

/**
 * Start session timer
 * If in a group, uses expiresAt from the group.
 * Otherwise uses a default 10 minute limit from connection.
 */
function startSessionTimer() {
  // Prevent multiple timers
  if (state.sessionTimerId) {
    clearInterval(state.sessionTimerId);
  }

  state.sessionTimerId = setInterval(() => {
    let remaining;

    if (state.currentGroup && state.currentGroup.expiresAt) {
      // Use expiration from group (ISO string)
      const expiresAt = new Date(state.currentGroup.expiresAt).getTime();
      remaining = expiresAt - Date.now();
    } else if (state.sessionStartTime) {
      // Fallback to connection-based timer
      const elapsed = Date.now() - state.sessionStartTime;
      remaining = (10 * 60 * 1000) - elapsed;
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

    // Warning at 5 minutes remaining
    if (remaining <= 5 * 60 * 1000) {
      timerEl.classList.add('warning');
    } else {
      timerEl.classList.remove('warning');
    }
  }, 1000);
}

/**
 * Handle session timeout
 */
function handleSessionTimeout() {
  alert('Session timeout. Please reconnect.');

  // Dissolve group if host, otherwise just clear state
  if (state.currentGroup) {
    const isHost = state.currentGroup.hostId === state.currentNodeId;
    if (isHost) {
      // Try to dissolve group before timeout
      handleDissolveGroup().catch(console.error);
    } else {
      // Member: just clear local state
      state.currentGroup = null;
    }
  }

  // Stop heartbeat
  stopHeartbeat();

  // Disconnect
  if (state.client) {
    state.client.disconnect();
  }

  state.connected = false;
  state.sessionStartTime = null;

  updateUI();
}

/**
 * Update UI based on state
 */
function updateUI() {
  const connected = state.connected;
  const inGroup = state.connected && state.currentGroup;

  // Connection status
  const statusEl = document.getElementById('connectionStatus');
  if (connected) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'status connected';
  } else {
    statusEl.textContent = 'Disconnected';
    statusEl.className = 'status disconnected';
  }

  // Show/hide disconnect button
  const disconnectBtn = document.getElementById('disconnectBtn');
  if (connected) {
    disconnectBtn.style.display = 'block';
  } else {
    disconnectBtn.style.display = 'none';
  }

  // Enable/disable buttons
  document.getElementById('createGroupBtn').disabled = !connected;
  document.getElementById('listGroupsBtn').disabled = !connected;
  document.getElementById('joinGroupBtn').disabled = !connected || !state.selectedGroupId;

  // Dissolve button only enabled when user is host
  const isHost = inGroup && state.currentGroup && state.currentGroup.hostId === state.currentNodeId;
  document.getElementById('dissolveGroupBtn').disabled = !isHost;

  // Leave button shown when in group and not host
  const leaveBtn = document.getElementById('leaveGroupBtn');
  if (inGroup && !isHost) {
    leaveBtn.style.display = 'inline-block';
  } else {
    leaveBtn.style.display = 'none';
  }

  document.getElementById('sendEventBtn').disabled = !inGroup;

  // Update rate status
  updateRateStatus();
}

/**
 * Show error message
 */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';

  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

/**
 * Show success message
 */
function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';

  setTimeout(() => {
    el.style.display = 'none';
  }, 3000);
}