// レッスンモードのコンテナ。gui.jsx のメニューバーと本体のあいだに常時マウントし、
//   - startChallenge(id) で開こうとしているチャレンジを、新しい作品 → setup →
//     openChallenge(id) の順に進める
//   - レッスンモードのあいだ課題バー（LessonTaskBar）を出す
// パレットの絞り込みは Blocks コンテナが getLessonAllowedBlocks で行う。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import LessonAssignmentBand from '../components/lesson-assignment-band/lesson-assignment-band.jsx';
import LessonHintNudge from '../components/lesson-hint/lesson-hint-nudge.jsx';
import LessonPartNames from '../components/lesson-part-names/lesson-part-names.jsx';
import LessonPartQuiz from '../components/lesson-part-quiz/lesson-part-quiz.jsx';
import LessonTaskBar from '../components/lesson-task-bar/lesson-task-bar.jsx';
import { applyDeckSetup, normalizeRubyVersion } from '../lib/deck-setup';
import { useChallengeActivityDiagram } from '../lib/lessons/activity-diagram/use-challenge-activity-diagram';
import { assignmentProgress, isAssignmentChallenge } from '../lib/lessons/assignment-progress';
import { setupForChallenge } from '../lib/lessons/challenge-setup';
import { applyChallengeStart } from '../lib/lessons/challenge-start';
import { findChallenge } from '../lib/lessons/courses';
import { LESSON_EVENTS, sendLessonEvent } from '../lib/lessons/lesson-analytics';
import {
    ROLE_SOURCES,
    connectedGroupSeats,
    loadRememberedRole,
    pairKeyOf,
    resolveChallengeRole,
    roleChangeRestarts,
    saveRememberedRole,
} from '../lib/lessons/lesson-role';
import { openAssignmentLessonsLibrary } from '../lib/lessons/open-lessons-library';
import { challengeForRole } from '../lib/lessons/role-swap';
import { useIdleNudge } from '../lib/lessons/use-idle-nudge';
import { computeBoundSeat } from '../lib/mesh-v2-classroom-binding.jsx';
import { targetCodeToBlocks } from '../lib/ruby-to-blocks-converter';
import sharedMessages from '../lib/shared-messages';
import { closeCards } from '../reducers/cards';
import { selectStudentLesson } from '../reducers/classroom';
import { requestExternalExitDnclMode, setDnclMode } from '../reducers/dncl-mode';
import { clearGoogleDriveFile } from '../reducers/google-drive-file';
import {
    cancelStartChallenge,
    closeLesson,
    dismissCompleted,
    getCurrentChallenge,
    getCurrentHint,
    getCurrentRole,
    hideCompleted,
    hideHint,
    openChallenge,
    setLessonRole,
    showCompleted,
    showHint,
    solvePartQuiz,
    startChallenge,
} from '../reducers/lesson-mode';
import { openLessonsLibrary } from '../reducers/modals';
import { setProjectUnchanged } from '../reducers/project-changed';
import {
    getIsAnyCreatingNewState,
    getIsShowingProject,
    getIsShowingWithoutId,
    requestNewProject,
} from '../reducers/project-state';
import { updateRubyCodeTarget } from '../reducers/ruby-code';
import LessonHint from './lesson-hint.jsx';
import LessonPracticePartner from './lesson-practice-partner.jsx';

