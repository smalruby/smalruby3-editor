// === Smalruby: This file is Smalruby-specific (error messages and constants for Ruby-to-blocks converter) ===

import {defineMessages} from 'react-intl';

import spritesLibrary from '../libraries/sprites.json';
import costumesLibrary from '../libraries/costumes.json';
import soundsLibrary from '../libraries/sounds.json';
import backdropsLibrary from '../libraries/backdrops.json';

const spriteLibraryNames = new Set(spritesLibrary.map(s => s.name));
const costumeLibraryNames = new Set(costumesLibrary.map(c => c.name));
const soundLibraryNames = new Set(soundsLibrary.map(s => s.name));
const backdropLibraryNames = new Set(backdropsLibrary.map(b => b.name));

const messages = defineMessages({
    couldNotConvertPrimitive: {
        defaultMessage: '"{ SOURCE }" could not be converted to a block.' +
            '\nCheck the spelling or use a supported value.',
        description: 'Error message for converting ruby to block when find the primitive',
        id: 'gui.smalruby3.rubyToBlocksConverter.couldNotConvertPrimitive'
    },
    wrongInstruction: {
        defaultMessage: '"{ SOURCE }" is the wrong instruction.' +
            '\nCheck the spelling or use a supported block.',
        description: 'Error message for converting ruby to block when find the wrong instruction',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstruction'
    },
    cannotChangeVariableScope: {
        defaultMessage: '"{ VARIABLE }", can\'t change variable scope.' +
            '\nDelete the variable first, then recreate it with the correct scope.',
        description: 'Error message when trying to change variable scope from global to instance or vice versa',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotChangeVariableScope'
    },
    wrongInstructionInClass: {
        defaultMessage: '"{ SOURCE }" cannot be placed directly inside a class definition.' +
            '\nUse it inside an event block (e.g. when_flag_clicked) or a method definition (def).',
        description: 'Error message when a non-hat/non-def block is placed directly in a class body',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstructionInClass'
    },
    spriteAndCostumesSoundsExclusive: {
        defaultMessage: 'set_sprite and set_costumes/set_sounds cannot be used together.' +
            '\nUse either set_sprite or set_costumes/set_sounds.',
        description: 'Error message when set_sprite is used with set_costumes or set_sounds',
        id: 'gui.smalruby3.rubyToBlocksConverter.spriteAndCostumesSoundsExclusive'
    },
    invalidSpriteName: {
        defaultMessage: 'sprite "{ NAME }" does not exist in the sprite library.' +
            '\nCheck the name or use a valid sprite name.',
        description: 'Error message when set_sprite references an invalid sprite library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidSpriteName'
    },
    invalidCostumeName: {
        defaultMessage: 'costume "{ NAME }" does not exist in the costume library.' +
            '\nCheck the name or use a valid costume name.',
        description: 'Error message when set_costumes references an invalid costume library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidCostumeName'
    },
    invalidSoundName: {
        defaultMessage: 'sound "{ NAME }" does not exist in the sound library.' +
            '\nCheck the name or use a valid sound name.',
        description: 'Error message when set_sounds references an invalid sound library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidSoundName'
    },
    invalidBackdropName: {
        defaultMessage: 'backdrop "{ NAME }" does not exist in the backdrop library.' +
            '\nCheck the name or use a valid backdrop name.',
        description: 'Error message when set_backdrops references an invalid backdrop library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidBackdropName'
    },
    spriteMethodInStageClass: {
        defaultMessage: '"{ METHOD }" cannot be used in class Stage.' +
            '\nThis method is only available for sprites.',
        description: 'Error message when a sprite-only set_xxx method is used in class Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.spriteMethodInStageClass'
    },
    stageMethodInSpriteClass: {
        defaultMessage: '"{ METHOD }" cannot be used in a sprite class.' +
            '\nThis method is only available for class Stage.',
        description: 'Error message when a stage-only set_xxx method is used in a sprite class',
        id: 'gui.smalruby3.rubyToBlocksConverter.stageMethodInSpriteClass'
    },
    classNotSupportedInV1: {
        defaultMessage: 'class definitions are not supported in Ruby version 1.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when class syntax is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.classNotSupportedInV1'
    },
    invalidStageSuperclass: {
        defaultMessage: 'Stage class can only inherit from ::Smalruby3::Stage or Smalruby3::Stage.',
        description: 'Error message when Stage class has invalid superclass',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidStageSuperclass'
    },
    setVariablesListsNotSupported: {
        defaultMessage: '"{ METHOD }" is not supported in Ruby version 2.' +
            '\nUse def initialize to set variable and list values instead.',
        description: 'Error message when set_variables/set_lists is used in V2 class',
        id: 'gui.smalruby3.rubyToBlocksConverter.setVariablesListsNotSupported'
    },
    invalidInitializeBody: {
        defaultMessage: '"{ SOURCE }" cannot be placed inside def initialize.' +
            '\nOnly variable and list assignments are allowed.',
        description: 'Error message when invalid code is in def initialize',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidInitializeBody'
    },
    wrongVariableScopeInInitialize: {
        defaultMessage: '"{ SOURCE }" uses the wrong variable scope for this class.' +
            '\nUse { PREFIX } variables in { CLASS_TYPE } classes.',
        description: 'Error message when wrong variable scope is used in initialize',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongVariableScopeInInitialize'
    },
    moduleNotSupportedInV1: {
        defaultMessage: 'module is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when module syntax is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleNotSupportedInV1'
    },
    nestedModuleNotSupported: {
        defaultMessage: 'Nested modules are not supported in Smalruby.',
        description: 'Error message when a module is nested inside another module',
        id: 'gui.smalruby3.rubyToBlocksConverter.nestedModuleNotSupported'
    },
    onlyMethodsInModule: {
        defaultMessage: 'Only method definitions (def) can be placed inside a module in Smalruby.',
        description: 'Error message when non-def statement is inside a module',
        id: 'gui.smalruby3.rubyToBlocksConverter.onlyMethodsInModule'
    },
    undefinedModule: {
        defaultMessage: 'Module "{ NAME }" is not defined.',
        description: 'Error message when include references an undefined module',
        id: 'gui.smalruby3.rubyToBlocksConverter.undefinedModule'
    },
    moduleFunctionNotSupported: {
        defaultMessage: 'module_function is not supported in Smalruby.',
        description: 'Error message when module_function is used',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleFunctionNotSupported'
    },
    extendNotSupported: {
        defaultMessage: 'extend is not supported in Smalruby.',
        description: 'Error message when extend is used',
        id: 'gui.smalruby3.rubyToBlocksConverter.extendNotSupported'
    },
    moduleNotSupportedInStage: {
        defaultMessage: 'module is not supported in Stage.' +
            '\nModules can only be used in sprite classes.',
        description: 'Error message when module syntax is used in Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleNotSupportedInStage'
    },
    includeNotSupportedInStage: {
        defaultMessage: 'include is not supported in class Stage.' +
            '\nModules can only be included in sprite classes.',
        description: 'Error message when include is used in class Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.includeNotSupportedInStage'
    },
    moduleImportFailed: {
        defaultMessage: 'Failed to import module "{ NAME }" from other sprites.',
        description: 'Error message when module auto-import from other sprites fails',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleImportFailed'
    },
    symbolNeedsToS: {
        defaultMessage: '"{ SOURCE }" — symbols need .to_s to be used as a string.' +
            '\nWrite { SUGGESTION } instead.',
        description: 'Error message when a symbol is used where a string is expected without .to_s',
        id: 'gui.smalruby3.rubyToBlocksConverter.symbolNeedsToS'
    },
    symbolCannotArithmetic: {
        defaultMessage: '"{ SOURCE }" — symbols cannot be used in arithmetic (+, -, *, /).' +
            '\nUse .to_s to convert first, e.g. { SUGGESTION }.',
        description: 'Error message when a symbol is used in arithmetic operation',
        id: 'gui.smalruby3.rubyToBlocksConverter.symbolCannotArithmetic'
    },
    symbolCannotCompare: {
        defaultMessage: '"{ SOURCE }" — symbols can only be compared with other symbols using >, <, >=, <=.' +
            '\nUse == instead, or convert with .to_s.',
        description: 'Error message when a symbol is compared with non-symbol using >, <, >=, <=',
        id: 'gui.smalruby3.rubyToBlocksConverter.symbolCannotCompare'
    }
});

// from scratch-vm/src/serialization/sb3.js
const CORE_EXTENSIONS = [
    'argument',
    'colour',
    'control',
    'data',
    'event',
    'looks',
    'math',
    'motion',
    'operator',
    'procedures',
    'ruby', // Ruby blocks are built-in (registered by scratch-vm's smalruby_ruby extension), not a loadable extension
    'sensing',
    'sound'
];

// from scratch-vm/src/serialization/sb3.js
const getExtensionIdForOpcode = function (opcode) {
    const index = opcode.indexOf('_');
    const prefix = opcode.substring(0, index);
    if (CORE_EXTENSIONS.indexOf(prefix) === -1) {
        if (prefix !== '') return prefix;
    }
    return null;
};

export {
    messages,
    spriteLibraryNames,
    costumeLibraryNames,
    soundLibraryNames,
    backdropLibraryNames,
    CORE_EXTENSIONS,
    getExtensionIdForOpcode
};
