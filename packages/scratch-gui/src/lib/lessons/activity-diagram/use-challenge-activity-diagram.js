// いまのチャレンジのアクティビティ図（置き方）を返す React の hook。課題の全文（containers/lesson-mode.jsx）と
// ヒントの 1 ページ目（containers/lesson-hint.jsx）の両方で使うので、変換の結果はチャレンジ・locale・
// Ruby のバージョンごとに覚えて、同じ答えを 2 回変換しない。
//
// 変換は VM も target も使わない（VM なしの RubyToBlocksConverter）。図に要るのはブロックの形と文だけで、
// VM の target を文脈にすると、まだ足していないスプライト（ペンギン）や音の名前で迷うことがあるため。
// 変換の結果は作品に入れない（ブロックの集合を読むだけ）。
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import RubyToBlocksConverter from '../../ruby-to-blocks-converter';
import { en } from './activity-diagram.locale';
import { challengeActivityDiagram, showsActivityDiagram } from './challenge-diagram';

const cache = new Map();

/**
 * 覚えている図を消す（テスト用）。
 */
export const clearActivityDiagramCache = () => cache.clear();

/**
 * 答えの Ruby を VM 形式のブロックにする（失敗は null）。
 * @param {string} code - Ruby。
 * @param {string|number} version - Ruby のバージョン。
 * @returns {Promise<?object>} ブロック。
 */
const convert = async (code, version) => {
    const converter = new RubyToBlocksConverter(null, { version: String(version || '2'), validateAssets: false });
    const ok = await converter.targetCodeToBlocks(null, code);
    if (!ok) {
        // eslint-disable-next-line no-console
        console.warn('[lesson-activity-diagram] the answer did not convert:', converter.errors);
        return null;
    }
    return converter.blocks;
};

/**
 * いまのチャレンジのアクティビティ図の置き方。出さないチャレンジ・変換の途中・失敗は null。
 * @param {?object} challenge - チャレンジ（defineChallenge の形）。
 * @param {object} [options] - 描き方。
 * @param {string|number} [options.rubyVersion] - Ruby のバージョン。
 * @param {?object} [options.scratchBlocks] - ScratchBlocks（対応していないブロックの名前を Msg から引く）。
 * @returns {?object} 置き方（layoutActivityDiagram の戻り値）。
 */
export const useChallengeActivityDiagram = (challenge, { rubyVersion = '2', scratchBlocks = null } = {}) => {
    const intl = useIntl();
    const shown = showsActivityDiagram(challenge);
    const msg = scratchBlocks && scratchBlocks.Msg ? scratchBlocks.Msg : null;
    const key = shown ? `${challenge.id}\n${intl.locale}\n${rubyVersion}\n${msg ? 'msg' : ''}` : null;
    const [state, setState] = useState({ key: null, layout: null });

    useEffect(() => {
        if (!key) return () => {};
        let promise = cache.get(key);
        if (!promise) {
            promise = challengeActivityDiagram(challenge, {
                locale: intl.locale,
                format: (id, values) => intl.formatMessage({ id, defaultMessage: en[id] || id }, values),
                toBlocks: (source) => convert(source.code, rubyVersion),
                // 対応していないブロックは、ブロックの文のテンプレート（「%1 歩動かす」）に穴の値を入れて書く
                blockName: msg ? (opcode) => msg[opcode.toUpperCase()] || null : null,
            }).catch((err) => {
                // eslint-disable-next-line no-console
                console.warn('[lesson-activity-diagram] could not draw the diagram:', err);
                return null;
            });
            cache.set(key, promise);
        }
        let cancelled = false;
        promise.then((diagram) => {
            if (!cancelled) setState({ key, layout: diagram ? diagram.layout : null });
        });
        return () => {
            cancelled = true;
        };
        // challenge・intl・msg は key（id・locale・Msg の有無）で見る
    }, [key]);

    return state.key === key ? state.layout : null;
};
