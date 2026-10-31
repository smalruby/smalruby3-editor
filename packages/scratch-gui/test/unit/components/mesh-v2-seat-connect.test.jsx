import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MeshV2InitialStep from '../../../src/components/connection-modal/mesh-v2-initial-step.jsx';
import MeshV2SeatPickStep from '../../../src/components/connection-modal/mesh-v2-seat-pick-step.jsx';
import MeshV2SeatWaitStep from '../../../src/components/connection-modal/mesh-v2-seat-wait-step.jsx';
import { MeshV2SeatConnect } from '../../../src/containers/mesh-v2-seat-connect.jsx';
import classroomAPI from '../../../src/lib/classroom-api.js';
import { seatPickerState } from '../../../src/lib/mesh-v2-seat-connect.js';
import ja from '../../../src/locales/ja.js';

jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: { lookupClassroom: jest.fn() },
}));

const renderJa = (ui) =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            {ui}
        </IntlProvider>,
    );

const seatGroup = (id, seats, host, memberSeats) => ({
    id,
    seatInfo: { baseName: id, seats, host },
    memberSeats,
});

describe('MeshV2SeatPickStep', () => {
    const pickProps = (extra) => {
        const picker = seatPickerState({
            studentCount: 8,
            presentSeats: [3, 5, 7],
            groups: [seatGroup('g1', [5], 5, [5])],
            chosenSeats: [3],
            mySeat: 3,
            groupLimit: 6,
        });
        return {
            picker,
            chosenSeats: [3],
            hostSeat: 3,
            mySeat: 3,
            onBack: jest.fn(),
            onToggle: jest.fn(),
            onSelectAll: jest.fn(),
            onJoinGroup: jest.fn(),
            onNext: jest.fn(),
            ...extra,
        };
    };

    test('own seat cannot be pressed and absent seats are labelled', () => {
        renderJa(<MeshV2SeatPickStep {...pickProps()} />);
        expect(screen.getByTestId('meshV2-seat-3')).toBeDisabled();
        expect(screen.getByTestId('meshV2-seat-1')).toHaveTextContent('欠席');
        expect(screen.getByText('あなたは 3番です。自分の番号は外せません。')).toBeInTheDocument();
    });

    test('the summary separates the chosen seats with ・ like the other screens', () => {
        renderJa(<MeshV2SeatPickStep {...pickProps({ chosenSeats: [3, 7, 12] })} />);
        expect(screen.getByTestId('meshV2-seat-summary')).toHaveTextContent('選んだ人: 3・7・12 ／ ホスト: 3番');
    });

    test('pressing a free seat toggles it', () => {
        const props = pickProps();
        renderJa(<MeshV2SeatPickStep {...props} />);
        fireEvent.click(screen.getByTestId('meshV2-seat-7'));
        expect(props.onToggle).toHaveBeenCalledWith(7);
    });

    test('pressing a seat in use asks to join its group', () => {
        const props = pickProps();
        renderJa(<MeshV2SeatPickStep {...props} />);
        fireEvent.click(screen.getByTestId('meshV2-seat-5'));
        expect(props.onToggle).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('meshV2-seat-busy-join'));
        expect(props.onJoinGroup).toHaveBeenCalledWith('g1');
    });

    test('select everyone is shown only without a limit', () => {
        const { rerender } = renderJa(<MeshV2SeatPickStep {...pickProps()} />);
        expect(screen.queryByTestId('meshV2-seat-select-all')).toBeNull();
        const picker = seatPickerState({
            studentCount: 4,
            presentSeats: [],
            groups: [],
            chosenSeats: [3],
            mySeat: 3,
            groupLimit: 0,
        });
        rerender(
            <IntlProvider locale="ja" messages={ja}>
                <MeshV2SeatPickStep {...pickProps({ picker })} />
            </IntlProvider>,
        );
        expect(screen.getByTestId('meshV2-seat-select-all')).toBeInTheDocument();
    });
});

