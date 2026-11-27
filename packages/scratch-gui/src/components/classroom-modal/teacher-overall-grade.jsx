/**
 * The overall grade of a class (「総合評価」, EPIC #2421 / #2426), behind the
 * ［採点簿｜総合評価］ switch of the grading tab.
 *
 * Left: the assignments to include and their weights, the points of S/A/B/C/未提出 and
 * the cuts of the weighted average. Right: the table (each assignment's grade, the
 * average and the overall grade, the newest assignment on the left) and the CSV.
 * Only confirmed assignments can be exported: an included assignment not confirmed
 * is listed with a link that opens its grading, and the CSV button stays disabled
 * (the table still shows the provisional result).
 *
 * The computation is `overallView` (pure); the settings are kept per class in this
 * browser (`useOverallGradeSettings`).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import useOverallGradeSettings from '../../containers/use-overall-grade-settings.js';
import { columnStatus, gradebookCell } from '../../lib/classroom-evaluation/gradebook.js';
import { gradingCsvText } from '../../lib/classroom-evaluation/grading-csv.js';
import { DEFAULT_WEIGHT, overallExportRows, overallView } from '../../lib/classroom-evaluation/overall-view.js';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import { gradebookMessages } from './teacher-gradebook.jsx';
import overallStyles from './teacher-overall-grade.css';

const messages = defineMessages({
    exportCsv: {
        defaultMessage: 'Export the overall grade CSV',
        description: 'Overall grade: button that downloads the CSV of the overall grade (#2426)',
        id: 'gui.classroom.overallGrade.exportCsv',
    },
    assignmentsHeading: {
        defaultMessage: 'Assignments and weights',
        description: 'Overall grade: heading of the list of assignments to include (#2426)',
        id: 'gui.classroom.overallGrade.assignmentsHeading',
    },
    weight: {
        defaultMessage: 'Weight',
        description: 'Overall grade: label of the weight of an assignment (#2426)',
        id: 'gui.classroom.overallGrade.weight',
    },
    pointsHeading: {
        defaultMessage: 'Grades as points',
        description: 'Overall grade: heading of the points of S/A/B/C (#2426)',
        id: 'gui.classroom.overallGrade.pointsHeading',
    },
    none: {
        defaultMessage: 'Not submitted',
        description: 'Overall grade: label of the points of a seat with no grade (#2426)',
        id: 'gui.classroom.overallGrade.none',
    },
    cutsHeading: {
        defaultMessage: 'Overall cuts (weighted average)',
        description: 'Overall grade: heading of the lowest average of each overall grade (#2426)',
        id: 'gui.classroom.overallGrade.cutsHeading',
    },
    below: {
        defaultMessage: 'Below that: C',
        description: 'Overall grade: after the cuts — an average below B is C (#2426)',
        id: 'gui.classroom.overallGrade.below',
    },
    savedNote: {
        defaultMessage: 'These settings are kept in this browser for this class.',
        description: 'Overall grade: where the settings are kept (#2426)',
        id: 'gui.classroom.overallGrade.savedNote',
    },
    reset: {
        defaultMessage: 'Back to the defaults',
        description: 'Overall grade: text button that puts the settings back to the defaults (#2426)',
        id: 'gui.classroom.overallGrade.reset',
    },
    unconfirmed: {
        defaultMessage:
            'Not confirmed yet: {links}. Until they are confirmed, the overall grade cannot be exported (the table below is provisional).',
        description: 'Overall grade: included assignments whose grades are not confirmed (#2426)',
        id: 'gui.classroom.overallGrade.unconfirmed',
    },
    loading: {
        defaultMessage: 'Reading the grades of the assignments…',
        description: 'Overall grade: the saved grades of an included assignment are being read (#2426)',
        id: 'gui.classroom.overallGrade.loading',
    },
    noColumns: {
        defaultMessage: 'Choose the assignments to include on the left.',
        description: 'Overall grade: no assignment is included (#2426)',
        id: 'gui.classroom.overallGrade.noColumns',
    },
    noSeats: {
        defaultMessage: 'No assignment is graded yet.',
        description: 'Overall grade: no seat has a grade in any assignment (#2426)',
        id: 'gui.classroom.overallGrade.noSeats',
    },
    average: {
        defaultMessage: 'Average',
        description: 'Overall grade: header of the weighted average column (#2426)',
        id: 'gui.classroom.overallGrade.average',
    },
    overall: {
        defaultMessage: 'Overall',
        description: 'Overall grade: header of the overall grade column (#2426)',
        id: 'gui.classroom.overallGrade.overall',
    },
    fileName: {
        defaultMessage: 'overall_grade',
        description: 'Overall grade: the end of the CSV file name (#2426)',
        id: 'gui.classroom.overallGrade.fileName',
    },
});

const GRADE_KEYS = ['S', 'A', 'B', 'C'];
const CUT_KEYS = ['S', 'A', 'B'];

const downloadCsv = (filename, text) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

const stateText = (intl, grading, loading) => {
    if (loading) return intl.formatMessage(gradebookMessages.stateLoading);
    const status = columnStatus(grading);
    if (status.kind === 'confirmed') {
        return intl.formatMessage(gradebookMessages.stateConfirmed, { graded: status.graded });
    }
    if (status.kind === 'draft') return intl.formatMessage(gradebookMessages.stateDraft, { drafts: status.drafts });
    return intl.formatMessage(gradebookMessages.stateNone);
};

/* 入れる課題 1 つ: チェックと重み。 */
const AssignmentRow = ({ grading, included, lesson, loading, weight, onSetIncluded, onSetWeight }) => {
    const intl = useIntl();
    const id = lesson.classroomId;
    const handleCheck = useCallback((e) => onSetIncluded(id, e.target.checked), [onSetIncluded, id]);
    const handleWeight = useCallback((e) => onSetWeight(id, e.target.value), [onSetWeight, id]);
    return (
        <li className={overallStyles.assignmentRow}>
            <label className={overallStyles.assignmentName}>
                <input
                    checked={included}
                    data-testid={`classroom-overall-include-${id}`}
                    type="checkbox"
                    onChange={handleCheck}
                />
                <span>
                    {lesson.assignmentName}
                    <span className={overallStyles.assignmentState}>{stateText(intl, grading, loading)}</span>
                </span>
            </label>
            <label className={overallStyles.numberField}>
                {intl.formatMessage(messages.weight)}
                <input
                    className={overallStyles.number}
                    data-testid={`classroom-overall-weight-${id}`}
                    disabled={!included}
                    min="0"
                    step="0.5"
                    type="number"
                    value={weight}
                    onChange={handleWeight}
                />
            </label>
        </li>
    );
};

