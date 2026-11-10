// レッスン表（モーダル）。言語のタブ › コース › レッスン › チャレンジの並びと、
// 記録（できた・進み具合・クリアの印）と「できること」を見せる。
// 状態（記録・開く・閉じる）は containers/lessons-library.jsx が渡す。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import { LANGUAGES } from '../../lib/lessons/courses';
import { isChallengeCompleted, lessonClearStatus } from '../../lib/lessons/lesson-progress';
import styles from './lessons-library.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessonsLibrary.title',
        description: 'Title of the lessons library modal',
        defaultMessage: 'Lessons',
    },
    tabBlocks: {
        id: 'gui.lessonsLibrary.tab.blocks',
        description: 'Language tab for block courses in the lessons library',
        defaultMessage: 'Blocks',
    },
    tabRuby: {
        id: 'gui.lessonsLibrary.tab.ruby',
        description: 'Language tab for Ruby courses in the lessons library',
        defaultMessage: 'Ruby',
    },
    tabDncl: {
        id: 'gui.lessonsLibrary.tab.dncl',
        description: 'Language tab for Japanese (DNCL) courses in the lessons library',
        defaultMessage: 'Japanese (DNCL)',
    },
    comingSoon: {
        id: 'gui.lessonsLibrary.comingSoon',
        description: 'Shown on a language tab that has no courses yet',
        defaultMessage: 'Coming soon',
    },
    lessonNumber: {
        id: 'gui.lessonsLibrary.lessonNumber',
        description: 'Heading of a lesson: its number within the course',
        defaultMessage: 'Lesson {number}',
    },
    progress: {
        id: 'gui.lessonsLibrary.progress',
        description: 'How many challenges of a lesson are done, and how many of the required ones',
        defaultMessage: '{completed} / {total} done (required {requiredDone} / {requiredTotal})',
    },
    cleared: {
        id: 'gui.lessonsLibrary.cleared',
        description: 'Mark on a lesson whose clear condition is met',
        defaultMessage: 'Cleared!',
    },
    required: {
        id: 'gui.lessonsLibrary.required',
        description: 'Mark on a challenge that is required to clear the lesson',
        defaultMessage: 'Required',
    },
    done: {
        id: 'gui.lessonsLibrary.done',
        description: 'Mark on a challenge that has been completed',
        defaultMessage: 'Done',
    },
    skillsTitle: {
        id: 'gui.lessonsLibrary.skillsTitle',
        description: 'Heading of the list of skills learned in a course',
        defaultMessage: 'What you can do',
    },
    categoryMotion: {
        id: 'gui.lessonsLibrary.category.motion',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Motion',
    },
    categoryLooks: {
        id: 'gui.lessonsLibrary.category.looks',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Looks',
    },
    categorySound: {
        id: 'gui.lessonsLibrary.category.sound',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Sound',
    },
    categoryEvents: {
        id: 'gui.lessonsLibrary.category.events',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Events',
    },
    categoryControl: {
        id: 'gui.lessonsLibrary.category.control',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Control',
    },
    categorySensing: {
        id: 'gui.lessonsLibrary.category.sensing',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Sensing',
    },
    categoryOperators: {
        id: 'gui.lessonsLibrary.category.operators',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Operators',
    },
    categoryVariables: {
        id: 'gui.lessonsLibrary.category.variables',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Variables',
    },
    categoryLists: {
        id: 'gui.lessonsLibrary.category.lists',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Lists',
    },
    categoryExtensions: {
        id: 'gui.lessonsLibrary.category.extensions',
        description: 'Block category name used as the label of a challenge color dot',
        defaultMessage: 'Extensions',
    },
});

const LANGUAGE_TABS = [
    { language: LANGUAGES.BLOCKS, label: messages.tabBlocks },
    { language: LANGUAGES.RUBY, label: messages.tabRuby },
    { language: LANGUAGES.DNCL, label: messages.tabDncl },
];

// なかま（カテゴリ id）→ 色のクラスと名前
const CATEGORY_STYLES = {
    motion: { className: styles.categoryMotion, label: messages.categoryMotion },
    looks: { className: styles.categoryLooks, label: messages.categoryLooks },
    sound: { className: styles.categorySound, label: messages.categorySound },
    events: { className: styles.categoryEvents, label: messages.categoryEvents },
    control: { className: styles.categoryControl, label: messages.categoryControl },
    sensing: { className: styles.categorySensing, label: messages.categorySensing },
    operators: { className: styles.categoryOperators, label: messages.categoryOperators },
    variables: { className: styles.categoryVariables, label: messages.categoryVariables },
    lists: { className: styles.categoryLists, label: messages.categoryLists },
    extensions: { className: styles.categoryExtensions, label: messages.categoryExtensions },
};

