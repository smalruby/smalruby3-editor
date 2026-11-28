import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { connect } from 'react-redux';
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
 * The right column of the Japanese tab (docs/design-system/code-tab.md「日本語タブの右の列」):
 * the console fills its height, and the sprites and backdrops (the children) wait behind a
 * strip with the name of the edited sprite. A Japanese program is a program of a terminal
 * that moves no character, and the list could change the edited sprite unnoticed. The strip
 * opens the list in place. Outside the Japanese tab the children are shown as they are; the
 * children keep their place in the tree, so the list is not mounted again.
 * @param {object} props - The props.
 * @param {boolean} props.active - Whether the Japanese tab is open.
 * @param {boolean} props.isStage - Whether the stage is edited.
 * @param {?string} props.targetName - The name of the edited sprite.
 * @param {React.ReactNode} props.children - The sprites and backdrops.
 * @returns {React.ReactElement} The column.
 */
const JapaneseRightColumn = ({ active, isStage = false, targetName = null, children }) => {
    const intl = useIntl();
    const [targetsOpen, setTargetsOpen] = useState(false);
    useEffect(() => {
        if (!active) setTargetsOpen(false);
    }, [active]);
    const handleToggleTargets = useCallback(() => setTargetsOpen((open) => !open), []);
    const targetsShown = !active || targetsOpen;
    const name = isStage ? intl.formatMessage(messages.stage) : targetName || '';
    return (
        <React.Fragment>
            {active ? <SmalrubyConsoleSlot /> : null}
            <div
                className={targetsShown ? styles.targets : null}
                data-testid="japanese-right-column-targets"
                hidden={!targetsShown}
            >
                {children}
            </div>
            {active ? (
                <div className={styles.strip} data-testid="japanese-right-column-strip">
                    <span className={styles.program}>
                        <FormattedMessage
                            {...messages.program}
                            values={{ name: <b className={styles.name}>{name}</b> }}
                        />
                    </span>
                    <button
                        aria-expanded={targetsOpen}
                        className={styles.link}
                        data-testid="japanese-right-column-show-targets"
                        onClick={handleToggleTargets}
                        type="button"
                    >
                        {intl.formatMessage(targetsOpen ? messages.hideTargets : messages.showTargets)}
                    </button>
                </div>
            ) : null}
        </React.Fragment>
    );
};

JapaneseRightColumn.propTypes = {
    active: PropTypes.bool.isRequired,
    children: PropTypes.node,
    isStage: PropTypes.bool,
    targetName: PropTypes.string,
};

const mapStateToProps = (state) => {
    const { editingTarget, sprites, stage } = state.scratchGui.targets;
    const sprite = sprites && sprites[editingTarget];
    return {
        isStage: Boolean(stage && editingTarget && stage.id === editingTarget),
        targetName: sprite ? sprite.name : null,
    };
};

export { JapaneseRightColumn };
export default connect(mapStateToProps)(JapaneseRightColumn);