AssignmentRow.propTypes = {
    grading: PropTypes.object,
    included: PropTypes.bool.isRequired,
    lesson: PropTypes.object.isRequired,
    loading: PropTypes.bool,
    weight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    onSetIncluded: PropTypes.func.isRequired,
    onSetWeight: PropTypes.func.isRequired,
};

/* 数の入力 1 つ（点・区切り）。 */
const NumberField = ({ dataTestId, label, step, value, valueKey, onChange }) => {
    const handleChange = useCallback((e) => onChange(valueKey, e.target.value), [onChange, valueKey]);
    return (
        <label className={overallStyles.numberField}>
            {label}
            <input
                className={overallStyles.number}
                data-testid={dataTestId}
                step={step}
                type="number"
                value={value}
                onChange={handleChange}
            />
        </label>
    );
};

NumberField.propTypes = {
    dataTestId: PropTypes.string.isRequired,
    label: PropTypes.node.isRequired,
    step: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    valueKey: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
};

/* 確定していない課題へのリンク。 */
const OpenLink = ({ column, onOpen }) => {
    const handleClick = useCallback(() => onOpen(column.classroomId), [onOpen, column.classroomId]);
    return (
        <button
            className={styles.gradebookColName}
            data-testid={`classroom-overall-open-${column.classroomId}`}
            type="button"
            onClick={handleClick}
        >
            {column.name}
        </button>
    );
};