const LessonMode = ({
    assignmentLesson = null,
    completedHidden = false,
    current,
    dispatch,
    dnclMode,
    fromAssignment = false,
    hint,
    isAnyCreatingNewState,
    isShowingProject,
    isShowingWithoutId,
    menuOpen,
    mySeat = null,
    onCancelStart,
    onCloseLesson,
    onDismissCompleted,
    onEndLesson,
    onExitDnclMode,
    onHideCompleted,
    onHideHint,
    onOpenChallenge,
    onRequestNewProject,
    onSetRole,
    onShowCompleted,
    onShowHint,
    onSolvePartQuiz,
    onStartChallenge,
    partQuizSolved = 0,
    pendingChallengeId,
    pendingRole = null,
    pendingRoleSource = null,
    progress,
    projectChanged,
    role = null,
    rolePair = null,
    rubyVersion,
    scratchBlocks = null,
    teacherLoggedIn = false,
    toastVisible,
    vm,
}) => {
    const intl = useIntl();
    // 答えのプログラムから描いたアクティビティ図（チャレンジの定義が出すとしたときだけ）。課題の全文の中に出す
    const activityDiagram = useChallengeActivityDiagram(current ? current.challenge : null, {
        rubyVersion,
        scratchBlocks,
    });

    // 1. 開こうとしているチャレンジがあれば、新しい作品にする（いまの作品に変更が
    //    あればメニューの「新規」と同じ確認）。新しい作品を頼んだことを ref で覚え、
    //    作品ができる前に別のチャレンジに変わっても二度は頼まない（できた作品で
    //    そのチャレンジを開く）。ref は pendingChallengeId が無くなるときに消す
    const startedForRef = useRef(null);
    useEffect(() => {
        if (pendingChallengeId === null) {
            startedForRef.current = null;
            return;
        }
        if (!isShowingProject || startedForRef.current !== null) return;
        startedForRef.current = pendingChallengeId;
        // eslint-disable-next-line no-alert
        if (projectChanged && !window.confirm(intl.formatMessage(sharedMessages.replaceProjectWarning))) {
            onCancelStart();
            return;
        }
        // 日本語モードのままだと、パレットが日本語で書けるブロックに絞られたうえにチャレンジの
        // 絞り込みが重なり、チャレンジで使うブロックが出てこない（#1735）。レッスンに入ると決まって
        // から（作品の置きかえを断ったときは変えない）、ふりがなモードに戻す
        if (dnclMode) onExitDnclMode();
        onRequestNewProject();
    }, [
        pendingChallengeId,
        isShowingProject,
        projectChanged,
        intl,
        dnclMode,
        onCancelStart,
        onExitDnclMode,
        onRequestNewProject,
    ]);

    // 2. 新しい作品ができたら setup を適用してレッスンモードに入る（titled-hoc と同じ
    //    「作成中 → 表示中」の遷移で検出する）
    const wasCreatingRef = useRef(isAnyCreatingNewState);
    const pendingRef = useRef(pendingChallengeId);
    pendingRef.current = pendingChallengeId;
    // setup のプログラムの変換に使う（effect をこれらの変化で走らせ直さないよう ref で持つ）
    const convertRef = useRef({ intl, rubyVersion });
    convertRef.current = { intl, rubyVersion };
    // 役を決めるのに使う（#2062。effect をこれらの変化で走らせ直さないよう ref で持つ）
    const roleInputRef = useRef({ mySeat, pendingRole, pendingRoleSource, rolePair });
    roleInputRef.current = { mySeat, pendingRole, pendingRoleSource, rolePair };
    useEffect(() => {
        const finished = wasCreatingRef.current && !isAnyCreatingNewState && isShowingWithoutId;
        wasCreatingRef.current = isAnyCreatingNewState;
        if (!finished || pendingChallengeId === null) return;
        const found = findChallenge(pendingChallengeId);
        if (!found) return;
        const challengeId = pendingChallengeId;
        // 役のあるチャレンジは、始める前に役を決める（最初から入るプログラムも役で入れかわる・#2062）。役を選び
        // なおして始めなおすときはその役、ほかは前回の役・出席番号のペア・シマラビの役の順（lesson-role.js）。
        // つながっているメッシュはチャレンジを始めなおしても切れないので、前のチャレンジのペアがわかる
        let roleInfo = null;
        if (found.challenge.roles) {
            const input = roleInputRef.current;
            const groupSeats = connectedGroupSeats(vm);
            roleInfo = input.pendingRole
                ? {
                      role: input.pendingRole,
                      source: input.pendingRoleSource || ROLE_SOURCES.CHOSEN,
                      pair: pairKeyOf(groupSeats) || input.rolePair,
                  }
                : resolveChallengeRole({ remembered: loadRememberedRole(), mySeat: input.mySeat, groupSeats });
        }
        const challenge = challengeForRole(found.challenge, roleInfo ? roleInfo.role : null);
        const setup = setupForChallenge(found.course, challenge);
        const { intl: convertIntl, rubyVersion: currentVersion } = convertRef.current;
        // setup で Ruby のバージョンを決めるチャレンジは、その版で答えを変換する
        const version = normalizeRubyVersion(setup.rubyVersion) || currentVersion;
        // 準備のあいだに、ほかのチャレンジ・ほかの作品に変わったら止める（作品が差しかわるとステージも変わる）
        const stageOf = () =>
            vm && vm.runtime && vm.runtime.getTargetForStage ? vm.runtime.getTargetForStage() : null;
        const startStage = stageOf();
        const isCurrent = () => pendingRef.current === challengeId && stageOf() === startStage;
        applyDeckSetup(setup, dispatch, vm)
            .catch((err) => {
                // setup が失敗してもチャレンジは開く（拡張機能などは手で足せる）
                // eslint-disable-next-line no-console
                console.warn('[lesson-mode] setup failed:', err);
            })
            // 拡張機能を読み込んだあとで、ネコの置きかえと前の段の答えを入れる（lib/lessons/challenge-start.js）
            .then(() =>
                applyChallengeStart(vm, setup, {
                    locale: convertIntl.locale,
                    toBlocks: (target, code) => targetCodeToBlocks(vm, target, code, convertIntl, { version }),
                    isCurrent,
                }),
            )
            .then((changed) => {
                if (!changed) return;
                // Ruby タブは編集中のスプライトが変わったときにしかプログラムを作り直さないので、入れた答えを出し直す
                if (vm.editingTarget) dispatch(updateRubyCodeTarget(vm.editingTarget, version));
                // 準備で変えたのは生徒の変更ではない。「変更あり」のままだと、チャレンジを選び直すだけで
                // 「作品を置きかえますか」の確認やページを離れるときの確認が出てしまう
                dispatch(setProjectUnchanged());
            })
            .catch((err) => {
                // eslint-disable-next-line no-console
                console.warn('[lesson-mode] the start of the challenge failed:', err);
            })
            .then(() => {
                // 途中で取り消された・別のチャレンジに変わったときは開かない
                if (pendingRef.current === challengeId) onOpenChallenge(challengeId, roleInfo);
            });
    }, [isAnyCreatingNewState, isShowingWithoutId, pendingChallengeId, dispatch, onOpenChallenge, vm]);

    // レッスン表（別の画面）ができるまでの入口。Playwright / Selenium からも呼ぶ
    useEffect(() => {
        if (typeof window === 'undefined') return () => {};
        window.smalruby = window.smalruby || {};
        window.smalruby.startChallenge = onStartChallenge;
        return () => {
            if (window.smalruby) delete window.smalruby.startChallenge;
        };
    }, [onStartChallenge]);

    // 課題バー（画面の幅いっぱい）が出る・消えると、ステージの列がその高さの分だけ上下に動く。
    // ステージ（containers/stage.jsx）は canvas の位置を window の resize / scroll でしか測り直さない
    // ので、知らせないとマウスの位置が課題バーの高さの分ずれて、ネコにマウスを重ねても
    // 「さわった」にならない（#1581）。ブロックの作業場所も高さが変わるので同じく resize で知らせる
    const taskBarVisible = Boolean(current);
    const taskBarVisibleRef = useRef(taskBarVisible);
    useEffect(() => {
        if (taskBarVisibleRef.current === taskBarVisible) return;
        taskBarVisibleRef.current = taskBarVisible;
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'));
    }, [taskBarVisible]);

    // 役を選びなおす（課題バーの役のボタン）。役を変えたら、その役のプログラムでチャレンジを始めなおす（変更があれば、
    // 作品を新しくするときの確認が出る。メッシュはつながったまま。ヒントのページはそのまま）。先に作った変数の名前と、
    // 入れかわった練習相手の変数の名前がぶつからないように、最初のプログラムが無いチャレンジ（3-3・4-1）も始めなおす。
    // 同じ役のまま決め方だけ変わるとき（出席番号でつながった）は、始めなおさない。生徒が選んだ役だけを端末に覚える
    // （次の役のあるチャレンジで「前回は…」と最初に選んでおく。reducer は端末に触らない）
    const currentId = current ? current.challenge.id : null;
    const changeRole = useCallback(
        (next, { roleSource = ROLE_SOURCES.CHOSEN, rolePair: pair } = {}) => {
            const found = currentId ? findChallenge(currentId) : null;
            if (!found || !found.challenge.roles) return;
            if (roleSource === ROLE_SOURCES.CHOSEN) {
                saveRememberedRole({ role: next, pair: pairKeyOf(connectedGroupSeats(vm)) || rolePair });
            }
            if (roleChangeRestarts(found.challenge) && next !== (role && role.role)) {
                onStartChallenge(currentId, { fromAssignment, role: next, roleSource });
            } else {
                onSetRole(next, { roleSource, rolePair: pair });
            }
        },
        [currentId, fromAssignment, onSetRole, onStartChallenge, role, rolePair, vm],
    );
    const handleChooseRole = useCallback((next) => changeRole(next), [changeRole]);

    // チャレンジの途中で出席番号のペアにつながったら、まだこのチャレンジで役を選んでいなければ、チャレンジを開くときと
    // 同じ決め方（resolveChallengeRole）で役を決めなおす（小さい人がシマラビの役・先生の判断 p3）。同じペアで前に
    // 選んだ役を覚えていれば、出席番号の役で上書きしない。作品を変えたあとに始めなおすことはしない（作ったものを消さない）
    const seatInputRef = useRef({ changeRole, mySeat, projectChanged, role });
    seatInputRef.current = { changeRole, mySeat, projectChanged, role };
    const roleChallengeOpen = Boolean(current && current.challenge.roles);
    useEffect(() => {
        if (!roleChallengeOpen || !vm || !vm.runtime || typeof vm.runtime.on !== 'function') return () => {};
        const onConnected = () => {
            const { changeRole: change, mySeat: seat, projectChanged: changed, role: now } = seatInputRef.current;
            if (!now || now.source === ROLE_SOURCES.CHOSEN || now.source === ROLE_SOURCES.SEAT) return;
            const groupSeats = connectedGroupSeats(vm);
            const resolved = resolveChallengeRole({ remembered: loadRememberedRole(), mySeat: seat, groupSeats });
            // 出席番号のペアでない・同じペアで選んだ役を覚えている（REMEMBERED）ときは、いまの役のまま
            if (resolved.source !== ROLE_SOURCES.SEAT) return;
            if (resolved.role !== now.role && changed) return;
            change(resolved.role, { roleSource: ROLE_SOURCES.SEAT, rolePair: resolved.pair });
        };
        vm.runtime.on('PERIPHERAL_CONNECTED', onConnected);
        return () => vm.runtime.removeListener('PERIPHERAL_CONNECTED', onConnected);
    }, [roleChallengeOpen, vm]);

    // 画面の部分の名前の札（#2133）。`showPartNames` のレッスンはチャレンジを開いたときから出しっぱなしにし、
    // ほかは課題バーの「なまえ」で数秒だけ出す（どこかを押す・Esc でも消える）。チャレンジが変わったら、
    // そのレッスンの決まりにもどす。出しっぱなしのレッスンで消したあと「なまえ」を押すと、また出しっぱなしにする
    // 「どこでしょう？」のクイズ（#2134）のチャレンジでは、名前の札を出さない（答えが見えてしまう）。「なまえ」のボタンも出さない
    const partQuiz = current ? current.challenge.partQuiz : null;
    const lessonShowsPartNames = Boolean(current && current.lesson.showPartNames && !partQuiz);
    const [partNames, setPartNames] = useState({ visible: lessonShowsPartNames, timed: false });
    useEffect(() => {
        setPartNames({ visible: lessonShowsPartNames, timed: false });
    }, [currentId, lessonShowsPartNames]);
    const handleTogglePartNames = useCallback(() => {
        setPartNames((prev) =>
            prev.visible ? { visible: false, timed: false } : { visible: true, timed: !lessonShowsPartNames },
        );
    }, [lessonShowsPartNames]);
    const handleClosePartNames = useCallback(() => setPartNames({ visible: false, timed: false }), []);
    const handleSolvePartQuiz = useCallback(
        (index) => {
            if (currentId) onSolvePartQuiz(currentId, index);
        },
        [currentId, onSolvePartQuiz],
    );

    const handleHint = useCallback(() => {
        if (hint && hint.visible) onHideHint();
        else onShowHint();
    }, [hint, onHideHint, onShowHint]);

    // 手が止まったら「ヒント」を光らせる（#2129 の Q5）。プログラムもステージも 2 分変わらなければ、課題バーの
    // 「ヒント」（小さくした札があれば札も）をゆっくり光らせ、「ヒントを見てみよう」と出す。何か操作したら止める。
    // ヒントを読んでいるあいだ・「できた！」のあいだは光らせない。ページを変える・小さくするとそこから数え直す
    const hintNudge = useIdleNudge({
        vm,
        enabled: Boolean(current),
        hintAvailable: Boolean(hint && hint.count > 0),
        hintVisible: Boolean(hint && hint.visible),
        blocked: Boolean(toastVisible),
        resetKey: hint ? `${currentId}|${hint.index}|${hint.minimized ? 'small' : ''}` : '',
    });

    // タップで全文を開くときは、吹き出しと「できた！」に重ねない。クイズのある「できた！」は閉じずに
    // 全文のあいだだけ隠し、全文を閉じたら出し直す（閉じるとクイズにもどれないため・#1639）
    const quizToast = Boolean(toastVisible && current && current.challenge.quiz);
    const handleOpenFullText = useCallback(() => {
        if (hint && hint.visible) onHideHint();
        if (quizToast) onHideCompleted();
        else if (toastVisible) onDismissCompleted();
    }, [hint, onHideHint, quizToast, toastVisible, onHideCompleted, onDismissCompleted]);
    const handleCloseFullText = useCallback(() => {
        if (completedHidden) onShowCompleted();
    }, [completedHidden, onShowCompleted]);

    // 課題バーのボタンの GA 計測（どのチャレンジで押したか。lib/lessons/lesson-analytics.js）
    // 課題のチャレンジからは、レッスン表を課題のチャレンジだけで開き直す（#1599）
    const handleQuit = useCallback(() => {
        sendLessonEvent(LESSON_EVENTS.OTHER_CHALLENGE, current, { fromAssignment, teacherLoggedIn });
        onCloseLesson(fromAssignment ? current.challenge.id : null);
    }, [current, fromAssignment, onCloseLesson, teacherLoggedIn]);

    const handleEnd = useCallback(() => {
        sendLessonEvent(LESSON_EVENTS.LESSON_END, current, { fromAssignment, teacherLoggedIn });
        onEndLesson();
    }, [current, fromAssignment, onEndLesson, teacherLoggedIn]);

    if (!current) return null;
    // 課題のチャレンジの中では、課題バーの同じ行に小さな課題の帯（丸と「あと n つ」）を出す（高さは変えない）
    const assignmentStatus = isAssignmentChallenge(assignmentLesson, current.challenge.id)
        ? assignmentProgress(assignmentLesson, progress)
        : null;
    // ヒントの吹き出し（containers/lesson-hint.jsx）は document.body に portal で出るので、
    // ここに置いても本体のレイアウトには影響しない
    return (
        <>
            <LessonTaskBar
                activityDiagram={activityDiagram}
                assignmentBand={
                    assignmentStatus ? <LessonAssignmentBand status={assignmentStatus} variant="compact" /> : null
                }
                challenge={current.challenge}
                challengeCount={current.lesson.challenges.length}
                hintAvailable={Boolean(hint && hint.count > 0)}
                hintNudge={hintNudge}
                hintVisible={Boolean(hint && hint.visible)}
                menuOpen={menuOpen}
                onEnd={handleEnd}
                onCloseFullText={handleCloseFullText}
                onChooseRole={handleChooseRole}
                onHint={handleHint}
                onOpenFullText={handleOpenFullText}
                onQuit={handleQuit}
                onTogglePartNames={partQuiz ? null : handleTogglePartNames}
                partNamesVisible={partNames.visible && !partQuiz}
                role={role}
                toastVisible={toastVisible}
            />
            {/* 小さくしたヒントの札も、手が止まったら光らせる */}
            <LessonHint nudge={hintNudge} />
            {/* 手が止まったときの「ヒントを見てみよう」（これも document.body への portal） */}
            <LessonHintNudge visible={hintNudge} />
            {/* 画面の部分の名前の札（これも document.body への portal） */}
            {partNames.visible && !partQuiz && (
                <LessonPartNames onClose={handleClosePartNames} timed={partNames.timed} />
            )}
            {/* 「どこでしょう？」のクイズ（これも document.body への portal。クイズのあいだ画面のクリックを受ける） */}
            {partQuiz && (
                <LessonPartQuiz
                    key={currentId}
                    questions={partQuiz.questions}
                    solved={partQuizSolved}
                    onSolve={handleSolvePartQuiz}
                />
            )}
            {/* メッシュの練習相手（チャレンジに partner があるときだけ。これも document.body への portal） */}
            <LessonPracticePartner />
        </>
    );
};

