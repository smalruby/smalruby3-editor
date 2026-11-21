// じゅんびチェック（#2299）のコンテナ。いまのチャレンジの `readinessCheck` の問いを 1 問ずつ出す（いまの問いの番号と
// 選んだものは reducers/lesson-mode.js の readinessAnswered / readinessChoice）。問いのブロック（Ruby）はヒントの
// `blocks` と同じ変換（lib/lessons/hint-blocks.js）で XML にして、問いのパネル（components/lesson-readiness-check/）に渡す。
// 変換した XML は作品の中には入れない（読み取り専用のワークスペースに描くだけ）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import LessonReadinessCheck from '../components/lesson-readiness-check/lesson-readiness-check.jsx';
import { localizeCode } from '../lib/lessons/courses';
import { rubyToBlocksXml } from '../lib/lessons/hint-blocks';
import { colorModeMap } from '../lib/settings/color-mode';
import { answerReadiness, getCurrentChallenge, nextReadiness } from '../reducers/lesson-mode';

/**
 * 問いの Ruby を、空行で区切ったスクリプトに分ける。
 * @param {string} code - Ruby。
 * @returns {Array<string>} スクリプト（空のものは除く）。
 */
const splitScripts = (code) =>
    code
        .split(/\n\s*\n/)
        .map((script) => script.trim())
        .filter(Boolean)
        .map((script) => `${script}\n`);

const LessonReadinessCheckContainer = ({
    answered = 0,
    choice = null,
    colorMode,
    current = null,
    onAnswer,
    onNext,
    rubyVersion,
    scratchBlocks = null,
    vm = null,
}) => {
    const intl = useIntl();
    const check = current ? current.challenge.readinessCheck : null;
    const challengeId = current ? current.challenge.id : null;
    const question = check && answered < check.questions.length ? check.questions[answered] : null;
    const blocks = question ? localizeCode(question.blocks, intl.locale) : null;

    // 変換した XML は Ruby ごとに覚える（同じ問いを開きなおしても変換し直さない）。スクリプトが 2 つある問い（数えよう・
    // なかまに合図しよう）は、空行で分けたスクリプトを 1 つずつ変換して横に並べる（読み取り専用のワークスペースでは、
    // 1 つの XML に入れた 2 つのスクリプトが同じ場所に重なって描かれるため）
    const cacheRef = useRef(new Map());
    const [rendered, setRendered] = useState({ blocks: null, xmls: [] });
    useEffect(() => {
        if (!blocks) return () => {};
        const cacheKey = `${rubyVersion}\n${blocks}`;
        if (cacheRef.current.has(cacheKey)) {
            setRendered({ blocks, xmls: cacheRef.current.get(cacheKey) });
            return () => {};
        }
        let cancelled = false;
        const target = vm && vm.editingTarget ? vm.editingTarget : null;
        const convert = (script) =>
            rubyToBlocksXml(vm, target, script, intl, { version: rubyVersion })
                .then(({ xml, errors }) => {
                    if (errors.length > 0) {
                        // eslint-disable-next-line no-console
                        console.warn('[lesson-readiness-check] the blocks did not convert:', errors);
                    }
                    return xml;
                })
                .catch((err) => {
                    // eslint-disable-next-line no-console
                    console.warn('[lesson-readiness-check] the blocks did not convert:', err);
                    return null;
                });
        Promise.all(splitScripts(blocks).map(convert)).then((xmls) => {
            const ok = xmls.filter(Boolean);
            cacheRef.current.set(cacheKey, ok);
            if (!cancelled) setRendered({ blocks, xmls: ok });
        });
        return () => {
            cancelled = true;
        };
    }, [blocks, intl, rubyVersion, vm]);

    const handleChoose = useCallback(
        (index) => {
            if (challengeId) onAnswer(challengeId, answered, index);
        },
        [answered, challengeId, onAnswer],
    );
    const handleNext = useCallback(() => {
        if (challengeId) onNext(challengeId);
    }, [challengeId, onNext]);

    if (!check) return null;
    return (
        <LessonReadinessCheck
            blocksXmls={rendered.blocks === blocks ? rendered.xmls : []}
            choice={choice && choice.index === answered ? choice.choice : null}
            colorMode={colorMode}
            index={answered}
            mediaPath={`./static/${colorModeMap[colorMode].blocksMediaFolder}/`}
            onChoose={handleChoose}
            onNext={handleNext}
            questions={check.questions}
            scratchBlocks={scratchBlocks}
        />
    );
};

LessonReadinessCheckContainer.propTypes = {
    // 答えて進んだ問いの数（reducers/lesson-mode.js の readinessAnswered）
    answered: PropTypes.number,
    // いまの問いで選んだもの（reducers/lesson-mode.js の readinessChoice）
    choice: PropTypes.shape({ index: PropTypes.number.isRequired, choice: PropTypes.number.isRequired }),
    colorMode: PropTypes.string.isRequired,
    current: PropTypes.shape({ challenge: PropTypes.object.isRequired }),
    onAnswer: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    rubyVersion: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    scratchBlocks: PropTypes.object,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    answered: state.scratchGui.lessonMode.readinessAnswered || 0,
    choice: state.scratchGui.lessonMode.readinessChoice || null,
    colorMode: state.scratchGui.settings.colorMode,
    current: getCurrentChallenge(state),
    rubyVersion: state.scratchGui.settings.rubyVersion,
    scratchBlocks: state.scratchGui.blockDisplay.scratchBlocks,
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onAnswer: (challengeId, index, choice) => dispatch(answerReadiness(challengeId, index, choice)),
    onNext: (challengeId) => dispatch(nextReadiness(challengeId)),
});

export { LessonReadinessCheckContainer, splitScripts };
export default connect(mapStateToProps, mapDispatchToProps)(LessonReadinessCheckContainer);
