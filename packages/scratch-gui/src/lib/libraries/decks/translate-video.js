/**
 * @file
 * Utility function to look up whether a translated video exists for a locale.
 */

const videos = {
    'intro-move-sayhello': {
        'en': 'rpjvs3v9gj',
        'ja': 'v2c2f3y2sc',
        'ja-Hira': 'v2c2f3y2sc'
    }
};

/**
 * Return a video identifier (on our video hosting service)
 * @param {string} videoId key in the videos object, or id string.
 * @param {string} locale locale to look up. If locale is not defined return the id for 'en' by default
 * @returns {string} identifier for the video on our video hosting service.
 */
const translateVideo = (videoId, locale) => {
    // if the videoId is not recognized in the videos object, assume it's already a video id on wistia
    if (!Object.prototype.hasOwnProperty.call(videos, videoId)) return videoId;
    if (Object.prototype.hasOwnProperty.call(videos[videoId], locale)) {
        return videos[videoId][locale];
    }
    return videos[videoId].en;
};

export {
    translateVideo
};
