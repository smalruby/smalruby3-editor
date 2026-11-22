// Studuino モードの書きこみのモーダル（#2219・S13・S7）。検査 → hex を作る → 書きこむ の進み具合を出す。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import { STUDUINO_IR_LIMITS } from '../../lib/studuino-ir/limits';
import { progressMarks, STEP } from '../../lib/studuino-write-steps';
import Box from '../box/box.jsx';
import styles from './studuino-write-modal.css';

/** ライブラリ（Studuino ライブラリ・GPL）のソースの入手先（アーテック社の公式の配布元）。 */
const LIBRARY_URL = 'https://www.artec-kk.co.jp/studuino/ja/arduino.php';
/** スモウルビー（構文木の検査と C++ の書き出しのコードを含む）のソース。 */
const SMALRUBY_SOURCE_URL = 'https://github.com/smalruby/smalruby3-editor';

const messages = defineMessages({
    title: {
        defaultMessage: 'Write to Studuino',
        description: 'Title of the modal to write the program to Studuino',
        id: 'gui.studuinoWrite.title',
    },
    notConfigured: {
        defaultMessage: 'Writing to Studuino is not available here.',
        description: 'The compile API is not configured',
        id: 'gui.studuinoWrite.error.notConfigured',
    },
    network: {
        defaultMessage: 'Could not connect to the server. Check the network and try again.',
        description: 'Network error of the compile API',
        id: 'gui.studuinoWrite.error.network',
    },
    invalidIr: {
        defaultMessage: 'The program has something that can not be written.',
        description: 'The compile API rejected the program',
        id: 'gui.studuinoWrite.error.invalidIr',
    },
    forbidden: {
        defaultMessage: 'Writing to Studuino is not available from this page.',
        description: 'The compile API rejected the origin',
        id: 'gui.studuinoWrite.error.forbidden',
    },
    tooLarge: {
        defaultMessage: 'The program is too large. Make it smaller.',
        description: 'The program is too large for the compile API',
        id: 'gui.studuinoWrite.error.tooLarge',
    },
    tooManyVariables: {
        defaultMessage: 'Too many variables. Studuino can use up to {limit} variables. Use fewer variables.',
        description: 'The program uses more variables than Studuino can hold',
        id: 'gui.studuinoWrite.error.tooManyVariables',
    },
    compileFailed: {
        defaultMessage: 'Could not make the program for Studuino.',
        description: 'The compile failed',
        id: 'gui.studuinoWrite.error.compileFailed',
    },
    flashOverflow: {
        defaultMessage: 'The program is too large for Studuino. Make it smaller.',
        description: 'The compiled program does not fit in the flash',
        id: 'gui.studuinoWrite.error.flashOverflow',
    },
    rateLimited: {
        defaultMessage: 'Too many writes in a short time. Wait a little and try again.',
        description: 'The compile API rate limit',
        id: 'gui.studuinoWrite.error.rateLimited',
    },
    timeout: {
        defaultMessage: 'It took too long to make the program. Try again.',
        description: 'The compile timed out',
        id: 'gui.studuinoWrite.error.timeout',
    },
    internal: {
        defaultMessage: 'Something went wrong on the server. Try again.',
        description: 'Other errors of the compile API',
        id: 'gui.studuinoWrite.error.internal',
    },
});

const MESSAGE_BY_ID = Object.fromEntries(Object.values(messages).map((m) => [m.id, m]));

const Mark = ({ status }) => <span className={classNames(styles.mark, styles[status])} />;
Mark.propTypes = { status: PropTypes.string.isRequired };

