/**
 * Utility functions for parsing project URLs
 */

/**
 * Extract Scratch project ID from Scratch project URL
 * @param {string} url - Scratch project URL
 * @returns {string|null} - Project ID or null if invalid
 */
export const extractScratchProjectId = url => {
    if (!url || typeof url !== 'string') {
        return null;
    }

    const patterns = [
        // Standard project URL: https://scratch.mit.edu/projects/1209008277/
        /^https?:\/\/scratch\.mit\.edu\/projects\/(\d+)\/?$/,
        // Project URL with additional path: https://scratch.mit.edu/projects/1209008277/editor/
        /^https?:\/\/scratch\.mit\.edu\/projects\/(\d+)\/.*$/
    ];

    for (const pattern of patterns) {
        const match = url.trim().match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

/**
 * Validate if URL is a valid Scratch project URL
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid Scratch project URL
 */
export const isValidScratchProjectUrl = url => extractScratchProjectId(url) !== null;
