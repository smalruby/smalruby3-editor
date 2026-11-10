// ヒントの吹き出しの中に本物のブロックを描く。scratch-blocks の読み取り専用ワークスペースを
// 小さく inject して XML（lib/lessons/hint-blocks.js が Ruby から作る）を読み込む。
// スクリーンショットは使わない（ブロックの見た目・言語・色がエディタと同じになる）。
import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';
import { DEFAULT_MODE, getColorsForMode } from '../../lib/settings/color-mode';
import styles from './lesson-hint.css';

// エディタ（BLOCKS_DEFAULT_SCALE = 0.675）より大きく描く
const HINT_BLOCKS_SCALE = 0.8;
const PADDING = 8;
// ハットブロックの帽子は原点より上に描かれる（lib/backpack/block-to-image.js と同じ補正）
const HAT_PADDING = 16;

/**
 * 読み取り専用ワークスペースにブロックを描き、中身の大きさに合わせて div を広げる。
 * @param {object} scratchBlocks - Blocks コンテナが作った ScratchBlocks（reducers/block-display）。
 * @param {HTMLElement} div - inject する div。
 * @param {string} xml - ブロックの XML。
 * @param {string} mediaPath - ブロックの画像の置き場所。
 * @param {string} colorMode - 色のモード（lib/settings/color-mode）。
 * @returns {object} ワークスペース（dispose は呼ぶ側）。
 */
const renderBlocks = (scratchBlocks, div, xml, mediaPath, colorMode) => {
    // inject は main workspace を差し替えるので、エディタのワークスペースを戻す
    // （blocks-gesture-recovery などが getMainWorkspace() でエディタを見るため）
    const mainWorkspace = scratchBlocks.getMainWorkspace();
    const workspace = scratchBlocks.inject(div, {
        readOnly: true,
        media: mediaPath,
        scrollbars: false,
        zoom: { controls: false, wheel: false, pinch: false, startScale: HINT_BLOCKS_SCALE },
        move: { scrollbars: false, drag: false, wheel: false },
        comments: false,
        collapse: false,
        sounds: false,
        trashcan: false,
        theme: new scratchBlocks.Theme(colorMode, getColorsForMode(colorMode)),
        scratchTheme: 'classic',
    });
    if (mainWorkspace && scratchBlocks.common && scratchBlocks.common.setMainWorkspace) {
        scratchBlocks.common.setMainWorkspace(mainWorkspace);
    }
    try {
        try {
            // VM の blockListener はエディタのワークスペースにしか付いていないが、念のため止める
            scratchBlocks.Events.disable();
            const dom = scratchBlocks.utils.xml.textToDom(xml);
            scratchBlocks.Xml.domToWorkspace(dom, workspace);
            // スクリプトが複数あるときは縦に並べる
            workspace.cleanUp();
        } finally {
            scratchBlocks.Events.enable();
        }
        const hasHat = workspace.getTopBlocks(false).some((block) => {
            const root = block.getSvgRoot && block.getSvgRoot();
            return root && root.getAttribute('data-shapes') === 'hat';
        });
        const box = workspace.getBlocksBoundingBox();
        const scale = workspace.scale;
        const top = PADDING + (hasHat ? HAT_PADDING * scale : 0);
        const width = Math.ceil((box.right - box.left) * scale + PADDING * 2);
        const height = Math.ceil((box.bottom - box.top) * scale + top + PADDING);
        div.style.width = `${Math.max(width, 1)}px`;
        div.style.height = `${Math.max(height, 1)}px`;
        scratchBlocks.svgResize(workspace);
        // 内容の左上が見えるように平行移動する（スクロールバーは無い）
        workspace.translate(-box.left * scale + PADDING, -box.top * scale + top);
    } catch (err) {
        // 描けなかったワークスペースを Blockly の一覧（common.getAllWorkspaces）に残さない
        workspace.dispose();
        throw err;
    }
    return workspace;
};

const LessonHintBlocks = ({ scratchBlocks, xml, mediaPath, colorMode = DEFAULT_MODE, onRendered }) => {
    const ref = useRef(null);

    useEffect(() => {
        const div = ref.current;
        if (!scratchBlocks || !xml || !div) return () => {};
        let workspace = null;
        try {
            workspace = renderBlocks(scratchBlocks, div, xml, mediaPath, colorMode);
        } catch (err) {
            // 描けなくても吹き出しの文言は出す
            // eslint-disable-next-line no-console
            console.warn('[lesson-hint] could not render the hint blocks:', err);
        }
        if (onRendered) onRendered();
        return () => {
            if (workspace) workspace.dispose();
            div.style.width = '';
            div.style.height = '';
        };
    }, [scratchBlocks, xml, mediaPath, colorMode, onRendered]);

    return <div ref={ref} className={styles.blocks} data-testid="lesson-hint-blocks" />;
};

LessonHintBlocks.propTypes = {
    colorMode: PropTypes.string,
    mediaPath: PropTypes.string.isRequired,
    onRendered: PropTypes.func,
    scratchBlocks: PropTypes.object,
    xml: PropTypes.string,
};

export default LessonHintBlocks;
