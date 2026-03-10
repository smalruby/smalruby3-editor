import downloadBlob from './download-blob';

/**
 * Padding around blocks in the exported image (in pixels, ~1rem).
 */
const EXPORT_PADDING = 16;

/**
 * Returns the blocks bounding box for the given workspace, or null if the
 * workspace is empty (no blocks placed).
 * Scratch Blocks returns {x, y, width, height} in workspace coordinates.
 * @param {object} workspace - Scratch Blocks / Blockly workspace instance
 * @returns {{x: number, y: number, width: number, height: number}|null} Bounding box or null for empty workspace
 */
const getBlocksBoundingBox = function (workspace) {
    const bbox = workspace.getBlocksBoundingBox();
    if (!bbox) return null;
    if (bbox.width === 0 && bbox.height === 0) return null;
    return bbox;
};

/**
 * Calculates the canvas pixel dimensions needed to contain all blocks with padding.
 * @param {{x: number, y: number, width: number, height: number}} bbox
 * @param {number} scale - Workspace zoom scale
 * @param {number} [padding] - Padding in pixels (default: EXPORT_PADDING)
 * @returns {{width: number, height: number}} Canvas dimensions in pixels
 */
const calculateCanvasDimensions = function (bbox, scale, padding = EXPORT_PADDING) {
    const blockWidth = bbox.width * scale;
    const blockHeight = bbox.height * scale;
    return {
        width: Math.ceil(blockWidth + (padding * 2)),
        height: Math.ceil(blockHeight + (padding * 2))
    };
};

/**
 * Builds the export filename from project title and sprite name.
 * @param {string} projectTitle
 * @param {string} spriteName
 * @returns {string} PNG filename
 */
const buildFilename = function (projectTitle, spriteName) {
    return `${projectTitle}_${spriteName}.png`;
};

/**
 * Builds an SVG string that contains only the blocks from the workspace,
 * clipped to their bounding box with padding, on a white background.
 * @param {object} workspace
 * @param {{x: number, y: number, width: number, height: number}} bbox
 * @param {number} scale
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @param {number} [padding]
 * @returns {string} Serialized SVG string
 */
const buildExportSVG = function (workspace, bbox, scale, width, height, padding = EXPORT_PADDING) {
    const svgNS = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    // Include <defs> and <style> from parent SVG (for block shapes, filters, etc.)
    const blockCanvas = workspace.svgBlockCanvas_;
    const parentSvg = blockCanvas.ownerSVGElement ||
        (blockCanvas.closest && blockCanvas.closest('svg'));
    if (parentSvg) {
        const defs = parentSvg.querySelector('defs');
        if (defs) svg.appendChild(defs.cloneNode(true));
        parentSvg.querySelectorAll('style').forEach(style => {
            svg.appendChild(style.cloneNode(true));
        });
    }

    // Include Scratch Blocks' injected styles from document head.
    // These set fill colors for .blocklyText etc. and are not inside the SVG element.
    document.querySelectorAll('style').forEach(style => {
        if ((style.textContent || '').includes('blocklyText')) {
            svg.appendChild(style.cloneNode(true));
        }
    });

    // White background
    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    // Clone block canvas and re-position so bbox top-left -> (padding, padding).
    // bbox.x and bbox.y are workspace coordinates of the top-left of all blocks.
    const canvasClone = blockCanvas.cloneNode(true);
    const tx = ((-bbox.x) * scale) + padding;
    const ty = ((-bbox.y) * scale) + padding;
    canvasClone.setAttribute('transform', `translate(${tx}, ${ty}) scale(${scale})`);
    svg.appendChild(canvasClone);

    return new XMLSerializer().serializeToString(svg);
};

/**
 * Renders an SVG string onto a canvas element and returns a Promise resolving
 * to that canvas.
 * @param {string} svgStr
 * @param {number} width
 * @param {number} height
 * @returns {Promise<HTMLCanvasElement>} Canvas with the rendered blocks
 */
const renderSVGToCanvas = function (svgStr, width, height) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = err => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        img.src = url;
    });
};

/**
 * Downloads all blocks in the given workspace as a PNG image.
 * Does nothing if the workspace contains no blocks.
 * @param {object} workspace - Scratch Blocks workspace
 * @param {string} projectTitle - Project name (used in filename)
 * @param {string} spriteName - Sprite / stage name (used in filename)
 * @returns {Promise<void>}
 */
const downloadBlocksAsImage = async function (workspace, projectTitle, spriteName) {
    const bbox = getBlocksBoundingBox(workspace);
    if (!bbox) return;

    const scale = workspace.scale;
    const {width, height} = calculateCanvasDimensions(bbox, scale);
    const svgStr = buildExportSVG(workspace, bbox, scale, width, height);
    const canvas = await renderSVGToCanvas(svgStr, width, height);

    return new Promise(resolve => {
        canvas.toBlob(blob => {
            downloadBlob(buildFilename(projectTitle, spriteName), blob);
            resolve();
        }, 'image/png');
    });
};

export {
    getBlocksBoundingBox,
    calculateCanvasDimensions,
    buildFilename,
    buildExportSVG,
    downloadBlocksAsImage,
    EXPORT_PADDING
};
