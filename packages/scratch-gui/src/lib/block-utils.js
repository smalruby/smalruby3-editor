/**
 * @fileoverview Utility functions and constants for block handling
 */

// Define blocks for each category based on make-toolbox-xml.js
export const CATEGORY_BLOCKS = {
    motion: [
        'motion_movesteps',
        'motion_turnright',
        'motion_turnleft',
        'motion_goto',
        'motion_gotoxy',
        'motion_glideto',
        'motion_glidesecstoxy',
        'motion_pointindirection',
        'motion_pointtowards',
        'motion_changexby',
        'motion_setx',
        'motion_changeyby',
        'motion_sety',
        'motion_ifonedgebounce',
        'motion_setrotationstyle'
    ],
    looks: [
        'looks_sayforsecs',
        'looks_say',
        'looks_thinkforsecs',
        'looks_think',
        'looks_switchcostumeto',
        'looks_nextcostume',
        'looks_switchbackdropto',
        'looks_nextbackdrop',
        'looks_changesizeby',
        'looks_setsizeto',
        'looks_changeeffectby',
        'looks_seteffectto',
        'looks_cleargraphiceffects',
        'looks_show',
        'looks_hide',
        'looks_gotofrontback',
        'looks_goforwardbackwardlayers',
        'looks_costumenumbername',
        'looks_backdropnumbername',
        'looks_size',
        // for Stage
        'looks_switchbackdroptoandwait'
    ],
    sound: [
        'sound_playuntildone',
        'sound_play',
        'sound_stopallsounds',
        'sound_changeeffectby',
        'sound_seteffectto',
        'sound_cleareffects',
        'sound_changevolumeby',
        'sound_setvolumeto'
    ],
    events: [
        'event_whenflagclicked',
        'event_whenkeypressed',
        'event_whenthisspriteclicked',
        'event_whenbackdropswitchesto',
        'event_whengreaterthan',
        'event_whenbroadcastreceived',
        'event_broadcast',
        'event_broadcastandwait'
    ],
    control: [
        'control_wait',
        'control_repeat',
        'control_forever',
        'control_if',
        'control_if_else',
        'control_wait_until',
        'control_repeat_until',
        'control_stop',
        'control_start_as_clone',
        'control_create_clone_of',
        'control_delete_this_clone'
    ],
    sensing: [
        'sensing_touchingobject',
        'sensing_touchingcolor',
        'sensing_coloristouchingcolor',
        'sensing_distanceto',
        'sensing_askandwait',
        'sensing_answer',
        'sensing_keypressed',
        'sensing_mousedown',
        'sensing_mousex',
        'sensing_mousey',
        'sensing_setdragmode',
        'sensing_loudness',
        'sensing_timer',
        'sensing_resettimer',
        'sensing_of',
        'sensing_current',
        'sensing_dayssince2000',
        'sensing_username'
    ],
    operators: [
        'operator_add',
        'operator_subtract',
        'operator_multiply',
        'operator_divide',
        'operator_random',
        'operator_gt',
        'operator_lt',
        'operator_equals',
        'operator_and',
        'operator_or',
        'operator_not',
        'operator_join',
        'operator_letter_of',
        'operator_length',
        'operator_contains',
        'operator_mod',
        'operator_round',
        'operator_mathop'
    ]
};

/**
 * Generate ordered list of all blocks based on CATEGORY_BLOCKS definition
 * @returns {Array} - Ordered array of all block IDs
 */
export const generateBlockOrder = function () {
    const blockOrder = [];
    const categoryOrder = ['motion', 'looks', 'sound', 'events', 'control', 'sensing', 'operators'];
    
    categoryOrder.forEach(categoryId => {
        const categoryBlocks = CATEGORY_BLOCKS[categoryId] || [];
        blockOrder.push(...categoryBlocks);
    });
    
    return blockOrder;
};

/**
 * Parse hex format only_blocks parameter and return selected blocks object
 * @param {string} hexString - Hex string starting with '0'
 * @returns {object} - Selected blocks object with categories
 */
export const parseHexFormatToSelectedBlocks = function (hexString) {
    const selectedBlocks = {};
    
    // Always initialize each category
    Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
        selectedBlocks[categoryId] = [];
    });
    
    // Parse hex format
    const hexData = hexString.slice(1); // Remove leading '0'
    
    // Convert hex to binary (reverse bit order within each hex digit for proper bit indexing)
    let binaryString = '';
    for (let i = 0; i < hexData.length; i++) {
        const hexDigit = hexData[i];
        const decimal = parseInt(hexDigit, 16);
        const binary = decimal.toString(2).padStart(4, '0');
        // Reverse the binary string to match bit ordering (LSB first)
        const reversedBinary = binary.split('')
            .reverse()
            .join('');
        binaryString += reversedBinary;
    }
    
    // Get the ordered list of all blocks
    const blockOrder = generateBlockOrder();
    
    // Map binary bits to block selections
    for (let i = 0; i < Math.min(binaryString.length, blockOrder.length); i++) {
        const bit = binaryString[i];
        const blockId = blockOrder[i];
        
        if (bit === '1') {
            // Find which category this block belongs to
            Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
                const categoryBlocks = CATEGORY_BLOCKS[categoryId] || [];
                if (categoryBlocks.includes(blockId)) {
                    if (!selectedBlocks[categoryId].includes(blockId)) {
                        selectedBlocks[categoryId].push(blockId);
                    }
                }
            });
        }
    }
    
    return selectedBlocks;
};

/**
 * Initialize block selection from only_blocks parameter
 * @param {string} onlyBlocks - The only_blocks parameter value
 * @returns {object} - Selected blocks object with categories initialized based on only_blocks
 */
export const initializeBlockSelectionFromOnlyBlocks = onlyBlocks => {
    const selectedBlocks = {};

    // Always initialize each category
    Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
        selectedBlocks[categoryId] = [];
    });

    // If no onlyBlocks parameter provided (null/undefined), select all blocks (default behavior)
    if (onlyBlocks === null || typeof onlyBlocks === 'undefined') {
        Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
            selectedBlocks[categoryId] = [...CATEGORY_BLOCKS[categoryId]];
        });
        return selectedBlocks;
    }

    // If empty string provided, return empty selections
    if (!onlyBlocks) return selectedBlocks;

    // Check if hex format (starts with '0')
    if (onlyBlocks.startsWith('0') && onlyBlocks.length > 1) {
        return parseHexFormatToSelectedBlocks(onlyBlocks);
    }

    // Parse only_blocks parameter (legacy format)
    const patterns = onlyBlocks.split(/[,.]/)
        .map(pattern => pattern.trim())
        .filter(pattern => pattern.length > 0);

    // Process patterns to determine which blocks should be initially selected
    patterns.forEach(pattern => {
        Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
            const categoryBlocks = CATEGORY_BLOCKS[categoryId] || [];

            // Check if pattern matches category prefix (e.g., "motion_" matches motion category)
            if (pattern.endsWith('_') && pattern === `${categoryId}_`) {
                // Select all blocks in this category
                selectedBlocks[categoryId] = [...categoryBlocks];
            } else if (categoryBlocks.includes(pattern)) {
                // Select specific block if it exists in this category
                if (!selectedBlocks[categoryId].includes(pattern)) {
                    selectedBlocks[categoryId].push(pattern);
                }
            }
        });
    });

    return selectedBlocks;
};
