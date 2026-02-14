/**
 * @file
 * Utility functions for handling tutorial images in multiple languages
 */

import {PLATFORM} from '../../platform.js';
import {enImages as defaultImages} from './en-steps.js';

let savedImages = {};
let savedLocale = '';

const loadJapanese = () =>
    import(/* webpackChunkName: "ja-steps" */ './ja-steps.js')
        .then(({jaImages: imageData}) => imageData);

const translations = {
    'ja': () => loadJapanese(),
    'ja-Hira': () => loadJapanese()
};

const loadImageData = (locale, platform) => {
    if (platform !== PLATFORM.ANDROID && Object.prototype.hasOwnProperty.call(translations, locale)) {
        translations[locale]()
            .then(newImages => {
                savedImages = newImages;
                savedLocale = locale;
            });
    }
};

/**
 * Return image data for tutorials based on locale (default: en)
 * @param {string} imageId key in the images object, or id string.
 * @param {string} locale requested locale
 * @returns {string} image
 */
const translateImage = (imageId, locale) => {
    if (locale !== savedLocale || !Object.prototype.hasOwnProperty.call(savedImages, imageId)) {
        return defaultImages[imageId];
    }
    return savedImages[imageId];
};

export {
    loadImageData,
    translateImage
};
