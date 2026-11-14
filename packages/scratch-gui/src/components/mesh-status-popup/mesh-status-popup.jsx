import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import meshIcon from '../../lib/libraries/extensions/mesh_v2/mesh-small.png';
import { describeNode, formatClock, HISTORY_COLLAPSED_COUNT, visibleHistory } from '../../lib/mesh-v2-status.js';
import MeshPracticePartner from '../mesh-practice-partner/mesh-practice-partner.jsx';
import styles from './mesh-status-popup.css';

const messages = defineMessages({
    title: {
        id: 'gui.meshStatus.title',
        defaultMessage: 'Mesh',
        description: 'Title of the mesh status and history window',
    },
    close: {
        id: 'gui.meshStatus.close',
        defaultMessage: 'Close',
        description: 'Close button of the mesh status window',
    },
    tabStatus: {
        id: 'gui.meshStatus.tabStatus',
        defaultMessage: 'Status',
        description: 'Tab that shows the mesh connection status',
    },
    tabHistory: {
        id: 'gui.meshStatus.tabHistory',
        defaultMessage: 'History',
        description: 'Tab that shows sent and received mesh messages',
    },
    tabPractice: {
        id: 'gui.meshStatus.tabPractice',
        defaultMessage: 'Practice partner',
        description: 'Tab of the practice partner that works without connecting (#1845)',
    },
    practicing: {
        id: 'gui.meshStatus.practicing',
        defaultMessage: 'Not connected (practicing with the practice partner)',
        description: 'Mesh is not connected and the practice partner is on',
    },
    practicePeer: {
        id: 'gui.meshStatus.practicePeer',
        defaultMessage: 'Partner (practice partner)',
        description: 'Label of the practice partner in the mesh status and history',
    },
    connectedWebSocket: {
        id: 'gui.meshStatus.connectedWebSocket',
        defaultMessage: 'Connected (WebSocket)',
        description: 'Mesh is connected with WebSocket',
    },
    connectedPolling: {
        id: 'gui.meshStatus.connectedPolling',
        defaultMessage: 'Connected (polling, up to 2 seconds late)',
        description: 'Mesh is connected with polling',
    },
    notConnected: {
        id: 'gui.meshStatus.notConnected',
        defaultMessage: 'Not connected',
        description: 'Mesh is not connected',
    },
    connect: {
        id: 'gui.meshStatus.connect',
        defaultMessage: 'Connect…',
        description: 'Button that opens the mesh connection window',
    },
    connection: {
        id: 'gui.meshStatus.connection',
        defaultMessage: 'Connection',
        description: 'Label of the mesh connection status',
    },
    group: {
        id: 'gui.meshStatus.group',
        defaultMessage: 'Group',
        description: 'Label of the mesh group name',
    },
    people: {
        id: 'gui.meshStatus.people',
        defaultMessage: 'Connected',
        description: 'Label of the number of nodes in the mesh group',
    },
    peopleCount: {
        id: 'gui.meshStatus.peopleCount',
        defaultMessage: '{count} people',
        description: 'Number of nodes in the mesh group',
    },
    self: {
        id: 'gui.meshStatus.self',
        defaultMessage: 'You',
        description: 'Label of this computer in the mesh status',
    },
    peer: {
        id: 'gui.meshStatus.peer',
        defaultMessage: 'Partner {number}',
        description: 'Label of another computer in the mesh status (no names are collected)',
    },
    peerUnknown: {
        id: 'gui.meshStatus.peerUnknown',
        defaultMessage: 'Partner',
        description: 'Label of another computer that is not in the status list yet',
    },
    seat: {
        id: 'gui.meshStatus.seat',
        defaultMessage: 'No. {seat}',
        description: 'Label of a computer by its seat number in a class',
    },
    seatSelf: {
        id: 'gui.meshStatus.seatSelf',
        defaultMessage: 'No. {seat} (you)',
        description: 'Label of this computer by its seat number in a class',
    },
    lastData: {
        id: 'gui.meshStatus.lastData',
        defaultMessage: 'Last data {time}',
        description: 'Time the variables of a node last arrived',
    },
    noVariables: {
        id: 'gui.meshStatus.noVariables',
        defaultMessage: 'No variables yet',
        description: 'A node has not sent any global variables yet',
    },
    noHistory: {
        id: 'gui.meshStatus.noHistory',
        defaultMessage: 'No messages yet',
        description: 'No mesh messages have been sent or received',
    },
    sent: {
        id: 'gui.meshStatus.sent',
        defaultMessage: 'Sent',
        description: 'A message this computer sent',
    },
    received: {
        id: 'gui.meshStatus.received',
        defaultMessage: 'Received',
        description: 'A message this computer received',
    },
    showMore: {
        id: 'gui.meshStatus.showMore',
        defaultMessage: 'Show more (up to 50)',
        description: 'Button that expands the mesh message history',
    },
    showLess: {
        id: 'gui.meshStatus.showLess',
        defaultMessage: 'Show less',
        description: 'Button that collapses the mesh message history',
    },
    noValue: {
        id: 'gui.meshStatus.noValue',
        defaultMessage: '(no value)',
        description: 'A mesh message sent without a value',
    },
});

