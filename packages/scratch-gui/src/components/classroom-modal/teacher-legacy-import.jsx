/**
 * 「以前の採点結果 CSV を読み込む」（#2431）: これまでの採点の画面は評価をサーバーに
 * 保存しておらず、先生が書き出した CSV にだけ残っている。それを読み、課題の名前で
 * このクラスの課題に照らし合わせ、プレビューを見せてから、先生の評価として確定で保存する。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    legacyGradingBody,
    parseLegacyGradingCsv,
    planLegacyImport,
} from '../../lib/classroom-evaluation/legacy-csv-import.js';
import ClassroomButton from './classroom-button.jsx';
import importStyles from './teacher-legacy-import.css';

const messages = defineMessages({
    open: {
        defaultMessage: 'Import an earlier grading CSV',
        description: 'Gradebook: text button to read the grading-result CSV exported from the old grading screen',
        id: 'gui.classroom.legacyImport.open',
    },
    heading: {
        defaultMessage: 'Import grades from an earlier CSV',
        description: 'Gradebook: heading of the import preview',
        id: 'gui.classroom.legacyImport.heading',
    },
    lead: {
        defaultMessage: 'Grades and reasons are saved as your grades and confirmed. Assignments are matched by name.',
        description: 'Gradebook: what the import does',
        id: 'gui.classroom.legacyImport.lead',
    },
    row: {
        defaultMessage: '{name}: {count} grades',
        description: 'Gradebook: one assignment in the import preview',
        id: 'gui.classroom.legacyImport.row',
    },
    overwrite: {
        defaultMessage: 'This assignment already has grades. They are replaced for the seats in the file.',
        description: 'Gradebook: warning for an assignment that already has grades on the new screen',
        id: 'gui.classroom.legacyImport.overwrite',
    },
    unmatched: {
        defaultMessage: 'Not found in this class (not imported): {names}',
        description: 'Gradebook: assignment names in the CSV that match no assignment of the class',
        id: 'gui.classroom.legacyImport.unmatched',
    },
    nothing: {
        defaultMessage: 'No grades in the file match an assignment of this class.',
        description: 'Gradebook: the CSV has nothing to import',
        id: 'gui.classroom.legacyImport.nothing',
    },
    badFile: {
        defaultMessage: 'This file is not a grading-result CSV.',
        description: 'Gradebook: the chosen file is not the old grading-result CSV',
        id: 'gui.classroom.legacyImport.badFile',
    },
    run: {
        defaultMessage: 'Import',
        description: 'Gradebook: button to save the previewed grades',
        id: 'gui.classroom.legacyImport.run',
    },
    cancel: {
        defaultMessage: 'Cancel',
        description: 'Gradebook: button to close the import preview',
        id: 'gui.classroom.legacyImport.cancel',
    },
    running: {
        defaultMessage: 'Importing…',
        description: 'Gradebook: the import is running',
        id: 'gui.classroom.legacyImport.running',
    },
    done: {
        defaultMessage: 'Imported {count} assignments.',
        description: 'Gradebook: the import finished',
        id: 'gui.classroom.legacyImport.done',
    },
    failed: {
        defaultMessage: 'Could not import: {names}',
        description: 'Gradebook: assignments whose import failed',
        id: 'gui.classroom.legacyImport.failed',
    },
});

/**
 * The import entry point and its preview.
 * @param {object} props - the class's assignments, their gradings and the save action
 * @param {Array<object>} props.lessons - the assignments ({classroomId, assignmentName})
 * @param {object} props.gradings - classroomId → saved grading
 * @param {Function} props.onImportGrading - (classroomId, body) → Promise; saves one assignment
 * @returns {React.ReactElement} the button, and the preview when a file is read
 */
