// === Smalruby: This file is Smalruby-specific (v1 Sprite.new code generator for RubyGenerator) ===

const SCALAR_TYPE = '';
const LIST_TYPE = 'list';

/**
 * Register the spriteNew method on the RubyGenerator.
 * Generates Sprite.new(...) / Stage.new(...) code for v1 file output format.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    Generator.spriteNew = function (renderedTarget) {
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

    return Generator;
}
