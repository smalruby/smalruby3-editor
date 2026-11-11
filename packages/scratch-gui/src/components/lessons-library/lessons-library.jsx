// レッスン表（フルスクリーンのモーダル）。「スプライトを選ぶ」画面（components/library）と同じ形に
// そろえる（児童・生徒が見慣れているため・#1530）:
//   - 紫のヘッダー（← 戻る ／ レッスンを選ぶ）
//   - 薄い紫の帯に検索ボックス ＋ 区切り ＋ 言語のボタン（コースがある言語だけ。選んだものはオレンジ）。
//     コースが 4 つを超えたら 2 段目にコースのボタン（押すとそのコースまでスクロール）
//   - コース = 大きい見出し（全部できたら名前の前に ✓、右にプログレスバーと「5 / 11」）、
//     レッスン = 小さい見出し、チャレンジ = カード（できたら右上に ✓）
// 絞り込み・言語・コースのボタンの判定は lib/lessons/library-filter.js（純粋関数）。
// 状態（記録・開く・閉じる）は containers/lessons-library.jsx が渡す。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import TagButton from '../../containers/tag-button.jsx';
import { LANGUAGES } from '../../lib/lessons/courses';
import { filterCourseStatuses, libraryLanguages, showCourseNav } from '../../lib/lessons/library-filter';
import Divider from '../divider/divider.jsx';
import Filter from '../filter/filter.jsx';
import styles from './lessons-library.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessonsLibrary.title',
        description: 'Title of the lessons library modal',
        defaultMessage: 'Choose a Lesson',
    },
    search: {
        id: 'gui.lessonsLibrary.search',
        description: 'Placeholder of the search box of the lessons library (searches challenge names)',
        defaultMessage: 'Search',
    },
    noMatch: {
        id: 'gui.lessonsLibrary.noMatch',
        description: 'Shown when no challenge name contains the search text',
        defaultMessage: 'No challenges match "{query}"',
    },
    tabBlocks: {
        id: 'gui.lessonsLibrary.tab.blocks',
        description: 'Language button for block courses in the lessons library',
        defaultMessage: 'Blocks',
    },
    tabRuby: {
        id: 'gui.lessonsLibrary.tab.ruby',
        description: 'Language button for Ruby courses in the lessons library',
        defaultMessage: 'Ruby',
    },
    tabDncl: {
        id: 'gui.lessonsLibrary.tab.dncl',
        description: 'Language button for Japanese (DNCL) courses in the lessons library',
        defaultMessage: 'Japanese (DNCL)',
    },
    lessonNumber: {
        id: 'gui.lessonsLibrary.lessonNumber',
        description: 'Heading of a lesson: its number within the course',
        defaultMessage: 'Lesson {number}',
    },
    courseProgress: {
        id: 'gui.lessonsLibrary.courseProgress',
        description: 'How many challenges of a course are done, next to its progress bar',
        defaultMessage: '{completed} / {total}',
    },
    done: {
        id: 'gui.lessonsLibrary.done',
        description: 'Label of the check on a completed challenge or course',
        defaultMessage: 'Done',
    },
    next: {
        id: 'gui.lessonsLibrary.next',
        description: 'Mark on the challenge to do next (opened from "Next challenge" on the completed toast)',
        defaultMessage: 'Next!',
    },
    categoryMotion: {
        id: 'gui.lessonsLibrary.category.motion',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Motion',
    },
    categoryLooks: {
        id: 'gui.lessonsLibrary.category.looks',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Looks',
    },
    categorySound: {
        id: 'gui.lessonsLibrary.category.sound',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Sound',
    },
    categoryEvents: {
        id: 'gui.lessonsLibrary.category.events',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Events',
    },
    categoryControl: {
        id: 'gui.lessonsLibrary.category.control',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Control',
    },
    categorySensing: {
        id: 'gui.lessonsLibrary.category.sensing',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Sensing',
    },
    categoryOperators: {
        id: 'gui.lessonsLibrary.category.operators',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Operators',
    },
    categoryVariables: {
        id: 'gui.lessonsLibrary.category.variables',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Variables',
    },
    categoryLists: {
        id: 'gui.lessonsLibrary.category.lists',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Lists',
    },
    categoryExtensions: {
        id: 'gui.lessonsLibrary.category.extensions',
        description: 'Block category name used as the label of the picture of a challenge card',
        defaultMessage: 'Extensions',
    },
});

