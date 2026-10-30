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

// computeBoundSeat runs in mapStateToProps, so it returns the same object while
// the seat is unchanged; a new object each time would re-render the connection
// modal on every store update (e.g. monitor updates of a running project).
let lastBoundSeat = null;
const boundSeatOf = (seat, teacher) => {
    if (!lastBoundSeat || lastBoundSeat.seat !== seat || lastBoundSeat.teacher !== teacher) {
        lastBoundSeat = { seat, teacher };
    }
    return lastBoundSeat;
};

/**
 * Derive the classroom seat that goes into the mesh node id and group name.
 * @param {object} classroom - state.scratchGui.classroom
 * @returns {?{seat: ?number, teacher: boolean}} the student's seat, `teacher: true`
 *   for a teacher with a selected class, or null outside a class
 */
const computeBoundSeat = (classroom) => {
    if (!classroom) return null;
    if (classroom.role === 'student' && classroom.joinCode) {
        return Number.isInteger(classroom.seatNumber) && classroom.seatNumber > 0
            ? boundSeatOf(classroom.seatNumber, false)
            : null;
    }
    if (classroom.teacherSelection && classroom.teacherSelection.joinCode) {
        return boundSeatOf(null, true);
    }
    return null;
};

/**
 * Hand the classroom seat to the meshV2 extension (no-op if it is not loaded).
 * The extension ignores it while connected, since a node id must not change
 * inside a group.
 * @param {object} vm - the VM
 * @param {?{seat: ?number, teacher: boolean}} seat - see computeBoundSeat
 */
const applySeatToExtension = (vm, seat) => {
    const ext = vm && vm.runtime && vm.runtime.peripheralExtensions ? vm.runtime.peripheralExtensions.meshV2 : null;
    if (!ext || typeof ext.setClassroomSeat !== 'function') return;
    ext.setClassroomSeat(seat);
};

const MeshV2ClassroomBinding = ({ boundDomain, boundSeat, currentDomain, vm, dispatch }) => {
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

    const seatSeat = boundSeat ? boundSeat.seat : null;
    const seatTeacher = boundSeat ? boundSeat.teacher : false;
    // boundSeat is a new object on every render, so depend on its fields.
    useEffect(() => {
        applySeatToExtension(vm, seatSeat || seatTeacher ? { seat: seatSeat, teacher: seatTeacher } : null);
    }, [seatSeat, seatTeacher, vm]);
    return null;
};

MeshV2ClassroomBinding.propTypes = {
    boundDomain: PropTypes.string,
    boundSeat: PropTypes.shape({
        seat: PropTypes.number,
        teacher: PropTypes.bool,
    }),
    currentDomain: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    boundDomain: computeBoundDomain(state.scratchGui.classroom),
    boundSeat: computeBoundSeat(state.scratchGui.classroom),
    currentDomain: state.scratchGui.meshV2.domain,
    vm: state.scratchGui.vm,
});

export { applySeatToExtension, computeBoundDomain, computeBoundSeat };
export default connect(mapStateToProps)(MeshV2ClassroomBinding);
