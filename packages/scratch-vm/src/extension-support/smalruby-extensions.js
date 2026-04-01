/**
 * Smalruby-specific extension registration
 *
 * This file centralizes all Smalruby custom extension registrations.
 * By importing from this single file, we minimize merge conflicts when
 * updating from upstream scratch-vm.
 *
 * When adding new Smalruby extensions:
 * 1. Add the registration logic to registerSmalrubyExtensions function
 * 2. No changes needed in extension-manager.js - it calls this function
 * @param {object} builtinExtensions - The builtin extensions object to register into
 */
const registerSmalrubyExtensions = builtinExtensions => {
    // microbitMore extension - Enhanced micro:bit support
    builtinExtensions.microbitMore = () => {
        const formatMessage = require('format-message');
        const ext = require('../extensions/microbitMore/index.js');
        const blockClass = ext.blockClass;
        blockClass.formatMessage = formatMessage;
        return blockClass;
    };

    // koshien extension - Smalruby Koshien competition support
    builtinExtensions.koshien = () => {
        const formatMessage = require('format-message');
        const blockClass = require('../extensions/koshien/index.js');
        blockClass.formatMessage = formatMessage;
        return blockClass;
    };

    // tm2scratch extension - Teachable Machine support
    builtinExtensions.tm2scratch = () => {
        const formatMessage = require('format-message');
        const blockClass = require('../extensions/scratch3_tm2scratch/index.js');
        blockClass.formatMessage = formatMessage;
        return blockClass;
    };

    // ruby extension - Ruby String methods support
    builtinExtensions.smalrubyRuby = () => {
        const formatMessage = require('format-message');
        const blockClass = require('../extensions/smalruby_ruby/index.js');
        blockClass.formatMessage = formatMessage;
        return blockClass;
    };
};

module.exports = registerSmalrubyExtensions;
