/**
 * The ［基準］ tab of an assignment's grading (teacher side, EPIC #2421 / #2425).
 *
 * From the top: the assignment's description (when it is empty, the AI guesses it
 * and asks 「合っていますか？」), the representative works (one per group, at most 8,
 * as a list — pressing a row opens only that one), the fairness questions, and the
 * S/A/B/C sentences, saved with the teacher's examples. An assignment that already
 * has a rubric shows it and can go straight to grading everyone. A rubric can also
 * be copied from another assignment (choose the class and the assignment, look at
 * it, then copy).
 *
 * The state and the calls are in `containers/use-grading-rubric.js`; this file only
 * draws them. `TeacherGradingGroupPrompt` is the question shown in the［生徒］tab
 * after a grade is changed: change the rest of the same group too?
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { GRADES } from '../../lib/classroom-evaluation/gradebook.js';
import { gradesWithoutExamples, hasRubricLevels } from '../../lib/classroom-evaluation/grading-ai.js';
import Spinner from '../spinner/spinner.jsx';
import ClassroomButton from './classroom-button.jsx';
import modalStyles from './classroom-modal.css';
import styles from './teacher-grading-rubric.css';

const messages = defineMessages({
    description: {
        defaultMessage: 'Assignment description',
        description: 'Rubric tab: heading of the assignment description (#2425)',
        id: 'gui.classroom.gradingRubric.description',
    },
    descriptionEmpty: {
        defaultMessage: 'The description is empty. The AI grades better when it knows what the assignment is.',
        description: 'Rubric tab: the assignment has no description (#2425)',
        id: 'gui.classroom.gradingRubric.descriptionEmpty',
    },
    describe: {
        defaultMessage: 'Ask the AI to Guess It',
        description: 'Rubric tab: button to let the AI guess the description from the starter and works (#2425)',
        id: 'gui.classroom.gradingRubric.describe',
    },
    describeQuestion: {
        defaultMessage: 'From the starter and a few works, I think this assignment is the following. Is that right?',
        description: 'Rubric tab: the AI asks whether its guess of the description is right (#2425)',
        id: 'gui.classroom.gradingRubric.describeQuestion',
    },
    describeOk: {
        defaultMessage: 'Right (Save to the Assignment)',
        description: 'Rubric tab: the guessed description is right, save it into the assignment (#2425)',
        id: 'gui.classroom.gradingRubric.describeOk',
    },
    describeFix: {
        defaultMessage: 'Save as Edited',
        description: 'Rubric tab: save the description as the teacher edited it (#2425)',
        id: 'gui.classroom.gradingRubric.describeFix',
    },
    describeOnlyHere: {
        defaultMessage: 'Do Not Save, Use for This Grading Only',
        description: 'Rubric tab: use the description for this grading only (#2425)',
        id: 'gui.classroom.gradingRubric.describeOnlyHere',
    },
    describeSaved: {
        defaultMessage: 'Saved to the assignment (students see it too).',
        description: 'Rubric tab: the description was saved into the assignment (#2425)',
        id: 'gui.classroom.gradingRubric.describeSaved',
    },
    describeUsed: {
        defaultMessage: 'Used for this grading only (not saved).',
        description: 'Rubric tab: the description is used only for this grading (#2425)',
        id: 'gui.classroom.gradingRubric.describeUsed',
    },
    starterNone: {
        defaultMessage: 'This assignment has no starter: every script of a work counts as added.',
        description: 'Rubric tab: the assignment has no starter project (#2425)',
        id: 'gui.classroom.gradingRubric.starterNone',
    },
    starterFailed: {
        defaultMessage: 'The starter could not be read: every script of a work counts as added.',
        description: 'Rubric tab: the starter project could not be read (#2425)',
        id: 'gui.classroom.gradingRubric.starterFailed',
    },
    hasRubric: {
        defaultMessage: 'This assignment has a rubric. You can grade everyone with it now.',
        description: 'Rubric tab: the assignment already has a rubric, building it can be skipped (#2425)',
        id: 'gui.classroom.gradingRubric.hasRubric',
    },
    editRubric: {
        defaultMessage: 'Rework the Rubric',
        description: 'Rubric tab: open the rubric builder for an assignment that has a rubric (#2425)',
        id: 'gui.classroom.gradingRubric.editRubric',
    },
    notLoaded: {
        defaultMessage: 'Load the submissions (step 1) to see the representative works.',
        description: 'Rubric tab: the submissions are not loaded yet (#2425)',
        id: 'gui.classroom.gradingRubric.notLoaded',
    },
    noWorks: {
        defaultMessage: 'No work was submitted.',
        description: 'Rubric tab: no submission to build the rubric from (#2425)',
        id: 'gui.classroom.gradingRubric.noWorks',
    },
    reps: {
        defaultMessage: 'Representative works ({done}/{total}) — {works} works in {groups} groups',
        description: 'Rubric tab: heading of the representative works list (#2425)',
        id: 'gui.classroom.gradingRubric.reps',
    },
    repsHint: {
        defaultMessage: 'Give each one the right grade and a short reason. Press a row to open it.',
        description: 'Rubric tab: what to do with the representatives (#2425)',
        id: 'gui.classroom.gradingRubric.repsHint',
    },
    propose: {
        defaultMessage: 'Show the AI’s Proposals',
        description: 'Rubric tab: let the AI propose a grade for each representative (#2425)',
        id: 'gui.classroom.gradingRubric.propose',
    },
    repMeta: {
        defaultMessage: '{size} works · seat {seat}',
        description: 'Rubric tab: size of the group and the representative seat (#2425)',
        id: 'gui.classroom.gradingRubric.repMeta',
    },
    ai: {
        defaultMessage: 'AI',
        description: 'Rubric tab: label of the AI proposal (#2425)',
        id: 'gui.classroom.gradingRubric.ai',
    },
    answer: {
        defaultMessage: 'Right grade',
        description: 'Rubric tab: label of the teacher’s grade (#2425)',
        id: 'gui.classroom.gradingRubric.answer',
    },
    differs: {
        defaultMessage: 'differs',
        description: 'Rubric tab: the teacher’s grade differs from the AI proposal (#2425)',
        id: 'gui.classroom.gradingRubric.differs',
    },
    added: {
        defaultMessage: 'Scripts added to the starter',
        description: 'Rubric tab: label of the added scripts of a work (#2425)',
        id: 'gui.classroom.gradingRubric.added',
    },
    reason: {
        defaultMessage: 'Reason (a few words, optional)',
        description: 'Rubric tab: placeholder of the reason of the teacher’s grade (#2425)',
        id: 'gui.classroom.gradingRubric.reason',
    },
    openWork: {
        defaultMessage: 'Open the Work',
        description: 'Rubric tab: open the representative work in the editor (#2425)',
        id: 'gui.classroom.gradingRubric.openWork',
    },
    fairness: {
        defaultMessage: 'Fairness check',
        description: 'Rubric tab: heading of the fairness questions (#2425)',
        id: 'gui.classroom.gradingRubric.fairness',
    },
    fairnessRun: {
        defaultMessage: 'Check Fairness',
        description: 'Rubric tab: let the AI compare the answers with the other works of each group (#2425)',
        id: 'gui.classroom.gradingRubric.fairnessRun',
    },
    fairnessNone: {
        defaultMessage: 'Nothing to ask: similar works get the same grade.',
        description: 'Rubric tab: the AI has no fairness question (#2425)',
        id: 'gui.classroom.gradingRubric.fairnessNone',
    },
    compare: {
        defaultMessage: 'Compare the Works',
        description: 'Rubric tab: show the works of a fairness question side by side (#2425)',
        id: 'gui.classroom.gradingRubric.compare',
    },
    seat: {
        defaultMessage: 'Seat {seat}',
        description: 'Rubric tab: a seat number (#2425)',
        id: 'gui.classroom.gradingRubric.seat',
    },
    sentences: {
        defaultMessage: 'Rubric (saved to the assignment, and copied when the assignment is reused)',
        description: 'Rubric tab: heading of the S/A/B/C sentences (#2425)',
        id: 'gui.classroom.gradingRubric.sentences',
    },
    draft: {
        defaultMessage: 'Let the AI Write the Rubric',
        description: 'Rubric tab: let the AI write the S/A/B/C sentences from the answers (#2425)',
        id: 'gui.classroom.gradingRubric.draft',
    },
    examplesNote: {
        defaultMessage: '{count} examples (the right grades) are saved with it and given to the AI when grading.',
        description: 'Rubric tab: the teacher’s examples are saved with the rubric (#2425)',
        id: 'gui.classroom.gradingRubric.examplesNote',
    },
    save: {
        defaultMessage: 'Save the Rubric',
        description: 'Rubric tab: save the rubric and the examples (#2425)',
        id: 'gui.classroom.gradingRubric.save',
    },
    saved: {
        defaultMessage: 'Saved. Next: grade everyone (step 3).',
        description: 'Rubric tab: the rubric was saved (#2425)',
        id: 'gui.classroom.gradingRubric.saved',
    },
    copy: {
        defaultMessage: 'Copy from Another Assignment…',
        description: 'Rubric tab: open the dialog to copy a rubric from another assignment (#2425)',
        id: 'gui.classroom.gradingRubric.copy',
    },
    copyTitle: {
        defaultMessage: 'Copy a rubric from another assignment',
        description: 'Rubric tab: title of the copy dialog (#2425)',
        id: 'gui.classroom.gradingRubric.copyTitle',
    },
    copyClass: {
        defaultMessage: 'Class',
        description: 'Rubric tab: label of the class select of the copy dialog (#2425)',
        id: 'gui.classroom.gradingRubric.copyClass',
    },
    copyAssignment: {
        defaultMessage: 'Assignment',
        description: 'Rubric tab: label of the assignment select of the copy dialog (#2425)',
        id: 'gui.classroom.gradingRubric.copyAssignment',
    },
    copyChoose: {
        defaultMessage: 'Choose…',
        description: 'Rubric tab: empty option of the copy dialog selects (#2425)',
        id: 'gui.classroom.gradingRubric.copyChoose',
    },
    copyNone: {
        defaultMessage: 'This assignment has no rubric.',
        description: 'Rubric tab: the chosen assignment has no rubric to copy (#2425)',
        id: 'gui.classroom.gradingRubric.copyNone',
    },
    copyExamples: {
        defaultMessage: '{count} examples are copied with it.',
        description: 'Rubric tab: the examples copied with the rubric (#2425)',
        id: 'gui.classroom.gradingRubric.copyExamples',
    },
    copyWarn: {
        defaultMessage: 'The rubric of this assignment is replaced by the copied one.',
        description: 'Rubric tab: copying replaces the current rubric (#2425)',
        id: 'gui.classroom.gradingRubric.copyWarn',
    },
    copyDo: {
        defaultMessage: 'Copy',
        description: 'Rubric tab: copy the rubric (#2425)',
        id: 'gui.classroom.gradingRubric.copyDo',
    },
    cancel: {
        defaultMessage: 'Cancel',
        description: 'Rubric tab: close the copy dialog (#2425)',
        id: 'gui.classroom.gradingRubric.cancel',
    },
    groupAsk: {
        defaultMessage: 'Change the other {count} works of the group “{group}” to {grade} too?',
        description: 'Student tab: after changing a grade, ask about the rest of the same group (#2425)',
        id: 'gui.classroom.gradingRubric.groupAsk',
    },
    groupYes: {
        defaultMessage: 'Change {count} More',
        description: 'Student tab: change the rest of the group too (#2425)',
        id: 'gui.classroom.gradingRubric.groupYes',
    },
    groupNo: {
        defaultMessage: 'Only This One',
        description: 'Student tab: change only this work (#2425)',
        id: 'gui.classroom.gradingRubric.groupNo',
    },
    noExample: {
        defaultMessage: 'No example (the AI’s guess)',
        description:
            'Rubric tab: next to a grade of the rubric that no example (right grade) has; the AI guessed its sentence',
        id: 'gui.classroom.gradingRubric.noExample',
    },
    noSExample: {
        defaultMessage:
            'There is no example of S, so the line between S and A moves. If another class has the same ' +
            'assignment, grade the class that has S works first to make the rubric, then copy it here.',
        description: 'Rubric tab: warning when the rubric (saved, to copy, or being built) has no example graded S',
        id: 'gui.classroom.gradingRubric.noSExample',
    },
    working: {
        defaultMessage: 'The AI is working…',
        description: 'Rubric tab: an AI call is running (#2425)',
        id: 'gui.classroom.gradingRubric.working',
    },
});

const Pill = ({ grade, empty = false }) => (
    <span className={classNames(modalStyles.evalGradePill, { [modalStyles.evalGradePillEmpty]: empty || !grade })}>
        {grade || '—'}
    </span>
);

Pill.propTypes = {
    empty: PropTypes.bool,
    grade: PropTypes.string,
};

/* 課題の説明。空なら AI の案を出して「合っていますか？」と聞く。 */
const DescriptionSection = ({ busy, description, lesson, loaded, onDescribe, onUseDescription }) => {
    const intl = useIntl();
    const proposed = description && description.status === 'proposed' ? description.text : '';
    const [text, setText] = useState(proposed);
    useEffect(() => setText(proposed), [proposed]);
    const handleChange = useCallback((e) => setText(e.target.value), []);
    const handleOk = useCallback(() => onUseDescription(proposed, true), [onUseDescription, proposed]);
    const handleFix = useCallback(() => onUseDescription(text, true), [onUseDescription, text]);
    const handleOnlyHere = useCallback(() => onUseDescription(text, false), [onUseDescription, text]);
    const status = description ? description.status : null;
    return (
        <div className={styles.section} data-testid="grading-rubric-description">
            <div className={modalStyles.evalPaneLabel}>{intl.formatMessage(messages.description)}</div>
            {lesson.assignmentText ? (
                <p className={styles.text} data-testid="grading-rubric-description-text">
                    {lesson.assignmentText}
                </p>
            ) : (
                <p className={styles.note}>{intl.formatMessage(messages.descriptionEmpty)}</p>
            )}
            {status === 'saved' && <p className={styles.done}>{intl.formatMessage(messages.describeSaved)}</p>}
            {status === 'used' && <p className={styles.done}>{intl.formatMessage(messages.describeUsed)}</p>}
            {!lesson.assignmentText && status !== 'proposed' && (
                <div className={styles.buttons}>
                    <ClassroomButton
                        dataTestId="grading-rubric-describe"
                        disabled={busy || !loaded}
                        onClick={onDescribe}
                    >
                        {intl.formatMessage(messages.describe)}
                    </ClassroomButton>
                </div>
            )}
            {status === 'proposed' && (
                <div className={styles.ai} data-testid="grading-rubric-describe-proposal">
                    <p className={styles.text}>{intl.formatMessage(messages.describeQuestion)}</p>
                    <textarea
                        className={styles.textarea}
                        data-testid="grading-rubric-describe-text"
                        maxLength={500}
                        rows={3}
                        value={text}
                        onChange={handleChange}
                    />
                    <div className={styles.buttons}>
                        <ClassroomButton
                            dataTestId="grading-rubric-describe-ok"
                            disabled={busy || !proposed}
                            variant="primary"
                            onClick={handleOk}
                        >
                            {intl.formatMessage(messages.describeOk)}
                        </ClassroomButton>
                        <ClassroomButton
                            dataTestId="grading-rubric-describe-fix"
                            disabled={busy || !text.trim() || text === proposed}
                            onClick={handleFix}
                        >
                            {intl.formatMessage(messages.describeFix)}
                        </ClassroomButton>
                        <ClassroomButton
                            dataTestId="grading-rubric-describe-only-here"
                            disabled={busy || !text.trim()}
                            onClick={handleOnlyHere}
                        >
                            {intl.formatMessage(messages.describeOnlyHere)}
                        </ClassroomButton>
                    </div>
                </div>
            )}
        </div>
    );
};

