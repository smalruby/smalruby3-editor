/**
 * Smalruby-specific Redux state registry
 *
 * This file centralizes all Smalruby customizations to Redux state management.
 * By importing from this single registry file, we minimize merge conflicts when
 * updating from upstream scratch-gui.
 *
 * When adding new Smalruby reducers:
 * 1. Add the import statement here
 * 2. Add to smalrubyReducers object
 * 3. Add to smalrubyInitialState object
 *
 * No changes needed in gui.ts - it imports this registry.
 */
import cardsReducer, { cardsInitialState } from './cards';
import classroomReducer, { classroomInitialState } from './classroom';
import classroomTutorialReducer, { classroomTutorialInitialState } from './classroom-tutorial';
import dnclModeReducer, { dnclModeInitialState } from './dncl-mode';
import googleDriveFileReducer, { googleDriveFileInitialState } from './google-drive-file';
import koshienFileReducer, { koshienFileInitialState } from './koshien-file';
import meshV2Reducer, { meshV2InitialState } from './mesh-v2';
import paletteVisibilityReducer, { initialState as paletteVisibilityInitialState } from './palette-visibility';
import rubyCodeReducer, { rubyCodeInitialState } from './ruby-code';
import smalrubotFirmwareReducer, { smalrubotFirmwareInitialState } from './smalrubot-firmware';
import tutorialOnboardingReducer, { tutorialOnboardingInitialState } from './tutorial-onboarding';

/**
 * All Smalruby reducers
 * These will be spread into combineReducers() in gui.ts
 */
export const smalrubyReducers = {
    classroom: classroomReducer,
    classroomTutorial: classroomTutorialReducer,
    dnclMode: dnclModeReducer,
    meshV2: meshV2Reducer,
    googleDriveFile: googleDriveFileReducer,
    koshienFile: koshienFileReducer,
    rubyCode: rubyCodeReducer,
    smalrubotFirmware: smalrubotFirmwareReducer,
    cards: cardsReducer,
    tutorialOnboarding: tutorialOnboardingReducer,
    paletteVisibility: paletteVisibilityReducer,
};

/**
 * All Smalruby initial state values
 * These will be spread into buildInitialState() in gui.ts
 */
export const smalrubyInitialState = {
    classroom: classroomInitialState,
    classroomTutorial: classroomTutorialInitialState,
    dnclMode: dnclModeInitialState,
    meshV2: meshV2InitialState,
    googleDriveFile: googleDriveFileInitialState,
    koshienFile: koshienFileInitialState,
    rubyCode: rubyCodeInitialState,
    smalrubotFirmware: smalrubotFirmwareInitialState,
    cards: cardsInitialState,
    tutorialOnboarding: tutorialOnboardingInitialState,
    paletteVisibility: paletteVisibilityInitialState,
};
