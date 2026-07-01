// === Smalruby: Start of mobile-friendly download strategy ===
/**
 * Detect Apple mobile browsers (iOS / iPadOS) where the anchor `download`
 * attribute is silently ignored, so a plain download click does nothing
 * (the reported "screenshot button does not work on mobile" symptom).
 *
 * iPadOS 13+ reports a desktop ("Macintosh") user agent, so touch support is
 * also checked. Android Chrome honors the `download` attribute, so it is
 * intentionally NOT treated as needing the mobile path.
 * @returns {boolean} True on iOS / iPadOS.
 */
const isAppleMobile = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/u.test(ua)) return true;
    // iPadOS 13+ masquerades as macOS Safari; distinguish it by touch support.
    return ua.includes('Macintosh') && (navigator.maxTouchPoints || 0) > 1;
};

/**
 * Choose how to deliver a blob to the user based on platform capabilities.
 * Pure function so the branch-selection logic can be unit tested without a
 * real browser (the actual save behaviour can only be verified on a device).
 * @param {object} env - Detected environment capabilities.
 * @param {boolean} env.hasMsSave - `navigator.msSaveOrOpenBlob` is available (legacy Edge).
 * @param {boolean} env.needsMobileSave - Platform ignores the anchor `download` attribute (iOS / iPadOS).
 * @param {boolean} env.canShareFile - The Web Share API can share this file.
 * @param {boolean} env.hasDownloadAttr - The anchor `download` attribute is supported.
 * @returns {('msSave'|'share'|'newTab'|'anchor')} The strategy to use.
 */
const chooseDownloadStrategy = ({ hasMsSave, needsMobileSave, canShareFile, hasDownloadAttr }) => {
    if (hasMsSave) return 'msSave';
    // iOS / iPadOS Safari ignores the `download` attribute, so the desktop
    // anchor-click path silently does nothing. Prefer the Web Share sheet
    // (save to Photos / Files); otherwise open the blob in a new tab so the
    // user can long-press to save it.
    if (needsMobileSave) return canShareFile ? 'share' : 'newTab';
    if (hasDownloadAttr) return 'anchor';
    return 'newTab';
};

/**
 * Wrap a blob in a File so it can be passed to the Web Share API.
 * @param {string} filename - Download filename.
 * @param {Blob} blob - The blob to wrap.
 * @returns {File|null} A File, or null if File construction is unavailable.
 */
const makeFile = (filename, blob) => {
    if (typeof File !== 'function') return null;
    try {
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    } catch (e) {
        return null;
    }
};

/**
 * Open a blob in a new tab so the user can save it manually (long-press on
 * mobile). Used as the fallback when neither anchor download nor Web Share
 * is usable.
 * @param {Blob} blob - The blob to open.
 * @returns {void}
 */
const openBlobInNewTab = (blob) => {
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke after a delay so the new tab has time to load the resource.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
};
// === Smalruby: End of mobile-friendly download strategy ===

/**
 * Trigger a download (or share) of the given blob under the given filename.
 * Desktop behaviour is unchanged (anchor `download` click); mobile platforms
 * that ignore the `download` attribute use the Web Share API or a new tab.
 * @param {string} filename - The filename to save as.
 * @param {Blob} blob - The blob to download.
 * @returns {void}
 */
const downloadBlob = (filename, blob) => {
    // Use special ms version if available to get it working on Edge.
    if (navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(blob, filename);
        return;
    }

    // === Smalruby: Start of mobile-friendly download dispatch ===
    const file = makeFile(filename, blob);
    const canShareFile = Boolean(
        file &&
            navigator.canShare &&
            navigator.share &&
            navigator.canShare({ files: [file] }),
    );
    const strategy = chooseDownloadStrategy({
        hasMsSave: false,
        needsMobileSave: isAppleMobile(),
        canShareFile,
        hasDownloadAttr: 'download' in HTMLAnchorElement.prototype,
    });

    if (strategy === 'share') {
        navigator.share({ files: [file], title: filename }).catch((err) => {
            // A deliberate user cancel rejects with AbortError; don't surprise
            // the user by popping a new tab in that case. Only fall back on a
            // genuine failure (e.g. transient activation expired because blob
            // generation took too long) so the blob can still be saved.
            if (err && err.name === 'AbortError') return;
            openBlobInNewTab(blob);
        });
        return;
    }
    if (strategy === 'newTab') {
        openBlobInNewTab(blob);
        return;
    }
    // === Smalruby: End of mobile-friendly download dispatch ===

    // strategy === 'anchor' (desktop): unchanged from upstream Scratch.
    const downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);
    const url = window.URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.type = blob.type;
    downloadLink.click();
    // remove the link after a timeout to prevent a crash on iOS 13 Safari
    window.setTimeout(() => {
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
    }, 1000);
};

export default downloadBlob;
// === Smalruby: Start of mobile-friendly download exports ===
export { chooseDownloadStrategy, isAppleMobile };
// === Smalruby: End of mobile-friendly download exports ===
