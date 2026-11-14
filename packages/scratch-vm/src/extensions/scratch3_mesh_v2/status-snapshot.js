const { parseNodeSeat } = require('./seat-naming');

// A node id (uuid hex) with an optional seat suffix, as at the head of a group name.
const HOST_HEAD_RE = /^[0-9a-f]{8,64}(?:s\d{2,3})?$/;

/**
 * 「状態と履歴」ポップアップ (#1844) に渡す、メッシュの今の様子のスナップショットを作る。
 * すでに手元にあるもの（remoteData・履歴・最後に知ったノード一覧）だけを読み、通信はしない。
 *
 * ノード（相手）の決め方:
 * - 自分と、listNodesInGroup で知ったノード一覧（ホストは入らないので、サーバーが記録した hostId、
 *   無ければグループ名の先頭から足す）と、
 *   変数の値が届いたノード（remoteData）を出す。
 * - ただし一覧を知ったあとは、一覧に無いノードは、一覧を問い合わせたあとに値が届いたものだけ出す
 *   （抜けた相手の古い値は出さず、問い合わせのあとに入った相手は 30 秒待たずに出す）。
 * - 人数は出したノードの数。
 *
 * 並び: 自分 → 出席番号の小さい順 → 番号の無いものは初めて見えた順（最初の値が届いた順。
 * 値をまだ送っていない相手はそのあとに、サーバーが返した順）。
 * @param {object} input - values read from the extension and the mesh service.
 * @param {string} input.connectionState - 'connected' など。
 * @param {object} input.service - MeshV2Service（読むだけ）。
 * @param {?string} input.domain - domain.
 * @param {string} input.groupLabel - 合言葉（グループ名の先頭 6 文字から作るひらがな）。
 * @param {boolean} input.inClassroom - クラスに参加中か（生徒・先生）。
 * @returns {object} snapshot (plain data, safe to keep in React state).
 */
const buildStatusSnapshot = ({ connectionState, service, domain, groupLabel, inClassroom }) => {
    const selfId = service.meshId;
    const connected = connectionState === 'connected' && !!service.groupId;
    const remoteData = service.remoteData || {};
    const listed = service.getGroupNodeIds();

    const ids = [];
    const add = (id) => {
        if (id && !ids.includes(id)) ids.push(id);
    };
    if (connected) {
        add(selfId);
        const listedAt = service.groupNodesFetchedAt || 0;
        // remoteData keeps its keys in the order the first value of each node arrived, so the
        // nodes are listed in order of first appearance (「相手 N」 is numbered in this order).
        Object.keys(remoteData).forEach((id) => {
            if (!listed || listed.includes(id)) {
                add(id);
                return;
            }
            const data = remoteData[id] || {};
            if (Object.keys(data).some((key) => data[key].timestamp > listedAt)) add(id);
        });
        // listNodesInGroup returns the members, not the host. Use the host id the server
        // recorded for the group (hostId); only without it, fall back to the head of the
        // group name, where this extension puts the host node id (seat-naming.js).
        if (listed && !service.isHost) {
            if (service.groupHostId) {
                add(service.groupHostId);
            } else {
                const head = String(service.groupName || '').split('|')[0];
                if (HOST_HEAD_RE.test(head)) add(head);
            }
        }
        // Members that have not sent any value yet, in the order the server returned them.
        if (listed) listed.forEach(add);
    }

    const nodes = ids.map((id, index) => {
        const data = remoteData[id] || {};
        const variables = Object.keys(data)
            .sort()
            .map((name) => ({ name, value: data[name].value, at: data[name].timestamp }));
        const lastDataAt = variables.reduce((max, v) => (Number.isFinite(v.at) && v.at > max ? v.at : max), 0);
        return {
            id,
            seat: parseNodeSeat(id),
            isSelf: id === selfId,
            order: index,
            lastDataAt: lastDataAt || null,
            variables,
        };
    });
    nodes.sort((a, b) => {
        if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
        if (a.seat !== null && b.seat !== null && a.seat !== b.seat) return a.seat - b.seat;
        if ((a.seat === null) !== (b.seat === null)) return a.seat === null ? 1 : -1;
        return a.order - b.order;
    });

    return {
        connectionState,
        connected,
        // 「相手 N」の番号をグループが変わったら付け直すため (#1844 review Q2)
        groupId: connected ? service.groupId : null,
        useWebSocket: connected ? !!service.useWebSocket : null,
        isHost: connected && !!service.isHost,
        domain: domain || null,
        groupLabel: connected ? groupLabel || '' : '',
        expiresAt: connected ? service.expiresAt || null : null,
        selfId,
        inClassroom: !!inClassroom,
        nodeCount: nodes.length,
        nodeCountFromServer: connected && !!listed,
        nodes: nodes.map(({ order, ...node }) => node),
        history: service.getMessageHistory(),
    };
};

module.exports = { buildStatusSnapshot };
