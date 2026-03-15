import Blockly from 'scratch-blocks';
import Generator from '../generator';

import EncodingHelpers from './encoding.js';
import VariableHelpers from './variables.js';
import ScrubHandler from './scrub.js';
import SpriteNewGenerator from './sprite-new.js';
import ClassWrapper from './class-wrapper.js';
import MathBlocks from './math.js';
import TextBlocks from './text.js';
import ColourBlocks from './colour.js';
import MotionBlocks from './motion.js';
import LooksBlocks from './looks.js';
import SoundBlocks from './sound.js';
import EventBlocks from './event.js';
import ControlBlocks from './control.js';
import SensingBlocks from './sensing.js';
import OperatorsBlocks from './operators.js';
import DataBlocks from './data.js';
import ProcedureBlocks from './procedure.js';
import RubyBlocks from './ruby.js';
import MusicBlocks from './music.js';
import PenBlocks from './pen.js';
import VideoBlocks from './video.js';
import Text2SpeechBlocks from './text2speech.js';
import TranslateBlocks from './translate.js';
import MakeyMakeyBlocks from './makeymakey.js';
import MicrobitBlocks from './microbit.js';
import MicrobitMoreBlocks from './microbit_more.js';
import BoostBlocks from './boost.js';
import EV3Blocks from './ev3.js';
import WeDo2Blocks from './wedo2.js';
import GdxForBlocks from './gdx_for.js';
import MeshBlocks from './mesh.js';
import MeshV2Blocks from './mesh_v2.js';
import SmalrubotS1Blocks from './smalrubot_s1.js';
import KoshienBlocks from './koshien.js';
import FaceSensingBlocks from './face_sensing.js';

const RubyGenerator = new Generator('Ruby');

RubyGenerator.addReservedWords(
    `BEGIN
     class
     ensure
     nil
     self
     when
     END
     def
     false
     not
     super
     while
     alias
     defined?
     for
     or
     then
     yield
     and
     do
     if
     redo
     true
     __LINE__
     begin
     else
     in
     rescue
     undef
     __FILE__
     break
     elsif
     module
     retry
     unless
     __ENCODING__
     case
     end
     next
     return
     until`.split(/\s+/));

/* eslint-disable no-multi-spaces */
RubyGenerator.ORDER_ATOMIC = 0;            // 0 "" ...
RubyGenerator.ORDER_COLLECTION = 1;        // tuples, lists, dictionaries
RubyGenerator.ORDER_STRING_CONVERSION = 1; // `expression...`
RubyGenerator.ORDER_MEMBER = 2;            // ::
RubyGenerator.ORDER_INDEX = 3;             // []
RubyGenerator.ORDER_FUNCTION_CALL = 4;     // ()
RubyGenerator.ORDER_UNARY_SIGN = 5;        // +(単項)  !  ~
RubyGenerator.ORDER_EXPONENTIATION = 6;    // **
RubyGenerator.ORDER_UNARY_MINUS_SIGN = 7;  // -(単項)
RubyGenerator.ORDER_MULTIPLICATIVE = 8;    // *  /  %
RubyGenerator.ORDER_ADDITIVE = 9;          // +  -
RubyGenerator.ORDER_BITWISE_SHIFT = 10;    // << >>
RubyGenerator.ORDER_BITWISE_AND = 11;      // &
RubyGenerator.ORDER_BITWISE_XOR = 12;      // ^
RubyGenerator.ORDER_BITWISE_OR = 12;       // |
RubyGenerator.ORDER_RELATIONAL = 13;       // > >=  < <=
RubyGenerator.ORDER_EQUALS = 14;           // <=> ==  === !=  =~  !~
RubyGenerator.ORDER_LOGICAL_AND = 15;      // &&
RubyGenerator.ORDER_LOGICAL_OR = 16;       // ||
RubyGenerator.ORDER_RANGE = 17;            // ..  ...
RubyGenerator.ORDER_CONDITIONAL = 18;      // ?:(条件演算子)
RubyGenerator.ORDER_ASSIGNMENT = 19;       // =(+=, -= ... )
RubyGenerator.ORDER_NOT = 20;              // not
RubyGenerator.ORDER_AND_OR = 21;           // and or
RubyGenerator.ORDER_NONE = 99;             // (...)
/* eslint-enable no-multi-spaces */

