const OPEN_MENU = 'scratch-gui/menus/OPEN_MENU';
const CLOSE_MENU = 'scratch-gui/menus/CLOSE_MENU';
const TOGGLE_MENU = 'scratch-gui/menus/TOGGLE_MENU';

const MENU_ABOUT = 'aboutMenu';
const MENU_ACCOUNT = 'accountMenu';
const MENU_EDIT = 'editMenu';
const MENU_FILE = 'fileMenu';
const MENU_LANGUAGE = 'languageMenu';
const MENU_LOGIN = 'loginMenu';
const MENU_MODE = 'modeMenu';
const MENU_SETTINGS = 'settingsMenu';
const MENU_COLOR_MODE = 'colorModeMenu';
const MENU_THEME = 'themeMenu';
const MENU_RUBY_VERSION = 'rubyVersionMenu';
// === Smalruby: Start of display mode menu ===
const MENU_DISPLAY_MODE = 'displayModeMenu';
// === Smalruby: End of display mode menu ===
const MENU_KOSHIEN = 'koshienMenu';
const MENU_MESH_V2 = 'meshV2Menu';
const MENU_SMALRUBOT_S1 = 'smalrubotS1Menu';

class Menu {
    constructor (id) {
        this.id = id;
        this.children = [];
        this.parent = null;
    }

    addChild (menu) {
        this.children.push(menu);
        menu.parent = this;
        return this;
    }

    descendants () {
        return this.children.flatMap(child => [child, ...child.descendants()]);
    }

    siblings () {
        if (!this.parent) return [];

        return this.parent.children.filter(child => child.id !== this.id);
    }

    findById (id) {
        if (this.id === id) return this;

        for (const child of this.children) {
            const found = child.findById(id);
            if (found) return found;
        }

        return null;
    }
}

// Structure of nested menus, used for collapsing submenus logic.
const rootMenu = new Menu('root')
    .addChild(
        new Menu(MENU_SETTINGS)
            .addChild(new Menu(MENU_LANGUAGE))
            .addChild(new Menu(MENU_COLOR_MODE))
            .addChild(new Menu(MENU_THEME))
            .addChild(new Menu(MENU_RUBY_VERSION))
            // === Smalruby: Start of display mode menu ===
            .addChild(new Menu(MENU_DISPLAY_MODE))
            // === Smalruby: End of display mode menu ===
    )
    .addChild(new Menu(MENU_FILE))
    .addChild(new Menu(MENU_EDIT))
    .addChild(new Menu(MENU_MODE))
    .addChild(new Menu(MENU_SETTINGS))
    .addChild(new Menu(MENU_LOGIN))
    .addChild(new Menu(MENU_ACCOUNT))
    .addChild(new Menu(MENU_ABOUT))
    .addChild(new Menu(MENU_KOSHIEN))
    .addChild(new Menu(MENU_MESH_V2))
    .addChild(new Menu(MENU_SMALRUBOT_S1));

const initialState = {
    [MENU_ABOUT]: false,
    [MENU_ACCOUNT]: false,
    [MENU_EDIT]: false,
    [MENU_FILE]: false,
    [MENU_LANGUAGE]: false,
    [MENU_LOGIN]: false,
    [MENU_MODE]: false,
    [MENU_SETTINGS]: false,
    [MENU_COLOR_MODE]: false,
    [MENU_THEME]: false,
    [MENU_RUBY_VERSION]: false,
    // === Smalruby: Start of display mode menu ===
    [MENU_DISPLAY_MODE]: false,
    // === Smalruby: End of display mode menu ===
    [MENU_KOSHIEN]: false,
    [MENU_MESH_V2]: false,
    [MENU_SMALRUBOT_S1]: false
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case OPEN_MENU: {
        const menu = rootMenu.findById(action.menu);
        // Close siblings when opening a menu
        const toClose = menu.siblings().flatMap(sibling => [sibling, ...sibling.descendants()]);

        return {
            ...state,
            [action.menu]: true,
            ...Object.fromEntries(toClose.map(({id}) => [id, false]))
        };
    }
    case CLOSE_MENU: {
        const menu = rootMenu.findById(action.menu);
        // Close this menu and any submenus
        const toClose = [menu, ...menu.descendants()];

        return {
            ...state,
            ...Object.fromEntries(toClose.map(({id}) => [id, false]))
        };
    }
    case TOGGLE_MENU: {
        const menu = rootMenu.findById(action.menu);
        if (state[action.menu]) {
            // Currently open: close this menu and any submenus
            const toClose = [menu, ...menu.descendants()];
            return {
                ...state,
                ...Object.fromEntries(toClose.map(({id}) => [id, false]))
            };
        }
        // Currently closed: open it, closing siblings
        const toClose = menu.siblings().flatMap(sibling => [sibling, ...sibling.descendants()]);
        return {
            ...state,
            [action.menu]: true,
            ...Object.fromEntries(toClose.map(({id}) => [id, false]))
        };
    }
    default:
        return state;
    }
};
const openMenu = menu => ({
    type: OPEN_MENU,
    menu: menu
});
const closeMenu = menu => ({
    type: CLOSE_MENU,
    menu: menu
});
const toggleMenu = menu => ({
    type: TOGGLE_MENU,
    menu: menu
});