LessonMode.propTypes = {
    // 参加している課題のレッスンの設定（assignment-progress.js）。無ければ null
    assignmentLesson: PropTypes.shape({
        challengeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
    current: PropTypes.shape({
        course: PropTypes.object.isRequired,
        lesson: PropTypes.object.isRequired,
        challenge: PropTypes.object.isRequired,
    }),
    dispatch: PropTypes.func.isRequired,
    dnclMode: PropTypes.bool,
    // クラスの課題から開いたか（GA の計測で送る）
    fromAssignment: PropTypes.bool,
    hint: PropTypes.shape({
        visible: PropTypes.bool.isRequired,
        minimized: PropTypes.bool,
        index: PropTypes.number.isRequired,
        count: PropTypes.number.isRequired,
        step: PropTypes.object,
    }),
    isAnyCreatingNewState: PropTypes.bool.isRequired,
    isShowingProject: PropTypes.bool.isRequired,
    isShowingWithoutId: PropTypes.bool.isRequired,
    menuOpen: PropTypes.bool,
    onCancelStart: PropTypes.func.isRequired,
    onCloseLesson: PropTypes.func.isRequired,
    onDismissCompleted: PropTypes.func.isRequired,
    // クイズのある「できた！」を、全文のあいだだけ隠す・出し直す（#1639）
    onHideCompleted: PropTypes.func.isRequired,
    onShowCompleted: PropTypes.func.isRequired,
    // 「できた！」をいっとき隠しているか（reducers/lesson-mode.js の completedHidden）
    completedHidden: PropTypes.bool,
    onEndLesson: PropTypes.func.isRequired,
    onExitDnclMode: PropTypes.func.isRequired,
    onHideHint: PropTypes.func.isRequired,
    onOpenChallenge: PropTypes.func.isRequired,
    // いまのチャレンジの役を選びなおす（始めなおさない役の変更・#2062）
    onSetRole: PropTypes.func.isRequired,
    onRequestNewProject: PropTypes.func.isRequired,
    onShowHint: PropTypes.func.isRequired,
    // 「どこでしょう？」のクイズの問いに正しく答えた（#2134）
    onSolvePartQuiz: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    // 「どこでしょう？」のクイズで正しく答えた数（reducers/lesson-mode.js の partQuizSolved）
    partQuizSolved: PropTypes.number,
    pendingChallengeId: PropTypes.string,
    // 役を選びなおして始めなおすときの役と、どう決めたか（#2062）
    pendingRole: PropTypes.string,
    pendingRoleSource: PropTypes.string,
    // クラスでの自分の出席番号（クラスの外・先生は null。出席番号のペアで役を決める）
    mySeat: PropTypes.number,
    // いまのチャレンジの役（役のあるチャレンジだけ）と、出席番号のペアの印
    role: PropTypes.shape({ role: PropTypes.string.isRequired, source: PropTypes.string }),
    rolePair: PropTypes.string,
    // lesson-progress.js の記録（課題の帯の数）
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }),
    projectChanged: PropTypes.bool.isRequired,
    rubyVersion: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // 対応していないブロックの名前を図に書くときの Msg（reducers/block-display）
    scratchBlocks: PropTypes.object,
    // 先生（クラス管理にログイン中）か（GA に送らない）
    teacherLoggedIn: PropTypes.bool,
    toastVisible: PropTypes.bool,
    vm: PropTypes.object,
};