OpenLink.propTypes = {
    column: PropTypes.object.isRequired,
    onOpen: PropTypes.func.isRequired,
};

const valueOf = (map, key) => (map && typeof map[key] !== 'undefined' && map[key] !== null ? map[key] : '');

/**
 * The overall grade screen.
 * @param {object} props - the class, its assignments and gradings
 * @param {?object} props.group - the class ({groupId, name})
 * @param {object} props.gradings - classroomId → saved grading (missing key = still reading)
 * @param {Array<object>} props.lessons - the assignments, newest first
 * @param {Function} props.onOpenAssignment - (classroomId) → open its grading
 * @returns {React.ReactElement} the screen
 */
const TeacherOverallGrade = ({ group, gradings, lessons, onOpenAssignment }) => {
    const intl = useIntl();
    const groupId = group ? group.groupId || null : null;
    const { settings, setIncluded, setWeight, setPoint, setCut, reset } = useOverallGradeSettings(groupId);
    const view = overallView({ lessons, gradings, settings });
    const includedIds = new Set(view.columns.map((c) => c.classroomId));

    const handleExport = useCallback(() => {
        const rows = overallExportRows(view);
        if (!rows) return;
        const base = (group && group.name) || 'class';
        downloadCsv(`${base}_${intl.formatMessage(messages.fileName)}.csv`, gradingCsvText(rows));
    }, [view, group, intl]);

    const links = view.unconfirmed.map((column, index) => (
        <React.Fragment key={column.classroomId}>
            {index > 0 ? '、' : null}
            <OpenLink column={column} onOpen={onOpenAssignment} />
        </React.Fragment>
    ));

    return (
        <div
            className={classNames(styles.gradebookArea, overallStyles.area)}
            data-testid="classroom-gradebook-overall"
        >
            <div className={overallStyles.actions}>
                <ClassroomButton
                    dataTestId="classroom-overall-export"
                    disabled={!view.canExport}
                    variant="primary"
                    onClick={handleExport}
                >
                    {intl.formatMessage(messages.exportCsv)}
                </ClassroomButton>
            </div>
            <div className={overallStyles.split}>
                <div className={overallStyles.settings} data-testid="classroom-overall-settings">
                    <h3 className={overallStyles.heading}>{intl.formatMessage(messages.assignmentsHeading)}</h3>
                    <ul className={overallStyles.assignmentList}>
                        {lessons.map((lesson) => (
                            <AssignmentRow
                                grading={gradings[lesson.classroomId]}
                                included={includedIds.has(lesson.classroomId)}
                                key={lesson.classroomId}
                                lesson={lesson}
                                loading={!(lesson.classroomId in gradings)}
                                weight={
                                    settings.weights && lesson.classroomId in settings.weights
                                        ? settings.weights[lesson.classroomId]
                                        : DEFAULT_WEIGHT
                                }
                                onSetIncluded={setIncluded}
                                onSetWeight={setWeight}
                            />
                        ))}
                    </ul>
                    <h3 className={overallStyles.heading}>{intl.formatMessage(messages.pointsHeading)}</h3>
                    <div className={overallStyles.fieldRow}>
                        {GRADE_KEYS.map((g) => (
                            <NumberField
                                dataTestId={`classroom-overall-point-${g}`}
                                key={g}
                                label={g}
                                value={valueOf(settings.points, g)}
                                valueKey={g}
                                onChange={setPoint}
                            />
                        ))}
                        <NumberField
                            dataTestId="classroom-overall-point-none"
                            label={intl.formatMessage(messages.none)}
                            value={valueOf(settings.points, 'none')}
                            valueKey="none"
                            onChange={setPoint}
                        />
                    </div>
                    <h3 className={overallStyles.heading}>{intl.formatMessage(messages.cutsHeading)}</h3>
                    <div className={overallStyles.fieldRow}>
                        {CUT_KEYS.map((g) => (
                            <NumberField
                                dataTestId={`classroom-overall-cut-${g}`}
                                key={g}
                                label={`${g} ≥`}
                                step="0.1"
                                value={valueOf(settings.cuts, g)}
                                valueKey={g}
                                onChange={setCut}
                            />
                        ))}
                        <span className={overallStyles.note}>{intl.formatMessage(messages.below)}</span>
                    </div>
                    <p className={overallStyles.note}>
                        {intl.formatMessage(messages.savedNote)}{' '}
                        <button
                            className={overallStyles.textButton}
                            data-testid="classroom-overall-reset"
                            type="button"
                            onClick={reset}
                        >
                            {intl.formatMessage(messages.reset)}
                        </button>
                    </p>
                </div>
                <div className={overallStyles.result}>
                    {view.unconfirmed.length > 0 && (
                        <p className={overallStyles.warn} data-testid="classroom-overall-unconfirmed" role="status">
                            {intl.formatMessage(messages.unconfirmed, { links })}
                        </p>
                    )}
                    {view.loading.length > 0 && (
                        <p className={overallStyles.note} data-testid="classroom-overall-loading">
                            {intl.formatMessage(messages.loading)}
                        </p>
                    )}
                    {view.columns.length === 0 ? (
                        <p className={styles.gradebookNote} data-testid="classroom-overall-no-columns">
                            {intl.formatMessage(messages.noColumns)}
                        </p>
                    ) : (
                        <div className={styles.evalMatrixWrapper}>
                            <table className={styles.evalMatrix} data-testid="classroom-overall-table">
                                <thead>
                                    <tr>
                                        <th className={styles.evalSeatHead} scope="col">
                                            {intl.formatMessage(gradebookMessages.seat)}
                                        </th>
                                        {view.columns.map((c) => (
                                            <th
                                                className={styles.gradebookColHead}
                                                key={c.classroomId}
                                                scope="col"
                                                title={c.name}
                                            >
                                                <span className={overallStyles.colName}>{c.name}</span>
                                            </th>
                                        ))}
                                        <th scope="col">{intl.formatMessage(messages.average)}</th>
                                        <th scope="col">{intl.formatMessage(messages.overall)}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {view.rows.map((row) => (
                                        <tr
                                            data-testid={`classroom-overall-row-${row.seatNumber}`}
                                            key={row.seatNumber}
                                        >
                                            <th className={styles.evalSeatCell} scope="row">
                                                {String(row.seatNumber).padStart(2, '0')}
                                            </th>
                                            {view.columns.map((c) => {
                                                const cell = gradebookCell(c.grading, row.seatNumber);
                                                return (
                                                    <td className={styles.gradebookCell} key={c.classroomId}>
                                                        {cell ? (
                                                            <span
                                                                className={classNames(styles.evalGradePill, {
                                                                    [styles.evalGradePillDraft]: cell.draft,
                                                                })}
                                                            >
                                                                {cell.grade}
                                                            </span>
                                                        ) : (
                                                            <span className={styles.gradebookNoGrade}>{'—'}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td data-testid={`classroom-overall-average-${row.seatNumber}`}>
                                                {row.average === null ? '—' : row.average.toFixed(2)}
                                            </td>
                                            <td data-testid={`classroom-overall-grade-${row.seatNumber}`}>
                                                {row.grade ? (
                                                    <span className={styles.evalGradePill}>{row.grade}</span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {view.rows.length === 0 && (
                                <p className={styles.gradebookNote} data-testid="classroom-overall-no-seats">
                                    {intl.formatMessage(messages.noSeats)}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

TeacherOverallGrade.propTypes = {
    /** The class ({groupId, name}); its settings are kept per groupId. */
    group: PropTypes.object,
    /** classroomId → saved grading (null = none; a missing key = still reading) */
    gradings: PropTypes.object.isRequired,
    /** The assignments of the class, newest first. */
    lessons: PropTypes.arrayOf(PropTypes.object).isRequired,
    /** (classroomId) → open the assignment's grading */
    onOpenAssignment: PropTypes.func.isRequired,
};

export { messages as overallGradeMessages };
export default TeacherOverallGrade;
