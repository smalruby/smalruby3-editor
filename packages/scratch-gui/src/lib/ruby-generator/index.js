import Blockly from 'scratch-blocks';
import Generator from '../generator';

import EncodingHelpers from './encoding.js';
import VariableHelpers from './variables.js';
import ScrubHandler from './scrub.js';
import SpriteNewGenerator from './sprite-new.js';
import ClassWrapper from './class-wrapper.js';
import CodeFinisher from './code-finisher.js';
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
// === Smalruby: Start of TM2Scratch extension ===
import TM2ScratchBlocks from './tm2scratch.js';
// === Smalruby: End of TM2Scratch extension ===
// === Smalruby: Start of Ruby String extension ===
import SmalrubyRubyBlocks from './smalruby-ruby.js';
// === Smalruby: End of Ruby String extension ===

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
 

RubyGenerator.init = function (options) {
    this.definitions_ = {};
    this.returnCallCache_ = {}; // Clear return value call cache
    this.emptyCallCache_ = {};
    this.notEqualsCallCache_ = {};
    this.greaterThanOrEqualCallCache_ = {};
    this.lessThanOrEqualCallCache_ = {};
    // === Smalruby: regex match operator caches ===
    this.regexNotMatchCallCache_ = {};
    this._moduleMethodCodes = {};
    this.version = options && options.version ? String(options.version) : '1';
    if (this.variableDB_) {
        this.variableDB_.reset();
    } else {
        this.variableDB_ = new Blockly.Names(RubyGenerator.RESERVED_WORDS_);
    }
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
CodeFinisher(RubyGenerator);
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
// === Smalruby: Start of TM2Scratch extension ===
TM2ScratchBlocks(RubyGenerator);
// === Smalruby: End of TM2Scratch extension ===
// === Smalruby: Start of Ruby String extension ===
SmalrubyRubyBlocks(RubyGenerator);
// === Smalruby: End of Ruby String extension ===

export default RubyGenerator;