// クラスでの自分の出席番号（生徒だけ）
const seatOf = (classroom) => {
    const seat = computeBoundSeat(classroom);
    return seat && !seat.teacher && Number.isInteger(seat.seat) ? seat.seat : null;
};

const mapStateToProps = (state) => {
    const { loadingState } = state.scratchGui.projectState;
    return {
        assignmentLesson: selectStudentLesson(state),
        current: getCurrentChallenge(state),
        dnclMode: state.scratchGui.dnclMode.dnclMode,
        fromAssignment: Boolean(state.scratchGui.lessonMode.fromAssignment),
        // 先生（クラス管理にログイン中）のときは GA に送らない
        teacherLoggedIn: Boolean(state.scratchGui.classroom && state.scratchGui.classroom.teacherLoggedIn),
        hint: getCurrentHint(state),
        isAnyCreatingNewState: getIsAnyCreatingNewState(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        isShowingWithoutId: getIsShowingWithoutId(loadingState),
        // メニューバーのメニューがどれか開いているか（課題バーのホバーの全文がメニューに重ならないように）
        menuOpen: Object.values(state.scratchGui.menus).some(Boolean),
        partQuizSolved: state.scratchGui.lessonMode.partQuizSolved || 0,
        pendingChallengeId: state.scratchGui.lessonMode.pendingChallengeId,
        pendingRole: state.scratchGui.lessonMode.pendingRole || null,
        pendingRoleSource: state.scratchGui.lessonMode.pendingRoleSource || null,
        mySeat: seatOf(state.scratchGui.classroom),
        role: getCurrentRole(state),
        rolePair: state.scratchGui.lessonMode.rolePair || null,
        progress: state.scratchGui.lessonMode.progress,
        projectChanged: state.scratchGui.projectChanged,
        rubyVersion: state.scratchGui.settings.rubyVersion,
        scratchBlocks: state.scratchGui.blockDisplay.scratchBlocks,
        // lesson-goal-watcher.jsx が「できた！」の toast を出す条件と同じ（いっとき隠しているあいだは出ていない）
        toastVisible:
            state.scratchGui.lessonMode.challengeId !== null &&
            state.scratchGui.lessonMode.justCompletedId === state.scratchGui.lessonMode.challengeId &&
            !state.scratchGui.lessonMode.completedHidden,
        completedHidden: Boolean(state.scratchGui.lessonMode.completedHidden),
        vm: state.scratchGui.vm,
    };
};

const mapDispatchToProps = (dispatch) => ({
    dispatch,
    onCancelStart: () => dispatch(cancelStartChallenge()),
    onCloseLesson: (assignmentChallengeId = null) => {
        // 「ほかのチャレンジへ」: いまのチャレンジを終えてレッスン表を開く（次のチャレンジをすぐ選べるように）。
        // 課題のチャレンジからは、課題のチャレンジだけで開き、次の課題のチャレンジに「次はこれ！」
        dispatch(closeLesson());
        if (assignmentChallengeId) openAssignmentLessonsLibrary(dispatch, assignmentChallengeId);
        else dispatch(openLessonsLibrary());
    },
    onDismissCompleted: () => dispatch(dismissCompleted()),
    onHideCompleted: () => dispatch(hideCompleted()),
    onShowCompleted: () => dispatch(showCompleted()),
    // 「レッスンをおえる」: レッスンから出るだけ（レッスン表は開かない・確認も出さない）。作品はそのまま残り、
    // パレットは getLessonAllowedBlocks が null になって全部のブロックにもどる
    onEndLesson: () => dispatch(closeLesson()),
    // 日本語モードのバナーの「Rubyふりがなモードに戻す」と同じ（containers/gui.jsx）。ブロックはすぐ全部
    // 戻し、次に Ruby タブを開いたときに日本語の表示に戻さないよう ruby-tab に知らせる
    onExitDnclMode: () => {
        dispatch(setDnclMode(false));
        dispatch(requestExternalExitDnclMode());
    },
    onHideHint: () => dispatch(hideHint()),
    onOpenChallenge: (challengeId, roleInfo) =>
        dispatch(
            openChallenge(
                challengeId,
                roleInfo ? { role: roleInfo.role, roleSource: roleInfo.source, rolePair: roleInfo.pair } : {},
            ),
        ),
    onSetRole: (role, options) => dispatch(setLessonRole(role, options)),
    onRequestNewProject: () => {
        // メニューの「新規」と同じ: Google Drive のファイルとの結び付きも切る。
        // 開いていたチュートリアルのカードも閉じる（カードの allowedBlocks が
        // レッスンをやめた後のパレットに残らないように）
        dispatch(closeCards());
        dispatch(clearGoogleDriveFile());
        dispatch(requestNewProject(false));
    },
    onShowHint: () => dispatch(showHint()),
    onSolvePartQuiz: (challengeId, index) => dispatch(solvePartQuiz(challengeId, index)),
    onStartChallenge: (challengeId, options) => dispatch(startChallenge(challengeId, options)),
});

export { LessonMode };
export default connect(mapStateToProps, mapDispatchToProps)(LessonMode);