const LANGUAGE_LABELS = {
    [LANGUAGES.BLOCKS]: messages.tabBlocks,
    [LANGUAGES.RUBY]: messages.tabRuby,
    [LANGUAGES.DNCL]: messages.tabDncl,
};

// なかま（カテゴリ id）→ カードの絵の色のクラスと名前
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

// 見せたいところへスクロールする（jsdom には scrollIntoView が無い）
const scrollToElement = (element) => {
    if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'start' });
};

// カードの絵。challenge.card.image があればその絵、無ければなかまの色の上に記号（仮の絵）
const CardArt = ({ challenge }) => {
    const intl = useIntl();
    const category = challenge.category ? CATEGORY_STYLES[challenge.category] : null;
    const card = challenge.card || {};
    const label = category ? intl.formatMessage(category.label) : null;
    return (
        <span
            className={classNames(styles.cardArt, category ? category.className : styles.categoryNone)}
            data-testid="lessons-library-card-art"
            {...(label ? { role: 'img', 'aria-label': label, title: label } : { 'aria-hidden': true })}
        >
            {card.image ? (
                <img className={styles.cardImage} src={card.image} alt="" draggable={false} />
            ) : (
                <span className={styles.cardSymbol} aria-hidden>
                    {card.symbol || challenge.number}
                </span>
            )}
        </span>
    );
};

CardArt.propTypes = {
    challenge: PropTypes.shape({
        number: PropTypes.number.isRequired,
        category: PropTypes.string,
        card: PropTypes.shape({ image: PropTypes.string, symbol: PropTypes.string }),
    }).isRequired,
};

const ChallengeCard = ({ challenge, completed, next, onSelect }) => {
    const intl = useIntl();
    const handleClick = useCallback(() => onSelect(challenge.id), [challenge.id, onSelect]);
    return (
        <li className={styles.cardItem}>
            <button
                type="button"
                className={classNames(styles.card, {
                    [styles.cardDone]: completed,
                    [styles.cardNext]: next,
                })}
                data-testid={`lessons-library-challenge-${challenge.id}`}
                data-completed={completed ? 'true' : 'false'}
                data-next={next ? 'true' : 'false'}
                onClick={handleClick}
            >
                <CardArt challenge={challenge} />
                <span className={styles.cardName}>{intl.formatMessage(challenge.name)}</span>
                {next ? (
                    <span className={styles.nextMark} data-testid="lessons-library-challenge-next">
                        {intl.formatMessage(messages.next)}
                    </span>
                ) : null}
                {completed ? (
                    <span
                        className={styles.cardCheck}
                        data-testid="lessons-library-challenge-done"
                        role="img"
                        aria-label={intl.formatMessage(messages.done)}
                    >
                        {'✓'}
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
        card: PropTypes.object,
    }).isRequired,
    completed: PropTypes.bool.isRequired,
    next: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
};

const LessonSection = ({ lessonStatus, focused, nextChallengeId, onSelectChallenge }) => {
    const { lesson, number } = lessonStatus;
    const intl = useIntl();
    const sectionRef = useRef(null);
    useEffect(() => {
        if (focused) scrollToElement(sectionRef.current);
    }, [focused]);
    return (
        <section
            ref={sectionRef}
            className={classNames(styles.lesson, { [styles.lessonFocused]: focused })}
            data-testid={`lessons-library-lesson-${lesson.id}`}
            data-focused={focused ? 'true' : 'false'}
        >
            <h3 className={styles.lessonTitle}>
                <span className={styles.lessonNumber}>{intl.formatMessage(messages.lessonNumber, { number })}</span>
                <span className={styles.lessonName}>{intl.formatMessage(lesson.name)}</span>
            </h3>
            <ul className={styles.cards}>
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
    // lesson-progress.js の courseProgress が返す lessons の 1 つ（検索で challenges を絞ったもの）
    lessonStatus: PropTypes.shape({
        lesson: PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.object.isRequired,
        }).isRequired,
        number: PropTypes.number.isRequired,
        challenges: PropTypes.arrayOf(
            PropTypes.shape({ challenge: PropTypes.object.isRequired, completed: PropTypes.bool.isRequired }),
        ).isRequired,
    }).isRequired,
    focused: PropTypes.bool,
    nextChallengeId: PropTypes.string,
    onSelectChallenge: PropTypes.func.isRequired,
};