const TeacherLegacyImport = ({ lessons, gradings, onImportGrading }) => {
    const intl = useIntl();
    const inputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);

    const handlePick = useCallback(() => {
        setResult(null);
        if (inputRef.current) inputRef.current.click();
    }, []);

    const handleFile = useCallback(
        (event) => {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const parsed = parseLegacyGradingCsv(String(reader.result || ''));
                if (parsed.error) {
                    setPreview({ error: true });
                    return;
                }
                const plan = planLegacyImport(
                    parsed.assignments,
                    lessons.map((l) => {
                        const grading = gradings[l.classroomId];
                        return {
                            classroomId: l.classroomId,
                            assignmentName: l.assignmentName,
                            hasGrades: !!(grading && grading.grades && Object.keys(grading.grades).length > 0),
                        };
                    }),
                );
                setPreview({ plan });
            };
            reader.readAsText(file, 'utf-8');
        },
        [lessons, gradings],
    );

    const handleCancel = useCallback(() => setPreview(null), []);

    const handleRun = useCallback(async () => {
        if (!preview || !preview.plan) return;
        setRunning(true);
        const confirmedAt = new Date().toISOString();
        const failed = [];
        let count = 0;
        for (const match of preview.plan.matches) {
            try {
                await onImportGrading(match.classroomId, legacyGradingBody(match.grades, confirmedAt));
                count++;
            } catch (err) {
                failed.push(match.name);
            }
        }
        setRunning(false);
        setPreview(null);
        setResult({ count, failed });
    }, [preview, onImportGrading]);

    const plan = preview && preview.plan;
    return (
        <div className={importStyles.area}>
            <ClassroomButton dataTestId="classroom-legacy-import-open" variant="text" onClick={handlePick}>
                {intl.formatMessage(messages.open)}
            </ClassroomButton>
            <input
                accept=".csv,text/csv"
                className={importStyles.file}
                data-testid="classroom-legacy-import-file"
                ref={inputRef}
                type="file"
                onChange={handleFile}
            />
            {result && (
                <p className={importStyles.result} data-testid="classroom-legacy-import-result" role="status">
                    {intl.formatMessage(messages.done, { count: result.count })}
                    {result.failed.length > 0 &&
                        ` ${intl.formatMessage(messages.failed, { names: result.failed.join('、') })}`}
                </p>
            )}
            {preview && (
                <div className={importStyles.panel} data-testid="classroom-legacy-import-preview">
                    <h3 className={importStyles.heading}>{intl.formatMessage(messages.heading)}</h3>
                    {preview.error ? (
                        <p className={importStyles.warn}>{intl.formatMessage(messages.badFile)}</p>
                    ) : (
                        <>
                            <p className={importStyles.lead}>{intl.formatMessage(messages.lead)}</p>
                            {plan.matches.length === 0 ? (
                                <p className={importStyles.warn}>{intl.formatMessage(messages.nothing)}</p>
                            ) : (
                                <ul className={importStyles.list}>
                                    {plan.matches.map((m) => (
                                        <li key={m.classroomId}>
                                            {intl.formatMessage(messages.row, { name: m.name, count: m.count })}
                                            {m.overwrite && (
                                                <span className={importStyles.warn}>
                                                    {intl.formatMessage(messages.overwrite)}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {plan.unmatched.length > 0 && (
                                <p className={importStyles.note}>
                                    {intl.formatMessage(messages.unmatched, { names: plan.unmatched.join('、') })}
                                </p>
                            )}
                        </>
                    )}
                    <div className={importStyles.buttons}>
                        {plan && plan.matches.length > 0 && (
                            <ClassroomButton
                                dataTestId="classroom-legacy-import-run"
                                disabled={running}
                                variant="primary"
                                onClick={handleRun}
                            >
                                {intl.formatMessage(running ? messages.running : messages.run)}
                            </ClassroomButton>
                        )}
                        <ClassroomButton
                            dataTestId="classroom-legacy-import-cancel"
                            disabled={running}
                            variant="secondary"
                            onClick={handleCancel}
                        >
                            {intl.formatMessage(messages.cancel)}
                        </ClassroomButton>
                    </div>
                </div>
            )}
        </div>
    );
};

TeacherLegacyImport.propTypes = {
    /** classroomId → saved grading */
    gradings: PropTypes.object.isRequired,
    /** The class's assignments. */
    lessons: PropTypes.arrayOf(PropTypes.object).isRequired,
    /** (classroomId, body) → Promise that saves one assignment's grading */
    onImportGrading: PropTypes.func.isRequired,
};

export default TeacherLegacyImport;
