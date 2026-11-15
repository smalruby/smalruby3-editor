/**
 * クラス一覧のカード（EPIC #1956 Q4・Q5・#1959）。Google Classroom のクラスのカードより低く、
 * 4 列 × 2 行で 8 クラスが 1300×600 の 1 画面に入る大きさ。
 *
 * - 上: クラスの色の帯（`classColorFor`）に名前と年度・セクション。
 * - 本文: 要約（課題の数・生徒の数）と次の授業日。共同管理・Google Classroom・生成 AI は小さな札。
 * - 下: ［採点］［⚙ 設定］と ⋮。アーカイブは ⋮ の中（取り消せる操作なので赤にしない・R4）。
 *   アーカイブ済みのクラスは［元に戻す］だけ。
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { classColorStyle } from '../../lib/classroom-class-color.js';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import BoardMenu, { BoardMenuItem } from './board-menu.jsx';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';

const messages = defineMessages({
    archiveConfirmTitle: {
        defaultMessage: 'Archive "{name}"?',
        description: 'Title of the dialog that confirms archiving a class from its card menu',
        id: 'gui.classroom.classList.archiveConfirmTitle',
    },
    cardMenu: {
        defaultMessage: 'Class options',
        description: 'Accessible name of the ⋮ menu on a class card',
        id: 'gui.classroom.classList.cardMenu',
    },
});

// Brand names stay as they are in every language; only "other" is translated.
const GENAI_SERVICE_NAMES = { chatgpt: 'ChatGPT', gemini: 'Gemini' };

/**
 * Short name of the generative AI a class uses, for the card.
 * @param {object} intl - react-intl object
 * @param {?object} genai - the class's stored genai settings
 * @returns {?string} the name, or null when the class does not use one
 */
const genaiServiceName = (intl, genai) => {
    if (!genai || genai.enabled !== true || !genai.service) return null;
    return (
        GENAI_SERVICE_NAMES[genai.service] ||
        intl.formatMessage({
            defaultMessage: 'Other',
            description: 'Generative AI name on a class card when the school chose its own service',
            id: 'gui.classroom.classList.genaiOther',
        })
    );
};

/**
 * 「2026年度・1組」: 帯の 2 行目。セクションが無ければ年度だけ。
 * @param {object} intl - react-intl object
 * @param {object} group - the class
 * @returns {string} the line
 */
const yearSectionLine = (intl, group) => {
    const year = intl.formatMessage(
        {
            defaultMessage: '{year} school year',
            description: 'School year label of a class',
            id: 'gui.classroom.classList.yearLabel',
        },
        { year: group.year },
    );
    return group.section ? `${year}・${group.section}` : year;
};

/**
 * Small confirmation over the class list before archiving a class from its ⋮ menu. The
 * archive can be undone from 「アーカイブ済みのクラス」, so the colors stay neutral (R4).
 * @param {object} props - component props
 * @param {string} props.error - error of the last request (a failed archive is shown here)
 * @param {string} props.errorTitle - title of that error
 * @param {object} props.group - the class to archive
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {Function} props.onCancel - keeps the class
 * @param {Function} props.onConfirm - archives the class
 * @returns {React.ReactElement} the dialog
 */
const ArchiveClassDialog = ({ error, errorTitle, group, isLoading, onCancel, onConfirm }) => {
    const intl = useIntl();
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape' && !isLoading) onCancel();
        },
        [isLoading, onCancel],
    );
    return (
        <div className={styles.createClassBackdrop}>
            <div
                aria-labelledby="classroom-class-archive-title"
                aria-modal="true"
                className={styles.createClassDialog}
                data-testid="classroom-class-archive-dialog"
                role="dialog"
                onKeyDown={handleKeyDown}
            >
                <h3 className={styles.createClassTitle} id="classroom-class-archive-title">
                    {intl.formatMessage(messages.archiveConfirmTitle, { name: formatClassLabel(group) })}
                </h3>
                <p className={styles.classArchiveNote} data-testid="classroom-class-archive-confirm-message">
                    <FormattedMessage
                        defaultMessage={
                            'It will be hidden from the class list, but you can restore it anytime from "Archived classes".'
                        }
                        description="Note in the dialog that confirms archiving a class from its card menu"
                        id="gui.classroom.classList.archiveConfirmNote"
                    />
                </p>
                <ErrorDisplay error={error} errorTitle={errorTitle} />
                <div className={styles.createClassButtons}>
                    <ClassroomButton
                        autoFocus
                        dataTestId="classroom-class-archive-cancel"
                        disabled={isLoading}
                        onClick={onCancel}
                    >
                        <FormattedMessage
                            defaultMessage="Keep the class"
                            description="Button that cancels archiving the class"
                            id="gui.classroom.classSettings.archiveConfirmNo"
                        />
                    </ClassroomButton>
                    <ClassroomButton
                        dataTestId="classroom-class-archive-confirm"
                        disabled={isLoading}
                        variant="primary"
                        onClick={onConfirm}
                    >
                        <FormattedMessage
                            defaultMessage="Yes, archive"
                            description="Confirm button that actually archives the class"
                            id="gui.classroom.classSettings.archiveConfirmYes"
                        />
                    </ClassroomButton>
                </div>
            </div>
        </div>
    );
};

