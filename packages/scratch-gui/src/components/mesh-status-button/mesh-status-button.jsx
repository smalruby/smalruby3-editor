import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { connect } from 'react-redux';
import meshIcon from '../../lib/libraries/extensions/mesh_v2/mesh-small.png';
import { useMeshV2Presence } from '../../lib/use-mesh-v2-presence.js';
import { closeMeshV2StatusPopup, openMeshV2StatusPopup } from '../../reducers/mesh-v2.js';
import styles from './mesh-status-button.css';

const messages = defineMessages({
    title: {
        id: 'gui.meshStatus.button',
        defaultMessage: 'Mesh status and history',
        description: 'Button next to the green flag and stop that opens the mesh status window',
    },
    practicing: {
        id: 'gui.meshStatus.buttonPracticing',
        defaultMessage: 'Mesh status and history (practicing with the practice partner)',
        description: 'Mesh status button while the practice partner is on (#1845)',
    },
    practiceBadge: {
        id: 'gui.meshStatus.practiceBadge',
        defaultMessage: 'Practice',
        description: 'Small badge on the mesh button while the practice partner is on',
    },
});

/**
 * 緑の旗・停止の横に置く、メッシュの「状態と履歴」を開くボタン (#1844)。
 * メッシュの拡張を足した作品のときだけ出す。つながっていれば緑の点を付ける。
 * 練習相手が動いているあいだは「練習」のしるしを付ける（ウィンドウを閉じても分かるように #1845）。
 * @param {object} props - props.
 * @param {string} props.className - extra class.
 * @param {boolean} props.isOpen - whether the window is open.
 * @param {Function} props.onToggle - opens or closes the window.
 * @param {boolean} props.practiceActive - the practice partner is on.
 * @param {object} props.vm - the VM.
 * @returns {?React.ReactElement} the button, or null without the mesh extension.
 */
const MeshStatusButton = ({ className, isOpen, onToggle, practiceActive = false, vm }) => {
    const intl = useIntl();
    const { loaded, connected } = useMeshV2Presence(vm);
    if (!loaded) return null;
    const title = intl.formatMessage(practiceActive ? messages.practicing : messages.title);
    return (
        <button
            aria-label={title}
            aria-pressed={isOpen}
            className={classNames(styles.button, className, { [styles.isOpen]: isOpen })}
            data-testid="mesh-status-button"
            onClick={onToggle}
            title={title}
            type="button"
        >
            <img alt="" className={styles.icon} draggable={false} src={meshIcon} />
            <span
                className={classNames(styles.dot, { [styles.dotOn]: connected })}
                data-testid={connected ? 'mesh-status-button-connected' : 'mesh-status-button-disconnected'}
            />
            {practiceActive && !connected && (
                <span aria-hidden="true" className={styles.practiceBadge} data-testid="mesh-status-button-practice">
                    {intl.formatMessage(messages.practiceBadge)}
                </span>
            )}
        </button>
    );
};

MeshStatusButton.propTypes = {
    className: PropTypes.string,
    isOpen: PropTypes.bool,
    onToggle: PropTypes.func.isRequired,
    practiceActive: PropTypes.bool,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    isOpen: !!(state.scratchGui.meshV2 && state.scratchGui.meshV2.statusPopupOpen),
    practiceActive: !!(state.scratchGui.meshV2 && state.scratchGui.meshV2.practiceActive),
});

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    ...stateProps,
    onToggle: () => dispatchProps.dispatch(stateProps.isOpen ? closeMeshV2StatusPopup() : openMeshV2StatusPopup()),
});

export { MeshStatusButton };
export default connect(mapStateToProps, null, mergeProps)(MeshStatusButton);
