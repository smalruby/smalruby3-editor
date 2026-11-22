// === Smalruby: This file is Smalruby-specific (micro:bit More extension converter entry point) ===
import registerLegacyHandlers, { MICROBIT_MORE_LEGACY_SENDS } from './microbit-more-legacy';
import registerModernHandlers, { MICROBIT_MORE_SENDS } from './microbit-more-modern';

/**
 * MicrobitMore converter
 */
const MicrobitMoreConverter = {
    sends: [...MICROBIT_MORE_SENDS, ...MICROBIT_MORE_LEGACY_SENDS],

    register: function (converter) {
        registerModernHandlers(converter);
        registerLegacyHandlers(converter);
    },
};

export default MicrobitMoreConverter;