/**
 * コースの「できること」（全チャレンジの skills を並び順に、id で重ねる）。
 * @param {object} course - コース。
 * @returns {Array<{id: string, name: object, challengeIds: Array<string>}>} できることと、それが身につくチャレンジ id。
 */
const courseSkills = (course) => {
    const byId = new Map();
    course.lessons.forEach((lesson) =>
        lesson.challenges.forEach((challenge) =>
            challenge.skills.forEach((skill) => {
                if (!byId.has(skill.id)) byId.set(skill.id, { ...skill, challengeIds: [] });
                byId.get(skill.id).challengeIds.push(challenge.id);
            }),
        ),
    );
    return Array.from(byId.values());
};

const ChallengeCard = ({ challenge, completed, onSelect }) => {
    const intl = useIntl();
    const category = challenge.category ? CATEGORY_STYLES[challenge.category] : null;
    const handleClick = useCallback(() => onSelect(challenge.id), [challenge.id, onSelect]);
    return (
        <li className={styles.challengeItem}>
            <button
                type="button"
                className={classNames(styles.challenge, { [styles.challengeDone]: completed })}
                data-testid={`lessons-library-challenge-${challenge.id}`}
                data-completed={completed ? 'true' : 'false'}
                onClick={handleClick}
            >
                <span className={styles.challengeNumber}>{challenge.number}</span>
                {category ? (
                    <span
                        className={classNames(styles.categoryDot, category.className)}
                        title={intl.formatMessage(category.label)}
                        aria-label={intl.formatMessage(category.label)}
                        role="img"
                    />
                ) : (
                    <span className={classNames(styles.categoryDot, styles.categoryNone)} />
                )}
                <span className={styles.challengeName}>{intl.formatMessage(challenge.name)}</span>
                {challenge.required ? (
                    <span className={styles.requiredMark} data-testid="lessons-library-challenge-required">
                        {intl.formatMessage(messages.required)}
                    </span>
                ) : null}
                {completed ? (
                    <span className={styles.doneMark} data-testid="lessons-library-challenge-done">
                        {intl.formatMessage(messages.done)}
                    </span>
                ) : null}
            </button>
        </li>
    );
};

ChallengeCard.propTypes = {
    challenge: PropTypes.shape({
        id: PropTypes.string.isRequired,
        number: PropTypes.number.isRequired,
        name: PropTypes.object.isRequired,
        category: PropTypes.string,
        required: PropTypes.bool,
    }).isRequired,
    completed: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
};

const LessonSection = ({ lesson, number, progress, onSelectChallenge }) => {
    const intl = useIntl();
    const status = lessonClearStatus(lesson, progress);
    const requiredDone = lesson.clear.required.length - status.missingRequired.length;
    return (
        <section className={styles.lesson} data-testid={`lessons-library-lesson-${lesson.id}`}>
            <div className={styles.lessonHeader}>
                <h3 className={styles.lessonTitle}>
                    <span className={styles.lessonNumber}>
                        {intl.formatMessage(messages.lessonNumber, { number })}
                    </span>
                    <span className={styles.lessonName}>{intl.formatMessage(lesson.name)}</span>
                </h3>
                <span className={styles.progress} data-testid="lessons-library-progress">
                    {intl.formatMessage(messages.progress, {
                        completed: status.completedCount,
                        total: lesson.challenges.length,
                        requiredDone,
                        requiredTotal: lesson.clear.required.length,
                    })}
                </span>
                {status.cleared ? (
                    <span className={styles.clearedMark} data-testid="lessons-library-lesson-cleared">
                        {intl.formatMessage(messages.cleared)}
                    </span>
                ) : null}
            </div>
            <ul className={styles.challenges}>
                {lesson.challenges.map((challenge) => (
                    <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        completed={isChallengeCompleted(progress, challenge.id)}
                        onSelect={onSelectChallenge}
                    />
                ))}
            </ul>
        </section>
    );
};

