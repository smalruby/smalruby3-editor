/**
 * @fileoverview Test for hex format parsing in make-toolbox-xml.js
 */

import makeToolboxXML from '../../src/lib/make-toolbox-xml.js';

describe('make-toolbox-xml hex format parsing', () => {
    test('should parse hex format and filter blocks correctly', () => {
        // Test hex format: 00048ffffffffffffffffffff7
        // This should select motion_setx + all other category blocks
        
        const result = makeToolboxXML(
            false, // isInitialSetup
            false, // isStage
            'target1', // targetId
            [], // categoriesXML
            'costume1', // costumeName
            'backdrop1', // backdropName
            'sound1', // soundName
            {
                motion: {primary: '#4C97FF', secondary: '#4280D7', tertiary: '#3373CC'},
                looks: {primary: '#9966FF', secondary: '#8A5CF5', tertiary: '#7C4DFF'},
                sounds: {primary: '#CF63CF', secondary: '#C94FC9', tertiary: '#BD42BD'},
                event: {primary: '#FFBF00', secondary: '#E6AC00', tertiary: '#CC9900'},
                control: {primary: '#FFAB19', secondary: '#EC9C13', tertiary: '#CF8B17'},
                sensing: {primary: '#5CB3D3', secondary: '#47A8D1', tertiary: '#2E8EB8'},
                operators: {primary: '#59C059', secondary: '#46B946', tertiary: '#389438'},
                data: {primary: '#FF8C1A', secondary: '#FF8000', tertiary: '#DB6E00'},
                more: {primary: '#FF6680', secondary: '#FF4D6A', tertiary: '#C94D4A'}
            }, // colors
            '00048ffffffffffffffffffff7', // onlyBlocks - hex format
            true // isOnlyBlocksSpecified
        );
        
        // The result should contain motion_setx block but not other motion blocks
        expect(result).toContain('type="motion_setx"');
        expect(result).not.toContain('type="motion_movesteps"');
        
        // The result should contain blocks from other categories
        expect(result).toContain('type="looks_say"');
        expect(result).toContain('type="sound_play"');
        expect(result).toContain('type="event_whenflagclicked"');
        expect(result).toContain('type="control_wait"');
        expect(result).toContain('type="sensing_touchingobject"');
        expect(result).toContain('type="operator_add"');
    });
});