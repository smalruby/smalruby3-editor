// レッスン表（モーダル）。言語のタブ › コース › レッスン › チャレンジの並びと、
// 記録（できた・進み具合・コースのクリアの印）を見せる。数えるのは lesson-progress.js の
// courseProgress（見た目の作り直しは #1530）。
// 状態（記録・開く・閉じる）は containers/lessons-library.jsx が渡す。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import { LANGUAGES } from '../../lib/lessons/courses';
import { courseProgress } from '../../lib/lessons/lesson-progress';
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
        description: 'How many challenges of a lesson are done',
        defaultMessage: '{completed} / {total} done',
    },
    done: {
        id: 'gui.lessonsLibrary.done',
        description: 'Mark on a challenge that has been completed',
        defaultMessage: 'Done',
    },
    next: {
        id: 'gui.lessonsLibrary.next',
        description: 'Mark on the challenge to do next (opened from "Next challenge" on the completed toast)',
        defaultMessage: 'Next!',
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

const ChallengeCard = ({ challenge, completed, next, onSelect }) => {
    const intl = useIntl();
    const category = challenge.category ? CATEGORY_STYLES[challenge.category] : null;
    const handleClick = useCallback(() => onSelect(challenge.id), [challenge.id, onSelect]);
    return (
        <li className={styles.challengeItem}>
            <button
                type="button"
                className={classNames(styles.challenge, {
                    [styles.challengeDone]: completed,
                    [styles.challengeNext]: next,
                })}
                data-testid={`lessons-library-challenge-${challenge.id}`}
                data-completed={completed ? 'true' : 'false'}
                data-next={next ? 'true' : 'false'}
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
                {next ? (
                    <span className={styles.nextMark} data-testid="lessons-library-challenge-next">
                        {intl.formatMessage(messages.next)}
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
    }).isRequired,
    completed: PropTypes.bool.isRequired,
    next: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
};

// レッスン表を開いたときに見せるレッスンへスクロールする（jsdom には scrollIntoView が無い）
const scrollToSection = (element) => {
    if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'start' });
};

const LessonSection = ({ lessonStatus, focused, nextChallengeId, onSelectChallenge }) => {
    const { lesson, number } = lessonStatus;
    const intl = useIntl();
    const sectionRef = useRef(null);
    useEffect(() => {
        if (focused) scrollToSection(sectionRef.current);
    }, [focused]);
    return (
        <section
            ref={sectionRef}
            className={classNames(styles.lesson, { [styles.lessonFocused]: focused })}
            data-testid={`lessons-library-lesson-${lesson.id}`}
            data-focused={focused ? 'true' : 'false'}
        >
            <div className={styles.lessonHeader}>
                <h3 className={styles.lessonTitle}>
                    <span className={styles.lessonNumber}>
                        {intl.formatMessage(messages.lessonNumber, { number })}
                    </span>
                    <span className={styles.lessonName}>{intl.formatMessage(lesson.name)}</span>
                </h3>
                <span className={styles.progress} data-testid="lessons-library-progress">
                    {intl.formatMessage(messages.progress, {
                        completed: lessonStatus.completedCount,
                        total: lessonStatus.total,
                    })}
                </span>
            </div>
            <ul className={styles.challenges}>
                {lessonStatus.challenges.map(({ challenge, completed }) => (
                    <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        completed={completed}
                        next={challenge.id === nextChallengeId}
                        onSelect={onSelectChallenge}
                    />
                ))}
            </ul>
        </section>
    );
};

LessonSection.propTypes = {
    // lesson-progress.js の courseProgress が返す lessons の 1 つ
    lessonStatus: PropTypes.shape({
        lesson: PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.object.isRequired,
        }).isRequired,
        number: PropTypes.number.isRequired,
        completedCount: PropTypes.number.isRequired,
        total: PropTypes.number.isRequired,
        challenges: PropTypes.arrayOf(
            PropTypes.shape({ challenge: PropTypes.object.isRequired, completed: PropTypes.bool.isRequired }),
        ).isRequired,
    }).isRequired,
    focused: PropTypes.bool,
    nextChallengeId: PropTypes.string,
    onSelectChallenge: PropTypes.func.isRequired,
};

const CourseSection = ({ course, progress, focusLessonId, nextChallengeId, onSelectChallenge }) => {
    const intl = useIntl();
    // コースのクリアの印は、コースのチャレンジが全部できたとき
    const status = courseProgress(course, progress);
    return (
        <section className={styles.course} data-testid={`lessons-library-course-${course.id}`}>
            <div className={styles.courseHeader}>
                <h2 className={styles.courseTitle}>{intl.formatMessage(course.name)}</h2>
                {status.allCompleted ? (
                    <span className={styles.badge} data-testid="lessons-library-badge">
                        {intl.formatMessage(course.badge)}
                    </span>
                ) : null}
            </div>
            {status.lessons.map((lessonStatus) => (
                <LessonSection
                    key={lessonStatus.lesson.id}
                    lessonStatus={lessonStatus}
                    focused={lessonStatus.lesson.id === focusLessonId}
                    nextChallengeId={nextChallengeId}
                    onSelectChallenge={onSelectChallenge}
                />
            ))}
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
    focusLessonId: PropTypes.string,
    nextChallengeId: PropTypes.string,
    onSelectChallenge: PropTypes.func.isRequired,
};

const LessonsLibrary = ({
    courses,
    progress,
    initialLanguage = LANGUAGES.BLOCKS,
    focusLessonId = null,
    nextChallengeId = null,
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
                                focusLessonId={focusLessonId}
                                nextChallengeId={nextChallengeId}
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
    // 開いたときに見せるレッスン（そこへスクロールして囲む）と、次として目立たせるチャレンジ。
    // 「できた！」の「次のチャレンジ」で開いたとき（lesson-progress.js の lessonsLibraryFocus）
    focusLessonId: PropTypes.string,
    nextChallengeId: PropTypes.string,
    onRequestClose: PropTypes.func.isRequired,
    onSelectChallenge: PropTypes.func.isRequired,
};

export default LessonsLibrary;