RubyGenerator.init = function (options) {
    this.definitions_ = {};
    this.returnCallCache_ = {}; // Clear return value call cache
    this.emptyCallCache_ = {};
    this.notEqualsCallCache_ = {};
    this.greaterThanOrEqualCallCache_ = {};
    this.lessThanOrEqualCallCache_ = {};
    this._moduleMethodCodes = {};
    this.version = options && options.version ? String(options.version) : '1';
    if (this.variableDB_) {
        this.variableDB_.reset();
    } else {
        this.variableDB_ = new Blockly.Names(RubyGenerator.RESERVED_WORDS_);
    }
};

RubyGenerator.finish = function (code, options) {
    const defs = [];
    for (const name in this.definitions_) {
        const def = this.definitions_[name];
        if (this.isString(def)) {
            if (name.match(/^require__/)) {
                this.requires_[name] = def;
            } else if (name.match(/^prepare__/)) {
                this.prepares_[name] = def;
            } else {
                defs.push(def);
            }
        }
    }

    const comments = RubyGenerator.getTargetCommentTexts();

    // Detect @ruby:class comments
    let classComment = null;
    const otherComments = [];
    for (const comment of comments) {
        if (comment === '@ruby:class' || comment.startsWith('@ruby:class:')) {
            classComment = comment;
        } else {
            otherComments.push(comment);
        }
    }

    // Generate module...end blocks from collected module method codes
    let moduleCode = '';
    if (classComment) {
        // Parse include= from class comment to determine module order
        const includeModuleNames = [];
        if (classComment.startsWith('@ruby:class:')) {
            const attrPart = classComment.slice('@ruby:class:'.length);
            const attrs = attrPart.split(',');
            for (const attr of attrs) {
                const includeMatch = attr.match(/^include=(.+)$/);
                if (includeMatch) {
                    includeModuleNames.push(includeMatch[1]);
                }
            }
        }

        // Generate module blocks in include order
        for (const moduleName of includeModuleNames) {
            const methods = this._moduleMethodCodes[moduleName];
            if (methods && methods.length > 0) {
                const methodsCode = methods.join('\n');
                moduleCode += `module ${moduleName}\n`;
                moduleCode += this.prefixLines(methodsCode, this.INDENT);
                moduleCode += `end\n\n`;
            }
        }
    }

    // For version 1 file output (withSpriteNew), use Sprite.new format
    // even when @ruby:class comment is present.
    // For version 2, @ruby:class takes priority over withSpriteNew.
    // For version 2 stage targets without @ruby:class, auto-wrap with class Stage.
    if (classComment && this.version !== '1') {
        code = this._wrapWithClass(
            code, classComment, options && options.withSpriteNew
        );
    } else if (this.version !== '1' && options && options.withSpriteNew) {
        // Version 2: auto-wrap with class (both sprite and stage)
        if (code.length > 0) {
            code = this._wrapWithClass(code, '@ruby:class', true);
        }
    } else if (options && options.withSpriteNew) {
        const spriteNewCode = this.spriteNew(this.currentTarget);
        if (code.length > 0) {
            code = this.prefixLines(code, this.INDENT);
        }
        code = `${spriteNewCode} do\n${code}end\n`;
    }

    // Add non-class target comments AFTER class wrapping so they appear
    // before the class definition, not inside it.
    if (otherComments.length > 0) {
        const commentCodes = otherComments.map(comment => `${this.prefixLines(comment, '# ')}\n`);
        code = `${commentCodes.join('\n')}\n${code}`;
    }

    if (defs.length === 0 && moduleCode.length === 0 && code.length === 0) {
        return '';
    }

    let s = '';
    if (defs.length > 0) {
        s += `${defs.join('\n')}\n\n`;
    }

    return s + moduleCode + code;
};

