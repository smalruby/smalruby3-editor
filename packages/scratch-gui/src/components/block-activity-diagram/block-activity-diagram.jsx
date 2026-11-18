// ブロックを右クリック →「アクティビティ図」で開くパネル（#1647）。図はレッスンと同じ部品
// （lesson-activity-diagram）で描く。モーダルにせず、見出しをつかんで動かせる・×で閉じられるパネルにする
// （後ろのブロックと見くらべながら直せるように。授業 PC の 1300×600 でも図の上に重ならないところへ動かせる）。
import PropTypes from 'prop-types';
import React from 'react';
import Draggable from 'react-draggable';
import { defineMessages, useIntl } from 'react-intl';
import LessonActivityDiagram from '../lesson-activity-diagram/lesson-activity-diagram.jsx';
import styles from './block-activity-diagram.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessons.activityDiagram.popupTitle',
        description: 'Title of the panel that shows the activity diagram of the right-clicked script',
        defaultMessage: 'Activity diagram ({name})',
    },
    close: {
        id: 'gui.lessons.activityDiagram.close',
        description: 'Label of the close button of the activity diagram panel',
        defaultMessage: 'Close',
    },
    scriptGone: {
        id: 'gui.lessons.activityDiagram.scriptGone',
        description: 'Shown in the activity diagram panel when the script was deleted',
        defaultMessage: 'This script is gone. Right-click a block to open the diagram again.',
    },
    liveNote: {
        id: 'gui.lessons.activityDiagram.liveNote',
        description: 'Note under the activity diagram: the diagram follows edits of the blocks',
        defaultMessage: 'The diagram changes when you change the blocks.',
    },
});

/**
 * ブロックのスクリプトのアクティビティ図のパネル。
 * @param {object} props - props。
 * @param {?object} props.layout - 図の置き方（`scriptActivityDiagram` の layout）。null ならスクリプトが無くなった。
 * @param {string} props.name - スプライトの名前（見出しに書く）。
 * @param {object} props.panelRef - パネルの要素の ref（大きさを測る）。
 * @param {{x: number, y: number}} props.position - パネルの位置。
 * @param {Function} props.onClose - 閉じる。
 * @param {Function} props.onDrag - 動かした（`(e, {x, y})`）。
 * @returns {React.ReactElement} パネル。
 */
const BlockActivityDiagram = ({ layout, name, panelRef, position, onClose, onDrag }) => {
    const intl = useIntl();
    return (
        <div className={styles.overlay}>
            <Draggable bounds="parent" handle={`.${styles.header}`} position={position} onDrag={onDrag}>
                <div
                    aria-label={intl.formatMessage(messages.title, { name })}
                    className={styles.panel}
                    data-testid="block-activity-diagram"
                    ref={panelRef}
                    role="dialog"
                >
                    <div className={styles.header}>
                        <span className={styles.title} data-testid="block-activity-diagram-title">
                            {intl.formatMessage(messages.title, { name })}
                        </span>
                        <button
                            aria-label={intl.formatMessage(messages.close)}
                            className={styles.close}
                            data-testid="block-activity-diagram-close"
                            title={intl.formatMessage(messages.close)}
                            type="button"
                            onClick={onClose}
                        >
                            {'×'}
                        </button>
                    </div>
                    <div className={styles.body} data-testid="block-activity-diagram-body">
                        {layout ? (
                            <LessonActivityDiagram layout={layout} />
                        ) : (
                            <p className={styles.message} data-testid="block-activity-diagram-gone">
                                {intl.formatMessage(messages.scriptGone)}
                            </p>
                        )}
                    </div>
                    {layout ? <p className={styles.note}>{intl.formatMessage(messages.liveNote)}</p> : null}
                </div>
            </Draggable>
        </div>
    );
};

BlockActivityDiagram.propTypes = {
    layout: PropTypes.shape({
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        shapes: PropTypes.arrayOf(PropTypes.object).isRequired,
        edges: PropTypes.arrayOf(PropTypes.object).isRequired,
        description: PropTypes.string,
    }),
    name: PropTypes.string.isRequired,
    panelRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
    position: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }).isRequired,
    onClose: PropTypes.func.isRequired,
    onDrag: PropTypes.func.isRequired,
};

export default BlockActivityDiagram;
