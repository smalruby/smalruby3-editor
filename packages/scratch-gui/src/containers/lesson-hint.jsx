// ヒントの吹き出しのコンテナ。getCurrentHint の状態を読み、ヒントの `blocks`（Ruby）を
// いまの code と同じ変換でブロックの XML にして、LessonHint に渡す。
// 「プログラムを入れる」はチュートリアルのカードの insertCodeButton と同じ仕組み
// （updateRubyCode → コードタブを出すと Ruby タブが変換してブロックを入れる）。
// チャレンジの `codeTarget` が 'stage' のとき（ステージのプログラム）は、入れる前にステージを
// えらび、Ruby タブの相手（rubyCode.target）もステージにしてから入れる。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import LessonHint from '../components/lesson-hint/lesson-hint.jsx';
import { LANGUAGES } from '../lib/lessons/courses';
import { rubyToBlocksXml } from '../lib/lessons/hint-blocks';
import { colorModeMap } from '../lib/settings/color-mode';
import { BLOCKS_TAB_INDEX, RUBY_TAB_INDEX, activateTab } from '../reducers/editor-tab';
import { getCurrentChallenge, getCurrentHint, hideHint, nextHint, prevHint } from '../reducers/lesson-mode';
import { updateRubyCode, updateRubyCodeTarget } from '../reducers/ruby-code';

const LessonHintContainer = ({
    colorMode,
    current,
    hint,
    onHideHint,
    onInsertCode,
    onNextHint,
    onPrevHint,
    rubyVersion,
    scratchBlocks,
    vm,
}) => {
    const intl = useIntl();
    const blocks = hint && hint.visible && hint.step ? hint.step.blocks : null;
    // 変換した XML は Ruby ごとに覚える（もどる・進めるで同じブロックを変換し直さない）
    const cacheRef = useRef(new Map());
    const [rendered, setRendered] = useState({ blocks: null, xml: null, error: false });

    useEffect(() => {
        if (!blocks) return () => {};
        const cached = cacheRef.current.get(blocks);
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
                cacheRef.current.set(blocks, result);
                if (!cancelled) setRendered({ blocks, ...result });
            });
        return () => {
            cancelled = true;
        };
    }, [blocks, intl, rubyVersion, vm]);

    const handleInsertCode = useCallback(() => {
        if (!current || !current.challenge.code) return;
        let target = null;
        if (current.challenge.codeTarget === 'stage' && vm && vm.runtime) {
            // ステージのプログラム: いま編集中のスプライトではなくステージに入れる
            target = vm.runtime.getTargetForStage() || null;
            if (target) vm.setEditingTarget(target.id);
        }
        onInsertCode(current.challenge.code, current.course.language, target, rubyVersion);
    }, [current, onInsertCode, rubyVersion, vm]);

    if (!hint || !hint.visible || !current) return null;
    const step = hint.step;
    const blocksReady = blocks !== null && rendered.blocks === blocks;
    return (
        <LessonHint
            blocksError={blocksReady && rendered.error}
            blocksXml={blocksReady ? rendered.xml : null}
            colorMode={colorMode}
            count={hint.count}
            debug={hint.debug}
            hasCode={Boolean(hint.code)}
            index={hint.index}
            lastResort={hint.lastResort}
            mediaPath={`./static/${colorModeMap[colorMode].blocksMediaFolder}/`}
            onClose={onHideHint}
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
    hint: PropTypes.shape({
        visible: PropTypes.bool.isRequired,
        index: PropTypes.number.isRequired,
        count: PropTypes.number.isRequired,
        step: PropTypes.object,
        spotlight: PropTypes.bool.isRequired,
        lastResort: PropTypes.bool.isRequired,
        debug: PropTypes.arrayOf(PropTypes.object).isRequired,
        code: PropTypes.string,
    }),
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
    hint: getCurrentHint(state),
    rubyVersion: state.scratchGui.settings.rubyVersion,
    scratchBlocks: state.scratchGui.blockDisplay.scratchBlocks,
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onHideHint: () => dispatch(hideHint()),
    onNextHint: () => dispatch(nextHint()),
    onPrevHint: () => dispatch(prevHint()),
    onInsertCode: (code, language, target, rubyVersion) => {
        // カードの insertCodeButton と同じ: Ruby を入れてから目的のタブを出す。ブロックの
        // コースではコードタブ（Ruby タブが変換してブロックにする）、Ruby / DNCL のコースでは Ruby タブ
        dispatch(hideHint());
        // 入れる相手が指定されたとき（ステージ）は、Ruby タブの相手を先にその target にする
        // （Ruby タブは rubyCode.target に向けて変換するため）
        if (target) dispatch(updateRubyCodeTarget(target, rubyVersion));
        dispatch(updateRubyCode(code));
        dispatch(activateTab(language === LANGUAGES.BLOCKS ? BLOCKS_TAB_INDEX : RUBY_TAB_INDEX));
    },
});

export { LessonHintContainer as LessonHint };
export default connect(mapStateToProps, mapDispatchToProps)(LessonHintContainer);
