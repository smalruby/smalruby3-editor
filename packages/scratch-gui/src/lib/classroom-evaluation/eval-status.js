/**
 * What the grading screen says while a step is running, and after it ends (#2419).
 *
 * The steps take long (each work is downloaded and analyzed, the AI is called
 * 10 seats at a time, comments are returned one by one), so the screen shows
 * what is being done right now with a spinner, a thin bar when the count is
 * known, and a short result when it ends. The words are built here (pure) so
 * they are tested without the screen.
 *
 * A running step (`evalProgress` of the hook) is one of:
 *   - {kind: 'load', assignmentName, done, total}: submissions of one assignment
 *     (total is null until its list is read)
 *   - {kind: 'loadProgress', assignmentName}: the progress of a lesson assignment
 *   - {kind: 'grade'|'comment', assignmentName, from, to, total}: the AI on seats from..to of total
 *   - {kind: 'return', done, total}: comments returned so far
 *   - {kind: 'gradebook', done, total}: the saved gradings of the class's assignments (#2424)
 *   - {kind: 'confirm', assignmentName}: the grades of an assignment are being confirmed (#2424)
 * A result (`evalResult`) is {kind: 'load'|'grade'|'comment'|'return'|'confirm', count, lessons, failed, done,
 * total}.
 */
import { defineMessages } from 'react-intl';

const evalStatusMessages = defineMessages({
    load: {
        defaultMessage: 'Loading the submissions of {name}',
        description: 'Grading screen: running message while reading the submissions of an assignment (#2419)',
        id: 'gui.classroom.evaluation.status.load',
    },
    loadCount: {
        defaultMessage: 'Loading the submissions of {name} ({done}/{total})',
        description:
            'Grading screen: running message while reading the submissions of an assignment, with the count (#2419)',
        id: 'gui.classroom.evaluation.status.loadCount',
    },
    loadProgress: {
        defaultMessage: 'Loading the progress of {name}',
        description: 'Grading screen: running message while reading the lesson progress of an assignment (#2419)',
        id: 'gui.classroom.evaluation.status.loadProgress',
    },
    grade: {
        defaultMessage: 'The AI is grading {name} (seats {from}–{to} of {total})',
        description: 'Grading screen: running message while the AI grades some seats of an assignment (#2419)',
        id: 'gui.classroom.evaluation.status.grade',
    },
    comment: {
        defaultMessage: 'The AI is drafting comments for {name} (seats {from}–{to} of {total})',
        description: 'Grading screen: running message while the AI drafts comments for some seats (#2419)',
        id: 'gui.classroom.evaluation.status.comment',
    },
    return: {
        defaultMessage: 'Returning the comments ({done}/{total})',
        description: 'Grading screen: running message while returning comments to the students (#2419)',
        id: 'gui.classroom.evaluation.status.return',
    },
    gradebook: {
        defaultMessage: 'Loading the gradebook ({done}/{total})',
        description: 'Grading screen: running message while reading the saved grades of each assignment (#2424)',
        id: 'gui.classroom.evaluation.status.gradebook',
    },
    confirm: {
        defaultMessage: 'Confirming the grades of {name}',
        description: 'Grading screen: running message while the grades of an assignment are confirmed (#2424)',
        id: 'gui.classroom.evaluation.status.confirm',
    },
    confirmDone: {
        defaultMessage: 'Confirmed {count} grades.',
        description: 'Grading screen: result after confirming the grades of an assignment (#2424)',
        id: 'gui.classroom.evaluation.status.confirmDone',
    },
    confirmFailed: {
        defaultMessage: 'Could not confirm the grades.',
        description: 'Grading screen: result when confirming the grades failed (#2424)',
        id: 'gui.classroom.evaluation.status.confirmFailed',
    },
    openWork: {
        defaultMessage: 'Opening the work',
        description: 'Grading screen: running message while a work is being opened in the editor (#2419)',
        id: 'gui.classroom.evaluation.status.openWork',
    },
    saveScoring: {
        defaultMessage: 'Saving the lesson points of {name}',
        description: 'Grading screen: running message while the lesson points of an assignment are saved (#2419)',
        id: 'gui.classroom.evaluation.status.saveScoring',
    },
    loadDone: {
        defaultMessage: 'Loaded {count} submissions.',
        description: 'Grading screen: result after reading the submissions (#2419)',
        id: 'gui.classroom.evaluation.status.loadDone',
    },
    loadProgressDone: {
        defaultMessage: 'Loaded the progress of {lessons} assignments.',
        description: 'Grading screen: result after reading only lesson progress (no work is submitted, #2419)',
        id: 'gui.classroom.evaluation.status.loadProgressDone',
    },
    gradeDone: {
        defaultMessage: 'The AI graded {count} submissions.',
        description: 'Grading screen: result after the AI grading (#2419)',
        id: 'gui.classroom.evaluation.status.gradeDone',
    },
    commentDone: {
        defaultMessage: 'The AI drafted {count} comments.',
        description: 'Grading screen: result after the AI comment drafts (#2419)',
        id: 'gui.classroom.evaluation.status.commentDone',
    },
    returnDone: {
        defaultMessage: 'Returned {count} comments.',
        description: 'Grading screen: result after returning the comments (#2419)',
        id: 'gui.classroom.evaluation.status.returnDone',
    },
    loadFailed: {
        defaultMessage: 'Could not load the submissions.',
        description: 'Grading screen: result when reading the submissions failed (#2419)',
        id: 'gui.classroom.evaluation.status.loadFailed',
    },
    gradeFailed: {
        defaultMessage: 'The AI grading stopped on the way.',
        description: 'Grading screen: result when the AI grading failed (#2419)',
        id: 'gui.classroom.evaluation.status.gradeFailed',
    },
    commentFailed: {
        defaultMessage: 'The AI comment drafts stopped on the way.',
        description: 'Grading screen: result when the AI comment drafts failed (#2419)',
        id: 'gui.classroom.evaluation.status.commentFailed',
    },
    returnFailed: {
        defaultMessage: 'Returning the comments stopped on the way ({done} of {total} returned).',
        description: 'Grading screen: result when returning the comments failed part way (#2419)',
        id: 'gui.classroom.evaluation.status.returnFailed',
    },
});