const TAB_STATUS = 'status';
const TAB_HISTORY = 'history';
const TAB_PRACTICE = 'practice';
const TABS = [TAB_STATUS, TAB_HISTORY, TAB_PRACTICE];
const TAB_IDS = {
    [TAB_STATUS]: 'mesh-status-tab-status',
    [TAB_HISTORY]: 'mesh-status-tab-history',
    [TAB_PRACTICE]: 'mesh-status-tab-practice',
};
const PANEL_ID = 'mesh-status-panel';
const POPUP_WIDTH = 320;
const MARGIN = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * @param {object} intl - react-intl.
 * @param {object} descriptor - describeNode() result.
 * @returns {string} the label (Q2 of EPIC #1842: no names).
 */
const nodeLabel = (intl, descriptor) => {
    if (descriptor.kind === 'seat') {
        return intl.formatMessage(descriptor.self ? messages.seatSelf : messages.seat, { seat: descriptor.seat });
    }
    if (descriptor.kind === 'self') return intl.formatMessage(messages.self);
    if (descriptor.kind === 'practice') return intl.formatMessage(messages.practicePeer);
    if (descriptor.number === null) return intl.formatMessage(messages.peerUnknown);
    return intl.formatMessage(messages.peer, { number: descriptor.number });
};

const initialPosition = () => {
    if (typeof window === 'undefined') return { left: MARGIN, top: 64 };
    const width = Math.min(POPUP_WIDTH, window.innerWidth - MARGIN * 2);
    const top = Math.min(96, window.innerHeight / 4);
    // Put it just left of the stage so the running project stays visible (Q1 of EPIC #1842).
    const stage = document.querySelector('[class*="gui_stage-and-target-wrapper"]');
    const stageLeft = stage ? stage.getBoundingClientRect().left : 0;
    if (stageLeft - width - MARGIN >= MARGIN) return { left: stageLeft - width - MARGIN, top };
    // No room (narrow screens, phones): the right edge, below the menu bar.
    return { left: Math.max(MARGIN, window.innerWidth - width - 16), top };
};

const StatusTab = ({ snapshot, labelCtx, intl, onConnect }) => {
    const connected = snapshot && snapshot.connected;
    const practicing = !connected && !!(snapshot && snapshot.practice);
    let connection = intl.formatMessage(practicing ? messages.practicing : messages.notConnected);
    if (connected) {
        connection = intl.formatMessage(
            snapshot.useWebSocket ? messages.connectedWebSocket : messages.connectedPolling,
        );
    }
    return (
        <div className={styles.tabBody}>
            <dl className={styles.summary}>
                <dt>
                    <FormattedMessage {...messages.connection} />
                </dt>
                <dd data-testid="mesh-status-connection">
                    <span className={classNames(styles.dot, { [styles.dotOn]: connected })} />
                    {connection}
                </dd>
                {connected && (
                    <>
                        <dt>
                            <FormattedMessage {...messages.group} />
                        </dt>
                        <dd data-testid="mesh-status-group">{`【${snapshot.groupLabel}】`}</dd>
                        <dt>
                            <FormattedMessage {...messages.people} />
                        </dt>
                        <dd data-testid="mesh-status-count">
                            <FormattedMessage {...messages.peopleCount} values={{ count: snapshot.nodeCount }} />
                        </dd>
                    </>
                )}
            </dl>
            {!connected && onConnect && (
                <button className={styles.connectButton} data-testid="mesh-status-connect" onClick={onConnect}>
                    <FormattedMessage {...messages.connect} />
                </button>
            )}
            {(connected || practicing) && (
                <ul className={styles.nodes} data-testid="mesh-status-nodes">
                    {snapshot.nodes.map((node) => (
                        <li className={styles.node} data-testid="mesh-status-node" key={node.id}>
                            <div className={styles.nodeHeader}>
                                <span className={styles.nodeLabel}>
                                    {nodeLabel(intl, describeNode(node.id, labelCtx))}
                                </span>
                                {node.lastDataAt && (
                                    <span className={styles.nodeTime}>
                                        <FormattedMessage
                                            {...messages.lastData}
                                            values={{ time: formatClock(node.lastDataAt) }}
                                        />
                                    </span>
                                )}
                            </div>
                            {node.variables.length === 0 ? (
                                <div className={styles.muted}>
                                    <FormattedMessage {...messages.noVariables} />
                                </div>
                            ) : (
                                <table className={styles.variables}>
                                    <tbody>
                                        {node.variables.map((v) => (
                                            <tr key={v.name}>
                                                <th>{v.name}</th>
                                                <td>{v.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

StatusTab.propTypes = {
    intl: PropTypes.object.isRequired,
    labelCtx: PropTypes.object.isRequired,
    onConnect: PropTypes.func,
    snapshot: PropTypes.object,
};

const HistoryTab = ({ history, labelCtx, intl }) => {
    const [expanded, setExpanded] = useState(false);
    const toggle = useCallback(() => setExpanded((v) => !v), []);
    const items = visibleHistory(history, expanded);
    if (items.length === 0) {
        return (
            <div className={classNames(styles.tabBody, styles.muted)} data-testid="mesh-status-history-empty">
                <FormattedMessage {...messages.noHistory} />
            </div>
        );
    }
    return (
        <div className={styles.tabBody}>
            <ol className={styles.history} data-testid="mesh-status-history">
                {items.map((item, index) => (
                    <li
                        className={styles.historyItem}
                        data-testid="mesh-status-history-item"
                        key={`${item.at}-${index}`}
                    >
                        <span className={styles.historyTime}>{formatClock(item.at)}</span>
                        <span
                            className={classNames(
                                styles.direction,
                                item.direction === 'sent' ? styles.sent : styles.received,
                            )}
                        >
                            {intl.formatMessage(item.direction === 'sent' ? messages.sent : messages.received)}
                        </span>
                        <span className={styles.historyWho}>
                            {nodeLabel(intl, describeNode(item.nodeId, labelCtx))}
                        </span>
                        <span className={styles.historyName}>{item.name}</span>
                        <span className={classNames(styles.historyValue, { [styles.muted]: !item.value })}>
                            {item.value || intl.formatMessage(messages.noValue)}
                        </span>
                    </li>
                ))}
            </ol>
            {history.length > HISTORY_COLLAPSED_COUNT && (
                <button className={styles.expandButton} data-testid="mesh-status-history-expand" onClick={toggle}>
                    {intl.formatMessage(expanded ? messages.showLess : messages.showMore)}
                </button>
            )}
        </div>
    );
};

HistoryTab.propTypes = {
    history: PropTypes.arrayOf(PropTypes.object).isRequired,
    intl: PropTypes.object.isRequired,
    labelCtx: PropTypes.object.isRequired,
};

/**
 * メッシュの「状態と履歴」の小さなウィンドウ (#1844)。モーダルではないので、開いたまま作品を
 * 動かせる。見出しをドラッグして動かせる（画面の外には出さない）。
 * @param {object} props - props.
 * @param {boolean} props.aboveStage - show above the full-screen stage.
 * @param {Array<string>} [props.messageNames] - message names of the project (practice tab).
 * @param {object} props.peers - {nodeId: number} for 「相手 N」.
 * @param {?object} [props.practice] - useMeshPracticePartner() result; no practice tab without it.
 * @param {Array<string>} [props.projectVariables] - stage variable names (practice tab).
 * @param {object} props.snapshot - getStatusSnapshot() of the VM.
 * @param {Function} props.onClose - closes the window.
 * @param {Function} props.onConnect - opens the connection modal.
 * @returns {React.ReactElement} the window.
 */
const MeshStatusPopup = ({
    aboveStage,
    messageNames = [],
    peers,
    practice = null,
    projectVariables = [],
    snapshot,
    onClose,
    onConnect,
}) => {
    const intl = useIntl();
    const [tab, setTab] = useState(TAB_STATUS);
    const [position, setPosition] = useState(initialPosition);
    const dragRef = useRef(null);
    const rootRef = useRef(null);

    const keepInside = useCallback((left, top) => {
        const el = rootRef.current;
        const width = el ? el.offsetWidth : POPUP_WIDTH;
        const height = el ? el.offsetHeight : 200;
        return {
            left: clamp(left, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN)),
            top: clamp(top, MARGIN, Math.max(MARGIN, window.innerHeight - Math.min(height, 48) - MARGIN)),
        };
    }, []);

    useEffect(() => {
        const handleResize = () => setPosition((p) => keepInside(p.left, p.top));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [keepInside]);

    const handlePointerMove = useCallback(
        (e) => {
            const drag = dragRef.current;
            if (!drag) return;
            setPosition(keepInside(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y));
        },
        [keepInside],
    );
    const handlePointerUp = useCallback(() => {
        dragRef.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove]);
    const handlePointerDown = useCallback(
        (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (e.target.closest && e.target.closest('button')) return;
            e.preventDefault();
            dragRef.current = { x: e.clientX, y: e.clientY, left: position.left, top: position.top };
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        },
        [position, handlePointerMove, handlePointerUp],
    );
    useEffect(() => handlePointerUp, [handlePointerUp]);

    const selectStatus = useCallback(() => setTab(TAB_STATUS), []);
    const selectHistory = useCallback(() => setTab(TAB_HISTORY), []);
    const selectPractice = useCallback(() => setTab(TAB_PRACTICE), []);
    const statusTabRef = useRef(null);
    const historyTabRef = useRef(null);
    const practiceTabRef = useRef(null);

    // Not a modal: no focus trap. Move the focus in when it opens and give it back to
    // whatever opened it when it closes (#1844 review FYI1).
    useEffect(() => {
        const opener = document.activeElement;
        if (rootRef.current) rootRef.current.focus();
        return () => {
            if (opener && opener !== document.body && document.contains(opener) && opener.focus) {
                opener.focus();
                return;
            }
            const button = document.querySelector('[data-testid="mesh-status-button"]');
            if (button) button.focus();
        };
    }, []);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        },
        [onClose],
    );

    // Left / right arrows switch the tabs (WAI-ARIA tabs pattern, automatic activation).
    const handleTabKeyDown = useCallback(
        (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const tabs = practice ? TABS : [TAB_STATUS, TAB_HISTORY];
            const step = e.key === 'ArrowRight' ? 1 : -1;
            const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
            setTab(next);
            const refs = { [TAB_STATUS]: statusTabRef, [TAB_HISTORY]: historyTabRef, [TAB_PRACTICE]: practiceTabRef };
            if (refs[next].current) refs[next].current.focus();
        },
        [tab, practice],
    );

    const labelCtx = {
        selfId: snapshot ? snapshot.selfId : '',
        inClassroom: !!(snapshot && snapshot.inClassroom),
        peers,
    };
    const history = (snapshot && snapshot.history) || [];

    return (
        <div
            aria-label={intl.formatMessage(messages.title)}
            className={classNames(styles.popup, { [styles.aboveStage]: aboveStage })}
            data-testid="mesh-status-popup"
            onKeyDown={handleKeyDown}
            ref={rootRef}
            role="dialog"
            tabIndex={-1}
            style={{
                left: position.left,
                top: position.top,
                // Keep the bottom on screen too (the expanded history can be long).
                maxHeight:
                    typeof window === 'undefined' ? null : Math.max(160, window.innerHeight - position.top - MARGIN),
            }}
        >
            <div className={styles.header} data-testid="mesh-status-drag-handle" onPointerDown={handlePointerDown}>
                <img alt="" className={styles.headerIcon} draggable={false} src={meshIcon} />
                <span className={styles.title}>
                    <FormattedMessage {...messages.title} />
                </span>
                <button
                    aria-label={intl.formatMessage(messages.close)}
                    className={styles.closeButton}
                    data-testid="mesh-status-close"
                    onClick={onClose}
                    title={intl.formatMessage(messages.close)}
                >
                    {'×'}
                </button>
            </div>
            <div className={styles.tabs} onKeyDown={handleTabKeyDown} role="tablist">
                <button
                    aria-controls={PANEL_ID}
                    aria-selected={tab === TAB_STATUS}
                    className={classNames(styles.tab, { [styles.tabActive]: tab === TAB_STATUS })}
                    data-testid="mesh-status-tab-status"
                    id={TAB_IDS[TAB_STATUS]}
                    onClick={selectStatus}
                    ref={statusTabRef}
                    role="tab"
                    tabIndex={tab === TAB_STATUS ? 0 : -1}
                >
                    <FormattedMessage {...messages.tabStatus} />
                </button>
                <button
                    aria-controls={PANEL_ID}
                    aria-selected={tab === TAB_HISTORY}
                    className={classNames(styles.tab, { [styles.tabActive]: tab === TAB_HISTORY })}
                    data-testid="mesh-status-tab-history"
                    id={TAB_IDS[TAB_HISTORY]}
                    onClick={selectHistory}
                    ref={historyTabRef}
                    role="tab"
                    tabIndex={tab === TAB_HISTORY ? 0 : -1}
                >
                    <FormattedMessage {...messages.tabHistory} />
                    {history.length > 0 && <span className={styles.badge}>{history.length}</span>}
                </button>
                {practice && (
                    <button
                        aria-controls={PANEL_ID}
                        aria-selected={tab === TAB_PRACTICE}
                        className={classNames(styles.tab, { [styles.tabActive]: tab === TAB_PRACTICE })}
                        data-testid="mesh-status-tab-practice"
                        id={TAB_IDS[TAB_PRACTICE]}
                        onClick={selectPractice}
                        ref={practiceTabRef}
                        role="tab"
                        tabIndex={tab === TAB_PRACTICE ? 0 : -1}
                    >
                        <FormattedMessage {...messages.tabPractice} />
                        {practice.active && <span className={styles.practiceDot} />}
                    </button>
                )}
            </div>
            <div
                aria-labelledby={TAB_IDS[tab]}
                className={styles.body}
                data-testid="mesh-status-panel"
                id={PANEL_ID}
                role="tabpanel"
            >
                {tab === TAB_STATUS && (
                    <StatusTab intl={intl} labelCtx={labelCtx} onConnect={onConnect} snapshot={snapshot} />
                )}
                {tab === TAB_HISTORY && <HistoryTab history={history} intl={intl} labelCtx={labelCtx} />}
                {tab === TAB_PRACTICE && practice && (
                    <MeshPracticePartner
                        messageNames={messageNames}
                        practice={practice}
                        projectVariables={projectVariables}
                    />
                )}
            </div>
        </div>
    );
};

MeshStatusPopup.propTypes = {
    aboveStage: PropTypes.bool,
    // 作品のメッセージ・ステージの変数の名前（練習相手のタブに並べる #1845）
    messageNames: PropTypes.arrayOf(PropTypes.string),
    onClose: PropTypes.func.isRequired,
    onConnect: PropTypes.func,
    peers: PropTypes.object.isRequired,
    // useMeshPracticePartner() の結果。無ければ「練習相手」のタブを出さない
    practice: PropTypes.object,
    projectVariables: PropTypes.arrayOf(PropTypes.string),
    snapshot: PropTypes.object,
};

export default MeshStatusPopup;
