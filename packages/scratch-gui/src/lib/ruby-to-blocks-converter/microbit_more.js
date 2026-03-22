// === Smalruby: This file is Smalruby-specific (micro:bit More extension converter entry point) ===

import registerModernHandlers from './microbit-more-modern';
import registerLegacyHandlers from './microbit-more-legacy';

/**
 * MicrobitMore converter
 */
const MicrobitMoreConverter = {
    register: function (converter) {
        registerModernHandlers(converter);
        registerLegacyHandlers(converter);
    }
};

export default MicrobitMoreConverter;
