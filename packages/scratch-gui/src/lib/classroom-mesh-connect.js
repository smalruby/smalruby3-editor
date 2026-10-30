/**
 * Open the mesh connection modal after a class project that uses mesh has
 * loaded (#1251). Students otherwise had to find the mesh connect button
 * themselves, which stalled lessons.
 *
 * The decision is split in two steps so the modals never overlap:
 * shouldPromptMeshConnect decides right after the load whether to ask, and
 * the request waits in Redux until shouldShowMeshConnectNow says no other
 * modal is in the way (e.g. the assignment panel stays open after
 * "Open the Starter Project").
 */

const MESH_V2_EXTENSION_ID = 'meshV2';

/** Loads made by the student's class flow (use-student-assignment.js). */
const CLASSROOM_LOAD_SOURCES = ['starter', 'previous', 'current'];

/**
 * Whether a finished load should ask to connect to mesh.
 * @param {object} params - load result
 * @param {?string} params.source - where the project came from ('starter' | 'previous' | 'current')
 * @param {boolean} params.meshLoaded - the loaded project uses the mesh v2 extension
 *     (includes projects migrated from mesh v1)
 * @param {boolean} params.meshConnected - mesh is already connected
 * @returns {boolean} true to request the connection modal
 */
const shouldPromptMeshConnect = ({ source, meshLoaded, meshConnected }) =>
    CLASSROOM_LOAD_SOURCES.includes(source) && !!meshLoaded && !meshConnected;

/**
 * Whether a pending request can be turned into the open connection modal now.
 * @param {object} params - current UI state
 * @param {boolean} params.pending - a load requested the connection modal
 * @param {boolean} [params.classroomModalVisible] - student classroom modal is open
 * @param {boolean} [params.teacherModalVisible] - teacher classroom modal is open
 * @param {boolean} [params.connectionModalVisible] - a connection modal is already open
 * @returns {boolean} true to open the connection modal now
 */
const shouldShowMeshConnectNow = ({ pending, classroomModalVisible, teacherModalVisible, connectionModalVisible }) =>
    !!pending && !classroomModalVisible && !teacherModalVisible && !connectionModalVisible;

/**
 * Read the mesh state of the project just loaded into the VM.
 * @param {object} vm - Scratch VM instance
 * @returns {{meshLoaded: boolean, meshConnected: boolean}} mesh state
 */
const readMeshState = (vm) => {
    const meshLoaded =
        typeof vm?.extensionManager?.isExtensionLoaded === 'function' &&
        !!vm.extensionManager.isExtensionLoaded(MESH_V2_EXTENSION_ID);
    const meshConnected =
        meshLoaded &&
        typeof vm.getPeripheralIsConnected === 'function' &&
        !!vm.getPeripheralIsConnected(MESH_V2_EXTENSION_ID);
    return { meshLoaded, meshConnected };
};

export {
    CLASSROOM_LOAD_SOURCES,
    MESH_V2_EXTENSION_ID,
    readMeshState,
    shouldPromptMeshConnect,
    shouldShowMeshConnectNow,
};
