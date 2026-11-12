// === Smalruby: This file is Smalruby-specific (micro:bit More extension converter entry point) ===
import registerLegacyHandlers from './microbit-more-legacy';
import registerModernHandlers from './microbit-more-modern';

/**
 * MicrobitMore converter
 */
const MicrobitMoreConverter = {
    register: function (converter) {
        registerModernHandlers(converter);
        registerLegacyHandlers(converter);
    },
};

export default MicrobitMoreConverter;
