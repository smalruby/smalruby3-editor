// === Smalruby: This file is Smalruby-specific (class insertion utility for Ruby tab) ===

const INDENT = '  ';

/**
 * Quote a string for Ruby output (double-quoted).
 * @param {string} string The string to quote.
 * @returns {string} The quoted string.
 */
const quote = string => {
    const escapeChars = {
        '\\': '\\\\',
        '"': '\\"',
        '\n': '\\n',
        '\t': '\\t',
    };
    const s = String(string);
    const sb = ['"'];
    for (let i = 0; i < s.length; i++) {
        const ch = s.charAt(i);
        sb.push(escapeChars[ch] || ch);
    }
    sb.push('"');
    return sb.join('');
};

/**
 * Prepend a prefix onto each line of code.
 * @param {string} text The lines of code.
 * @param {string} prefix The common prefix.
 * @returns {string} The prefixed lines of code.
 */
const prefixLines = (text, prefix = INDENT) => prefix + text.replace(/(?!\n$)\n/g, `\n${prefix}`);

/**
 * Check if a string is a valid Ruby constant name (class name).
 * @param {string} name The name to check.
 * @returns {boolean} Whether the name is a valid class name.
 */
const isValidClassName = name => /^[A-Z][\p{L}\p{N}_]*$/u.test(name);

/**
 * Check if code already contains a class definition.
 * Matches lines starting with optional whitespace followed by "class ".
 * Ignores comments (lines starting with #).
 * @param {string} code The code to check.
 * @returns {boolean} Whether the code contains a class definition.
 */
const hasClassDefinition = code => {
    const lines = code.split('\n');
    for (const line of lines) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('#')) continue;
        if (/^class\s/.test(trimmed)) return true;
    }
    return false;
};

/**
 * Generate set_xxx lines for sprite attributes that differ from defaults.
 * @param {object} target The sprite target.
 * @param {string[]} setLines Array to push set lines into.
 */
const generateSetXxx = (target, setLines) => {
    if (target.x !== 0) {
        setLines.push(`set_x ${target.x}`);
    }
    if (target.y !== 0) {
        setLines.push(`set_y ${target.y}`);
    }
    if (target.direction !== 90) {
        setLines.push(`set_direction ${target.direction}`);
    }
    if (!target.visible) {
        setLines.push(`set_visible ${!!target.visible}`);
    }
    if (target.size !== 100) {
        setLines.push(`set_size ${target.size}`);
    }
    if (target.currentCostume > 0) {
        setLines.push(`set_current_costume ${target.currentCostume + 1}`);
    }
    if (target.rotationStyle !== 'all around') {
        setLines.push(`set_rotation_style ${quote(target.rotationStyle)}`);
    }
};

/**
 * Generate set_xxx lines for stage attributes that differ from defaults.
 * @param {object} target The stage target.
 * @param {string[]} setLines Array to push set lines into.
 */
const generateStageSetXxx = (target, setLines) => {
    if (target.currentCostume > 0) {
        setLines.push(`set_current_backdrop ${target.currentCostume + 1}`);
    }
};

/**
 * Wrap existing code with a class definition.
 * Returns null if code already contains a class definition.
 * This replicates the logic of RubyGenerator._wrapWithClass with forFileOutput=true.
 * @param {string} code The current editor code.
 * @param {object} target The editing target (vm.editingTarget).
 * @returns {string|null} The wrapped code, or null if class already exists.
 */
const wrapCurrentCodeWithClass = (code, target) => {
    if (hasClassDefinition(code)) {
        return null;
    }

    const isStage = target.isStage;
    let className;
    const setLines = [];

    if (isStage) {
        className = 'Stage';
        if (target.sprite.name !== 'Stage') {
            setLines.push(`set_name ${quote(target.sprite.name)}`);
        }
    } else {
        const spriteName = target.sprite.name;
        if (isValidClassName(spriteName)) {
            className = spriteName;
        } else {
            const sprites = target.runtime.targets.filter(t => !t.isStage);
            const index = sprites.indexOf(target) + 1;
            className = `Sprite${index}`;
            setLines.push(`set_name ${quote(spriteName)}`);
        }
    }

    // Generate set_xxx for non-default attributes
    if (isStage) {
        generateStageSetXxx(target, setLines);
    } else {
        generateSetXxx(target, setLines);
    }

    let setCode = '';
    if (setLines.length > 0) {
        setCode = setLines.map(line => `${INDENT}${line}\n`).join('');
    }

    // Split code into hat/def blocks vs other top-level code
    let bodyCode = code;
    let outsideCode = '';

    if (bodyCode.length > 0) {
        const sections = bodyCode.split(/\n\n/);
        const insideSections = [];
        const outsideSections = [];
        for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed.length === 0) continue;
            if (
                /^self\.when\(/.test(trimmed) ||
                /^when_/.test(trimmed) ||
                /^\w+\.when[\s_(]/.test(trimmed) ||
                /^def /.test(trimmed)
            ) {
                insideSections.push(section);
            } else {
                outsideSections.push(section);
            }
        }
        bodyCode = insideSections.join('\n\n');
        if (bodyCode.length > 0 && !bodyCode.endsWith('\n')) {
            bodyCode += '\n';
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

    if (bodyCode.length > 0) {
        bodyCode = prefixLines(bodyCode, INDENT);
    }

    const separator = setCode.length > 0 && bodyCode.length > 0 ? '\n' : '';
    const inheritance = isStage ? '' : ' < ::Smalruby3::Sprite';
    let result = `class ${className}${inheritance}\n${setCode}${separator}${bodyCode}end\n`;

    if (outsideCode.length > 0) {
        result += outsideCode;
    }

    return result;
};

export { wrapCurrentCodeWithClass, hasClassDefinition };