const StuduinoWriteModal = ({
    step,
    blocks,
    noFlag,
    tooManyVariables,
    percent,
    messageId,
    compiled,
    webSerialSupported,
    onClose,
    onRetry,
    onSaveSource,
    onShowBlocks,
    onWrite,
}) => {
    const intl = useIntl();
    const marks = progressMarks(step);
    // 変数の数の上限（S1）は別の文で知らせるので、「使えないブロック」の数には入れない
    const unusableCount = blocks.filter(
        (b) => !(tooManyVariables && b.reason === 'too_large' && b.detail === 'too_many_variables'),
    ).length;
    return (
        <Modal contentLabel={intl.formatMessage(messages.title)} id="studuinoWriteModal" onRequestClose={onClose}>
            <Box className={styles.body} data-testid="studuino-write-modal">
                <ol className={styles.steps}>
                    <li data-testid="studuino-write-step-check" data-status={marks.check}>
                        <Mark status={marks.check} />
                        <FormattedMessage
                            defaultMessage="Check the program"
                            description="Step 1 of writing to Studuino"
                            id="gui.studuinoWrite.step.check"
                        />
                    </li>
                    <li data-testid="studuino-write-step-compile" data-status={marks.compile}>
                        <Mark status={marks.compile} />
                        <FormattedMessage
                            defaultMessage="Make the program for Studuino"
                            description="Step 2 of writing to Studuino"
                            id="gui.studuinoWrite.step.compile"
                        />
                    </li>
                    <li data-testid="studuino-write-step-write" data-status={marks.write}>
                        <Mark status={marks.write} />
                        <FormattedMessage
                            defaultMessage="Write to Studuino"
                            description="Step 3 of writing to Studuino"
                            id="gui.studuinoWrite.step.write"
                        />
                        {step === STEP.WRITING ? ` ${percent || 0}%` : null}
                    </li>
                </ol>

                <div className={styles.message} data-testid="studuino-write-message">
                    {step === STEP.CHECK_FAILED && noFlag && blocks.length === 0 ? (
                        <FormattedMessage
                            defaultMessage='Put a "when green flag clicked" block. It runs when Studuino is turned on.'
                            description="No green flag block in the Studuino mode"
                            id="gui.studuinoWrite.noFlag"
                        />
                    ) : null}
                    {step === STEP.CHECK_FAILED && tooManyVariables ? (
                        <FormattedMessage
                            {...messages.tooManyVariables}
                            values={{ limit: STUDUINO_IR_LIMITS.maxVariables }}
                        />
                    ) : null}
                    {step === STEP.CHECK_FAILED && tooManyVariables && unusableCount > 0 ? ' ' : null}
                    {step === STEP.CHECK_FAILED && unusableCount > 0 ? (
                        <FormattedMessage
                            defaultMessage="{count} blocks can not be used. Fix them and try again."
                            description="There are blocks that can not be written"
                            id="gui.studuinoWrite.unusableBlocks"
                            values={{ count: unusableCount }}
                        />
                    ) : null}
                    {step === STEP.CHECK_FAILED && !noFlag && blocks.length === 0 ? (
                        <FormattedMessage {...messages.tooLarge} />
                    ) : null}
                    {step === STEP.COMPILE_FAILED ? (
                        <FormattedMessage {...(MESSAGE_BY_ID[messageId] || messages.internal)} />
                    ) : null}
                    {step === STEP.READY && webSerialSupported ? (
                        <FormattedMessage
                            defaultMessage="Connect Studuino with the USB cable and press Write."
                            description="Ready to write to Studuino"
                            id="gui.studuinoWrite.ready"
                        />
                    ) : null}
                    {step === STEP.READY && !webSerialSupported ? (
                        <FormattedMessage
                            defaultMessage="This browser can not write to Studuino. Use Chrome or Edge."
                            description="Web Serial is not supported"
                            id="gui.studuinoWrite.noWebSerial"
                        />
                    ) : null}
                    {step === STEP.WRITE_FAILED ? (
                        <FormattedMessage
                            defaultMessage="Could not write to Studuino. Check the USB cable and try again."
                            description="Writing to Studuino failed"
                            id="gui.studuinoWrite.writeFailed"
                        />
                    ) : null}
                    {step === STEP.ABORTED ? (
                        <FormattedMessage
                            defaultMessage="Stopped. Write again, or write back the firmware to use Studuino from the computer."
                            description="Writing to Studuino was stopped"
                            id="gui.studuinoWrite.aborted"
                        />
                    ) : null}
                    {step === STEP.DONE ? (
                        <FormattedMessage
                            defaultMessage="Done! Unplug the USB cable and connect the battery to run the program."
                            description="Writing to Studuino finished"
                            id="gui.studuinoWrite.done"
                        />
                    ) : null}
                </div>

                <div className={styles.buttons}>
                    {step === STEP.CHECK_FAILED && blocks.length > 0 ? (
                        <button
                            className={classNames(styles.button, styles.primary)}
                            data-testid="studuino-write-show-blocks"
                            onClick={onShowBlocks}
                        >
                            <FormattedMessage
                                defaultMessage="Show the blocks"
                                description="Button to show the blocks that can not be used"
                                id="gui.studuinoMode.switchDialog.showBlocks"
                            />
                        </button>
                    ) : null}
                    {[STEP.COMPILE_FAILED, STEP.ABORTED].includes(step) ? (
                        <button className={styles.button} data-testid="studuino-write-retry" onClick={onRetry}>
                            <FormattedMessage
                                defaultMessage="Try again"
                                description="Button to try writing to Studuino again"
                                id="gui.studuinoWrite.retry"
                            />
                        </button>
                    ) : null}
                    {[STEP.READY, STEP.WRITE_FAILED].includes(step) && webSerialSupported ? (
                        <button
                            className={classNames(styles.button, styles.primary)}
                            data-testid="studuino-write-write"
                            onClick={onWrite}
                        >
                            <FormattedMessage
                                defaultMessage="Write"
                                description="Button to write the program to Studuino"
                                id="gui.studuinoWrite.write"
                            />
                        </button>
                    ) : null}
                    <button className={styles.button} data-testid="studuino-write-close" onClick={onClose}>
                        <FormattedMessage
                            defaultMessage="Close"
                            description="Button to close the modal to write to Studuino"
                            id="gui.studuinoWrite.close"
                        />
                    </button>
                </div>

                <div className={styles.license} data-testid="studuino-write-license">
                    <FormattedMessage
                        defaultMessage="The program uses the Studuino library of Artec (GPL). Get its source from {library}. The source of this page is at {smalruby}."
                        description="License notice of the Studuino library (GPL) used by the written program"
                        id="gui.studuinoWrite.license"
                        values={{
                            library: (
                                <a href={LIBRARY_URL} rel="noopener noreferrer" target="_blank">
                                    Artec
                                </a>
                            ),
                            smalruby: (
                                <a href={SMALRUBY_SOURCE_URL} rel="noopener noreferrer" target="_blank">
                                    GitHub
                                </a>
                            ),
                        }}
                    />{' '}
                    {compiled && compiled.source ? (
                        <button
                            className={styles.link}
                            data-testid="studuino-write-save-source"
                            onClick={onSaveSource}
                        >
                            <FormattedMessage
                                defaultMessage="Save the C++ of this program"
                                description="Button to save the generated C++ source (GPL corresponding source)"
                                id="gui.studuinoWrite.saveSource"
                            />
                        </button>
                    ) : null}
                    <div className={styles.trademark}>
                        <FormattedMessage
                            defaultMessage="Studuino® is a registered trademark of Artec Co., Ltd."
                            description="Trademark notice of Studuino"
                            id="gui.studuinoWrite.trademark"
                        />
                    </div>
                </div>
            </Box>
        </Modal>
    );
};

StuduinoWriteModal.propTypes = {
    blocks: PropTypes.arrayOf(PropTypes.object),
    compiled: PropTypes.shape({ source: PropTypes.string }),
    messageId: PropTypes.string,
    noFlag: PropTypes.bool,
    tooManyVariables: PropTypes.bool,
    percent: PropTypes.number,
    step: PropTypes.string.isRequired,
    webSerialSupported: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onRetry: PropTypes.func.isRequired,
    onSaveSource: PropTypes.func.isRequired,
    onShowBlocks: PropTypes.func.isRequired,
    onWrite: PropTypes.func.isRequired,
};

StuduinoWriteModal.defaultProps = {
    blocks: [],
};

export default StuduinoWriteModal;
