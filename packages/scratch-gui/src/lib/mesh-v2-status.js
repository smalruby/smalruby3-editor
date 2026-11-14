// メッシュの「状態と履歴」ポップアップ (#1844) の表示の決まり（純粋関数）。
// データは VM の getStatusSnapshot()（scratch3_mesh_v2/status-snapshot.js）が作る。
import { parseNodeSeat } from '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming';

// 履歴は見るのが生徒なので、ふだんは 3 件だけ。開くと VM が持っている 50 件まで。
const HISTORY_COLLAPSED_COUNT = 3;
const HISTORY_EXPANDED_COUNT = 50;

/**
 * 「相手 1」「相手 2」… の番号を、はじめて見えた順に割り当てる（一度付けた番号は変えない）。
 * クラスでは出席番号のあるノードには番号を付けない（「03 番」で出すため）。
 * @param {object} prev - これまでの {nodeId: number}。
 * @param {Array<string>} ids - いま見えているノード id（届いた順）。
 * @param {string} selfId - 自分のノード id。
 * @param {boolean} [inClassroom] - クラスに参加中か。
 * @returns {object} 新しい {nodeId: number}（変わらなければ prev そのもの）。
 */
const assignPeerNumbers = (prev, ids, selfId, inClassroom = false) => {
    let next = prev;
    let max = Object.values(prev).reduce((m, n) => Math.max(m, n), 0);
    ids.forEach((id) => {
        if (!id || id === selfId || Object.prototype.hasOwnProperty.call(next, id)) return;
        if (inClassroom && parseNodeSeat(id) !== null) return;
        if (next === prev) next = { ...prev };
        max += 1;
        next[id] = max;
    });
    return next;
};

/**
 * 「相手 N」の番号を、スナップショットを読むたびに更新する。
 * - 同じグループの間は一度付けた番号を変えない。
 * - グループが変わったとき・抜けたとき（groupId が変わる）は 1 から付け直す。
 * - 番号は初めて見えた順: ノードの並び（VM が最初の値が届いた順に並べる）→ 履歴の古い順。
 * @param {{groupId: ?string, peers: object}} prev - これまでの番号。
 * @param {?object} snapshot - VM の getStatusSnapshot()。
 * @returns {{groupId: ?string, peers: object}} 新しい番号（変わらなければ prev そのもの）。
 */
const updatePeerNumbers = (prev, snapshot) => {
    const groupId = (snapshot && snapshot.groupId) || null;
    const base = prev && prev.groupId === groupId ? prev : { groupId, peers: {} };
    if (!snapshot) return base;
    const ids = snapshot.nodes
        .map((node) => node.id)
        .concat(
            snapshot.history
                .slice()
                .reverse()
                .map((item) => item.nodeId),
        );
    const peers = assignPeerNumbers(base.peers, ids, snapshot.selfId, snapshot.inClassroom);
    return peers === base.peers ? base : { groupId, peers };
};

/**
 * ノードの見せ方（EPIC #1842 Q2）。名前は集めない。
 * - クラスに参加中で出席番号があれば「03 番」（自分なら「（あなた）」を足す）。
 * - それ以外は自分が「あなた」、ほかは「相手 1」「相手 2」…。
 * @param {string} id - ノード id。
 * @param {{selfId: string, inClassroom: boolean, peers: object}} ctx - 表示の文脈。
 * @returns {{kind: string, seat?: string, self?: boolean, number?: ?number}} 見せ方。
 */
const describeNode = (id, { selfId, inClassroom, peers }) => {
    if (inClassroom) {
        const seat = parseNodeSeat(id);
        if (seat !== null) return { kind: 'seat', seat: String(seat).padStart(2, '0'), self: id === selfId };
    }
    if (id === selfId) return { kind: 'self' };
    const number = peers && Object.prototype.hasOwnProperty.call(peers, id) ? peers[id] : null;
    return { kind: 'peer', number };
};

/**
 * @param {?Array<object>} history - 新しい順の履歴。
 * @param {boolean} expanded - 開いているか。
 * @returns {Array<object>} 見せる分。
 */
const visibleHistory = (history, expanded) =>
    (history || []).slice(0, expanded ? HISTORY_EXPANDED_COUNT : HISTORY_COLLAPSED_COUNT);

/**
 * @param {?number} ms - 時刻（ms）。
 * @returns {string} 「09:05:07」（その端末の時刻）。無ければ ''。
 */
const formatClock = (ms) => {
    if (!Number.isFinite(ms)) return '';
    const d = new Date(ms);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
};

export {
    HISTORY_COLLAPSED_COUNT,
    HISTORY_EXPANDED_COUNT,
    assignPeerNumbers,
    describeNode,
    formatClock,
    updatePeerNumbers,
    visibleHistory,
};
