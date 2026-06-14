const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const TargetType = require('../../extension-support/target-type');
const Variable = require('../../engine/variable');
const RemoteClient = require('./remote-client.js');
const mapUtils = require('./map-utils');

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */
 
const blockIconURI = 'data:image/png;base64,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';

let formatMessage = require('format-message');
const translations = require('./translations.json');

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'koshien';

/**
 * Enum for item.
 * @readonly
 * @enum {string}
 */
const KoshienItemName = {
    DYNAMITE: 'dynamite',
    BOMB: 'bomb'
};

/**
 * Enum for coordinate.
 * @readonly
 * @enum {string}
 */
const KoshienCoordinateName = {
    POSITION: 'position',
    X: 'x',
    Y: 'y'
};

/**
 * Enum for target.
 * @readonly
 * @enum {string}
 */
const KoshienTargetName = {
    OTHER: 'other_player',
    ENEMY: 'enemy',
    GOAL: 'goal',
    PLAYER: 'player'
};

/**
 * Enum for object
 * @readonly
 * @enum {string}
 */
const KoshienObjectName = {
    UNKNOWN: 'unknown',
    SPACE: 'space',
    WALL: 'wall',
    STOREHOUSE: 'storehouse',
    GOAL: 'goal',
    WATER: 'water',
    BREAKABLE_WALL: 'breakable wall',
    TEA: 'tea',
    SWEETS: 'sweets',
    COIN: 'COIN',
    DOLPHIN: 'dolphin',
    SWORD: 'sword',
    POISON: 'poison',
    SNAKE: 'snake',
    TRAP: 'trap',
    BOMB: 'bomb'
};

/**
 * A fixed, believable 17x17 sample map used by the mock (disconnected) client.
 *
 * This is the real Smalruby Koshien 2024 sample map ("map_01") with its item
 * layer merged in, so that clicking any block while editing an AI offline
 * returns game-like, self-consistent data instead of placeholder zeros. It is
 * the single source of truth from which every mock reader derives its value.
 *
 * The whole 17x17 field is surrounded by an unbreakable wall border (codes 1/2;
 * the original map uses 2 on the top/left edge and 1 on the bottom/right edge).
 * Cell codes: 0 space, 1/2 unbreakable wall, 3 goal, 4 water, 5 breakable wall;
 * a-e beneficial items, A-D harmful items (matching the real my_map encoding).
 * @type {Array<string>}
 */
const MOCK_MAP = [
    '22222222222222222',
    '2d0000000000000a1',
    '200A4440B4440A001',
    '20055555555555001',
    '200000C0000000001',
    '20100b00000C00101',
    '201055505550001c1',
    '20105000005000101',
    '201050000050b0101',
    '20105000305000101',
    '2c1050c00050C0101',
    '20105555055000101',
    '20000000000000001',
    '20455555D55555401',
    '24000B00000B00041',
    '204d0000e0000d401',
    '21111111111111111'
];

/**
 * Initial actor positions for the mock world, taken from the real map_01:
 * the two player start cells are (5,1) and (10,1), the goal cell ('3') is at
 * (8,9), and the enemy guards the goal. Kept consistent with MOCK_MAP.
 * @type {object}
 */
const MOCK_INITIAL_POSITIONS = {
    player: '5:1',
    goal: '8:9',
    enemy: '8:9',
    other_player: '10:1'
};

/**
 * Base class describing the surface a Koshien client must implement.
 *
 * Block methods talk to the game only through this interface, so the concrete
 * implementation can be swapped between a mock (fixed values, used while
 * disconnected) and a future remote client that speaks to a real game server.
 */
class KoshienClient {
    /**
     * Construct a Client of Smalruby Koshien game server.
     * @param {Runtime} runtime - the Scratch 3.0 runtime
     * @param {string} extensionId - the id of the extension
     */
    constructor (runtime, extensionId) {

        /**
         * The Scratch 3.0 runtime used to trigger the green flag button.
         * @type {Runtime}
         * @private
         */
        this.runtime = runtime;

        /**
         * The id of the extension this client belongs to.
         */
        this._extensionId = extensionId;

        this._isConnected = false;
        this._playerName = null;
    }

