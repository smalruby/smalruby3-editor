import {filterBlocks} from '../../../src/lib/make-toolbox-xml';

describe('make-toolbox-xml', () => {
    describe('filterBlocks', () => {
        const sampleCategoryXML = `<category name="Motion" colour="#4C97FF" secondaryColour="#3373CC">
        <block type="motion_movesteps">
            <value name="STEPS">
                <shadow type="math_number">
                    <field name="NUM">10</field>
                </shadow>
            </value>
        </block>
        <sep gap="36"/>
        <block type="motion_turnright">
            <value name="DEGREES">
                <shadow type="math_number">
                    <field name="NUM">15</field>
                </shadow>
            </value>
        </block>
        <sep gap="36"/>
        <block type="motion_turnleft">
            <value name="DEGREES">
                <shadow type="math_number">
                    <field name="NUM">15</field>
                </shadow>
            </value>
        </block>
        <sep gap="36"/>
        <block type="motion_goto">
            <value name="TO">
                <shadow type="motion_goto_menu">
                </shadow>
            </value>
        </block>
        <category-separator/>
    </category>`;

        test('should preserve blockSeparator when filtering blocks', () => {
            const allowedPatterns = ['motion_movesteps', 'motion_turnright'];
            const result = filterBlocks(sampleCategoryXML, allowedPatterns);

            // Should contain blockSeparator between allowed blocks
            expect(result).toContain('<sep gap="36"/>');
            
            // Should contain both allowed blocks
            expect(result).toContain('motion_movesteps');
            expect(result).toContain('motion_turnright');
            
            // Should not contain filtered out blocks
            expect(result).not.toContain('motion_turnleft');
            expect(result).not.toContain('motion_goto');
        });

        test('should consolidate consecutive blockSeparators', () => {
            // Test case where filtering creates consecutive separators
            const allowedPatterns = ['motion_movesteps', 'motion_goto']; // Skip middle blocks
            const result = filterBlocks(sampleCategoryXML, allowedPatterns);

            // Should have one separator between blocks and one categorySeparator at the end
            // Note: both blockSeparator and categorySeparator use the same XML format
            const separatorMatches = result.match(/<sep gap="36"\/>/g) || [];
            expect(separatorMatches.length).toBe(2); // One between blocks, one at category end

            expect(result).toContain('motion_movesteps');
            expect(result).toContain('motion_goto');
            expect(result).not.toContain('motion_turnright');
            expect(result).not.toContain('motion_turnleft');
        });

        test('should remove separators at beginning and end', () => {
            const xmlWithLeadingSeparator = `<category name="Motion">
        <sep gap="36"/>
        <block type="motion_movesteps"></block>
        <sep gap="36"/>
        <block type="motion_turnright"></block>
        <sep gap="36"/>
        <category-separator/>
    </category>`;

            const allowedPatterns = ['motion_movesteps'];
            const result = filterBlocks(xmlWithLeadingSeparator, allowedPatterns);

            // Should not start or end with separator
            expect(result).not.toMatch(/^\s*<category[^>]*>\s*<sep/);
            expect(result).not.toMatch(/<sep[^>]*\/>\s*<category-separator/);
            
            expect(result).toContain('motion_movesteps');
            expect(result).not.toContain('motion_turnright');
        });

        test('should return empty string when no blocks match', () => {
            const allowedPatterns = ['nonexistent_block'];
            const result = filterBlocks(sampleCategoryXML, allowedPatterns);

            expect(result).toBe('');
        });

        test('should return original XML when no patterns provided', () => {
            const result = filterBlocks(sampleCategoryXML, []);
            expect(result).toBe(sampleCategoryXML);
        });

        test('should handle XML without separators', () => {
            const xmlWithoutSeparators = `<category name="Motion">
        <block type="motion_movesteps"></block>
        <block type="motion_turnright"></block>
        <category-separator/>
    </category>`;

            const allowedPatterns = ['motion_movesteps'];
            const result = filterBlocks(xmlWithoutSeparators, allowedPatterns);

            expect(result).toContain('motion_movesteps');
            expect(result).not.toContain('motion_turnright');
            expect(result).not.toContain('<sep gap="36"/>');
        });
    });
});