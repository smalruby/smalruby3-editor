import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import {
    buttonValueFor,
    MAX_MESSAGE_VALUE_LENGTH,
    MAX_VARIABLE_NAME_LENGTH,
    partnerVariableRows,
} from '../../lib/mesh-practice/partner';
import styles from './mesh-practice-partner.css';

const messages = defineMessages({
    use: {
        id: 'gui.meshPractice.use',
        defaultMessage: 'Use the practice partner',
        description: 'Checkbox that turns on the mesh practice partner',
    },
    note: {
        id: 'gui.meshPractice.note',
        defaultMessage:
            'Works only while mesh is not connected. Nothing is sent to the server. ' +
            'The settings are kept in this browser, not in the project.',
        description: 'Explanation of the mesh practice partner',
    },
    paused: {
        id: 'gui.meshPractice.paused',
        defaultMessage: 'The practice partner rests while mesh is connected.',
        description: 'Shown while mesh is connected, when the practice partner cannot be used',
    },
    sendTitle: {
        id: 'gui.meshPractice.sendTitle',
        defaultMessage: 'Send a message',
        description: 'Heading of the list of messages the practice partner can send',
    },
    valuePlaceholder: {
        id: 'gui.meshPractice.valuePlaceholder',
        defaultMessage: 'value (optional)',
        description: 'Placeholder of the value sent with a message',
    },
    send: {
        id: 'gui.meshPractice.send',
        defaultMessage: 'Send',
        description: 'Button: the practice partner sends this message',
    },
    sendLabel: {
        id: 'gui.meshPractice.sendLabel',
        defaultMessage: 'Send {name}',
        description: 'Accessible name of the send button of a message',
    },
    noMessages: {
        id: 'gui.meshPractice.noMessages',
        defaultMessage: 'This project has no messages yet.',
        description: 'The project has no broadcast messages',
    },
    variablesTitle: {
        id: 'gui.meshPractice.variablesTitle',
        defaultMessage: "Partner's variables",
        description: 'Heading of the variables the practice partner has (read with "sensor value")',
    },
    set: {
        id: 'gui.meshPractice.set',
        defaultMessage: 'Set',
        description: 'Button: the practice partner sets the variable to the value',
    },
    setLabel: {
        id: 'gui.meshPractice.setLabel',
        defaultMessage: 'Set {name}',
        description: 'Accessible name of the set button of a variable',
    },
    notSet: {
        id: 'gui.meshPractice.notSet',
        defaultMessage: 'not set',
        description: 'Placeholder of a partner variable that has no value yet',
    },
    remove: {
        id: 'gui.meshPractice.remove',
        defaultMessage: 'Remove {name}',
        description: 'Button that removes a partner variable or an automatic reply',
    },
    newVariable: {
        id: 'gui.meshPractice.newVariable',
        defaultMessage: 'new variable name',
        description: 'Placeholder of the name of a new partner variable',
    },
    addVariable: {
        id: 'gui.meshPractice.addVariable',
        defaultMessage: 'Make',
        description: 'Button that makes a new partner variable',
    },
    createdHint: {
        id: 'gui.meshPractice.createdHint',
        defaultMessage: 'Variables you make here appear in the "sensor value" block.',
        description: 'Hint below the partner variables',
    },
    repliesTitle: {
        id: 'gui.meshPractice.repliesTitle',
        defaultMessage: 'Automatic replies',
        description: 'Heading of the automatic replies of the practice partner',
    },
    reply: {
        id: 'gui.meshPractice.reply',
        defaultMessage: 'When it receives {on}, send back {send}',
        description: 'One automatic reply of the practice partner',
    },
    replyWithValue: {
        id: 'gui.meshPractice.replyWithValue',
        defaultMessage: 'When it receives {on}, send back {send} with {value}',
        description: 'One automatic reply of the practice partner that sends a value',
    },
    replyOn: {
        id: 'gui.meshPractice.replyOn',
        defaultMessage: 'When it receives',
        description: 'Label of the message that starts an automatic reply',
    },
    replySend: {
        id: 'gui.meshPractice.replySend',
        defaultMessage: 'send back',
        description: 'Label of the message the automatic reply sends back',
    },
    addReply: {
        id: 'gui.meshPractice.addReply',
        defaultMessage: 'Add',
        description: 'Button that adds an automatic reply',
    },
    noReplies: {
        id: 'gui.meshPractice.noReplies',
        defaultMessage: 'No automatic replies yet.',
        description: 'The practice partner has no automatic replies',
    },
});

