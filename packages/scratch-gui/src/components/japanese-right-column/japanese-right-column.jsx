import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { connect } from 'react-redux';
import { STAGE_DISPLAY_SIZES } from '../../lib/layout-constants.js';
import { getStageDimensions } from '../../lib/screen-utils.js';
import { setSmalrubyConsoleVisible } from '../../reducers/smalruby-console.js';
import { SmalrubyConsoleSlot } from '../smalruby-console/smalruby-console-slot.jsx';
import styles from './japanese-right-column.css';

const messages = defineMessages({
    program: {
        id: 'gui.japaneseRightColumn.program',
        defaultMessage: 'Program of {name}',
        description: 'Strip under the console of the Japanese tab: whose program is edited',
    },
    stage: {
        id: 'gui.japaneseRightColumn.stage',
        defaultMessage: 'the stage',
        description: 'The name of the stage in the strip under the console of the Japanese tab',
    },
    showTargets: {
        id: 'gui.japaneseRightColumn.showTargets',
        defaultMessage: 'See the sprites and backdrops',
        description: 'Link in the strip under the console of the Japanese tab that opens the sprites and backdrops',
    },
    hideTargets: {
        id: 'gui.japaneseRightColumn.hideTargets',
        defaultMessage: 'Hide the sprites and backdrops',
        description: 'Link in the strip under the console of the Japanese tab that closes the sprites and backdrops',
    },
});

/**
 * The right column while the console is shown, in every tab, and always in the Japanese tab
 * (docs/design-system/code-tab.md「コンソールを出しているときの右の列」): the console fills its
 * height, and the sprites and backdrops (the children) wait behind a strip with the name of
 * the edited sprite. The console and the sprites are never shown together: with both on the
 * screen, a click on the list changed the edited sprite unnoticed while the program was read in
 * the console. The strip leads to the sprites: it hides the console and opens them. In the
 * Japanese tab, where a program moves no character, the sprites stay behind the strip with the
 * console hidden too (the stage is shown), and the strip opens them in place. Elsewhere, with the
 * console hidden, the children are shown as they are; they keep their place in the tree, so the
 * list is not mounted again.
 * @param {object} props - The props.
 * @param {boolean} props.active - Whether the Japanese tab is open.
 * @param {boolean} props.consoleVisible - Whether the console is shown.
 * @param {boolean} props.isStage - Whether the stage is edited.
 * @param {string} props.stageSize - The size of the stage: the console takes its width (the
 * column has no width of its own; the stage gives it).
 * @param {?string} props.targetName - The name of the edited sprite.
 * @param {Function} props.onHideConsole - Hides the console (the stage is shown in its place).
 * @param {React.ReactNode} props.children - The sprites and backdrops.
 * @returns {React.ReactElement} The column.
 */
const JapaneseRightColumn = ({
    active,
    consoleVisible = false,
    isStage = false,
    stageSize,
    targetName = null,
    onHideConsole = () => {},
    children,
}) => {
    const intl = useIntl();
    const [targetsOpen, setTargetsOpen] = useState(false);
    useEffect(() => {
        // the console is shown: only the console (it closes the sprites the strip opened)
        if (!active || consoleVisible) setTargetsOpen(false);
    }, [active, consoleVisible]);
    const handleToggleTargets = useCallback(() => {
        if (consoleVisible) {
            // the sprites are used with the stage, not with the console
            onHideConsole();
            setTargetsOpen(true);
            return;
        }
        setTargetsOpen((open) => !open);
    }, [consoleVisible, onHideConsole]);
    const column = active || consoleVisible;
    const targetsShown = !consoleVisible && (!active || targetsOpen);
    const linkOpens = consoleVisible || !targetsOpen;
    const name = isStage ? intl.formatMessage(messages.stage) : targetName || '';
    return (
        <React.Fragment>
            {column ? (
                <SmalrubyConsoleSlot
                    shrinkWhenEmpty={targetsOpen}
                    width={getStageDimensions(stageSize, false).width}
                />
            ) : null}
            <div
                className={targetsShown ? styles.targets : null}
                data-testid="japanese-right-column-targets"
                hidden={!targetsShown}
            >
                {children}
            </div>
            {column ? (
                <div className={styles.strip} data-testid="japanese-right-column-strip">
                    <span className={styles.program}>
                        <FormattedMessage
                            {...messages.program}
                            values={{ name: <b className={styles.name}>{name}</b> }}
                        />
                    </span>
                    <button
                        aria-expanded={!linkOpens}
                        className={styles.link}
                        data-testid="japanese-right-column-show-targets"
                        onClick={handleToggleTargets}
                        type="button"
                    >
                        {intl.formatMessage(linkOpens ? messages.showTargets : messages.hideTargets)}
                    </button>
                </div>
            ) : null}
        </React.Fragment>
    );
};

JapaneseRightColumn.propTypes = {
    active: PropTypes.bool.isRequired,
    children: PropTypes.node,
    consoleVisible: PropTypes.bool,
    isStage: PropTypes.bool,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    targetName: PropTypes.string,
    onHideConsole: PropTypes.func,
};

const mapStateToProps = (state) => {
    const { editingTarget, sprites, stage } = state.scratchGui.targets;
    const sprite = sprites && sprites[editingTarget];
    return {
        isStage: Boolean(stage && editingTarget && stage.id === editingTarget),
        targetName: sprite ? sprite.name : null,
        consoleVisible: state.scratchGui.smalrubyConsole.visible,
    };
};

const mapDispatchToProps = (dispatch) => ({
    onHideConsole: () => dispatch(setSmalrubyConsoleVisible(false)),
});

export { JapaneseRightColumn };
export default connect(mapStateToProps, mapDispatchToProps)(JapaneseRightColumn);
