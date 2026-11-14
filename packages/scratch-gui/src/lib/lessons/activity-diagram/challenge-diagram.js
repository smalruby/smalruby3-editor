// チャレンジの定義から、アクティビティ図（モデルと置き方）を作る。
// 図のもとは答えのプログラム（`code` と `spriteCodes`）を Ruby → ブロック変換したもの
// （ヒントの絵・「プログラムを入れる」と同じ変換）。変換は呼ぶ側が `toBlocks` で渡す
// （GUI もテストも VM なしの RubyToBlocksConverter。use-challenge-activity-diagram.js）。
// 練習相手の定義（`partner`）があれば、自分と相手のスイムレーンにする。
import { localizeCode } from '../courses';
import { layoutActivityDiagram } from './layout';
import { buildActivityModel, partnerLane } from './model';

const P = 'gui.lessons.activityDiagram.';

/**
 * 課題の全文・ヒントの 1 ページ目に図を出すか。チャレンジの定義の `activityDiagram` が true で、
 * 答えのプログラムがあるときだけ。
 * @param {?object} challenge - チャレンジ（defineChallenge の形）。
 * @returns {boolean} 出すか。
 */
export const showsActivityDiagram = (challenge) =>
    Boolean(
        challenge &&
        challenge.activityDiagram === true &&
        (challenge.code || (challenge.spriteCodes && challenge.spriteCodes.length > 0)),
    );

/**
 * 自分のレーンのもとにするプログラム（いまの locale の Ruby）。`target` は変換の文脈にする相手
 * （'code' = `code` を入れる相手、それ以外はスプライトの名前）。
 * @param {object} challenge - チャレンジ。
 * @param {string} locale - いまの locale。
 * @returns {Array<{id: string, sources: Array<{name: ?string, code: string, target: string}>}>} レーン。
 */
export const activityDiagramLanes = (challenge, locale) => {
    const code = localizeCode(challenge.code, locale);
    const sources = [
        ...(code ? [{ name: null, code, target: 'code' }] : []),
        ...(challenge.spriteCodes || [])
            .map(({ sprite, code: spriteCode }) => ({
                name: sprite,
                code: localizeCode(spriteCode, locale),
                target: sprite,
            }))
            .filter((source) => source.code),
    ];
    return [{ id: 'own', sources }];
};

/**
 * チャレンジのアクティビティ図を作る。出さないチャレンジ・変換できなかったときは null。
 * @param {object} challenge - チャレンジ。
 * @param {object} options - 作り方。
 * @param {string} options.locale - いまの locale。
 * @param {function(string, object=): string} options.format - 文言を引く関数。
 * @param {function(object): Promise<?object>} options.toBlocks - source（`activityDiagramLanes` の要素）→
 *   VM 形式のブロック（失敗は null）。
 * @param {?function(string): ?string} [options.blockName] - 対応していないブロックの名前のテンプレート。
 * @param {?string} [options.codeName] - `code` を入れる相手の名前（スプライトが 2 つ以上のとき見出しに書く）。
 *   無ければ、ステージのプログラムなら「ステージ」、ほかは「ネコ」（`spriteCodes` の残りのスプライト）。
 * @returns {Promise<?{model: object, layout: object}>} 図。
 */
export const challengeActivityDiagram = async (
    challenge,
    { locale, format, toBlocks, blockName = null, codeName = null },
) => {
    if (!showsActivityDiagram(challenge)) return null;
    const partner = partnerLane(challenge.partner, { format });
    const lanes = [];
    for (const lane of activityDiagramLanes(challenge, locale)) {
        const targets = [];
        for (const source of lane.sources) {
            const blocks = await toBlocks(source);
            if (!blocks) return null;
            const name =
                source.target === 'code'
                    ? codeName || format(`${P}${challenge.codeTarget === 'stage' ? 'stage' : 'codeSprite'}`)
                    : source.name;
            targets.push({ name, blocks });
        }
        lanes.push({ id: lane.id, label: partner ? format(`${P}ownLane`) : null, targets });
    }
    const model = buildActivityModel({ lanes }, { format, blockName });
    if (partner) model.lanes.push(partner);
    const layout = layoutActivityDiagram(model, { yes: format(`${P}yes`), no: format(`${P}no`) });
    return { model, layout };
};