const CourseSection = ({ status, focusLessonId, nextChallengeId, onSelectChallenge }) => {
    const intl = useIntl();
    const { course, completedCount, total, allCompleted } = status;
    const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    return (
        <section className={styles.course} data-testid={`lessons-library-course-${course.id}`}>
            <div className={styles.courseHeader}>
                <h2 className={styles.courseTitle}>
                    {allCompleted ? (
                        <span
                            className={styles.courseCheck}
                            data-testid="lessons-library-course-done"
                            role="img"
                            aria-label={intl.formatMessage(messages.done)}
                        >
                            {'✓'}
                        </span>
                    ) : null}
                    {intl.formatMessage(course.name)}
                </h2>
                <div className={styles.courseProgress} data-testid="lessons-library-course-progress">
                    <div
                        className={styles.progressBar}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={completedCount}
                        aria-label={intl.formatMessage(course.name)}
                    >
                        <div className={styles.progressBarValue} style={{ width: `${percent}%` }} />
                    </div>
                    <span className={styles.progressText} data-testid="lessons-library-course-progress-text">
                        {intl.formatMessage(messages.courseProgress, { completed: completedCount, total })}
                    </span>
                </div>
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
    // library-filter.js の filterCourseStatuses が返す 1 つ
    status: PropTypes.shape({
        course: PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.object.isRequired,
        }).isRequired,
        completedCount: PropTypes.number.isRequired,
        total: PropTypes.number.isRequired,
        allCompleted: PropTypes.bool.isRequired,
        lessons: PropTypes.array.isRequired,
    }).isRequired,
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
    const languages = useMemo(() => libraryLanguages(courses), [courses]);
    const [language, setLanguage] = useState(() =>
        languages.includes(initialLanguage) ? initialLanguage : languages[0] || initialLanguage,
    );
    const [query, setQuery] = useState('');
    const contentRef = useRef(null);

    const languageCourses = useMemo(() => courses.filter((course) => course.language === language), [
        courses,
        language,
    ]);
    const nameOf = useCallback((challenge) => intl.formatMessage(challenge.name), [intl]);
    const statuses = useMemo(() => filterCourseStatuses(languageCourses, progress, query, nameOf), [
        languageCourses,
        progress,
        query,
        nameOf,
    ]);

    const handleQueryChange = useCallback((event) => setQuery(event.target.value), []);
    const handleQueryClear = useCallback(() => setQuery(''), []);
    const handleLanguage = useCallback((tag) => setLanguage(tag), []);
    const handleCourseNav = useCallback((courseId) => {
        const content = contentRef.current;
        if (!content) return;
        scrollToElement(content.querySelector(`[data-testid="lessons-library-course-${courseId}"]`));
    }, []);

    return (
        <Modal
            fullScreen
            className={styles.modal}
            contentLabel={intl.formatMessage(messages.title)}
            id="lessonsLibrary"
            onRequestClose={onRequestClose}
        >
            <div className={styles.body} data-testid="lessons-library">
                <div className={styles.filterBar}>
                    <div className={styles.search} data-testid="lessons-library-search">
                        <Filter
                            className={styles.filter}
                            filterQuery={query}
                            inputClassName={styles.filterInput}
                            placeholderText={intl.formatMessage(messages.search)}
                            onChange={handleQueryChange}
                            onClear={handleQueryClear}
                        />
                    </div>
                    <Divider className={styles.divider} />
                    {languages.map((lang) => (
                        <TagButton
                            key={lang}
                            tag={lang}
                            intlLabel={LANGUAGE_LABELS[lang]}
                            active={lang === language}
                            aria-pressed={lang === language}
                            className={styles.tagButton}
                            data-testid={`lessons-library-tab-${lang}`}
                            onClick={handleLanguage}
                        />
                    ))}
                </div>
                {showCourseNav(languageCourses) ? (
                    <div className={styles.courseNav} data-testid="lessons-library-course-nav">
                        {languageCourses.map((course) => (
                            <TagButton
                                key={course.id}
                                tag={course.id}
                                intlLabel={course.name}
                                className={classNames(styles.tagButton, styles.courseNavButton)}
                                data-testid={`lessons-library-course-nav-${course.id}`}
                                onClick={handleCourseNav}
                            />
                        ))}
                    </div>
                ) : null}
                <div className={styles.content} ref={contentRef}>
                    {statuses.length === 0 && query.trim() ? (
                        <p className={styles.noMatch} data-testid="lessons-library-no-match">
                            {intl.formatMessage(messages.noMatch, { query: query.trim() })}
                        </p>
                    ) : (
                        statuses.map((status) => (
                            <CourseSection
                                key={status.course.id}
                                status={status}
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