    isConnected () {
        return this._isConnected;
    }

    connect (playerName) {
        this._playerName = playerName;
        this._isConnected = true;
    }

    // --- Interface (overridden by concrete clients) ---

    getMapArea () {}

    moveTo () {
        return Promise.resolve();
    }

    setItem () {}

    setMessage () {
        return Promise.resolve();
    }

    turnOver () {}

    map () {
        return -1;
    }

    mapAll () {
        return '';
    }

    mapFrom () {
        return -1;
    }

    calcRoute () {
        return [];
    }

    locateObjects () {
        return [];
    }

    targetCoordinate () {
        return null;
    }
}

/**
 * Mock client used while not connected to a real game server.
 *
 * It simulates a believable game on top of {@link MOCK_MAP} the same way the
 * real server does: the player's "my map" starts fully unexplored (all -1) and
 * is revealed 5x5 at a time by {@link getMapArea}. Readers (map / map_all /
 * calc_route / locate_objects) all work off this gradually-revealed my map, so
 * clicking blocks offline behaves like a real game in progress. Player moves
 * and placed items update a small amount of state. Everything is deterministic
 * and resets to the initial state.
 */
class MockClient extends KoshienClient {
    /**
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     * @param {string} extensionId - the id of the extension.
     */
    constructor (runtime, extensionId) {
        super(runtime, extensionId);
        this.reset();
    }

    /**
     * Restore the mock world to its initial state: a fresh ground-truth map and
     * a fully-unexplored "my map".
     */
    reset () {
        this._fullGrid = mapUtils.parseMapString(MOCK_MAP.join(','));
        const height = this._fullGrid.length;
        const width = height ? this._fullGrid[0].length : 0;
        this._grid = mapUtils.createUnexploredGrid(width, height);
        this._positions = Object.assign({}, MOCK_INITIAL_POSITIONS);
        this._turn = 0;
    }

    connect (playerName) {
        super.connect(playerName);
        // Connecting starts a fresh game session.
        this.reset();
    }

    /**
     * Reveal the 5x5 area around a position into the player's my map.
     * @param {string} position - the "x:y" center of the area to reveal.
     */
    getMapArea (position) {
        mapUtils.revealArea(this._grid, this._fullGrid, position, 5);
    }

    /**
     * @param {string} position - the queried "x:y" position.
     * @returns {(number|string)} - the my-map cell (-1 when unexplored).
     */
    map (position) {
        const p = mapUtils.parsePosition(position);
        return mapUtils.cellAt(this._grid, p.x, p.y);
    }

    /**
     * @returns {string} - the player's my map as a "row,row,..." string
     *     ('-' marks cells not yet revealed by getMapArea).
     */
    mapAll () {
        return mapUtils.gridToMapString(this._grid);
    }

    /**
     * Read a cell out of a map string previously obtained from {@link mapAll}.
     * @param {string} position - the queried "x:y" position.
     * @param {string} mapString - a map string ("row,row,...", '-' = unexplored).
     * @returns {(number|string)} - the cell value (-1 when it cannot be resolved).
     */
    mapFrom (position, mapString) {
        if (typeof mapString !== 'string' || mapString.length === 0) {
            return -1;
        }
        const grid = mapUtils.parseMapString(mapString);
        const p = mapUtils.parsePosition(position);
        return mapUtils.cellAt(grid, p.x, p.y);
    }

    /**
     * @param {object} props - {src, dst, exceptCells}; src/dst default to the
     *     current player/goal positions when omitted. Routes over the my map,
     *     so unexplored cells are treated as passable (like the real game).
     * @returns {Array<string>} - the shortest route as "x:y" strings.
     */
    calcRoute (props) {
        const {src, dst, exceptCells} = props || {};
        const start = src && String(src).includes(':') ? src : this._positions.player;
        const goal = dst && String(dst).includes(':') ? dst : this._positions.goal;
        return mapUtils.calcRoute(this._grid, start, goal, exceptCells || []);
    }

