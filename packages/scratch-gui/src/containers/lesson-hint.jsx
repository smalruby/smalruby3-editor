// ヒントの吹き出しのコンテナ。getCurrentHint の状態を読み、ヒントの `blocks`（Ruby）を
// いまの code と同じ変換でブロックの XML にして、LessonHint に渡す。
// 「プログラムを入れる」はチュートリアルのカードの insertCodeButton と同じ仕組み
// （updateRubyCode → コードタブを出すと Ruby タブが変換してブロックを入れる）。
// チャレンジの `codeTarget` が 'stage' のとき（ステージのプログラム）は、入れる前にステージを
// えらび、Ruby タブの相手（rubyCode.target）もステージにしてから入れる。
// チャレンジに `spriteCodes`（ほかのスプライトのプログラム）があるときは、それを先に
// それぞれのスプライトへ入れ（いなければライブラリから足す）、code は残りのスプライト（ネコ）を
// えらんでから入れる。
// 入れる前に同じ変換を音・背景の確かめ込みで試し、失敗するとき（Owl をまだ足していない等）は
// 入れずに吹き出しの中にわけを出す（入れると Ruby タブに切りかわってエラーになり、ブロックの
// コースの子どもには何が起きたかわかりにくいため）。`spriteCodes` も同じく、入れる前に全部を確かめる
// （ペンギンにだけ入って、ネコの分で止まる、という半端な状態にしない）。
// `code` / `spriteCodes` / ヒントの `blocks` は locale ごとに持てる（作品の中の名前が locale で変わる。
// courses.js の localizeCode）。いまの locale のものを使い、「プログラムを入れる」では、それが作品に
// 合わない（日本語の作品を英語の UI で開いた等）ときは、ほかの locale のものを試す。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import LessonHint from '../components/lesson-hint/lesson-hint.jsx';
import { LANGUAGES, challengeCodeCandidates, localizeCode } from '../lib/lessons/courses';
import { rubyToBlocksXml } from '../lib/lessons/hint-blocks';
import { findCodeSprite, findSpriteByName, insertSpriteCodes } from '../lib/lessons/insert-sprite-code';
import { LESSON_EVENTS, sendLessonEvent } from '../lib/lessons/lesson-analytics';
import { targetCodeToBlocks } from '../lib/ruby-to-blocks-converter';
import { colorModeMap } from '../lib/settings/color-mode';
import { BLOCKS_TAB_INDEX, RUBY_TAB_INDEX, activateTab } from '../reducers/editor-tab';
import {
    finishHint,
    getCurrentChallenge,
    getCurrentHint,
    hideHint,
    nextHint,
    prevHint,
} from '../reducers/lesson-mode';
import { updateRubyCode, updateRubyCodeTarget } from '../reducers/ruby-code';

