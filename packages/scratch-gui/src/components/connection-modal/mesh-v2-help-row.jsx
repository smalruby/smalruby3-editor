// === Smalruby: This file is Smalruby-specific (MeshV2 help in the body) ===
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './mesh-v2-help-row.css';

/**
 * メッシュの接続のモーダルの［ヘルプ］。濃い緑のヘッダーの上の小さい文字は読みにくいので
 * （デザインシステムの「つなぐ画面」）、ヘッダーではなく本文の下に、どの画面でも出す (#1899)。
 * @param {object} props - props.
 * @param {Function} props.onHelp - opens the mesh help page.
 * @returns {?React.ReactElement} the help row, or null without onHelp.
 */
const MeshV2HelpRow = ({ onHelp }) => {
    if (!onHelp) return null;
    return (
        <div className={styles.row}>
            <button className={styles.button} data-testid="meshV2-help" onClick={onHelp} type="button">
                <FormattedMessage defaultMessage="Help" description="Help button in modal" id="gui.modal.help" />
            </button>
        </div>
    );
};

MeshV2HelpRow.propTypes = {
    onHelp: PropTypes.func,
};

export default MeshV2HelpRow;