    /**
     * @param {object} props - {position, sqSize, objects}; position defaults to
     *     the current player position when omitted. Scans the my map, so only
     *     already-revealed items are found (like the real game).
     * @returns {Array<string>} - the "x:y" positions of the matching objects.
     */
    locateObjects (props) {
        const {position, sqSize, objects} = props || {};
        const center =
            position && String(position).includes(':') ? position : this._positions.player;
        return mapUtils.locateObjects(this._grid, center, sqSize, objects);
    }

    /**
     * @param {string} target - one of player/goal/other_player/enemy.
     * @param {string} coordinate - one of position/x/y.
     * @returns {string|number|null} - the requested coordinate, or null.
     */
    targetCoordinate (target, coordinate) {
        const pos = this._positions[target];
        if (!pos) {
            return null;
        }
        const p = mapUtils.parsePosition(pos);
        if (coordinate === 'x') {
            return p.x;
        }
        if (coordinate === 'y') {
            return p.y;
        }
        return pos;
    }

    /**
     * Pseudo-move the mock player so subsequent reads reflect the new position.
     * Passability is checked against the ground-truth map (a real wall blocks
     * the move even if that cell has not been revealed yet).
     * @param {string} position - the destination "x:y".
     * @returns {Promise} - resolved once the (instant) move is applied.
     */
    moveTo (position) {
        const p = mapUtils.parsePosition(position);
        const cell = mapUtils.cellAt(this._fullGrid, p.x, p.y);
        if (cell !== -1 && isFinite(mapUtils.moveCost(cell))) {
            this._positions.player = mapUtils.formatPosition(p.x, p.y);
        }
        return Promise.resolve();
    }

    /**
     * Pseudo-place an item on the ground-truth map (shown as a bomb marker).
     * It becomes visible in the my map once that cell is revealed by getMapArea.
     * @param {string} item - the item kind (dynamite/bomb).
     * @param {string} position - the "x:y" position.
     */
    setItem (item, position) {
        const p = mapUtils.parsePosition(position);
        if (this._fullGrid[p.y] && mapUtils.cellAt(this._fullGrid, p.x, p.y) !== -1) {
            this._fullGrid[p.y][p.x] = 'D';
        }
    }

    /**
     * Advance the mock turn counter.
     */
    turnOver () {
        this._turn += 1;
    }
}

/**
 * Scratch 3.0 blocks to make Smalruby Koshien AI.
 */
class KoshienBlocks {

    /**
     * A translation object which is used in this class.
     * @param {FormatMessage} formatter - translation object
     */
    static set formatMessage (formatter) {
        formatMessage = formatter;
        if (formatMessage) setupTranslations();
    }

