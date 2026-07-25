/**
 * 合言葉で取り込み（#1109・受け取る側）。先生からもらった合言葉で、限定公開の
 * 課題をこの組に取り込む。入力 → プレビュー（lookup・sharedId は露出しない）→
 * 取り込み。ボード（課題一覧）の「合言葉で取り込み」から開く。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './classroom-modal.css';

const TeacherPasscodeImport = ({ group, isLoading, lookup, error, onLookup, onImport, onCancel }) => {
    const [passcode, setPasscode] = useState('');

    const handleChange = useCallback((e) => {
        // 参加コード同型（英数字小文字）。空白を除き小文字化して扱う。
        setPasscode(e.target.value.trim().toLowerCase());
    }, []);
    const handleLookup = useCallback(() => {
        if (passcode.trim()) onLookup(passcode.trim());
    }, [onLookup, passcode]);
    const handleImport = useCallback(() => {
        onImport(passcode.trim(), group.groupId);
    }, [onImport, passcode, group]);

    return (
        <div className={styles.postAssignmentContainer} data-testid="classroom-phase-passcode-import">
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Import by passcode"
                    description="Passcode import step title"
                    id="gui.classroom.shared.passcodeImportTitle"
                />
            </div>
            <p className={styles.postAssignmentHint}>
                <FormattedMessage
                    defaultMessage={
                        'Enter the passcode a fellow teacher gave you to import the assignment into this class.'
                    }
                    description="Passcode import hint"
                    id="gui.classroom.shared.passcodeImportHint"
                />
            </p>
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    <FormattedMessage
                        defaultMessage="Passcode"
                        description="Label for the 合言葉"
                        id="gui.classroom.shared.passcodeLabel"
                    />
                    {': '}
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-passcode-input"
                    maxLength={6}
                    placeholder="abc234"
                    type="text"
                    value={passcode}
                    onChange={handleChange}
                />
            </div>
            {error ? (
                <div className={styles.passcodeError} data-testid="classroom-passcode-error">
                    {error}
                </div>
            ) : null}
            {lookup ? (
                <div className={styles.passcodePreview} data-testid="classroom-passcode-preview">
                    <FormattedMessage
                        defaultMessage={'Import "{title}" into this class.'}
                        description="Passcode lookup preview"
                        id="gui.classroom.shared.passcodePreview"
                        values={{ title: lookup.title }}
                    />
                </div>
            ) : null}
            <div className={styles.formFooter}>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-passcode-cancel"
                    type="button"
                    onClick={onCancel}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel passcode import"
                        id="gui.classroom.shared.shareCancel"
                    />
                </button>
                {lookup ? (
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-passcode-import"
                        disabled={isLoading}
                        type="button"
                        onClick={handleImport}
                    >
                        <FormattedMessage
                            defaultMessage="Import into this class"
                            description="Import the looked-up assignment"
                            id="gui.classroom.shared.passcodeImportBtn"
                        />
                    </button>
                ) : (
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-passcode-lookup"
                        disabled={!passcode.trim() || isLoading}
                        type="button"
                        onClick={handleLookup}
                    >
                        <FormattedMessage
                            defaultMessage="Check"
                            description="Look up the passcode"
                            id="gui.classroom.shared.passcodeLookupBtn"
                        />
                    </button>
                )}
            </div>
        </div>
    );
};

TeacherPasscodeImport.propTypes = {
    error: PropTypes.string,
    group: PropTypes.shape({ groupId: PropTypes.string }).isRequired,
    isLoading: PropTypes.bool,
    lookup: PropTypes.shape({ title: PropTypes.string }),
    onCancel: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    onLookup: PropTypes.func.isRequired,
};

export default TeacherPasscodeImport;
