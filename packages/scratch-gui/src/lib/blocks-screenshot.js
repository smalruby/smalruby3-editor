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
 * Merges the blocks bounding box with the bubble canvas bounding box so that
 * comment bubbles are included in the exported area.
 * @param {object} workspace - Scratch Blocks / Blockly workspace instance
 * @param {{x: number, y: number, width: number, height: number}} blockBbox - Blocks-only bounding box
 * @returns {{x: number, y: number, width: number, height: number}} Merged bounding box
 */
const mergeWithBubbleBBox = function (workspace, blockBbox) {
    const bubbleCanvas = workspace.svgBubbleCanvas_;
    if (!bubbleCanvas || bubbleCanvas.children.length === 0) {
        return blockBbox;
    }
    const bubbleBbox = bubbleCanvas.getBBox();
    if (!bubbleBbox || (bubbleBbox.width === 0 && bubbleBbox.height === 0)) {
        return blockBbox;
    }
    const minX = Math.min(blockBbox.x, bubbleBbox.x);
    const minY = Math.min(blockBbox.y, bubbleBbox.y);
    const maxX = Math.max(blockBbox.x + blockBbox.width, bubbleBbox.x + bubbleBbox.width);
    const maxY = Math.max(blockBbox.y + blockBbox.height, bubbleBbox.y + bubbleBbox.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
        width: Math.ceil(blockWidth + padding * 2),
        height: Math.ceil(blockHeight + padding * 2),
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
 * Fetches an SVG file and returns it as a data URI string.
 * Results are cached so the same URL is only fetched once.
 * @param {string} url - Relative or absolute URL to an SVG file
 * @returns {Promise<string>} data URI (data:image/svg+xml;base64,...)
 */
const svgDataUriCache = {};
const fetchSvgAsDataUri = async function (url) {
    if (svgDataUriCache[url]) return svgDataUriCache[url];
    const response = await fetch(url);
    const text = await response.text();
    const dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
    svgDataUriCache[url] = dataUri; // eslint-disable-line require-atomic-updates
    return dataUri;
};

/**
 * Replaces relative image hrefs in an SVG element with inlined data URIs.
 * This is necessary because when the SVG is serialized to a blob, relative
 * paths lose their base URL context and the images fail to load.
 * @param {SVGElement} svgElement - SVG element containing <image> elements
 * @returns {Promise<void>}
 */
const inlineImageHrefs = async function (svgElement) {
    const images = svgElement.querySelectorAll('image');
    const xlinkNS = 'http://www.w3.org/1999/xlink';
    const promises = [];
    for (const img of images) {
        const href = img.getAttributeNS(xlinkNS, 'href') || img.getAttribute('href') || '';
        if (href && !href.startsWith('data:')) {
            promises.push(
                fetchSvgAsDataUri(href).then(dataUri => {
                    if (img.getAttributeNS(xlinkNS, 'href')) {
                        img.setAttributeNS(xlinkNS, 'href', dataUri);
                    } else {
                        img.setAttribute('href', dataUri);
                    }
                }),
            );
        }
    }
    await Promise.all(promises);
};

/**
 * Builds an SVG string that contains only the blocks from the workspace,
 * clipped to their bounding box with padding, on a white background.
 * Relative image hrefs (e.g. green-flag.svg, rotate icons) are inlined
 * as data URIs so they render correctly when the SVG is loaded as a blob.
 * @param {object} workspace
 * @param {{x: number, y: number, width: number, height: number}} bbox
 * @param {number} scale
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @param {number} [padding]
 * @returns {Promise<string>} Serialized SVG string
 */
const buildExportSVG = async function (workspace, bbox, scale, width, height, padding = EXPORT_PADDING) {
    const svgNS = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    // Include <defs> and <style> from parent SVG (for block shapes, filters, etc.)
    const blockCanvas = workspace.svgBlockCanvas_;
    const parentSvg = blockCanvas.ownerSVGElement || (blockCanvas.closest && blockCanvas.closest('svg'));
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
    const tx = -bbox.x * scale + padding;
    const ty = -bbox.y * scale + padding;
    const canvasTransform = `translate(${tx}, ${ty}) scale(${scale})`;

    const canvasClone = blockCanvas.cloneNode(true);
    canvasClone.setAttribute('transform', canvasTransform);
    svg.appendChild(canvasClone);

    // Clone bubble canvas (comment bubbles) with the same transform.
    // Remove <foreignObject> elements which contain HTML <textarea> for editing;
    // they cause tainted canvas errors when the SVG is loaded via blob URL.
    // The visible comment text is already in <text> elements, so nothing is lost.
    const bubbleCanvas = workspace.svgBubbleCanvas_;
    if (bubbleCanvas && bubbleCanvas.children.length > 0) {
        const bubbleClone = bubbleCanvas.cloneNode(true);
        bubbleClone.querySelectorAll('foreignObject').forEach(fo => fo.remove());
        bubbleClone.setAttribute('transform', canvasTransform);
        svg.appendChild(bubbleClone);
    }

    // Inline relative image hrefs as data URIs so they survive blob serialization
    await inlineImageHrefs(svg);

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
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
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
    const blockBbox = getBlocksBoundingBox(workspace);
    if (!blockBbox) return;

    const bbox = mergeWithBubbleBBox(workspace, blockBbox);
    const scale = workspace.scale;
    const { width, height } = calculateCanvasDimensions(bbox, scale);
    const svgStr = await buildExportSVG(workspace, bbox, scale, width, height);
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
    mergeWithBubbleBBox,
    calculateCanvasDimensions,
    buildFilename,
    buildExportSVG,
    renderSVGToCanvas,
    inlineImageHrefs,
    downloadBlocksAsImage,
    EXPORT_PADDING,
};