    /**
     * @returns {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'koshien.name',
            default: 'Smalruby Koshien',
            description: 'name of the extension'
        });
    }

    /**
     * @returns {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    get ITEMS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'koshien.itemsMenu.dynamite',
                    default: 'dynamite',
                    description: 'label for dynamite item in item picker for koshien extension'
                }),
                value: KoshienItemName.DYNAMITE
            },
            {
                text: formatMessage({
                    id: 'koshien.itemsMenu.bomb',
                    default: 'bomb',
                    description: 'label for bomb item in item picker for koshien extension'
                }),
                value: KoshienItemName.BOMB
            }
        ];
    }

    get TARGETS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'koshien.targetsMenu.other',
                    default: 'other',
                    description: 'label for other player in target picker for koshien extension'
                }),
                value: KoshienTargetName.OTHER
            },
            {
                text: formatMessage({
                    id: 'koshien.targetsMenu.enemy',
                    default: 'enemy',
                    description: 'label for enemy in target picker for koshien extension'
                }),
                value: KoshienTargetName.ENEMY
            },
            {
                text: formatMessage({
                    id: 'koshien.targetsMenu.goal',
                    default: 'goal',
                    description: 'label for goal in target picker for koshien extension'
                }),
                value: KoshienTargetName.GOAL
            },
            {
                text: formatMessage({
                    id: 'koshien.targetsMenu.player',
                    default: 'player',
                    description: 'label for player in target picker for koshien extension'
                }),
                value: KoshienTargetName.PLAYER
            }
        ];
    }

    get COORDINATES_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'koshien.coordinatesMenu.x',
                    default: 'x',
                    description: 'label for x in coordinate picker for koshien extension'
                }),
                value: KoshienCoordinateName.X
            },
            {
                text: formatMessage({
                    id: 'koshien.coordinatesMenu.y',
                    default: 'y',
                    description: 'label for y in coordinate picker for koshien extension'
                }),
                value: KoshienCoordinateName.Y
            }
        ];
    }

    get COORDINATES_AND_POSITION_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'koshien.coordinatesMenu.position',
                    default: 'position',
                    description: 'label for position in coordinate picker for koshien extension'
                }),
                value: KoshienCoordinateName.POSITION
            }
        ].concat(this.COORDINATES_MENU);
    }

    get OBJECTS_MENU () {
        return [
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.unknown',
                    default: 'unknown',
                    description: 'label for unknown in object picker for koshien extension'
                }),
                value: KoshienObjectName.UNKNOWN
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.space',
                    default: 'space',
                    description: 'label for space in object picker for koshien extension'
                }),
                value: KoshienObjectName.SPACE
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.wall',
                    default: 'wall',
                    description: 'label for wall in object picker for koshien extension'
                }),
                value: KoshienObjectName.WALL
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.storehouse',
                    default: 'storehouse',
                    description: 'label for storehouse in object picker for koshien extension'
                }),
                value: KoshienObjectName.STOREHOUSE
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.goal',
                    default: 'goal',
                    description: 'label for goal in object picker for koshien extension'
                }),
                value: KoshienObjectName.GOAL
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.water',
                    default: 'water',
                    description: 'label for water in object picker for koshien extension'
                }),
                value: KoshienObjectName.WATER
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.breakableWall',
                    default: 'breakable wall',
                    description: 'label for breakable_wall in object picker for koshien extension'
                }),
                value: KoshienObjectName.BREAKABLE_WALL
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.tea',
                    default: 'tea',
                    description: 'label for tea in object picker for koshien extension'
                }),
                value: KoshienObjectName.TEA
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.sweets',
                    default: 'sweets',
                    description: 'label for sweets in object picker for koshien extension'
                }),
                value: KoshienObjectName.SWEETS
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.coin',
                    default: 'coin',
                    description: 'label for coin in object picker for koshien extension'
                }),
                value: KoshienObjectName.COIN
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.dolphin',
                    default: 'dolphin',
                    description: 'label for dolphin in object picker for koshien extension'
                }),
                value: KoshienObjectName.DOLPHIN
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.sword',
                    default: 'sword',
                    description: 'label for sword in object picker for koshien extension'
                }),
                value: KoshienObjectName.SWORD
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.poison',
                    default: 'poison',
                    description: 'label for poison in object picker for koshien extension'
                }),
                value: KoshienObjectName.POISON
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.snake',
                    default: 'snake',
                    description: 'label for snake in object picker for koshien extension'
                }),
                value: KoshienObjectName.SNAKE
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.trap',
                    default: 'trap',
                    description: 'label for trap in object picker for koshien extension'
                }),
                value: KoshienObjectName.TRAP
            },
            {
                text: formatMessage({
                    id: 'koshien.objectsMenu.bomb',
                    default: 'bomb',
                    description: 'label for bomb in object picker for koshien extension'
                }),
                value: KoshienObjectName.BOMB
            }
        ];
    }

    /**
     * Construct a set of Koshien blocks.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }

        // Backends: the believable MockClient is always available so an AI can be
        // built/run offline. When a real game server endpoint is configured
        // (the GUI/connection flow supplies it via runtime.getKoshienRemoteOptions),
        // a RemoteClient is also created and used while connected; if the connection
        // fails the extension falls back to the MockClient ("つながなくても作れる").
        this._mockClient = new MockClient(this.runtime, KoshienBlocks.EXTENSION_ID);
        const remoteOptions =
            runtime && typeof runtime.getKoshienRemoteOptions === 'function'
                ? runtime.getKoshienRemoteOptions()
                : null;
        this._remoteClient =
            remoteOptions && remoteOptions.endpoint
                ? new RemoteClient(this.runtime, KoshienBlocks.EXTENSION_ID, remoteOptions)
                : null;
        this._client = this._remoteClient || this._mockClient;

        // Reset the offline mock world back to its initial state at the natural
        // "new game" moments, so a teacher can demonstrate the blocks, then start
        // over cleanly:
        //   - green flag (PROJECT_START): re-run the AI from the beginning
        //   - stop (PROJECT_STOP_ALL): leave a clean slate for the next run
        // (connect_game also resets, see MockClient.connect.)
        this._resetMockWorld = this._resetMockWorld.bind(this);
        if (this.runtime && typeof this.runtime.on === 'function') {
            this.runtime.on('PROJECT_START', this._resetMockWorld);
            this.runtime.on('PROJECT_STOP_ALL', this._resetMockWorld);
        }
    }

    /**
     * Fall back to the offline MockClient (e.g. when the server is unreachable).
     */
    _fallbackToMock () {
        this._client = this._mockClient;
    }