const MessageRow = ({ intl, name, initialValue, onSend }) => {
    const [value, setValue] = useState(initialValue);
    const handleChange = useCallback((e) => setValue(e.target.value), []);
    const handleSend = useCallback(() => onSend(name, value), [name, value, onSend]);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') handleSend();
        },
        [handleSend],
    );
    return (
        <li className={styles.row} data-testid="mesh-practice-message">
            <span className={styles.name}>{name}</span>
            <input
                aria-label={intl.formatMessage(messages.valuePlaceholder)}
                className={styles.input}
                data-testid="mesh-practice-message-value"
                maxLength={MAX_MESSAGE_VALUE_LENGTH}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={intl.formatMessage(messages.valuePlaceholder)}
                type="text"
                value={value}
            />
            <button
                aria-label={intl.formatMessage(messages.sendLabel, { name })}
                className={styles.button}
                data-testid="mesh-practice-send"
                onClick={handleSend}
            >
                <FormattedMessage {...messages.send} />
            </button>
        </li>
    );
};

MessageRow.propTypes = {
    initialValue: PropTypes.string.isRequired,
    intl: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
    onSend: PropTypes.func.isRequired,
};

const VariableRow = ({ intl, row, onRemove, onSet }) => {
    const [value, setValue] = useState(row.value === null ? '' : row.value);
    const handleChange = useCallback((e) => setValue(e.target.value), []);
    const handleSet = useCallback(() => onSet(row.name, value), [row.name, value, onSet]);
    const handleRemove = useCallback(() => onRemove(row.name), [row.name, onRemove]);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') handleSet();
        },
        [handleSet],
    );
    return (
        <li className={styles.row} data-testid="mesh-practice-variable">
            <span className={classNames(styles.name, { [styles.created]: row.created })}>{row.name}</span>
            <input
                aria-label={row.name}
                className={styles.input}
                data-testid="mesh-practice-variable-value"
                maxLength={MAX_MESSAGE_VALUE_LENGTH}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={row.value === null ? intl.formatMessage(messages.notSet) : ''}
                type="text"
                value={value}
            />
            <span className={styles.actions}>
                <button
                    aria-label={intl.formatMessage(messages.setLabel, { name: row.name })}
                    className={styles.button}
                    data-testid="mesh-practice-variable-set"
                    onClick={handleSet}
                >
                    <FormattedMessage {...messages.set} />
                </button>
                {row.created && (
                    <button
                        aria-label={intl.formatMessage(messages.remove, { name: row.name })}
                        className={styles.removeButton}
                        data-testid="mesh-practice-variable-remove"
                        onClick={handleRemove}
                        title={intl.formatMessage(messages.remove, { name: row.name })}
                    >
                        {'×'}
                    </button>
                )}
            </span>
        </li>
    );
};

VariableRow.propTypes = {
    intl: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
    onSet: PropTypes.func.isRequired,
    row: PropTypes.shape({
        created: PropTypes.bool,
        name: PropTypes.string,
        value: PropTypes.string,
    }).isRequired,
};

