// === Smalruby: This file is Smalruby-specific (code finishing/post-processing for RubyGenerator) ===

/**
 * Register code finishing methods on the RubyGenerator.
 * Handles: finish, initTargets, finishTargets.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    Generator.finish = function (code, options) {
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

        const comments = Generator.getTargetCommentTexts();

        // Detect @ruby:class, @ruby:initialize, and @ruby:module comments
        let classComment = null;
        const moduleComments = {}; // moduleName -> user comment text
        const otherComments = [];
        for (const comment of comments) {
            if (comment === '@ruby:class' || comment.startsWith('@ruby:class:')) {
                classComment = comment;
            } else if (comment.startsWith('@ruby:initialize')) {
                // Consumed by _generateInitialize in class-wrapper — skip
            } else {
                // Check for module comment: "user text\n@ruby:module:ModuleName"
                const moduleMatch = comment.match(/@ruby:module:(\S+)/);
                if (moduleMatch) {
                    const moduleName = moduleMatch[1];
                    const userText = comment.split('\n')
                        .filter(line => !line.startsWith('@ruby:'))
                        .join('\n');
                    if (userText.trim().length > 0) {
                        moduleComments[moduleName] = userText;
                    }
                } else {
                    otherComments.push(comment);
                }
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
                    // Prepend user comment if present
                    if (moduleComments[moduleName]) {
                        moduleCode += `${this.prefixLines(moduleComments[moduleName], '# ')}\n`;
                    }
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
            // Version 2: auto-wrap with class (both sprite and stage).
            // Wrap even with no scripts when the target has variables/lists (or
            // an @ruby:initialize comment) to initialize — e.g. a Stage that
            // only holds global lists used by sprites. Without this the
            // def initialize is dropped and globals such as $最短経路 stay nil.
            // v1 emits the equivalent via Stage.new(lists: [...]).
            if (code.length > 0 || this._hasInitializableState(this.currentTarget)) {
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

    Generator.initTargets = function (options) {
        this._options = options || {};
        this.requires_ = {};
        this.prepares_ = {};

        if (options && Object.prototype.hasOwnProperty.call(options, 'requires')) {
            options.requires.forEach(name => {
                this.requires_[`require__${name}`] = `require "${name}"`;
            });
        }
    };

    Generator.finishTargets = function (code, _options) {
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
        // Extract all module...end blocks (with optional preceding comment lines),
        // keep unique ones, place them before class definitions.
        const moduleRegex = /^(?:#[^\n]*\n)*module (\w+)\n[\s\S]*?^end\n/gm;
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

    return Generator;
}