    /**
     * Reset the offline mock world back to its initial state. The real game
     * server (RemoteClient) is unaffected.
     */
    _resetMockWorld () {
        if (this._mockClient && typeof this._mockClient.reset === 'function') {
            this._mockClient.reset();
        }
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: KoshienBlocks.EXTENSION_ID,
            name: KoshienBlocks.EXTENSION_NAME,
            blockIconURI: blockIconURI,
            showStatusButton: false,
            blocks: [
                {
                    opcode: 'connectGame',
                    blockType: BlockType.HAT,
                    isEdgeActivated: false,
                    text: formatMessage({
                        id: 'koshien.connectGame',
                        default: 'connect game server with the player name [NAME]',
                        description: 'connect game server with the player name'
                    }),
                    arguments: {
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'player1'
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'getMapArea',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.getMapArea',
                        default: 'get map around [POSITION]',
                        description: 'get map information around position'
                    }),
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'map',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.map',
                        default: 'map at [POSITION]',
                        description: 'map information at position'
                    }),
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'moveTo',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.moveTo',
                        default: 'move to [POSITION]',
                        description: 'move to position'
                    }),
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'calcGoalRoute',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.calcGoalRoute',
                        default: 'store shortest goal path to list: [RESULT]',
                        description: 'store shortest path between player and goal to list'
                    }),
                    arguments: {
                        RESULT: {
                            type: ArgumentType.STRING,
                            menu: 'listNames',
                            defaultValue: ' '
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'calcRoute',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.calcRoute',
                         
                        default: 'store shortest path (begin [SRC] end x: [DST] except list: [EXCEPT_CELLS]) to list: [RESULT]',
                        description: 'store shortest path between two points to list'
                    }),
                    arguments: {
                        SRC: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        },
                        DST: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        },
                        EXCEPT_CELLS: {
                            type: ArgumentType.STRING,
                            menu: 'listNames',
                            defaultValue: ' '
                        },
                        RESULT: {
                            type: ArgumentType.STRING,
                            menu: 'listNames',
                            defaultValue: ' '
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'setItem',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.setItem',
                        default: 'place a [ITEM] at [POSITION]',
                        description: 'place an item at position'
                    }),
                    arguments: {
                        ITEM: {
                            type: ArgumentType.STRING,
                            menu: 'itemMenu',
                            defaultValue: KoshienItemName.DYNAMITE
                        },
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'mapFrom',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.mapFrom',
                        default: 'map at [POSITION] from [MAP]',
                        description: 'map information at position from variable'
                    }),
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        },
                        MAP: {
                            type: ArgumentType.STRING,
                            menu: 'variableNames',
                            defaultValue: ' '
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'mapAll',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.mapAll',
                        default: 'all map',
                        description: 'all map information'
                    }),
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'locateObjects',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.locateObjects',
                         
                        default: 'store terrain and items within range (center [POSITION] range [SQ_SIZE] terrain/items [OBJECTS]) to list: [RESULT]',
                        description: 'store terrain and items within range to list'
                    }),
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        },
                        SQ_SIZE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 5
                        },
                        OBJECTS: {
                            type: ArgumentType.STRING,
                            defaultValue: 'ABCD'
                        },
                        RESULT: {
                            type: ArgumentType.STRING,
                            menu: 'listNames',
                            defaultValue: ' '
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'targetCoordinate',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.targetCoordinate',
                        default: '[TARGET] of [COORDINATE]',
                        description: 'target of coordinate'
                    }),
                    arguments: {
                        TARGET: {
                            type: ArgumentType.STRING,
                            menu: 'targetMenu',
                            defaultValue: KoshienTargetName.OTHER
                        },
                        COORDINATE: {
                            type: ArgumentType.STRING,
                            menu: 'coordinateAndPositionMenu',
                            defaultValue: KoshienCoordinateName.POSITION
                        }
                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'turnOver',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.turnOver',
                        default: 'turn over',
                        description: 'turn over'
                    }),
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'position',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.position',
                        default: 'position [X] [Y]',
                        description: 'x and y convert to position'
                    }),
                    arguments: {
                        X: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        Y: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }

                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'positionOf',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.positionOf',
                        default: '[POSITION] of [COORDINATE]',
                        description: 'position of coordinate'
                    }),
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            defaultValue: '0:0'
                        },
                        COORDINATE: {
                            type: ArgumentType.STRING,
                            menu: 'coordinateMenu',
                            defaultValue: KoshienCoordinateName.X
                        }

                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'object',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'koshien.object',
                        default: '[OBJECT]',
                        description: 'object of code'
                    }),
                    arguments: {
                        OBJECT: {
                            type: ArgumentType.STRING,
                            menu: 'objectMenu',
                            defaultValue: KoshienObjectName.UNKNOWN
                        }

                    },
                    filter: [TargetType.SPRITE]
                },
                {
                    opcode: 'setMessage',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'koshien.setMessage',
                        default: 'message [MESSAGE]',
                        description: 'display a message'
                    }),
                    arguments: {
                        MESSAGE: {
                            type: ArgumentType.STRING,
                            defaultValue: 'hello'
                        }
                    },
                    filter: [TargetType.SPRITE]
                }
            ],
            menus: {
                variableNames: {
                    acceptReporters: false,
                    items: 'getVariableNamesMenuItems'
                },
                listNames: {
                    acceptReporters: false,
                    items: 'getListNamesMenuItems'
                },
                itemMenu: {
                    acceptReporters: false,
                    items: this.ITEMS_MENU
                },
                coordinateMenu: {
                    acceptReporters: false,
                    items: this.COORDINATES_MENU
                },
                coordinateAndPositionMenu: {
                    acceptReporters: false,
                    items: this.COORDINATES_AND_POSITION_MENU
                },
                targetMenu: {
                    acceptReporters: false,
                    items: this.TARGETS_MENU
                },
                objectMenu: {
                    acceptReporters: false,
                    items: this.OBJECTS_MENU
                }
            },
            translationMap: translations
        };
    }

    getVariableNamesMenuItems () {
        return this.getVariableOrListNamesMenuItems(Variable.SCALAR_TYPE);
    }

    getListNamesMenuItems () {
        return this.getVariableOrListNamesMenuItems(Variable.LIST_TYPE);
    }

    getVariableOrListNamesMenuItems (type) {
        const sprite = this.runtime.getEditingTarget();
        return [' '].concat(sprite.getAllVariableNamesInScopeByType(type));
    }

    /**
     * connect game server with the player name
     * @param {object} args - the block's arguments.
     * @param {string} args.NAME - name of the player.
     * @returns {boolean} - true if the event raised.
     */
     
    connectGame (args) {
        if (this._client.isConnected()) {
            return false;
        }

        // Offline (mock) backend: connect synchronously with fixed state.
        if (this._client !== this._remoteClient) {
            this._client.connect(args.NAME);
            return true;
        }

        // Remote backend: attempt a real connection to the game server.
        // If it fails (server unreachable / CORS / error), fall back to the
        // offline MockClient so the AI keeps returning sensible fixed values.
        return Promise.resolve(this._remoteClient.connectGame(args.NAME))
            .then(() => true)
            .catch(() => {
                this._fallbackToMock();
                this._mockClient.connect(args.NAME);
                return true;
            });
    }

    /**
     * Resolve the target used to read/write variables.
     * @param {object} util - the block utility (may be undefined).
     * @returns {?object} - the target, or null.
     */
    _resolveTarget (util) {
        if (util && util.target) {
            return util.target;
        }
        if (this.runtime && this.runtime.getEditingTarget) {
            return this.runtime.getEditingTarget();
        }
        return null;
    }

    /**
     * Replace the contents of a list variable (looked up by name) with values.
     * No-op when the name is empty or the list cannot be found.
     * @param {object} util - the block utility.
     * @param {string} listName - the list variable name.
     * @param {Array} values - the new list contents.
     */
    _writeListByName (util, listName, values) {
        if (typeof listName !== 'string' || listName.trim() === '') {
            return;
        }
        const target = this._resolveTarget(util);
        if (!target || !target.lookupVariableByNameAndType) {
            return;
        }
        const list = target.lookupVariableByNameAndType(listName, Variable.LIST_TYPE);
        if (!list) {
            return;
        }
        list.value = values.slice();
        list._monitorUpToDate = false;
    }

    /**
     * Read a scalar variable's value by name.
     * @param {object} util - the block utility.
     * @param {string} name - the variable name.
     * @returns {(string|number|Array|null)} - the value, or null when not found.
     */
    _readVariableByName (util, name) {
        if (typeof name !== 'string' || name.trim() === '') {
            return null;
        }
        const target = this._resolveTarget(util);
        if (!target || !target.lookupVariableByNameAndType) {
            return null;
        }
        const variable = target.lookupVariableByNameAndType(name, Variable.SCALAR_TYPE);
        return variable ? variable.value : null;
    }

    /**
     * Read a list variable's contents by name.
     * @param {object} util - the block utility.
     * @param {string} name - the list variable name.
     * @returns {Array} - the list contents, or [] when not found.
     */
    _readListByName (util, name) {
        if (typeof name !== 'string' || name.trim() === '') {
            return [];
        }
        const target = this._resolveTarget(util);
        if (!target || !target.lookupVariableByNameAndType) {
            return [];
        }
        const list = target.lookupVariableByNameAndType(name, Variable.LIST_TYPE);
        return list && Array.isArray(list.value) ? list.value.slice() : [];
    }

    /**
     * get map information around position
     * @param {object} args - the block's arguments.
     * @param {string} args.POSITION - position
     * @returns {(Promise|undefined)} - resolves when fetched (remote); undefined for mock.
     */
    getMapArea (args) {
        return this._client.getMapArea(args.POSITION);
    }

    /**
     * map at position
     * @param {object} args - the block's arguments.
     * @param {string} args.POSITION - position.
     * @returns {number} - map information.
     */
    map (args) {
        return this._client.map(args.POSITION);
    }

    /**
     * move to x, y
     * @param {object} args - the block's arguments.
     * @param {string} args.POSITION - position.
     * @returns {Promise} - promise
     */
    moveTo (args) {
        return this._client.moveTo(args.POSITION);
    }

    /**
     * shortest path between player and goal, stored into the result list
     * @param {object} args - the block's arguments.
     * @param {string} args.RESULT - result list name.
     * @param {object} util - the block utility.
     */
    calcGoalRoute (args, util) {
        const route = this._client.calcRoute({});
        this._writeListByName(util, args.RESULT, route);
    }

    /**
     * shortest path between two points, stored into the result list
     * @param {object} args - the block's arguments.
     * @param {string} args.SRC - src.
     * @param {string} args.DST - dst.
     * @param {string} args.EXCEPT_CELLS - except cells.
     * @param {string} args.RESULT - result list name.
     * @param {object} util - the block utility.
     */
    calcRoute (args, util) {
        const exceptCells = this._readListByName(util, args.EXCEPT_CELLS);
        const route = this._client.calcRoute({
            src: args.SRC,
            dst: args.DST,
            exceptCells
        });
        this._writeListByName(util, args.RESULT, route);
    }

    /**
     * place an item at position
     * @param {object} args - the block's arguments.
     * @param {string} args.ITEM - item.
     * @param {string} args.POSITION - position.
     * @returns {(Promise|undefined)} - resolves when placed (remote); undefined for mock.
     */
    setItem (args) {
        return this._client.setItem(args.ITEM, args.POSITION);
    }

    /**
     * map from location at position
     * @param {object} args - the block's arguments.
     * @param {string} args.MAP - map variable name.
     * @param {string} args.POSITION - position.
     * @param {object} util - the block utility.
     * @returns {number} - map information.
     */
    mapFrom (args, util) {
        const mapString = this._readVariableByName(util, args.MAP);
        return this._client.mapFrom(args.POSITION, mapString);
    }

    /**
     * all map information
     * @returns {string} - the whole map as a string.
     */
    mapAll () {
        return this._client.mapAll();
    }

    /**
     * terrain and items within range, stored into the result list
     * @param {object} args - the block's arguments.
     * @param {string} args.POSITION - position.
     * @param {number} args.SQ_SIZE - size.
     * @param {string} args.OBJECTS - item.
     * @param {string} args.RESULT - result list name.
     * @param {object} util - the block utility.
     */
    locateObjects (args, util) {
        const positions = this._client.locateObjects({
            position: args.POSITION,
            sqSize: args.SQ_SIZE,
            objects: args.OBJECTS
        });
        this._writeListByName(util, args.RESULT, positions);
    }

    /**
     * target of coordinate
     * @param {object} args - the block's arguments.
     * @param {string} args.TARGET - target.
     * @param {string} args.COORDINATE - coordinate.
     * @returns {string|number|null} - the requested coordinate.
     */
    targetCoordinate (args) {
        return this._client.targetCoordinate(args.TARGET, args.COORDINATE);
    }

    /**
     * turn over
     * @returns {(Promise|undefined)} - resolves on next turn (remote); undefined for mock.
     */
    turnOver () {
        return this._client.turnOver();
    }

    /**
     * x and y convert to position
     * @param {object} args - the block's arguments.
     * @param {number} args.X - x.
     * @param {number} args.Y - y.
     * @returns {string} - position
     */
     
    position (args) {
        return `${args.X}:${args.Y}`;
    }

    /**
     * position of coordinate
     * @param {object} args - the block's arguments.
     * @param {string} args.POSITION - position.
     * @param {string} args.COORDINATE - coordinate.
     * @returns {number} - position of x or y
     */
    positionOf (args) {
        const position = args.POSITION.split(':');
        return Number(args.COORDINATE === 'x' ? position[0] : position[1]);
    }

    /**
     * object of code
     * @param {object} args - the block's arguments.
     * @param {string} args.OBJECT - object.
     * @returns {number} - object of code
     */
    object (args) {
        switch (args.OBJECT) {
        case KoshienObjectName.UNKNOWN:
            return -1;
        case KoshienObjectName.SPACE:
            return 0;
        case KoshienObjectName.WALL:
            return 1;
        case KoshienObjectName.STOREHOUSE:
            return 2;
        case KoshienObjectName.GOAL:
            return 3;
        case KoshienObjectName.WATER:
            return 4;
        case KoshienObjectName.BREAKABLE_WALL:
            return 5;
        case KoshienObjectName.TEA:
            return 'a';
        case KoshienObjectName.SWEETS:
            return 'b';
        case KoshienObjectName.COIN:
            return 'c';
        case KoshienObjectName.DOLPHIN:
            return 'd';
        case KoshienObjectName.SWORD:
            return 'e';
        case KoshienObjectName.POISON:
            return 'A';
        case KoshienObjectName.SNAKE:
            return 'B';
        case KoshienObjectName.TRAP:
            return 'C';
        case KoshienObjectName.BOMB:
            return 'D';
        default:
            return -1;
        }
    }

    /**
     * display a message
     * @param {object} args - the block's arguments.
     * @param {string} args.MESSAGE - message.
     */
     
    setMessage (args) {
        return this._client.setMessage(args.MESSAGE);
    }
}

module.exports = KoshienBlocks;