ArchiveClassDialog.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

/**
 * One class card.
 * @param {object} props - component props
 * @param {number} props.assignmentCount - assignments in the class
 * @param {object} props.group - the class
 * @param {Array<object>} props.groups - every class of the teacher (for the color)
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {?{classroom: object, date: string}} props.nextLesson - the next lesson of the class
 * @param {Function} props.onRequestArchive - asks to archive the class (opens the confirmation)
 * @param {Function} props.onRestoreGroup - restores an archived class
 * @param {Function} props.onSelectGroup - opens the class
 * @param {?Function} props.onShowEvaluation - opens grading (null when grading is not available)
 * @param {Function} props.onShowSettings - opens the class settings
 * @returns {React.ReactElement} the card
 */
const ClassCard = ({
    assignmentCount,
    group,
    groups,
    isLoading,
    nextLesson,
    onRequestArchive,
    onRestoreGroup,
    onSelectGroup,
    onShowEvaluation,
    onShowSettings,
}) => {
    const intl = useIntl();
    const handleOpen = useCallback(() => onSelectGroup(group), [onSelectGroup, group]);
    const handleEvaluate = useCallback(() => onShowEvaluation(group), [onShowEvaluation, group]);
    const handleSettings = useCallback(() => onShowSettings(group.groupId), [onShowSettings, group.groupId]);
    const handleRestore = useCallback(() => onRestoreGroup(group.groupId), [onRestoreGroup, group.groupId]);
    const handleArchive = useCallback(() => onRequestArchive(group.groupId), [onRequestArchive, group.groupId]);
    const isArchived = group.status === 'archived';
    const genaiName = genaiServiceName(intl, group.genai);
    const label = formatClassLabel(group);
    const id = group.groupId;

    let nextLine;
    if (assignmentCount === 0) {
        nextLine = (
            <FormattedMessage
                defaultMessage="No assignments yet"
                description="Class card line when the class has no assignment"
                id="gui.classroom.classList.noAssignments"
            />
        );
    } else if (nextLesson) {
        const name = nextLesson.classroom.assignmentName || nextLesson.classroom.className || '';
        nextLine = (
            <FormattedMessage
                defaultMessage="Next lesson {date}: {name}"
                description="Class card line: the next lesson date and its assignment"
                id="gui.classroom.classList.nextLesson"
                values={{
                    date: intl.formatDate(new Date(`${nextLesson.date}T00:00:00`), {
                        month: 'numeric',
                        day: 'numeric',
                    }),
                    name,
                }}
            />
        );
    } else {
        nextLine = (
            <FormattedMessage
                defaultMessage="No upcoming lesson"
                description="Class card line when no assignment has a lesson date from today on"
                id="gui.classroom.classList.noNextLesson"
            />
        );
    }

    return (
        <li className={styles.classCard} data-testid={`classroom-class-card-${id}`}>
            <button
                className={styles.classCardMain}
                data-testid={`classroom-class-open-${id}`}
                disabled={isLoading}
                title={label}
                type="button"
                onClick={handleOpen}
            >
                <span
                    className={styles.classCardBand}
                    data-testid={`classroom-class-band-${id}`}
                    style={classColorStyle(id, groups)}
                >
                    <span className={styles.classCardName}>{group.name}</span>
                    <span className={styles.classCardSection}>{yearSectionLine(intl, group)}</span>
                </span>
                <span className={styles.classCardBody}>
                    <span className={styles.classCardMeta} data-testid={`classroom-class-summary-${id}`}>
                        <span>
                            {intl.formatMessage(
                                {
                                    defaultMessage: '{count} assignments',
                                    description: 'Assignment count on a class card',
                                    id: 'gui.classroom.classList.assignmentCount',
                                },
                                { count: assignmentCount },
                            )}
                        </span>
                        {typeof group.studentCount === 'number' ? (
                            <span>
                                {intl.formatMessage(
                                    {
                                        defaultMessage: '{count} students',
                                        description: 'Student count (seat numbers) on a class card',
                                        id: 'gui.classroom.classList.studentCount',
                                    },
                                    { count: group.studentCount },
                                )}
                            </span>
                        ) : null}
                    </span>
                    <span className={styles.classCardNext} data-testid={`classroom-class-next-${id}`}>
                        {nextLine}
                    </span>
                    <span className={styles.classCardBadges}>
                        {isArchived ? (
                            <span className={styles.classCardBadge}>
                                <FormattedMessage
                                    defaultMessage="Archived"
                                    description="Badge for an archived class"
                                    id="gui.classroom.classList.archivedBadge"
                                />
                            </span>
                        ) : null}
                        {group.role === 'co-teacher' ? (
                            <span className={styles.classCardBadge}>
                                <FormattedMessage
                                    defaultMessage="Co-managed"
                                    description="Badge shown when the teacher co-manages this class"
                                    id="gui.classroom.classList.coTeacherBadge"
                                />
                            </span>
                        ) : null}
                        {group.googleClassroomCourseId ? (
                            <span className={styles.classCardBadge}>
                                <FormattedMessage
                                    defaultMessage="Google Classroom"
                                    description="Badge shown when a class is linked to a Google Classroom course"
                                    id="gui.classroom.classList.gcBadge"
                                />
                            </span>
                        ) : null}
                        {genaiName ? (
                            <span className={styles.classCardBadge} data-testid={`classroom-class-genai-${id}`}>
                                {intl.formatMessage(
                                    {
                                        defaultMessage: 'Generative AI: {service}',
                                        description: 'Generative AI used in the class, on a class card',
                                        id: 'gui.classroom.classList.genaiSummary',
                                    },
                                    { service: genaiName },
                                )}
                            </span>
                        ) : null}
                    </span>
                </span>
            </button>
            <div className={styles.classCardFooter}>
                {isArchived ? (
                    <ClassroomButton
                        className={styles.classCardFooterButton}
                        dataTestId={`classroom-class-restore-${id}`}
                        disabled={isLoading}
                        variant="text"
                        onClick={handleRestore}
                    >
                        <FormattedMessage
                            defaultMessage="Restore"
                            description="Button on an archived class card to restore it"
                            id="gui.classroom.classList.restore"
                        />
                    </ClassroomButton>
                ) : (
                    <React.Fragment>
                        {onShowEvaluation ? (
                            <ClassroomButton
                                className={styles.classCardFooterButton}
                                dataTestId={`classroom-class-evaluate-${id}`}
                                disabled={isLoading}
                                variant="text"
                                onClick={handleEvaluate}
                            >
                                <FormattedMessage
                                    defaultMessage="Grade"
                                    description="Button on a class card to open term-end evaluation"
                                    id="gui.classroom.classList.evaluate"
                                />
                            </ClassroomButton>
                        ) : null}
                        <ClassroomButton
                            className={styles.classCardFooterButton}
                            dataTestId={`classroom-class-settings-open-${id}`}
                            disabled={isLoading}
                            variant="text"
                            onClick={handleSettings}
                        >
                            <span aria-hidden="true">{'⚙'}</span>
                            <FormattedMessage
                                defaultMessage="Settings"
                                description="Button on a class card to open its settings"
                                id="gui.classroom.classList.settings"
                            />
                        </ClassroomButton>
                        <span className={styles.classCardFooterSpacer} />
                        <BoardMenu
                            alignRight
                            ariaLabel={intl.formatMessage(messages.cardMenu)}
                            buttonClassName={styles.boardKebab}
                            disabled={isLoading}
                            label="⋮"
                            testId={`classroom-class-menu-${id}`}
                        >
                            {(close) => (
                                <BoardMenuItem
                                    close={close}
                                    disabled={isLoading}
                                    testId={`classroom-class-archive-${id}`}
                                    onSelect={handleArchive}
                                >
                                    <FormattedMessage
                                        defaultMessage="Archive"
                                        description="Button to archive (hide) the class"
                                        id="gui.classroom.classSettings.archive"
                                    />
                                </BoardMenuItem>
                            )}
                        </BoardMenu>
                    </React.Fragment>
                )}
            </div>
        </li>
    );
};

ClassCard.propTypes = {
    assignmentCount: PropTypes.number.isRequired,
    group: PropTypes.object.isRequired,
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool,
    nextLesson: PropTypes.shape({
        classroom: PropTypes.object.isRequired,
        date: PropTypes.string.isRequired,
    }),
    onRequestArchive: PropTypes.func,
    onRestoreGroup: PropTypes.func,
    onSelectGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func,
    onShowSettings: PropTypes.func.isRequired,
};

export { ArchiveClassDialog, yearSectionLine };
export default ClassCard;