const openAboutMenu = () => openMenu(MENU_ABOUT);
const closeAboutMenu = () => closeMenu(MENU_ABOUT);
const aboutMenuOpen = state => state.scratchGui.menus[MENU_ABOUT];

const openAccountMenu = () => openMenu(MENU_ACCOUNT);
const closeAccountMenu = () => closeMenu(MENU_ACCOUNT);
const accountMenuOpen = state => state.scratchGui.menus[MENU_ACCOUNT];

const openEditMenu = () => openMenu(MENU_EDIT);
const closeEditMenu = () => closeMenu(MENU_EDIT);
const toggleEditMenu = () => toggleMenu(MENU_EDIT);
const editMenuOpen = state => state.scratchGui.menus[MENU_EDIT];

const openFileMenu = () => openMenu(MENU_FILE);
const closeFileMenu = () => closeMenu(MENU_FILE);
const toggleFileMenu = () => toggleMenu(MENU_FILE);
const fileMenuOpen = state => state.scratchGui.menus[MENU_FILE];

const openLanguageMenu = () => openMenu(MENU_LANGUAGE);
const closeLanguageMenu = () => closeMenu(MENU_LANGUAGE);
const languageMenuOpen = state => state.scratchGui.menus[MENU_LANGUAGE];

const openLoginMenu = () => openMenu(MENU_LOGIN);
const closeLoginMenu = () => closeMenu(MENU_LOGIN);
const loginMenuOpen = state => state.scratchGui.menus[MENU_LOGIN];

const openModeMenu = () => openMenu(MENU_MODE);
const closeModeMenu = () => closeMenu(MENU_MODE);
const modeMenuOpen = state => state.scratchGui.menus[MENU_MODE];

const openSettingsMenu = () => openMenu(MENU_SETTINGS);
const closeSettingsMenu = () => closeMenu(MENU_SETTINGS);
const toggleSettingsMenu = () => toggleMenu(MENU_SETTINGS);
const settingsMenuOpen = state => state.scratchGui.menus[MENU_SETTINGS];

const openColorModeMenu = () => openMenu(MENU_COLOR_MODE);
const closeColorModeMenu = () => closeMenu(MENU_COLOR_MODE);
const colorModeMenuOpen = state => state.scratchGui.menus[MENU_COLOR_MODE];

const openThemeMenu = () => openMenu(MENU_THEME);
const closeThemeMenu = () => closeMenu(MENU_THEME);
const themeMenuOpen = state => state.scratchGui.menus[MENU_THEME];

const openRubyVersionMenu = () => openMenu(MENU_RUBY_VERSION);
const closeRubyVersionMenu = () => closeMenu(MENU_RUBY_VERSION);
const rubyVersionMenuOpen = state => state.scratchGui.menus[MENU_RUBY_VERSION];

// === Smalruby: Start of display mode menu ===
const openDisplayModeMenu = () => openMenu(MENU_DISPLAY_MODE);
const closeDisplayModeMenu = () => closeMenu(MENU_DISPLAY_MODE);
const displayModeMenuOpen = state => state.scratchGui.menus[MENU_DISPLAY_MODE];
// === Smalruby: End of display mode menu ===

const openKoshienMenu = () => openMenu(MENU_KOSHIEN);
const closeKoshienMenu = () => closeMenu(MENU_KOSHIEN);
const koshienMenuOpen = state => state.scratchGui.menus[MENU_KOSHIEN];

const openMeshV2Menu = () => openMenu(MENU_MESH_V2);
const closeMeshV2Menu = () => closeMenu(MENU_MESH_V2);
const meshV2MenuOpen = state => state.scratchGui.menus[MENU_MESH_V2];

const openSmalrubotS1Menu = () => openMenu(MENU_SMALRUBOT_S1);
const closeSmalrubotS1Menu = () => closeMenu(MENU_SMALRUBOT_S1);
const smalrubotS1MenuOpen = state => state.scratchGui.menus[MENU_SMALRUBOT_S1];

export {
    reducer as default,
    initialState as menuInitialState,
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openAccountMenu,
    closeAccountMenu,
    accountMenuOpen,
    openEditMenu,
    closeEditMenu,
    toggleEditMenu,
    editMenuOpen,
    openFileMenu,
    closeFileMenu,
    toggleFileMenu,
    fileMenuOpen,
    openLanguageMenu,
    closeLanguageMenu,
    languageMenuOpen,
    openLoginMenu,
    closeLoginMenu,
    loginMenuOpen,
    openModeMenu,
    closeModeMenu,
    modeMenuOpen,
    openSettingsMenu,
    closeSettingsMenu,
    toggleSettingsMenu,
    settingsMenuOpen,
    openColorModeMenu,
    closeColorModeMenu,
    colorModeMenuOpen,
    openThemeMenu,
    closeThemeMenu,
    themeMenuOpen,
    openRubyVersionMenu,
    closeRubyVersionMenu,
    rubyVersionMenuOpen,
    // === Smalruby: Start of display mode menu ===
    openDisplayModeMenu,
    closeDisplayModeMenu,
    displayModeMenuOpen,
    // === Smalruby: End of display mode menu ===
    openKoshienMenu,
    closeKoshienMenu,
    koshienMenuOpen,
    openMeshV2Menu,
    closeMeshV2Menu,
    meshV2MenuOpen,
    openSmalrubotS1Menu,
    closeSmalrubotS1Menu,
    smalrubotS1MenuOpen
};
