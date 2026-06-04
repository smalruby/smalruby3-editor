import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import MeshSelfSensorNotice from '../components/mesh-self-sensor-notice/mesh-self-sensor-notice.jsx';
import { hasSensorValueCollision } from '../lib/mesh-v2-sensor-collision.js';
import { hideMeshV2SelfSensorNotice, showMeshV2SelfSensorNotice } from '../reducers/mesh-v2.js';

// Shown at most once per browser (Issue #707). Once shown we never check again.
const SHOWN_KEY = 'smalruby:meshSelfSensorNoticeShown';

const alreadyShown = () => {
    try {
        return (
            typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem(SHOWN_KEY) === 'true'
        );
    } catch (_e) {
        return false;
    }
};

const markShown = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(SHOWN_KEY, 'true');
    } catch (_e) {
        // localStorage unavailable (private mode etc.) — fall back to per-session.
    }
};

// Always-mounted container. While the one-time notice has not yet been shown, it
// watches the VM for any change that could introduce a collision between a global
// variable name and a Mesh v2 "sensor value" lookup (project load, variable
// add/rename, sensor dropdown change, Ruby tab edit — all surface as
// PROJECT_LOADED / PROJECT_CHANGED), and shows the notice the first time one is found.
const MeshSelfSensorNoticeContainer = ({ vm, isOpen, onShow, onHide }) => {
    const onShowRef = useRef(onShow);
    onShowRef.current = onShow;

    useEffect(() => {
        if (!vm || alreadyShown()) return () => {};
        let timer = null;
        let detached = false;

        const detach = () => {
            if (timer) clearTimeout(timer);
            timer = null;
            vm.off('PROJECT_LOADED', schedule);
            vm.off('PROJECT_CHANGED', schedule);
            detached = true;
        };

        const run = () => {
            if (detached) return;
            if (hasSensorValueCollision(vm)) {
                markShown();
                onShowRef.current();
                detach();
            }
        };

        // PROJECT_CHANGED fires on every edit; debounce so we check once per burst.
        const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(run, 300);
        };

        vm.on('PROJECT_LOADED', schedule);
        vm.on('PROJECT_CHANGED', schedule);
        // Also check the current project once (it may already be loaded with a collision).
        schedule();

        return detach;
    }, [vm]);

    const handleDismiss = useCallback(() => onHide(), [onHide]);

    return <MeshSelfSensorNotice onDismiss={handleDismiss} visible={isOpen} />;
};

MeshSelfSensorNoticeContainer.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    onShow: PropTypes.func.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    isOpen: Boolean(state.scratchGui.meshV2.selfSensorNoticeVisible),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onShow: () => dispatch(showMeshV2SelfSensorNotice()),
    onHide: () => dispatch(hideMeshV2SelfSensorNotice()),
});

export default connect(mapStateToProps, mapDispatchToProps)(MeshSelfSensorNoticeContainer);