const ReplyForm = ({ intl, messageNames, onAdd }) => {
    const [on, setOn] = useState(messageNames[0] || '');
    const [send, setSend] = useState(messageNames[0] || '');
    const [value, setValue] = useState('');
    const pick = (current) => (messageNames.includes(current) ? current : messageNames[0] || '');
    const onName = pick(on);
    const sendName = pick(send);
    const handleOn = useCallback((e) => setOn(e.target.value), []);
    const handleSend = useCallback((e) => setSend(e.target.value), []);
    const handleValue = useCallback((e) => setValue(e.target.value), []);
    const handleAdd = useCallback(() => {
        if (onAdd({ onBroadcast: onName, broadcast: sendName, value })) setValue('');
    }, [onAdd, onName, sendName, value]);
    if (messageNames.length === 0) return null;
    return (
        <div className={styles.replyForm} data-testid="mesh-practice-reply-form">
            <label className={styles.replyField}>
                <span>
                    <FormattedMessage {...messages.replyOn} />
                </span>
                <select
                    className={styles.input}
                    data-testid="mesh-practice-reply-on"
                    onChange={handleOn}
                    value={onName}
                >
                    {messageNames.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>
            <label className={styles.replyField}>
                <span>
                    <FormattedMessage {...messages.replySend} />
                </span>
                <select
                    className={styles.input}
                    data-testid="mesh-practice-reply-send"
                    onChange={handleSend}
                    value={sendName}
                >
                    {messageNames.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>
            <div className={styles.replyValueRow}>
                <input
                    aria-label={intl.formatMessage(messages.valuePlaceholder)}
                    className={styles.input}
                    data-testid="mesh-practice-reply-value"
                    maxLength={MAX_MESSAGE_VALUE_LENGTH}
                    onChange={handleValue}
                    placeholder={intl.formatMessage(messages.valuePlaceholder)}
                    type="text"
                    value={value}
                />
                <button className={styles.button} data-testid="mesh-practice-add-reply" onClick={handleAdd}>
                    <FormattedMessage {...messages.addReply} />
                </button>
            </div>
        </div>
    );
};

ReplyForm.propTypes = {
    intl: PropTypes.object.isRequired,
    messageNames: PropTypes.arrayOf(PropTypes.string).isRequired,
    onAdd: PropTypes.func.isRequired,
};

/**
 * メッシュのウィンドウの「練習相手」タブ (#1845)。作品のメッセージと変数を自動で並べ、押すだけで
 * 練習相手として送る・値を入れる。自動の返事も作れる。
 * @param {object} props - props.
 * @param {Array<string>} props.messageNames - 作品のメッセージの名前。
 * @param {object} props.practice - useMeshPracticePartner() の結果。
 * @param {Array<string>} props.projectVariables - 作品のステージの変数の名前。
 * @returns {React.ReactElement} the tab body.
 */
const MeshPracticePartner = ({ messageNames, practice, projectVariables }) => {
    const intl = useIntl();
    const [newName, setNewName] = useState('');
    const { allowed, enabled, settings } = practice;
    const rows = partnerVariableRows(settings, projectVariables);
    const disabled = !allowed;

    const handleUse = useCallback((e) => practice.setUse(e.target.checked), [practice]);
    const handleNewName = useCallback((e) => setNewName(e.target.value), []);
    const handleAddVariable = useCallback(() => {
        if (practice.addVariable(newName)) setNewName('');
    }, [practice, newName]);
    const handleNewKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') handleAddVariable();
        },
        [handleAddVariable],
    );
    const { send: handleSend, setVariable: handleSetVariable, removeVariable: handleRemoveVariable } = practice;
    const handleAddReply = practice.addReply;
    const handleRemoveReply = useCallback((e) => practice.removeReply(Number(e.currentTarget.value)), [practice]);

    return (
        <div className={styles.practice} data-testid="mesh-practice">
            <label className={styles.use}>
                <input
                    checked={enabled && allowed}
                    data-testid="mesh-practice-use"
                    disabled={disabled}
                    onChange={handleUse}
                    type="checkbox"
                />
                <FormattedMessage {...messages.use} />
                <span className={classNames(styles.dot, { [styles.dotOn]: practice.active })} />
            </label>
            {disabled ? (
                <p className={styles.paused} data-testid="mesh-practice-paused">
                    <FormattedMessage {...messages.paused} />
                </p>
            ) : (
                <p className={styles.note}>
                    <FormattedMessage {...messages.note} />
                </p>
            )}
            <fieldset className={styles.sections} disabled={disabled}>
                <h3 className={styles.heading}>
                    <FormattedMessage {...messages.sendTitle} />
                </h3>
                {messageNames.length === 0 ? (
                    <p className={styles.muted}>
                        <FormattedMessage {...messages.noMessages} />
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {messageNames.map((name) => (
                            <MessageRow
                                initialValue={buttonValueFor(settings, name)}
                                intl={intl}
                                key={name}
                                name={name}
                                onSend={handleSend}
                            />
                        ))}
                    </ul>
                )}

                <h3 className={styles.heading}>
                    <FormattedMessage {...messages.variablesTitle} />
                </h3>
                <ul className={styles.list}>
                    {rows.map((row) => (
                        <VariableRow
                            intl={intl}
                            key={`${row.created ? 'c' : 'p'}:${row.name}`}
                            onRemove={handleRemoveVariable}
                            onSet={handleSetVariable}
                            row={row}
                        />
                    ))}
                </ul>
                <div className={styles.addRow}>
                    <input
                        aria-label={intl.formatMessage(messages.newVariable)}
                        className={styles.input}
                        data-testid="mesh-practice-new-variable"
                        maxLength={MAX_VARIABLE_NAME_LENGTH}
                        onChange={handleNewName}
                        onKeyDown={handleNewKeyDown}
                        placeholder={intl.formatMessage(messages.newVariable)}
                        type="text"
                        value={newName}
                    />
                    <button
                        className={styles.button}
                        data-testid="mesh-practice-add-variable"
                        disabled={newName.trim() === ''}
                        onClick={handleAddVariable}
                    >
                        <FormattedMessage {...messages.addVariable} />
                    </button>
                </div>
                <p className={styles.muted}>
                    <FormattedMessage {...messages.createdHint} />
                </p>

                <h3 className={styles.heading}>
                    <FormattedMessage {...messages.repliesTitle} />
                </h3>
                {settings.replies.length === 0 ? (
                    <p className={styles.muted}>
                        <FormattedMessage {...messages.noReplies} />
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {settings.replies.map((reply, index) => {
                            const text = intl.formatMessage(reply.value ? messages.replyWithValue : messages.reply, {
                                on: `「${reply.onBroadcast}」`,
                                send: `「${reply.broadcast}」`,
                                value: `「${reply.value}」`,
                            });
                            return (
                                <li
                                    className={styles.replyRow}
                                    data-testid="mesh-practice-reply"
                                    key={`${reply.onBroadcast}-${reply.broadcast}-${reply.value}`}
                                >
                                    <span className={styles.replyText}>{text}</span>
                                    <button
                                        aria-label={intl.formatMessage(messages.remove, { name: text })}
                                        className={styles.removeButton}
                                        data-testid="mesh-practice-reply-remove"
                                        onClick={handleRemoveReply}
                                        title={intl.formatMessage(messages.remove, { name: text })}
                                        value={index}
                                    >
                                        {'×'}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <ReplyForm intl={intl} messageNames={messageNames} onAdd={handleAddReply} />
            </fieldset>
        </div>
    );
};

MeshPracticePartner.propTypes = {
    messageNames: PropTypes.arrayOf(PropTypes.string).isRequired,
    practice: PropTypes.shape({
        active: PropTypes.bool,
        addReply: PropTypes.func,
        addVariable: PropTypes.func,
        allowed: PropTypes.bool,
        enabled: PropTypes.bool,
        removeReply: PropTypes.func,
        removeVariable: PropTypes.func,
        send: PropTypes.func,
        setUse: PropTypes.func,
        setVariable: PropTypes.func,
        settings: PropTypes.object,
    }).isRequired,
    projectVariables: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default MeshPracticePartner;