describe('MeshV2SeatWaitStep', () => {
    const waitProps = (extra) => ({
        chosenSeats: [3, 7, 12, 20],
        connected: false,
        hostSeat: 3,
        statuses: [
            { seat: 3, status: 'waiting', host: false },
            { seat: 7, status: 'me', host: false },
            { seat: 12, status: 'elsewhere', groupSeats: [12, 15], host: false },
            { seat: 20, status: 'absent', host: false },
        ],
        warning: { seat: 12, groupSeats: [12, 15] },
        onCancel: jest.fn(),
        onConfirmAlone: jest.fn(),
        onDismissAlone: jest.fn(),
        onKeepWaiting: jest.fn(),
        onRechoose: jest.fn(),
        onRemoveSeat: jest.fn(),
        onRetry: jest.fn(),
        onStartNow: jest.fn(),
        ...extra,
    });

    test('shows each chosen seat and who the student waits for', () => {
        renderJa(<MeshV2SeatWaitStep {...waitProps()} />);
        expect(screen.getByText('「3・7・12・20番のグループ」')).toBeInTheDocument();
        expect(screen.getByTestId('meshV2-seat-wait-note')).toHaveTextContent('ホストの 3番さんを待っています');
        expect(screen.getByTestId('meshV2-seat-status-20')).toHaveTextContent('欠席のため待ちません');
        expect(screen.getByTestId('meshV2-seat-status-7')).toHaveTextContent('あなた');
    });

    test('the warning offers remove / choose again / keep waiting', () => {
        const props = waitProps();
        renderJa(<MeshV2SeatWaitStep {...props} />);
        expect(screen.getByTestId('meshV2-seat-elsewhere-warning')).toHaveTextContent('12・15番のグループ');
        fireEvent.click(screen.getByTestId('meshV2-seat-remove'));
        expect(props.onRemoveSeat).toHaveBeenCalledWith(12);
        fireEvent.click(screen.getByTestId('meshV2-seat-keep-waiting'));
        expect(props.onKeepWaiting).toHaveBeenCalledWith(12);
        fireEvent.click(screen.getByTestId('meshV2-seat-rechoose'));
        expect(props.onRechoose).toHaveBeenCalled();
    });

    test('everyone here hides the warning and disables start now', () => {
        renderJa(<MeshV2SeatWaitStep {...waitProps({ allArrived: true, connected: true })} />);
        expect(screen.getByTestId('meshV2-seat-all-arrived')).toHaveTextContent('そろいました');
        expect(screen.queryByTestId('meshV2-seat-elsewhere-warning')).toBeNull();
        expect(screen.getByTestId('meshV2-seat-start-now')).toBeDisabled();
    });
});