/**
 * Short words for the step button while it runs. Both labels are laid on top
 * of each other so the button keeps its width; these (with the spinner) are
 * kept shorter than the step names so the step row does not jump.
 */
const evalRunningLabelMessages = defineMessages({
    load: {
        defaultMessage: 'Loading',
        description: 'Grading screen: step button label while reading the submissions or progress (#2419)',
        id: 'gui.classroom.evaluation.running.load',
    },
    grade: {
        defaultMessage: 'Grading',
        description: 'Grading screen: step button label while the AI grades (#2419)',
        id: 'gui.classroom.evaluation.running.grade',
    },
    comment: {
        defaultMessage: 'Drafting',
        description: 'Grading screen: step button label while the AI drafts comments (#2419)',
        id: 'gui.classroom.evaluation.running.comment',
    },
    return: {
        defaultMessage: 'Returning',
        description: 'Grading screen: step button label while returning the comments (#2419)',
        id: 'gui.classroom.evaluation.running.return',
    },
    confirm: {
        defaultMessage: 'Confirming',
        description: 'Grading screen: step button label while the grades are confirmed (#2424)',
        id: 'gui.classroom.evaluation.running.confirm',
    },
});

/** Which step button runs for each kind (`loadProgress` is the same button 1). */
const RUNNING_STEP_OF_KIND = {
    load: 'load',
    loadProgress: 'load',
    grade: 'grade',
    comment: 'comment',
    return: 'return',
    confirm: 'confirm',
};

const ratioOf = (done, total) => (total > 0 ? Math.min(1, Math.max(0, done / total)) : null);

/**
 * The running message: what is being done now.
 * @param {object} args - what is running
 * @param {?object} args.progress - the running step of the hook (null = none)
 * @param {boolean} [args.openingWork] - a work is being opened
 * @param {?string} [args.savingName] - the assignment whose lesson points are being saved
 * @returns {?{message: object, values: object, ratio: ?number}} null when nothing runs;
 *   ratio (0..1) only when the count is known (the bar)
 */
const describeEvalRunning = ({ progress, openingWork = false, savingName = null }) => {
    if (progress) {
        const name = progress.assignmentName || '';
        switch (progress.kind) {
            case 'load':
                if (typeof progress.total === 'number' && progress.total > 0) {
                    return {
                        message: evalStatusMessages.loadCount,
                        values: { name, done: progress.done, total: progress.total },
                        ratio: ratioOf(progress.done, progress.total),
                    };
                }
                return { message: evalStatusMessages.load, values: { name }, ratio: null };
            case 'loadProgress':
                return { message: evalStatusMessages.loadProgress, values: { name }, ratio: null };
            case 'grade':
            case 'comment':
                return {
                    message: evalStatusMessages[progress.kind],
                    values: { name, from: progress.from, to: progress.to, total: progress.total },
                    // The seats before this call are done.
                    ratio: ratioOf(progress.from - 1, progress.total),
                };
            case 'gradebook':
                return {
                    message: evalStatusMessages.gradebook,
                    values: { done: progress.done, total: progress.total },
                    ratio: ratioOf(progress.done, progress.total),
                };
            case 'confirm':
                return { message: evalStatusMessages.confirm, values: { name }, ratio: null };
            case 'return':
                return {
                    message: evalStatusMessages.return,
                    // 「5/28」 is the one being returned now.
                    values: { done: Math.min(progress.done + 1, progress.total), total: progress.total },
                    ratio: ratioOf(progress.done, progress.total),
                };
            default:
                return null;
        }
    }
    if (openingWork) return { message: evalStatusMessages.openWork, values: {}, ratio: null };
    if (savingName !== null) {
        return { message: evalStatusMessages.saveScoring, values: { name: savingName }, ratio: null };
    }
    return null;
};

/**
 * The short result after a step ends (or fails).
 * @param {?object} result - `evalResult` of the hook
 * @returns {?{message: object, values: object, failed: boolean}} null when there is nothing to say
 */
const describeEvalResult = (result) => {
    if (!result || !RUNNING_STEP_OF_KIND[result.kind]) return null;
    if (result.failed) {
        const message = evalStatusMessages[`${RUNNING_STEP_OF_KIND[result.kind]}Failed`];
        return { message, values: { done: result.done || 0, total: result.total || 0 }, failed: true };
    }
    if (result.kind === 'load' && !result.count && result.lessons > 0) {
        return { message: evalStatusMessages.loadProgressDone, values: { lessons: result.lessons }, failed: false };
    }
    const message = evalStatusMessages[`${RUNNING_STEP_OF_KIND[result.kind]}Done`];
    return { message, values: { count: result.count || 0 }, failed: false };
};

/**
 * The step button that is running, and its short label.
 * @param {?object} progress - the running step of the hook
 * @returns {?{step: string, label: object}} null when no step runs
 */
const runningStepOf = (progress) => {
    const step = progress && RUNNING_STEP_OF_KIND[progress.kind];
    return step ? { step, label: evalRunningLabelMessages[step] } : null;
};

export { describeEvalResult, describeEvalRunning, evalRunningLabelMessages, evalStatusMessages, runningStepOf };