RubyGenerator.initTargets = function (options) {
    this.requires_ = {};
    this.prepares_ = {};

    if (options && Object.prototype.hasOwnProperty.call(options, 'requires')) {
        options.requires.forEach(name => {
            this.requires_[`require__${name}`] = `require "${name}"`;
        });
    }
};

RubyGenerator.finishTargets = function (code, _options) {
    let s = '';
    const requires = Object.keys(this.requires_).map(name => this.requires_[name]);
    if (requires.length > 0) {
        s += `${requires.join('\n')}\n\n`;
    }

    const prepares = Object.keys(this.prepares_).map(name => this.prepares_[name]);
    if (prepares.length > 0) {
        s += `${prepares.join('\n')}\n\n`;
    }

    // Deduplicate module definitions in multi-target output.
    // Extract all module...end blocks, keep unique ones, place them before class definitions.
    const moduleRegex = /^module (\w+)\n[\s\S]*?^end\n/gm;
    const seenModules = new Set();
    const uniqueModules = [];
    let match;
    while ((match = moduleRegex.exec(code)) !== null) {
        const moduleName = match[1];
        if (!seenModules.has(moduleName)) {
            seenModules.add(moduleName);
            uniqueModules.push(match[0]);
        }
    }

    if (uniqueModules.length > 0) {
        // Remove all module definitions from code
        code = code.replace(moduleRegex, '');
        // Clean up extra blank lines left by removal
        code = code.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
        // Prepend unique modules
        const modulesCode = uniqueModules.join('\n');
        code = `${modulesCode}\n${code}`;
    }

    return s + code;
};

RubyGenerator.spriteName = function () {
    return 'self';
};

RubyGenerator.getScripts = function () {
    return Generator.prototype.getScripts.call(this).sort((a, b) => {
        const aValue = (this.getBlock(a).opcode === 'procedures_definition' ? 1 : -1);
        const bValue = (this.getBlock(b).opcode === 'procedures_definition' ? 1 : -1);
        return bValue - aValue;
    });
};

EncodingHelpers(RubyGenerator);
VariableHelpers(RubyGenerator);
ScrubHandler(RubyGenerator);
SpriteNewGenerator(RubyGenerator);
ClassWrapper(RubyGenerator);
MathBlocks(RubyGenerator);
TextBlocks(RubyGenerator);
ColourBlocks(RubyGenerator);
MotionBlocks(RubyGenerator);
LooksBlocks(RubyGenerator);
SoundBlocks(RubyGenerator);
EventBlocks(RubyGenerator);
ControlBlocks(RubyGenerator);
SensingBlocks(RubyGenerator);
OperatorsBlocks(RubyGenerator);
DataBlocks(RubyGenerator);
ProcedureBlocks(RubyGenerator);
RubyBlocks(RubyGenerator);
MusicBlocks(RubyGenerator);
PenBlocks(RubyGenerator);
VideoBlocks(RubyGenerator);
Text2SpeechBlocks(RubyGenerator);
TranslateBlocks(RubyGenerator);
MakeyMakeyBlocks(RubyGenerator);
MicrobitBlocks(RubyGenerator);
MicrobitMoreBlocks(RubyGenerator);
BoostBlocks(RubyGenerator);
EV3Blocks(RubyGenerator);
WeDo2Blocks(RubyGenerator);
GdxForBlocks(RubyGenerator);
MeshBlocks(RubyGenerator);
MeshV2Blocks(RubyGenerator);
SmalrubotS1Blocks(RubyGenerator);
KoshienBlocks(RubyGenerator);
FaceSensingBlocks(RubyGenerator);

export default RubyGenerator;
