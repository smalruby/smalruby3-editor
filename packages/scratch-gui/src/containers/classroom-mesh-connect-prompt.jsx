import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MESH_V2_EXTENSION_ID, readMeshState, shouldShowMeshConnectNow } from '../lib/classroom-mesh-connect.js';
import { clearMeshConnectRequest } from '../reducers/classroom.js';
import { setConnectionModalExtensionId } from '../reducers/connection-modal.js';
import { openConnectionModal } from '../reducers/modals.js';

/**
 * Opens the mesh connection modal requested by a class load (#1251), the
 * same way the extension's connect button does (blocks.jsx). Waits while a
 * classroom modal is open so the two modals never overlap: the choice row
 * closes the modal right after loading, while the assignment panel's
 * "Open the Starter Project" keeps it open — the connection modal then shows
 * once the student closes the panel. The request is cleared as it opens, so
 * closing the connection modal does not bring it back until the next load;
 * a request that finds mesh already connected is dropped.
 * @returns {null} renders nothing
 */
const ClassroomMeshConnectPrompt = () => {
    const dispatch = useDispatch();
    const vm = useSelector((state) => state.scratchGui.vm);
    const pending = useSelector((state) => !!state.scratchGui.classroom?.meshConnectPending);
    const classroomModalVisible = useSelector((state) => !!state.scratchGui.classroom?.modalVisible);
    const teacherModalVisible = useSelector((state) => !!state.scratchGui.classroom?.teacherModalVisible);
    const connectionModalVisible = useSelector((state) => !!state.scratchGui.modals.connectionModal);

    useEffect(() => {
        if (
            !shouldShowMeshConnectNow({ pending, classroomModalVisible, teacherModalVisible, connectionModalVisible })
        ) {
            return;
        }
        dispatch(clearMeshConnectRequest());
        if (readMeshState(vm).meshConnected) return;
        dispatch(setConnectionModalExtensionId(MESH_V2_EXTENSION_ID));
        dispatch(openConnectionModal());
    }, [pending, classroomModalVisible, teacherModalVisible, connectionModalVisible, vm, dispatch]);

    return null;
};

export default ClassroomMeshConnectPrompt;
