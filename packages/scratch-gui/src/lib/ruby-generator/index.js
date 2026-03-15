import Blockly from 'scratch-blocks';
import Generator from '../generator';

import EncodingHelpers from './encoding.js';
import VariableHelpers from './variables.js';
import ScrubHandler from './scrub.js';
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

const SCALAR_TYPE = '';
const LIST_TYPE = 'list';

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

// Check if a string is a valid Ruby constant name (class name)
RubyGenerator._isValidClassName = function (name) {
    return /^[A-Z][\p{L}\p{N}_]*$/u.test(name);
};

RubyGenerator._wrapWithClass = function (code, classComment, forFileOutput) {
    const target = this.currentTarget;
    const isStage = target && target.isStage;
    let className;
    const includeNames = [];
    const setLines = [];

    // Parse attribute list from @ruby:class:attr1,attr2,...
    // Support name=ClassName format for preserving class names
    let allowedAttributes = [];
    let explicitClassName = null;
    let superclassPath = null;
    if (classComment.startsWith('@ruby:class:')) {
        const attrPart = classComment.slice('@ruby:class:'.length);
        allowedAttributes = attrPart.split(',');

        // Check for <=superclass in the attributes
        const superAttrIndex = allowedAttributes.findIndex(a => a.startsWith('<='));
        if (superAttrIndex >= 0) {
            const encoded = allowedAttributes[superAttrIndex].slice(2);
            // Decode: leading // → ::, then / → ::
            if (encoded.startsWith('//')) {
                superclassPath = `::${encoded.slice(2).replace(/\//g, '::')}`;
            } else {
                superclassPath = encoded.replace(/\//g, '::');
            }
            allowedAttributes.splice(superAttrIndex, 1);
        }

        // Check for name=ClassName in the attributes
        const nameAttrIndex = allowedAttributes.findIndex(a => a.startsWith('name='));
        if (nameAttrIndex >= 0) {
            explicitClassName = allowedAttributes[nameAttrIndex].slice('name='.length);
            // Replace name=ClassName with plain 'name' for attribute processing
            allowedAttributes[nameAttrIndex] = 'name';
        }

        // Check for sprite=SpriteName in the attributes
        const spriteAttrIndex = allowedAttributes.findIndex(a => a.startsWith('sprite='));
        if (spriteAttrIndex >= 0) {
            const spriteName = allowedAttributes[spriteAttrIndex].slice('sprite='.length);
            setLines.push(`set_sprite ${this.quote_(spriteName)}`);
            // Replace sprite=Name with plain 'sprite' for attribute processing (already handled)
            allowedAttributes[spriteAttrIndex] = 'sprite';
        }

        // Extract include=ModuleName entries (in order) and remove from allowedAttributes
        for (let i = allowedAttributes.length - 1; i >= 0; i--) {
            const includeMatch = allowedAttributes[i].match(/^include=(.+)$/);
            if (includeMatch) {
                includeNames.unshift(includeMatch[1]);
                allowedAttributes.splice(i, 1);
            }
        }
    }

    // Determine if this is an auto-wrap (no user-defined @ruby:class attributes)
    const isAutoWrap = allowedAttributes.length === 0 && forFileOutput;

    if (isStage) {
        // Stage always uses class name "Stage"
        className = 'Stage';
        // Generate set_name if explicitly listed or auto-wrapping, and name differs from "Stage"
        if ((allowedAttributes.indexOf('name') >= 0 || isAutoWrap) &&
            target.sprite.name !== 'Stage') {
            setLines.push(`set_name ${this.quote_(target.sprite.name)}`);
        }
    } else if (explicitClassName) {
        // Use the explicit class name from name=ClassName
        className = explicitClassName;
        const spriteName = target.sprite.name;
        if (spriteName !== className) {
            setLines.push(`set_name ${this.quote_(spriteName)}`);
        }
    } else if (allowedAttributes.indexOf('name') >= 0) {
        const spriteName = target.sprite.name;
        if (this._isValidClassName(spriteName)) {
            className = spriteName;
        } else {
            // Calculate sprite index
            const sprites = target.runtime.targets.filter(t => !t.isStage);
            const index = sprites.indexOf(target) + 1;
            className = `Sprite${index}`;
            setLines.push(`set_name ${this.quote_(spriteName)}`);
        }
    } else {
        // No name attribute - use Sprite%index% or sprite name if uppercase
        const spriteName = target.sprite.name;
        if (isAutoWrap && this._isValidClassName(spriteName)) {
            className = spriteName;
        } else {
            const sprites = target.runtime.targets.filter(t => !t.isStage);
            const index = sprites.indexOf(target) + 1;
            className = `Sprite${index}`;
            if (isAutoWrap && spriteName !== className) {
                setLines.push(`set_name ${this.quote_(spriteName)}`);
            }
        }
    }

    // Generate set_xxx for listed attributes, or all non-default attributes if auto-wrapping
    const autoAll = isAutoWrap;
    if (isStage) {
        this._generateStageSetXxx(target, setLines, allowedAttributes, autoAll);
    } else {
        this._generateSetXxx(target, setLines, allowedAttributes, autoAll);
    }

    let setCode = '';
    if (setLines.length > 0) {
        setCode = setLines.map(line => `${this.INDENT}${line}\n`).join('');
    }

    // Generate include statements for modules
    let includeCode = '';
    if (includeNames.length > 0) {
        includeCode = includeNames.map(name => `${this.INDENT}include ${name}\n`).join('');
    }

    let outsideCode = '';
    if (forFileOutput && code.length > 0) {
        // Split code into top-level sections (separated by blank lines)
        // and separate hat/def blocks from non-hat code
        const sections = code.split(/\n\n/);
        const insideSections = [];
        const outsideSections = [];
        for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed.length === 0) continue;
            if (/^self\.when\(/.test(trimmed) ||
                /^when_/.test(trimmed) ||
                /^\w+\.when[\s_(]/.test(trimmed) ||
                /^def /.test(trimmed)) {
                insideSections.push(section);
            } else {
                outsideSections.push(section);
            }
        }
        code = insideSections.join('\n\n');
        if (code.length > 0 && !code.endsWith('\n')) {
            code += '\n';
        }
        if (outsideSections.length > 0) {
            const commented = outsideSections
                .join('\n\n')
                .split('\n')
                .map(line => (line.trim().length > 0 ? `# ${line}` : ''))
                .join('\n');
            outsideCode = `\n${commented}\n`;
        }
    }

    if (code.length > 0) {
        code = this.prefixLines(code, this.INDENT);
    }
    // Build the inner class content with separators
    const innerParts = [setCode, includeCode, code].filter(p => p.length > 0);
    const innerCode = innerParts.join('\n');
    let inheritance = '';
    if (superclassPath) {
        inheritance = ` < ${superclassPath}`;
    } else if (forFileOutput) {
        inheritance = ' < ::Smalruby3::Sprite';
    }
    code = `class ${className}${inheritance}\n${innerCode}end\n`;

    if (outsideCode.length > 0) {
        code += outsideCode;
    }

    return code;
};

RubyGenerator._generateSetXxx = function (target, setLines, allowedAttributes, autoAll) {
    const has = attr => autoAll || allowedAttributes.indexOf(attr) >= 0;
    if (has('x') && target.x !== 0) {
        setLines.push(`set_x ${target.x}`);
    }
    if (has('y') && target.y !== 0) {
        setLines.push(`set_y ${target.y}`);
    }
    if (has('direction') && target.direction !== 90) {
        setLines.push(`set_direction ${target.direction}`);
    }
    if (has('visible') && !target.visible) {
        setLines.push(`set_visible ${!!target.visible}`);
    }
    if (has('size') && target.size !== 100) {
        setLines.push(`set_size ${target.size}`);
    }
    if (has('current_costume') && target.currentCostume > 0) {
        setLines.push(`set_current_costume ${target.currentCostume + 1}`);
    }
    if (has('rotation_style') && target.rotationStyle !== 'all around') {
        setLines.push(`set_rotation_style ${this.quote_(target.rotationStyle)}`);
    }
    if (has('costumes') && target.sprite && target.sprite.costumes) {
        const costumeNames = target.sprite.costumes.map(c => this.quote_(c.name));
        setLines.push(`set_costumes [${costumeNames.join(', ')}]`);
    }
    if (has('sounds') && target.sprite && target.sprite.sounds) {
        const soundNames = target.sprite.sounds.map(s => this.quote_(s.name));
        setLines.push(`set_sounds [${soundNames.join(', ')}]`);
    }
};

RubyGenerator._generateStageSetXxx = function (target, setLines, allowedAttributes, autoAll) {
    const has = attr => autoAll || allowedAttributes.indexOf(attr) >= 0;
    if (has('current_backdrop') && target.currentCostume > 0) {
        setLines.push(`set_current_backdrop ${target.currentCostume + 1}`);
    }
    if (has('backdrops') && target.sprite && target.sprite.costumes) {
        const backdropNames = target.sprite.costumes.map(c => this.quote_(c.name));
        setLines.push(`set_backdrops [${backdropNames.join(', ')}]`);
    }
    if (has('sounds') && target.sprite && target.sprite.sounds) {
        const soundNames = target.sprite.sounds.map(s => this.quote_(s.name));
        setLines.push(`set_sounds [${soundNames.join(', ')}]`);
    }
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

RubyGenerator.spriteNew = function (renderedTarget) {
    if (!renderedTarget) {
        return null;
    }

    const attributes = {};
    if (renderedTarget.x !== 0) {
        attributes.x = renderedTarget.x;
    }
    if (renderedTarget.y !== 0) {
        attributes.y = renderedTarget.y;
    }
    if (renderedTarget.direction !== 90) {
        attributes.direction = renderedTarget.direction;
    }
    if (!renderedTarget.visible) {
        attributes.visible = !!renderedTarget.visible;
    }
    if (renderedTarget.size !== 100) {
        attributes.size = renderedTarget.size;
    }
    if (renderedTarget.currentCostume > 1) {
        attributes.current_costume = renderedTarget.currentCostume - 1;
    }
    const costumes = renderedTarget.sprite.costumes;
    if (costumes.length > 0) {
        const s = costumes.map(i => {
            const h = {
                asset_id: this.quote_(i.assetId),
                name: this.quote_(i.name),
                bitmap_resolution: i.bitmapResolution ? i.bitmapResolution : 1,
                data_format: this.quote_(i.dataFormat),
                rotation_center_x: i.rotationCenterX,
                rotation_center_y: i.rotationCenterY
            };
            return this.hashToCode(h);
        }).join(',\n');
        attributes.costumes = `[\n${this.prefixLines(s, this.INDENT)}\n]`;
    }
    if (renderedTarget.rotationStyle !== 'all around') {
        attributes.rotation_style = this.quote_(renderedTarget.rotationStyle);
    }

    const variables = [];
    const lists = [];
    for (const id in renderedTarget.variables) {
        const v = renderedTarget.variables[id];
        switch (v.type) {
        case SCALAR_TYPE:
            variables.push(v);
            break;
        case LIST_TYPE:
            lists.push(v);
            break;
        }
    }
    if (variables.length > 0) {
        const s = variables.map(i => {
            const h = {
                name: this.quote_(this.escapeVariableName(i.name))
            };
            if (i.value !== 0) {
                h.value = this.scalarToCode(i.value);
            }
            return this.hashToCode(h);
        }).join(',\n');
        attributes.variables = `[\n${this.prefixLines(s, this.INDENT)}\n]`;
    }
    if (lists.length > 0) {
        const s = lists.map(i => {
            const h = {
                name: this.quote_(this.escapeVariableName(i.name))
            };
            if (i.value.length > 0) {
                h.value = this.listToCode(i.value);
            }
            return this.hashToCode(h);
        }).join(',\n');
        attributes.lists = `[\n${this.prefixLines(s, this.INDENT)}\n]`;
    }

    let code = this.hashToCode(attributes, ': ', false);
    if (code.length > 0) {
        const indent = renderedTarget.isStage ? '          ' : '           ';
        code = `,\n${this.prefixLines(code, indent)}`;
    }
    const klass = renderedTarget.isStage ? 'Stage' : 'Sprite';
    const name = renderedTarget.sprite.name;
    return `${klass}.new(${this.quote_(name)}${code})`;
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