describe('MeshV2SeatConnect', () => {
    const makeVm = (ext) => {
        const vm = new EventEmitter();
        vm.runtime = { peripheralExtensions: { meshV2: ext } };
        vm.connectPeripheral = jest.fn();
        vm.disconnectPeripheral = jest.fn();
        return vm;
    };
    const makeExt = (groups, extra) => ({
        connectionState: 'disconnected',
        listSeatGroups: jest.fn(() => Promise.resolve(groups)),
        setSeatGroupSeats: jest.fn(),
        getConnectedGroupId: jest.fn(() => null),
        isConnectedAsHost: jest.fn(() => false),
        ...extra,
    });
    const renderConnect = (vm, extra) =>
        renderJa(
            <MeshV2SeatConnect
                joinCode="abc123"
                mySeat={3}
                vm={vm}
                onBack={jest.fn()}
                onClose={jest.fn()}
                {...extra}
            />,
        );

    beforeEach(() => {
        classroomAPI.lookupClassroom.mockResolvedValue({
            studentCount: 12,
            takenSeats: [3, 7, 12],
            meshGroupLimit: 6,
        });
    });

    test('the smallest present seat creates the group with the chosen seats', async () => {
        const ext = makeExt([]);
        const vm = makeVm(ext);
        renderConnect(vm);
        await waitFor(() => expect(screen.getByTestId('meshV2-seat-7')).toBeEnabled());
        fireEvent.click(screen.getByTestId('meshV2-seat-7'));
        fireEvent.click(screen.getByTestId('meshV2-seat-connect'));
        await waitFor(() => expect(vm.connectPeripheral).toHaveBeenCalledWith('meshV2', 'meshV2_host'));
        expect(ext.setSeatGroupSeats).toHaveBeenCalledWith([3, 7]);
        expect(vm.connectPeripheral).toHaveBeenCalledTimes(1);
    });

    test('a group with the own seat is joined instead of creating one', async () => {
        const ext = makeExt([seatGroup('g7', [3, 7], 7, [7])]);
        const vm = makeVm(ext);
        renderConnect(vm);
        await waitFor(() => expect(screen.getByTestId('meshV2-seat-connect')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('meshV2-seat-connect'));
        await waitFor(() => expect(vm.connectPeripheral).toHaveBeenCalledWith('meshV2', 'g7'));
        expect(ext.setSeatGroupSeats).not.toHaveBeenCalled();
    });

    test('a seat that is not the host waits for the host', async () => {
        const ext = makeExt([]);
        const vm = makeVm(ext);
        renderJa(<MeshV2SeatConnect joinCode="abc123" mySeat={7} vm={vm} onBack={jest.fn()} onClose={jest.fn()} />);
        await waitFor(() => expect(screen.getByTestId('meshV2-seat-3')).toBeEnabled());
        fireEvent.click(screen.getByTestId('meshV2-seat-3'));
        fireEvent.click(screen.getByTestId('meshV2-seat-connect'));
        await waitFor(() =>
            expect(screen.getByTestId('meshV2-seat-wait-note')).toHaveTextContent('ホストの 3番さんを待っています'),
        );
        expect(vm.connectPeripheral).not.toHaveBeenCalled();
    });

    test('a host whose seat is in a group with a smaller host leaves to merge', async () => {
        const ext = makeExt([seatGroup('mine', [3, 7], 7, [7]), seatGroup('g3', [3, 7], 3, [3])], {
            connectionState: 'connected',
            getConnectedGroupId: jest.fn(() => 'mine'),
            isConnectedAsHost: jest.fn(() => true),
        });
        const vm = makeVm(ext);
        renderJa(<MeshV2SeatConnect joinCode="abc123" mySeat={7} vm={vm} onBack={jest.fn()} onClose={jest.fn()} />);
        await waitFor(() => expect(screen.getByTestId('meshV2-seat-connect')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('meshV2-seat-connect'));
        await waitFor(() => expect(vm.disconnectPeripheral).toHaveBeenCalledWith('meshV2'));
    });

    test('everyone here closes the modal after a moment', async () => {
        jest.useFakeTimers();
        try {
            const ext = makeExt([seatGroup('g3', [3, 7], 3, [3, 7])], {
                connectionState: 'connected',
                getConnectedGroupId: jest.fn(() => 'g3'),
                isConnectedAsHost: jest.fn(() => true),
            });
            const vm = makeVm(ext);
            const onClose = jest.fn();
            renderConnect(vm, { onClose });
            await act(async () => {
                await Promise.resolve();
            });
            fireEvent.click(screen.getByTestId('meshV2-seat-7'));
            fireEvent.click(screen.getByTestId('meshV2-seat-connect'));
            await act(async () => {
                await Promise.resolve();
                await Promise.resolve();
            });
            expect(screen.getByTestId('meshV2-seat-all-arrived')).toBeInTheDocument();
            act(() => {
                jest.advanceTimersByTime(2000);
            });
            expect(onClose).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('MeshV2InitialStep classic methods', () => {
    const initialProps = (extra) => ({
        domain: 'abc123',
        domainReadOnly: true,
        onCreateGroup: jest.fn(),
        onDomainChange: jest.fn(),
        onJoinGroup: jest.fn(),
        ...extra,
    });

    test('outside a class the classic buttons are shown as before', () => {
        renderJa(<MeshV2InitialStep {...initialProps()} />);
        expect(screen.getByTestId('meshV2-create-group')).toBeInTheDocument();
        expect(screen.getByTestId('meshV2-join-group')).toBeInTheDocument();
        expect(screen.queryByTestId('meshV2-classic-toggle')).toBeNull();
    });

    test('in a class they are folded away, open on press and start folded again', () => {
        classroomAPI.lookupClassroom.mockResolvedValue({ studentCount: 5, takenSeats: [3], meshGroupLimit: 6 });
        const vm = { runtime: { peripheralExtensions: {} } };
        const props = initialProps({
            classroomJoinCode: 'abc123',
            classroomName: '3年2組',
            meshV2Seat: { seat: 3, teacher: false },
            vm,
            onJoinSeatGroup: jest.fn(),
            onSeatConnect: jest.fn(),
        });
        const { unmount } = renderJa(<MeshV2InitialStep {...props} />);
        expect(screen.getByTestId('meshV2-seat-connect-entry')).toBeInTheDocument();
        expect(screen.queryByTestId('meshV2-create-group')).toBeNull();
        const toggle = screen.getByTestId('meshV2-classic-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('クラスの外や、先生に言われたときだけ使います。')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('meshV2-join-group'));
        expect(props.onJoinGroup).toHaveBeenCalled();
        unmount();
        renderJa(<MeshV2InitialStep {...props} />);
        expect(screen.getByTestId('meshV2-classic-toggle')).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('meshV2-create-group')).toBeNull();
    });
});

describe('MeshV2InitialStep invitation from a seat group', () => {
    const makeVm = (groups) => ({
        runtime: { peripheralExtensions: { meshV2: { listSeatGroups: jest.fn(() => Promise.resolve(groups)) } } },
    });
    const inviteProps = (groups, extra) => ({
        classroomJoinCode: 'abc123',
        classroomName: '3年2組',
        domain: 'abc123',
        domainReadOnly: true,
        meshV2Seat: { seat: 7, teacher: false },
        vm: makeVm(groups),
        onCreateGroup: jest.fn(),
        onDomainChange: jest.fn(),
        onJoinGroup: jest.fn(),
        onJoinSeatGroup: jest.fn(),
        onSeatConnect: jest.fn(),
        ...extra,
    });

    beforeEach(() => {
        classroomAPI.lookupClassroom.mockResolvedValue({
            studentCount: 12,
            takenSeats: [3, 7, 12],
            meshGroupLimit: 6,
        });
    });

    test('a late student sees the group that waits for them and can join it', async () => {
        const props = inviteProps([seatGroup('g3', [3, 7, 12], 3, [3, 12])]);
        renderJa(<MeshV2InitialStep {...props} />);
        expect(await screen.findByTestId('meshV2-seat-invite')).toHaveTextContent(
            '3番さんのグループに呼ばれています',
        );
        expect(screen.getByTestId('meshV2-seat-invite-status-3')).toHaveTextContent('ホスト・参加中');
        expect(screen.getByTestId('meshV2-seat-invite-status-12')).toHaveTextContent('参加中');
        expect(screen.getByTestId('meshV2-seat-invite-status-7')).toHaveTextContent('あなた（まだ入っていません）');
        expect(screen.queryByTestId('meshV2-seat-connect-entry')).toBeNull();
        fireEvent.click(screen.getByTestId('meshV2-seat-invite-join'));
        expect(props.onJoinSeatGroup).toHaveBeenCalledWith('g3');
    });

    test('skipping shows the usual first screen', async () => {
        renderJa(<MeshV2InitialStep {...inviteProps([seatGroup('g3', [3, 7], 3, [3])])} />);
        fireEvent.click(await screen.findByTestId('meshV2-seat-invite-skip'));
        expect(screen.queryByTestId('meshV2-seat-invite')).toBeNull();
        expect(screen.getByTestId('meshV2-seat-connect-entry')).toBeInTheDocument();
    });

    test('a student who was not chosen sees the usual first screen', async () => {
        const props = inviteProps([seatGroup('g3', [3, 12], 3, [3])]);
        renderJa(<MeshV2InitialStep {...props} />);
        await waitFor(() => expect(props.vm.runtime.peripheralExtensions.meshV2.listSeatGroups).toHaveBeenCalled());
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.queryByTestId('meshV2-seat-invite')).toBeNull();
        expect(screen.getByTestId('meshV2-seat-connect-entry')).toBeInTheDocument();
    });

    test('the teacher is not invited', async () => {
        const props = inviteProps([seatGroup('g3', [3, 7], 3, [3])], { meshV2Seat: { seat: 7, teacher: true } });
        renderJa(<MeshV2InitialStep {...props} />);
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.queryByTestId('meshV2-seat-invite')).toBeNull();
        expect(props.vm.runtime.peripheralExtensions.meshV2.listSeatGroups).not.toHaveBeenCalled();
    });
});
