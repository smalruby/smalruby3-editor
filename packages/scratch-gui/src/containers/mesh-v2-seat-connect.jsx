// "出席番号でつながる": choose seats (screen 2), then wait and connect (screen 3).
// Every decision comes from lib/mesh-v2-seat-connect.js; this container only
// reads the class and its groups, and starts the connection the rules ask for.
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import MeshV2SeatPickStep from '../components/connection-modal/mesh-v2-seat-pick-step.jsx';
import MeshV2SeatWaitStep from '../components/connection-modal/mesh-v2-seat-wait-step.jsx';
import {
    ACTION,
    ALL_ARRIVED_CLOSE_MS,
    SEAT_STATUS,
    decideSeatAction,
    describeSeatStatuses,
    findGroupToMergeInto,
    isEveryoneHere,
    needsAloneConfirm,
    pickHostSeat,
    seatPickerState,
    toggleSeat,
} from '../lib/mesh-v2-seat-connect.js';
import { getMeshV2Extension, useSeatSnapshot } from '../lib/mesh-v2-seat-snapshot.js';

const EXTENSION_ID = 'meshV2';
const HOST_PERIPHERAL_ID = 'meshV2_host';
// The waiting screen reads the groups this often (the host switch waits 20 s).
const WAIT_POLL_MS = 3000;

const STEP = { PICK: 'pick', WAIT: 'wait' };

const isConnected = (ext) => !!(ext && ext.connectionState === 'connected' && ext.getConnectedGroupId());

