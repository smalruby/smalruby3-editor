// === Smalruby: This file is Smalruby-specific (class definition wrapping for RubyGenerator) ===

/**
 * Register class wrapping and set_xxx generation methods on the RubyGenerator.
 * Handles: _wrapWithClass, _isValidClassName, _generateSetXxx, _generateStageSetXxx.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    // Check if a string is a valid Ruby constant name (class name)
    Generator._isValidClassName = function (name) {
        return /^[A-Z][\p{L}\p{N}_]*$/u.test(name);
    };

    Generator._wrapWithClass = function (code, classComment, forFileOutput) {
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

    Generator._generateSetXxx = function (target, setLines, allowedAttributes, autoAll) {
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

    Generator._generateStageSetXxx = function (target, setLines, allowedAttributes, autoAll) {
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

    return Generator;
}