const LessonHintContainer = ({
    colorMode,
    current,
    fromAssignment = false,
    hint,
    onFinishHint,
    onHideHint,
    onInsertCode,
    onNextHint,
    onPrevHint,
    rubyVersion,
    scratchBlocks,
    vm,
}) => {
    const intl = useIntl();
    const blocks = hint && hint.visible && hint.step ? localizeCode(hint.step.blocks, intl.locale) : null;
    // 変換した XML は Ruby ごとに覚える（もどる・進めるで同じブロックを変換し直さない）。
    // 変換の結果は Ruby のバージョンでも変わるので、キーに含める
    const cacheRef = useRef(new Map());
    const [rendered, setRendered] = useState({ blocks: null, xml: null, error: false });
    // 「プログラムを入れる」を試して失敗したときのわけ（変換のエラーの文言）。ページが変わったら・開き直したら消す
    const [insertErrors, setInsertErrors] = useState([]);
    const hintIndex = hint ? hint.index : null;
    const hintVisible = Boolean(hint && hint.visible);
    const hintSession = hint ? hint.session : null;
    useEffect(() => setInsertErrors([]), [hintIndex, hintVisible, hintSession]);

    useEffect(() => {
        if (!blocks) return () => {};
        const cacheKey = `${rubyVersion}\n${blocks}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setRendered({ blocks, xml: cached.xml, error: cached.error });
            return () => {};
        }
        let cancelled = false;
        const target = vm && vm.editingTarget ? vm.editingTarget : null;
        rubyToBlocksXml(vm, target, blocks, intl, { version: rubyVersion })
            .then(({ xml, errors }) => {
                if (errors.length > 0) {
                    // eslint-disable-next-line no-console
                    console.warn('[lesson-hint] hint blocks did not convert:', errors);
                }
                return { xml, error: !xml };
            })
            .catch((err) => {
                // eslint-disable-next-line no-console
                console.warn('[lesson-hint] hint blocks did not convert:', err);
                return { xml: null, error: true };
            })
            .then((result) => {
                cacheRef.current.set(cacheKey, result);
                if (!cancelled) setRendered({ blocks, ...result });
            });
        return () => {
            cancelled = true;
        };
    }, [blocks, intl, rubyVersion, vm]);

    const insertChallengeCode = useCallback(async () => {
        if (!current || !current.challenge.code) return;
        const { challenge } = current;
        const hasVm = Boolean(vm && vm.runtime);
        const stage = challenge.codeTarget === 'stage' && hasVm ? vm.runtime.getTargetForStage() : null;
        const editing = vm && vm.editingTarget ? vm.editingTarget : null;
        // 確かめる組: [target, code]。まだいないスプライト（これから足すペンギン）は target なしで確かめる
        // （target が無いと音・コスチュームは確かめない。足すのはライブラリのままのスプライトなので足りる）
        const checksFor = (candidate) => {
            const spriteCodes = hasVm ? candidate.spriteCodes : [];
            // code を入れる相手: ステージのプログラムはステージ、spriteCodes があれば残りのスプライト（ネコ）。
            // どちらでもなければ null（いま編集中のスプライトに入れる）
            const codeSprite = spriteCodes.length > 0 ? findCodeSprite(vm, spriteCodes) : null;
            return [
                ...spriteCodes.map(({ sprite, code }) => [findSpriteByName(vm, sprite), code]),
                [stage || codeSprite || editing, candidate.code],
            ];
        };
        const candidates = challengeCodeCandidates(challenge, intl.locale);
        // 作品に合う最初の組を使う。どれも合わなければ、わけのいちばん少ない組（同じなら先の組 =
        // いまの locale）のわけを出す。日本語の作品を英語の UI で開いて Owl をまだ足していないとき、
        // en の組のわけ（"Meow" も Owl も無い）を出すと、作品にある「ニャー」を探させてしまう
        let chosen = null;
        let fewestErrors = null;
        try {
            for (const candidate of candidates) {
                const results = await Promise.all(
                    checksFor(candidate).map(([t, code]) =>
                        rubyToBlocksXml(vm, t, code, intl, { version: rubyVersion, validateAssets: true }),
                    ),
                );
                const errors = results.flatMap((r) => r.errors);
                if (errors.length === 0) {
                    chosen = candidate;
                    break;
                }
                if (!fewestErrors || errors.length < fewestErrors.length) fewestErrors = errors;
            }
            if (!chosen) {
                setInsertErrors(fewestErrors.map((e) => e.text).filter(Boolean));
                return;
            }
        } catch (err) {
            // 試しの変換そのものが落ちたときは、従来どおり（いまの locale の組を）入れて Ruby タブにまかせる
            // eslint-disable-next-line no-console
            console.warn('[lesson-hint] could not check the program before inserting:', err);
            chosen = candidates[0];
        }
        setInsertErrors([]);
        const spriteCodes = hasVm ? chosen.spriteCodes : [];
        let target = stage;
        if (spriteCodes.length > 0) {
            // ほかのスプライト（ペンギン）のプログラムを先に入れ、code はネコに入れる
            target = await insertSpriteCodes(vm, spriteCodes, {
                toBlocks: (t, code) => targetCodeToBlocks(vm, t, code, intl, { version: rubyVersion }),
            });
        }
        if (target) vm.setEditingTarget(target.id);
        onInsertCode(chosen.code, current.course.language, target, rubyVersion);
        // 正解のプログラムを確認した（入れたときだけ。入れられなかったときは上で戻る）
        sendLessonEvent(LESSON_EVENTS.ANSWER_VIEW, current, fromAssignment);
    }, [current, fromAssignment, intl, onInsertCode, rubyVersion, vm]);

    // 「プログラムを入れる」を続けて押したときに 2 回入れない（spriteCodes ではペンギンが 2 匹足される）
    const insertingRef = useRef(false);
    const handleInsertCode = useCallback(() => {
        if (insertingRef.current) return Promise.resolve();
        insertingRef.current = true;
        return insertChallengeCode().finally(() => {
            insertingRef.current = false;
        });
    }, [insertChallengeCode]);

    if (!hint || !hint.visible || !current) return null;
    const step = hint.step;
    const blocksReady = blocks !== null && rendered.blocks === blocks;
    return (
        <LessonHint
            // チャレンジを開き直したら、ドラッグした位置や「置き換えますか？」を持ち越さない
            key={hint.session}
            blocksError={blocksReady && rendered.error}
            blocksXml={blocksReady ? rendered.xml : null}
            colorMode={colorMode}
            count={hint.count}
            debug={hint.debug}
            hasCode={Boolean(hint.code)}
            index={hint.index}
            insertErrors={insertErrors}
            lastResort={hint.lastResort}
            mediaPath={`./static/${colorModeMap[colorMode].blocksMediaFolder}/`}
            onClose={onHideHint}
            onFinish={onFinishHint}
            onInsertCode={handleInsertCode}
            onNext={onNextHint}
            onPrev={onPrevHint}
            scratchBlocks={scratchBlocks}
            spotlight={hint.spotlight}
            target={step ? step.target : null}
            title={step ? step.title : null}
        />
    );
};

LessonHintContainer.propTypes = {
    colorMode: PropTypes.string.isRequired,
    current: PropTypes.shape({
        course: PropTypes.object.isRequired,
        lesson: PropTypes.object.isRequired,
        challenge: PropTypes.object.isRequired,
    }),
    // クラスの課題から開いたか（GA の計測で送る）
    fromAssignment: PropTypes.bool,
    hint: PropTypes.shape({
        visible: PropTypes.bool.isRequired,
        index: PropTypes.number.isRequired,
        count: PropTypes.number.isRequired,
        step: PropTypes.object,
        spotlight: PropTypes.bool.isRequired,
        lastResort: PropTypes.bool.isRequired,
        debug: PropTypes.arrayOf(PropTypes.object).isRequired,
        // `code` は locale ごとのオブジェクトでもよい（ここでは有無だけを見る）
        code: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        session: PropTypes.number,
    }),
    onFinishHint: PropTypes.func.isRequired,
    onHideHint: PropTypes.func.isRequired,
    onInsertCode: PropTypes.func.isRequired,
    onNextHint: PropTypes.func.isRequired,
    onPrevHint: PropTypes.func.isRequired,
    rubyVersion: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    scratchBlocks: PropTypes.object,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    colorMode: state.scratchGui.settings.colorMode,
    current: getCurrentChallenge(state),
    fromAssignment: Boolean(state.scratchGui.lessonMode.fromAssignment),
    hint: getCurrentHint(state),
    rubyVersion: state.scratchGui.settings.rubyVersion,
    scratchBlocks: state.scratchGui.blockDisplay.scratchBlocks,
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onFinishHint: () => dispatch(finishHint()),
    onHideHint: () => dispatch(hideHint()),
    onNextHint: () => dispatch(nextHint()),
    onPrevHint: () => dispatch(prevHint()),
    onInsertCode: (code, language, target, rubyVersion) => {
        // カードの insertCodeButton と同じ: Ruby を入れてから目的のタブを出す。ブロックの
        // コースではコードタブ（Ruby タブが変換してブロックにする）、Ruby / DNCL のコースでは Ruby タブ
        dispatch(hideHint());
        // 入れる相手が指定されたとき（ステージ・spriteCodes のときのネコ）は、Ruby タブの相手を先に
        // その target にする
        // （Ruby タブは rubyCode.target に向けて変換するため）
        if (target) dispatch(updateRubyCodeTarget(target, rubyVersion));
        dispatch(updateRubyCode(code));
        dispatch(activateTab(language === LANGUAGES.BLOCKS ? BLOCKS_TAB_INDEX : RUBY_TAB_INDEX));
    },
});

export { LessonHintContainer as LessonHint };
export default connect(mapStateToProps, mapDispatchToProps)(LessonHintContainer);