DescriptionSection.propTypes = {
    busy: PropTypes.bool,
    description: PropTypes.object,
    lesson: PropTypes.object.isRequired,
    loaded: PropTypes.bool,
    onDescribe: PropTypes.func.isRequired,
    onUseDescription: PropTypes.func.isRequired,
};

/* 代表の作品の 1 行（押すとこの行だけ開く）。 */
const RepresentativeRow = ({ answer, busy, classroomId, open, proposal, rep, onOpenWork, onSetAnswer, onToggle }) => {
    const intl = useIntl();
    const seat = rep.seatNumber;
    const handleToggle = useCallback(() => onToggle(seat), [onToggle, seat]);
    const handleGrade = useCallback(
        (e) => onSetAnswer(seat, { grade: e.currentTarget.dataset.grade }),
        [onSetAnswer, seat],
    );
    const handleReason = useCallback((e) => onSetAnswer(seat, { reason: e.target.value }), [onSetAnswer, seat]);
    const handleOpen = useCallback(() => onOpenWork(seat, classroomId), [onOpenWork, seat, classroomId]);
    const grade = answer && answer.grade;
    const aiGrade = proposal && proposal.grade;
    return (
        <li className={styles.rep}>
            <button
                aria-expanded={open}
                className={styles.repHead}
                data-testid={`grading-rubric-rep-${seat}`}
                type="button"
                onClick={handleToggle}
            >
                <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                <span className={styles.repName}>{rep.name}</span>
                <span className={styles.meta}>{intl.formatMessage(messages.repMeta, { size: rep.size, seat })}</span>
                <span className={styles.meta}>
                    {intl.formatMessage(messages.ai)} <Pill grade={aiGrade} />
                </span>
                <span className={styles.meta}>
                    {intl.formatMessage(messages.answer)} <Pill grade={grade} />
                    {grade && aiGrade && grade !== aiGrade && (
                        <span className={styles.differs}>{intl.formatMessage(messages.differs)}</span>
                    )}
                </span>
            </button>
            {open && (
                <div className={styles.repBody} data-testid={`grading-rubric-rep-body-${seat}`}>
                    <div className={modalStyles.evalPaneLabel}>{intl.formatMessage(messages.added)}</div>
                    <pre className={styles.code}>{rep.code}</pre>
                    {proposal && proposal.reason && (
                        <p className={styles.note}>
                            {intl.formatMessage(messages.ai)}
                            {': '}
                            {proposal.reason}
                        </p>
                    )}
                    <div className={styles.buttons}>
                        <span className={styles.meta}>{intl.formatMessage(messages.answer)}</span>
                        {GRADES.map((g) => (
                            <button
                                aria-pressed={grade === g}
                                className={classNames(styles.gradeButton, { [styles.gradeButtonOn]: grade === g })}
                                data-grade={g}
                                data-testid={`grading-rubric-rep-grade-${seat}-${g}`}
                                disabled={busy}
                                key={g}
                                type="button"
                                onClick={handleGrade}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                    <input
                        className={styles.input}
                        data-testid={`grading-rubric-rep-reason-${seat}`}
                        maxLength={300}
                        placeholder={intl.formatMessage(messages.reason)}
                        type="text"
                        value={(answer && answer.reason) || ''}
                        onChange={handleReason}
                    />
                    {onOpenWork && (
                        <div className={styles.buttons}>
                            <ClassroomButton dataTestId={`grading-rubric-rep-open-${seat}`} onClick={handleOpen}>
                                {intl.formatMessage(messages.openWork)}
                            </ClassroomButton>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
};

RepresentativeRow.propTypes = {
    answer: PropTypes.object,
    busy: PropTypes.bool,
    classroomId: PropTypes.string.isRequired,
    open: PropTypes.bool,
    proposal: PropTypes.object,
    rep: PropTypes.object.isRequired,
    onOpenWork: PropTypes.func,
    onSetAnswer: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
};

/* フェアの確認の質問 1 つ。 */
const FairnessCheck = ({ answer, busy, check, index, works, onAnswer }) => {
    const intl = useIntl();
    const [comparing, setComparing] = useState(false);
    const handleCompare = useCallback(() => setComparing((prev) => !prev), []);
    const handleOption = useCallback((e) => onAnswer(index, e.currentTarget.dataset.option), [onAnswer, index]);
    const shown = (check.seatNumbers || []).map((s) => works.find((w) => w.seatNumber === s)).filter(Boolean);
    return (
        <li className={styles.check} data-testid={`grading-rubric-check-${index}`}>
            <p className={styles.text}>{check.question}</p>
            <div className={styles.buttons}>
                {(check.options || []).map((option, i) => (
                    <button
                        aria-pressed={answer === option}
                        className={classNames(styles.optionButton, { [styles.optionButtonOn]: answer === option })}
                        data-option={option}
                        data-testid={`grading-rubric-check-${index}-option-${i}`}
                        disabled={busy}
                        key={i}
                        type="button"
                        onClick={handleOption}
                    >
                        {option}
                    </button>
                ))}
                {shown.length > 0 && (
                    <ClassroomButton
                        ariaExpanded={comparing}
                        dataTestId={`grading-rubric-check-${index}-compare`}
                        variant="text"
                        onClick={handleCompare}
                    >
                        {intl.formatMessage(messages.compare)}
                    </ClassroomButton>
                )}
            </div>
            {comparing && (
                <div className={styles.compare}>
                    {shown.map((w) => (
                        <div className={styles.compareItem} key={w.seatNumber}>
                            <div className={modalStyles.evalPaneLabel}>
                                {intl.formatMessage(messages.seat, { seat: w.seatNumber })}
                            </div>
                            <pre className={styles.code}>{w.code}</pre>
                        </div>
                    ))}
                </div>
            )}
        </li>
    );
};

FairnessCheck.propTypes = {
    answer: PropTypes.string,
    busy: PropTypes.bool,
    check: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    works: PropTypes.arrayOf(PropTypes.object).isRequired,
    onAnswer: PropTypes.func.isRequired,
};

/* 基準の文の表。正解の例が無い段には「正解の例が無い（AI の推測）」を添える。 */
const LevelsTable = ({ dataTestId = 'classroom-eval-rubric-levels', examples = null, levels }) => {
    const intl = useIntl();
    const missing = examples ? gradesWithoutExamples(examples) : [];
    return (
        <table className={modalStyles.evalRubricTable} data-testid={dataTestId}>
            <tbody>
                {levels.map((level) => (
                    <tr key={level.grade}>
                        <th scope="row">
                            <Pill grade={level.grade} />
                        </th>
                        <td>
                            {level.text}
                            {missing.includes(level.grade) && (
                                <>
                                    {' '}
                                    <span
                                        className={styles.noExample}
                                        data-testid={`${dataTestId}-no-example-${level.grade}`}
                                    >
                                        {intl.formatMessage(messages.noExample)}
                                    </span>
                                </>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

LevelsTable.propTypes = {
    dataTestId: PropTypes.string,
    /** The examples of the rubric: the grades none has are marked (null = do not mark). */
    examples: PropTypes.arrayOf(PropTypes.object),
    levels: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/* S の正解の例が無いときの注意（S と A の線がぶれる）。 */
const NoSExampleWarning = ({ dataTestId }) => {
    const intl = useIntl();
    return (
        <p className={styles.warn} data-testid={dataTestId} role="note">
            {intl.formatMessage(messages.noSExample)}
        </p>
    );
};

NoSExampleWarning.propTypes = {
    dataTestId: PropTypes.string.isRequired,
};

const lacksS = (examples) => gradesWithoutExamples(examples).includes('S');

/* ほかの課題から基準をコピー（クラスと課題を選び、中身を見てからコピー）。 */
const CopyDialog = ({ busy, classes, onClose, onCopy, onRead }) => {
    const intl = useIntl();
    const [classKey, setClassKey] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [preview, setPreview] = useState(null); // null | 'loading' | {rubric}
    const chosenClass = classes.find((c) => c.key === classKey) || null;
    const handleClass = useCallback((e) => {
        setClassKey(e.target.value);
        // The assignment belongs to the class chosen before: choose again.
        setSourceId('');
        setPreview(null);
    }, []);
    const handleAssignment = useCallback(
        async (e) => {
            const value = e.target.value;
            setSourceId(value);
            if (!value) {
                setPreview(null);
                return;
            }
            setPreview('loading');
            const rubric = await onRead(value);
            setPreview({ sourceId: value, rubric });
        },
        [onRead],
    );
    const rubric = preview && preview !== 'loading' && preview.sourceId === sourceId ? preview.rubric : null;
    const handleCopy = useCallback(async () => {
        if (rubric && (await onCopy(rubric))) onClose();
    }, [rubric, onCopy, onClose]);
    return (
        <div className={styles.dialog} data-testid="grading-rubric-copy-dialog" role="group">
            <div className={modalStyles.evalPaneLabel}>{intl.formatMessage(messages.copyTitle)}</div>
            <div className={styles.buttons}>
                <label className={styles.meta}>
                    {intl.formatMessage(messages.copyClass)}{' '}
                    <select
                        className={modalStyles.groupSelect}
                        data-testid="grading-rubric-copy-class"
                        value={classKey}
                        onChange={handleClass}
                    >
                        <option value="">{intl.formatMessage(messages.copyChoose)}</option>
                        {classes.map((c) => (
                            <option key={c.key} value={c.key}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.meta}>
                    {intl.formatMessage(messages.copyAssignment)}{' '}
                    <select
                        className={modalStyles.groupSelect}
                        data-testid="grading-rubric-copy-assignment"
                        disabled={!chosenClass}
                        value={sourceId}
                        onChange={handleAssignment}
                    >
                        <option value="">{intl.formatMessage(messages.copyChoose)}</option>
                        {(chosenClass ? chosenClass.assignments : []).map((a) => (
                            <option key={a.classroomId} value={a.classroomId}>
                                {a.assignmentName}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {preview === 'loading' && <Spinner small />}
            {preview && preview !== 'loading' && !rubric && (
                <p className={styles.note} data-testid="grading-rubric-copy-none">
                    {intl.formatMessage(messages.copyNone)}
                </p>
            )}
            {rubric && (
                <div className={styles.ai} data-testid="grading-rubric-copy-preview">
                    {lacksS(rubric.examples) && <NoSExampleWarning dataTestId="grading-rubric-copy-no-s-example" />}
                    <LevelsTable
                        dataTestId="grading-rubric-copy-levels"
                        examples={rubric.examples || []}
                        levels={rubric.levels || []}
                    />
                    <p className={styles.note}>
                        {intl.formatMessage(messages.copyExamples, { count: (rubric.examples || []).length })}
                    </p>
                    <p className={styles.warn}>{intl.formatMessage(messages.copyWarn)}</p>
                </div>
            )}
            <div className={styles.buttons}>
                <ClassroomButton
                    dataTestId="grading-rubric-copy-do"
                    disabled={busy || !rubric}
                    variant="primary"
                    onClick={handleCopy}
                >
                    {intl.formatMessage(messages.copyDo)}
                </ClassroomButton>
                <ClassroomButton dataTestId="grading-rubric-copy-cancel" onClick={onClose}>
                    {intl.formatMessage(messages.cancel)}
                </ClassroomButton>
            </div>
        </div>
    );
};

CopyDialog.propTypes = {
    busy: PropTypes.bool,
    classes: PropTypes.arrayOf(PropTypes.object).isRequired,
    onClose: PropTypes.func.isRequired,
    onCopy: PropTypes.func.isRequired,
    onRead: PropTypes.func.isRequired,
};

const TeacherGradingRubric = ({ busy: parentBusy = false, lesson, tools, onOpenWork = null }) => {
    const intl = useIntl();
    const {
        answers,
        copyClasses,
        description,
        examples,
        fairness,
        levels,
        loaded,
        proposals,
        representatives,
        running,
        savedAt,
        savedRubric,
        starter,
        works,
        groups,
        loadStarter,
    } = tools;
    const busy = parentBusy || !!running;
    // An assignment that has a rubric opens on it; building it again is a choice.
    const [building, setBuilding] = useState(false);
    const [openSeat, setOpenSeat] = useState(null);
    const [copying, setCopying] = useState(false);
    useEffect(() => {
        if (loaded) loadStarter();
    }, [loaded, loadStarter, lesson.classroomId]);
    useEffect(() => {
        setBuilding(false);
        setOpenSeat(null);
        setCopying(false);
    }, [lesson.classroomId]);
    const handleToggle = useCallback((seat) => setOpenSeat((prev) => (prev === seat ? null : seat)), []);
    const handleBuild = useCallback(() => setBuilding(true), []);
    const handleCopyOpen = useCallback(() => setCopying((prev) => !prev), []);
    const handleCopyClose = useCallback(() => setCopying(false), []);
    const handleLevel = useCallback(
        (e) => tools.handleSetLevel(e.currentTarget.dataset.grade, e.target.value),
        [tools],
    );
    const handleSave = useCallback(async () => {
        if (await tools.handleSaveRubric()) setBuilding(false);
    }, [tools]);

    const hasRubric = hasRubricLevels(savedRubric);
    const showBuilder = !hasRubric || building;
    const done = representatives.filter(
        (r) => answers[String(r.seatNumber)] && answers[String(r.seatNumber)].grade,
    ).length;
    const canSave = levels.some((l) => l.text.trim());

    return (
        <div className={styles.root} data-testid="grading-rubric">
            <DescriptionSection
                busy={busy}
                description={description}
                lesson={lesson}
                loaded={loaded}
                onDescribe={tools.handleDescribe}
                onUseDescription={tools.handleUseDescription}
            />
            {starter && starter.status === 'none' && (
                <p className={styles.note}>{intl.formatMessage(messages.starterNone)}</p>
            )}
            {starter && starter.status === 'failed' && (
                <p className={styles.note}>{intl.formatMessage(messages.starterFailed)}</p>
            )}
            {running && (
                <p className={styles.note} data-testid="grading-rubric-running" role="status">
                    <Spinner small /> {intl.formatMessage(messages.working)}
                </p>
            )}
            {hasRubric && !building && (
                <div className={styles.section} data-testid="grading-rubric-saved">
                    <div className={modalStyles.evalPaneLabel}>{intl.formatMessage(messages.sentences)}</div>
                    {lacksS(savedRubric.examples) && <NoSExampleWarning dataTestId="grading-rubric-no-s-example" />}
                    <LevelsTable examples={savedRubric.examples || []} levels={savedRubric.levels} />
                    <p className={styles.done}>
                        {savedAt ? intl.formatMessage(messages.saved) : intl.formatMessage(messages.hasRubric)}
                    </p>
                    <div className={styles.buttons}>
                        <ClassroomButton dataTestId="grading-rubric-edit" disabled={busy} onClick={handleBuild}>
                            {intl.formatMessage(messages.editRubric)}
                        </ClassroomButton>
                    </div>
                </div>
            )}
            {showBuilder && (
                <>
                    <div className={styles.section} data-testid="grading-rubric-reps">
                        {!loaded && <p className={styles.note}>{intl.formatMessage(messages.notLoaded)}</p>}
                        {loaded && representatives.length === 0 && (
                            <p className={styles.note}>{intl.formatMessage(messages.noWorks)}</p>
                        )}
                        {loaded && representatives.length > 0 && (
                            <>
                                <div className={modalStyles.evalPaneLabel}>
                                    {intl.formatMessage(messages.reps, {
                                        done,
                                        total: representatives.length,
                                        works: works.length,
                                        groups: groups.length,
                                    })}
                                </div>
                                <p className={styles.note}>{intl.formatMessage(messages.repsHint)}</p>
                                <div className={styles.buttons}>
                                    <ClassroomButton
                                        dataTestId="grading-rubric-propose"
                                        disabled={busy}
                                        onClick={tools.handlePropose}
                                    >
                                        {intl.formatMessage(messages.propose)}
                                    </ClassroomButton>
                                </div>
                                <ul className={styles.reps}>
                                    {representatives.map((rep) => (
                                        <RepresentativeRow
                                            answer={answers[String(rep.seatNumber)]}
                                            busy={busy}
                                            classroomId={lesson.classroomId}
                                            key={rep.key}
                                            open={openSeat === rep.seatNumber}
                                            proposal={proposals[String(rep.seatNumber)]}
                                            rep={rep}
                                            onOpenWork={onOpenWork}
                                            onSetAnswer={tools.handleSetAnswer}
                                            onToggle={handleToggle}
                                        />
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                    {loaded && representatives.length > 0 && (
                        <div className={styles.section} data-testid="grading-rubric-fairness">
                            <div className={modalStyles.evalPaneLabel}>{intl.formatMessage(messages.fairness)}</div>
                            <div className={styles.buttons}>
                                <ClassroomButton
                                    dataTestId="grading-rubric-fairness-run"
                                    disabled={busy || done === 0}
                                    onClick={tools.handleCheckFairness}
                                >
                                    {intl.formatMessage(messages.fairnessRun)}
                                </ClassroomButton>
                            </div>
                            {fairness && fairness.checks.length === 0 && (
                                <p className={styles.done}>{intl.formatMessage(messages.fairnessNone)}</p>
                            )}
                            {fairness && fairness.checks.length > 0 && (
                                <ul className={styles.checks}>
                                    {fairness.checks.map((check, i) => (
                                        <FairnessCheck
                                            answer={fairness.answers[i]}
                                            busy={busy}
                                            check={check}
                                            index={i}
                                            key={i}
                                            works={works}
                                            onAnswer={tools.handleAnswerFairness}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    <div className={styles.section} data-testid="grading-rubric-sentences">
                        <div className={modalStyles.evalPaneLabel}>{intl.formatMessage(messages.sentences)}</div>
                        {examples.length > 0 && lacksS(examples) && (
                            <NoSExampleWarning dataTestId="grading-rubric-draft-no-s-example" />
                        )}
                        <div className={styles.buttons}>
                            <ClassroomButton
                                dataTestId="grading-rubric-draft"
                                disabled={busy || examples.length === 0}
                                onClick={tools.handleDraftRubric}
                            >
                                {intl.formatMessage(messages.draft)}
                            </ClassroomButton>
                        </div>
                        <table className={modalStyles.evalRubricTable}>
                            <tbody>
                                {levels.map((level) => (
                                    <tr key={level.grade}>
                                        <th scope="row">
                                            <Pill grade={level.grade} />
                                        </th>
                                        <td className={styles.levelCell}>
                                            <input
                                                className={styles.input}
                                                data-grade={level.grade}
                                                data-testid={`grading-rubric-level-${level.grade}`}
                                                maxLength={500}
                                                type="text"
                                                value={level.text}
                                                onChange={handleLevel}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className={styles.note}>
                            {intl.formatMessage(messages.examplesNote, { count: examples.length })}
                        </p>
                        <div className={styles.buttons}>
                            <ClassroomButton
                                dataTestId="grading-rubric-save"
                                disabled={busy || !canSave}
                                variant="primary"
                                onClick={handleSave}
                            >
                                {intl.formatMessage(messages.save)}
                            </ClassroomButton>
                        </div>
                    </div>
                </>
            )}
            <div className={styles.buttons}>
                <ClassroomButton
                    ariaExpanded={copying}
                    dataTestId="grading-rubric-copy"
                    disabled={busy}
                    onClick={handleCopyOpen}
                >
                    {intl.formatMessage(messages.copy)}
                </ClassroomButton>
            </div>
            {copying && (
                <CopyDialog
                    busy={busy}
                    classes={copyClasses}
                    onClose={handleCopyClose}
                    onCopy={tools.handleCopyRubric}
                    onRead={tools.handleReadCopySource}
                />
            )}
        </div>
    );
};

TeacherGradingRubric.propTypes = {
    /** Something else of the grading is running (load / AI / return). */
    busy: PropTypes.bool,
    /** The open assignment (evalLessons item). */
    lesson: PropTypes.object.isRequired,
    /** The result of useGradingRubric. */
    tools: PropTypes.object.isRequired,
    /** (seat, classroomId) → open the work in the editor. */
    onOpenWork: PropTypes.func,
};

/* 全員の採点のあとに 1 件を直したとき、同じまとまりも直すかを聞く（［生徒］のタブ）。 */
const TeacherGradingGroupPrompt = ({ prompt, onApply, onDismiss }) => {
    const intl = useIntl();
    if (!prompt) return null;
    return (
        <div className={styles.prompt} data-testid="grading-group-prompt" role="alert">
            <span>
                {intl.formatMessage(messages.groupAsk, {
                    count: prompt.seats.length,
                    group: prompt.group,
                    grade: prompt.grade,
                })}
            </span>
            <span className={styles.buttons}>
                <ClassroomButton dataTestId="grading-group-prompt-yes" variant="primary" onClick={onApply}>
                    {intl.formatMessage(messages.groupYes, { count: prompt.seats.length })}
                </ClassroomButton>
                <ClassroomButton dataTestId="grading-group-prompt-no" onClick={onDismiss}>
                    {intl.formatMessage(messages.groupNo)}
                </ClassroomButton>
            </span>
        </div>
    );
};

TeacherGradingGroupPrompt.propTypes = {
    prompt: PropTypes.shape({
        group: PropTypes.string,
        grade: PropTypes.string,
        seats: PropTypes.arrayOf(PropTypes.number),
    }),
    onApply: PropTypes.func.isRequired,
    onDismiss: PropTypes.func.isRequired,
};

export { TeacherGradingGroupPrompt, messages as gradingRubricMessages };
export default TeacherGradingRubric;
