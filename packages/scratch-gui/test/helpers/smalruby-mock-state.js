/**
 * Smalruby-specific mock state helper for Redux store tests
 *
 * This file provides a centralized helper for getting Smalruby state properties
 * in test mocks. When new Smalruby reducers are added to smalruby-registry.ts,
 * update this helper to include the new state properties.
 *
 * Usage in tests:
 *   const {getSmalrubyMockState} = require('../../helpers/smalruby-mock-state');
 *   const mockStore = {
 *       ...upstreamState,
 *       ...getSmalrubyMockState()
 *   };
 */

/**
 * Get Smalruby-specific mock state for Redux store tests
 * @returns {Object} Smalruby state properties with empty initial values
 */
const getSmalrubyMockState = () => ({
    tutorialOnboarding: {},
    meshV2: {},
    googleDriveFile: {},
    koshienFile: {},
    rubyCode: {},
    cards: {}
});

module.exports = {
    getSmalrubyMockState
};
