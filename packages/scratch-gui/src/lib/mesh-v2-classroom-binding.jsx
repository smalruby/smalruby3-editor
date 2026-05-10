import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { setDomain as setMeshV2Domain } from '../reducers/mesh-v2.js';

/**
 * Derive the Mesh v2 domain that should be bound to the current classroom state.
 * @param {object} classroom - state.scratchGui.classroom
 * @returns {string|null} lowercase join code, or null when unbound
 */
const computeBoundDomain = (classroom) => {
    if (!classroom) return null;
    if (classroom.role === 'student' && classroom.joinCode) {
        return String(classroom.joinCode).toLowerCase();
    }
    if (classroom.teacherSelection && classroom.teacherSelection.joinCode) {
        return String(classroom.teacherSelection.joinCode).toLowerCase();
    }
    return null;
};

const MeshV2ClassroomBinding = ({ boundDomain, currentDomain, vm, dispatch }) => {
    // Stash the pre-bind domain so that when the binding releases (teacher logs
    // out / student leaves the class), we can restore the domain the user had
    // before joining instead of leaving the join code stuck in the input.
    const stashedDomainRef = useRef(null);
    const wasBoundRef = useRef(false);

    useEffect(() => {
        const applyToExtension = (value) => {
            const ext =
                vm && vm.runtime && vm.runtime.peripheralExtensions ? vm.runtime.peripheralExtensions.meshV2 : null;
            if (!ext || typeof ext.setDomain !== 'function') return;
            try {
                ext.setDomain(value);
            } catch (_e) {
                // setDomain throws while connected; the runtime keeps its current domain.
            }
        };

        if (boundDomain) {
            if (!wasBoundRef.current) {
                stashedDomainRef.current = currentDomain || null;
                wasBoundRef.current = true;
            }
            if (currentDomain !== boundDomain) {
                dispatch(setMeshV2Domain(boundDomain));
            }
            applyToExtension(boundDomain);
        } else if (wasBoundRef.current) {
            const restore = stashedDomainRef.current;
            stashedDomainRef.current = null;
            wasBoundRef.current = false;
            if (currentDomain !== restore) {
                dispatch(setMeshV2Domain(restore));
            }
            applyToExtension(restore);
        }
    }, [boundDomain, currentDomain, vm, dispatch]);
    return null;
};

MeshV2ClassroomBinding.propTypes = {
    boundDomain: PropTypes.string,
    currentDomain: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    boundDomain: computeBoundDomain(state.scratchGui.classroom),
    currentDomain: state.scratchGui.meshV2.domain,
    vm: state.scratchGui.vm,
});

export { computeBoundDomain };
export default connect(mapStateToProps)(MeshV2ClassroomBinding);