const MeshV2SeatConnect = ({ joinCode, mySeat, vm, onBack, onClose }) => {
    const [step, setStep] = React.useState(STEP.PICK);
    const [chosenSeats, setChosenSeats] = React.useState([mySeat]);
    const [waitStartedAt, setWaitStartedAt] = React.useState(0);
    const [connected, setConnected] = React.useState(() => isConnected(getMeshV2Extension(vm)));
    const [error, setError] = React.useState(false);
    const [kept, setKept] = React.useState([]);
    const [aloneConfirm, setAloneConfirm] = React.useState(false);
    const [allArrived, setAllArrived] = React.useState(false);
    // Set while a create / join is in flight, so a poll does not start a second one.
    const pendingRef = React.useRef(false);
    // "待たずに始める" pressed before being connected: close once connected.
    const closeOnConnectRef = React.useRef(false);

    const snapshot = useSeatSnapshot({
        vm,
        joinCode,
        intervalMs: step === STEP.WAIT ? WAIT_POLL_MS : 0,
    });
    const { classSeats, groups, refresh } = snapshot;
    const presentSeats = classSeats ? classSeats.presentSeats : [];

    React.useEffect(() => {
        const handleConnected = () => {
            pendingRef.current = false;
            setError(false);
            setConnected(true);
            if (closeOnConnectRef.current) onClose();
        };
        const handleError = () => {
            // A lost group (e.g. the host dissolved it to merge) is not a failure:
            // the next poll finds the surviving group. Only a failed create / join is.
            const failed = pendingRef.current;
            pendingRef.current = false;
            setConnected(false);
            if (!failed) return;
            closeOnConnectRef.current = false;
            setError(true);
        };
        const handleDisconnected = () => {
            pendingRef.current = false;
            setConnected(false);
        };
        vm.on('PERIPHERAL_CONNECTED', handleConnected);
        vm.on('PERIPHERAL_REQUEST_ERROR', handleError);
        vm.on('PERIPHERAL_DISCONNECTED', handleDisconnected);
        return () => {
            vm.removeListener('PERIPHERAL_CONNECTED', handleConnected);
            vm.removeListener('PERIPHERAL_REQUEST_ERROR', handleError);
            vm.removeListener('PERIPHERAL_DISCONNECTED', handleDisconnected);
        };
    }, [vm, onClose]);

    const startConnection = React.useCallback(
        (decision) => {
            const ext = getMeshV2Extension(vm);
            if (!ext || pendingRef.current) return;
            if (decision.action === ACTION.CREATE) {
                pendingRef.current = true;
                ext.setSeatGroupSeats(decision.seats);
                vm.connectPeripheral(EXTENSION_ID, HOST_PERIPHERAL_ID);
            } else if (decision.action === ACTION.JOIN) {
                pendingRef.current = true;
                vm.connectPeripheral(EXTENSION_ID, decision.groupId);
            }
        },
        [vm],
    );

    const elapsedMs = waitStartedAt ? snapshot.updatedAt - waitStartedAt : 0;
    const decision = React.useMemo(() => {
        if (step !== STEP.WAIT || !groups) return null;
        return decideSeatAction({ groups, chosenSeats, presentSeats, mySeat, elapsedMs });
    }, [step, groups, chosenSeats, presentSeats, mySeat, elapsedMs]);

    // Act on each new snapshot while waiting.
    React.useEffect(() => {
        if (step !== STEP.WAIT || !groups || error) return;
        const ext = getMeshV2Extension(vm);
        if (!ext) return;
        if (isConnected(ext)) {
            if (!ext.isConnectedAsHost()) return;
            const target = findGroupToMergeInto({ groups, myGroupId: ext.getConnectedGroupId(), mySeat });
            // Leave the own group; the next poll joins the surviving one.
            if (target) vm.disconnectPeripheral(EXTENSION_ID);
            return;
        }
        if (decision) startConnection(decision);
        // Only a new snapshot should trigger an action, so `decision` is read but not a dependency.
    }, [snapshot.updatedAt, step, error]);

    const ext = getMeshV2Extension(vm);
    const groupId = connected && ext ? ext.getConnectedGroupId() : null;
    const statuses = React.useMemo(
        () => describeSeatStatuses({ groups: groups || [], groupId, chosenSeats, presentSeats, mySeat }),
        [groups, groupId, chosenSeats, presentSeats, mySeat],
    );
    const everyoneHere = step === STEP.WAIT && connected && !!groups && isEveryoneHere(statuses);

    React.useEffect(() => {
        let timer = null;
        if (everyoneHere) {
            setAllArrived(true);
            timer = setTimeout(() => onClose(), ALL_ARRIVED_CLOSE_MS);
        }
        return () => clearTimeout(timer);
    }, [everyoneHere, onClose]);

    const warning = statuses.find((entry) => entry.status === SEAT_STATUS.ELSEWHERE && !kept.includes(entry.seat));

    // --- screen 2 ---
    const picker = React.useMemo(
        () =>
            seatPickerState({
                studentCount: classSeats ? classSeats.studentCount : 0,
                presentSeats,
                groups: groups || [],
                chosenSeats,
                mySeat,
                groupLimit: classSeats ? classSeats.groupLimit : 0,
            }),
        [classSeats, presentSeats, groups, chosenSeats, mySeat],
    );
    const hostSeat = pickHostSeat({ chosenSeats, presentSeats, mySeat });
    const groupLimit = classSeats ? classSeats.groupLimit : 0;

    const handleToggle = React.useCallback(
        (seat) => setChosenSeats((prev) => toggleSeat(prev, seat, mySeat, groupLimit)),
        [mySeat, groupLimit],
    );
    const handleSelectAll = React.useCallback(
        () => setChosenSeats(picker.seats.map((entry) => entry.seat)),
        [picker],
    );
    const handleJoinBusy = React.useCallback(
        (busyGroupId) => {
            closeOnConnectRef.current = true;
            setStep(STEP.WAIT);
            startConnection({ action: ACTION.JOIN, groupId: busyGroupId });
        },
        [startConnection],
    );
    const handleNext = React.useCallback(() => {
        setKept([]);
        setError(false);
        setAllArrived(false);
        setWaitStartedAt(Date.now());
        setStep(STEP.WAIT);
        refresh();
    }, [refresh]);

    // --- screen 3 ---
    const leaveGroup = React.useCallback(() => {
        closeOnConnectRef.current = false;
        if (isConnected(getMeshV2Extension(vm))) vm.disconnectPeripheral(EXTENSION_ID);
    }, [vm]);
    const handleRechoose = React.useCallback(() => {
        leaveGroup();
        setAloneConfirm(false);
        setStep(STEP.PICK);
        refresh();
    }, [leaveGroup, refresh]);
    const handleCancelWait = React.useCallback(() => {
        leaveGroup();
        onBack();
    }, [leaveGroup, onBack]);
    const handleRemoveSeat = React.useCallback(
        (seat) => setChosenSeats((prev) => toggleSeat(prev, seat, mySeat, groupLimit)),
        [mySeat, groupLimit],
    );
    const handleKeepWaiting = React.useCallback((seat) => setKept((prev) => [...prev, seat]), []);
    const startNow = React.useCallback(() => {
        setAloneConfirm(false);
        if (isConnected(getMeshV2Extension(vm))) {
            onClose();
            return;
        }
        closeOnConnectRef.current = true;
        // Without waiting for the host: join a group for this seat if any, else host now.
        startConnection(
            decideSeatAction({ groups: groups || [], chosenSeats, presentSeats, mySeat, elapsedMs: Infinity }),
        );
    }, [vm, onClose, startConnection, groups, chosenSeats, presentSeats, mySeat]);
    const handleStartNow = React.useCallback(() => {
        if (needsAloneConfirm(statuses)) {
            setAloneConfirm(true);
            return;
        }
        startNow();
    }, [statuses, startNow]);
    const handleDismissAlone = React.useCallback(() => setAloneConfirm(false), []);
    const handleRetry = React.useCallback(() => {
        setError(false);
        refresh();
    }, [refresh]);

    if (step === STEP.PICK) {
        return (
            <MeshV2SeatPickStep
                chosenSeats={[...chosenSeats].sort((a, b) => a - b)}
                hostSeat={hostSeat}
                mySeat={mySeat}
                picker={picker}
                onBack={onBack}
                onJoinGroup={handleJoinBusy}
                onNext={handleNext}
                onSelectAll={handleSelectAll}
                onToggle={handleToggle}
            />
        );
    }
    return (
        <MeshV2SeatWaitStep
            allArrived={allArrived}
            aloneConfirm={aloneConfirm}
            chosenSeats={statuses.map((entry) => entry.seat)}
            connected={connected}
            error={error}
            hostSeat={decision && decision.action === ACTION.WAIT ? decision.hostSeat : null}
            statuses={statuses}
            warning={warning || null}
            onCancel={handleCancelWait}
            onConfirmAlone={startNow}
            onDismissAlone={handleDismissAlone}
            onKeepWaiting={handleKeepWaiting}
            onRechoose={handleRechoose}
            onRemoveSeat={handleRemoveSeat}
            onRetry={handleRetry}
            onStartNow={handleStartNow}
        />
    );
};

MeshV2SeatConnect.propTypes = {
    joinCode: PropTypes.string,
    mySeat: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    vm: PropTypes.shape({
        connectPeripheral: PropTypes.func,
        disconnectPeripheral: PropTypes.func,
        on: PropTypes.func,
        removeListener: PropTypes.func,
    }).isRequired,
};

const mapStateToProps = (state) => ({
    joinCode: state.scratchGui.classroom.joinCode,
});

export { MeshV2SeatConnect };
export default connect(mapStateToProps)(MeshV2SeatConnect);