LessonSection.propTypes = {
    lesson: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.object.isRequired,
        challenges: PropTypes.array.isRequired,
        clear: PropTypes.shape({
            count: PropTypes.number.isRequired,
            required: PropTypes.arrayOf(PropTypes.string).isRequired,
        }).isRequired,
    }).isRequired,
    number: PropTypes.number.isRequired,
    progress: PropTypes.object.isRequired,
    onSelectChallenge: PropTypes.func.isRequired,
};

const CourseSection = ({ course, progress, onSelectChallenge }) => {
    const intl = useIntl();
    // レッスンがまだ無いコースに印を付けない（every は空配列で true になる）
    const cleared =
        course.lessons.length > 0 && course.lessons.every((lesson) => lessonClearStatus(lesson, progress).cleared);
    const skills = useMemo(() => courseSkills(course), [course]);
    return (
        <section className={styles.course} data-testid={`lessons-library-course-${course.id}`}>
            <div className={styles.courseHeader}>
                <h2 className={styles.courseTitle}>{intl.formatMessage(course.name)}</h2>
                {cleared ? (
                    <span className={styles.badge} data-testid="lessons-library-badge">
                        {intl.formatMessage(course.badge)}
                    </span>
                ) : null}
            </div>
            {course.lessons.map((lesson, index) => (
                <LessonSection
                    key={lesson.id}
                    lesson={lesson}
                    number={index + 1}
                    progress={progress}
                    onSelectChallenge={onSelectChallenge}
                />
            ))}
            {skills.length > 0 ? (
                <div className={styles.skills} data-testid="lessons-library-skills">
                    <h3 className={styles.skillsTitle}>{intl.formatMessage(messages.skillsTitle)}</h3>
                    <ul className={styles.skillList}>
                        {skills.map((skill) => {
                            const done = skill.challengeIds.some((id) => isChallengeCompleted(progress, id));
                            return (
                                <li
                                    key={skill.id}
                                    className={classNames(styles.skill, { [styles.skillDone]: done })}
                                    data-testid={`lessons-library-skill-${skill.id}`}
                                    data-done={done ? 'true' : 'false'}
                                >
                                    {intl.formatMessage(skill.name)}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
        </section>
    );
};

CourseSection.propTypes = {
    course: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.object.isRequired,
        badge: PropTypes.object.isRequired,
        lessons: PropTypes.array.isRequired,
    }).isRequired,
    progress: PropTypes.object.isRequired,
    onSelectChallenge: PropTypes.func.isRequired,
};

const LessonsLibrary = ({
    courses,
    progress,
    initialLanguage = LANGUAGES.BLOCKS,
    onRequestClose,
    onSelectChallenge,
}) => {
    const intl = useIntl();
    const [language, setLanguage] = useState(initialLanguage);
    const visibleCourses = courses.filter((course) => course.language === language);
    return (
        <Modal
            fullScreen
            className={styles.modal}
            headerClassName={styles.header}
            contentLabel={intl.formatMessage(messages.title)}
            id="lessonsLibrary"
            onRequestClose={onRequestClose}
        >
            <div className={styles.body} data-testid="lessons-library">
                <div className={styles.tabs} role="tablist">
                    {LANGUAGE_TABS.map((tab) => (
                        <button
                            key={tab.language}
                            type="button"
                            role="tab"
                            aria-selected={tab.language === language}
                            className={classNames(styles.tab, { [styles.tabActive]: tab.language === language })}
                            data-testid={`lessons-library-tab-${tab.language}`}
                            // eslint-disable-next-line react/jsx-no-bind
                            onClick={() => setLanguage(tab.language)}
                        >
                            {intl.formatMessage(tab.label)}
                        </button>
                    ))}
                </div>
                <div className={styles.content} role="tabpanel">
                    {visibleCourses.length === 0 ? (
                        <p className={styles.comingSoon} data-testid="lessons-library-coming-soon">
                            {intl.formatMessage(messages.comingSoon)}
                        </p>
                    ) : (
                        visibleCourses.map((course) => (
                            <CourseSection
                                key={course.id}
                                course={course}
                                progress={progress}
                                onSelectChallenge={onSelectChallenge}
                            />
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};

LessonsLibrary.propTypes = {
    // courses.js の defineCourse が返す形
    courses: PropTypes.arrayOf(PropTypes.object).isRequired,
    // lesson-progress.js の記録
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }).isRequired,
    initialLanguage: PropTypes.oneOf(Object.values(LANGUAGES)),
    onRequestClose: PropTypes.func.isRequired,
    onSelectChallenge: PropTypes.func.isRequired,
};

export { courseSkills };
export default LessonsLibrary;
