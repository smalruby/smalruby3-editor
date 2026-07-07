// === Smalruby: This file is Smalruby-specific (Koshien practice game panel) ===

import React, {useState, useCallback, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import {defineMessages, useIntl} from 'react-intl';
import styles from './koshien-mock-panel.css';

import closeIcon from '../cards/icon--close.svg';
import shrinkIcon from '../cards/icon--shrink.svg';
import expandIcon from '../cards/icon--expand.svg';

import itemTea from './item-tea.png';
import itemSweets from './item-sweets.png';
import itemCoin from './item-coin.png';
import itemDolphin from './item-dolphin.png';
import itemSword from './item-sword.png';
import itemPoison from './item-poison.png';
import itemSnake from './item-snake.png';
import itemTrap from './item-trap.png';
import itemBomb from './item-bomb.png';
import player1Sprite from './player1.png';
import player2Sprite from './player2.png';
import enemyNormal from './enemy-normal.png';
import enemyAngry from './enemy-angry.png';
import enemyKill from './enemy-kill.png';

const MENU_BAR_HEIGHT = 48;
const TILE = 22; // 17 tiles * 22px = 374px — fits a 600px-tall viewport

/**
 * Sprite for each item mark on the board (official viewer artwork).
 * @type {object}
 */
const ITEM_SPRITES = {
    a: itemTea,
    b: itemSweets,
    c: itemCoin,
    d: itemDolphin,
    e: itemSword,
    A: itemPoison,
    B: itemSnake,
    C: itemTrap,
    D: itemBomb,
};

/**
 * Fill color for cells the AI has not explored yet ('mine' view).
 * @type {string}
 */
const UNEXPLORED_COLOR = '#2b2f36';

/**
 * Flat terrain colors for the top-down grid.
 * @type {object}
 */
const TERRAIN_COLORS = {
    0: '#efe7d3', // space
    1: '#4a4f55', // wall
    2: '#8a6642', // storehouse wall
    3: '#f5c542', // goal
    4: '#5aa9e6', // water
    5: '#a7adb3', // breakable wall
};

const messages = defineMessages({
    title: {
        id: 'gui.koshienMockPanel.title',
        defaultMessage: 'Koshien practice game',
        description: 'Title for the Koshien practice game panel',
    },
    shrink: {
        id: 'gui.koshienMockPanel.shrink',
        defaultMessage: 'Shrink',
        description: 'Title for button to shrink the koshien panel',
    },
    expand: {
        id: 'gui.koshienMockPanel.expand',
        defaultMessage: 'Expand',
        description: 'Title for button to expand the koshien panel',
    },
    close: {
        id: 'gui.koshienMockPanel.close',
        defaultMessage: 'Close',
        description: 'Title for button to close the koshien panel',
    },
    notConnected: {
        id: 'gui.koshienMockPanel.notConnected',
        defaultMessage: 'Run "connect to game server" to start a practice game.',
        description: 'Shown in the koshien panel before the AI connects',
    },
    viewAll: {
        id: 'gui.koshienMockPanel.viewAll',
        defaultMessage: 'All',
        description: 'Board view showing the whole true game state',
    },
    viewMine: {
        id: 'gui.koshienMockPanel.viewMine',
        defaultMessage: 'My AI',
        description: 'Board view showing only what the AI has explored',
    },
    turn: {
        id: 'gui.koshienMockPanel.turn',
        defaultMessage: 'Turn',
        description: 'Label for the current turn in the koshien panel',
    },
    gameOver: {
        id: 'gui.koshienMockPanel.gameOver',
        defaultMessage: 'Game over',
        description: 'Shown in the koshien panel when the round has ended',
    },
    you: {
        id: 'gui.koshienMockPanel.you',
        defaultMessage: 'You',
        description: 'Label for the user pawn in the koshien panel',
    },
    rival: {
        id: 'gui.koshienMockPanel.rival',
        defaultMessage: 'Rival',
        description: 'Label for the rival pawn in the koshien panel',
    },
    score: {
        id: 'gui.koshienMockPanel.score',
        defaultMessage: 'Score',
        description: 'Label for a score in the koshien panel',
    },
    actionsLeft: {
        id: 'gui.koshienMockPanel.actionsLeft',
        defaultMessage: 'Actions left',
        description: 'Label for the remaining actions this turn',
    },
    canMove: {
        id: 'gui.koshienMockPanel.canMove',
        defaultMessage: 'Move left',
        description: 'Label for whether a move is still available this turn',
    },
    dynamite: {
        id: 'gui.koshienMockPanel.dynamite',
        defaultMessage: 'Dynamite',
        description: 'Label for the remaining dynamite',
    },
    bomb: {
        id: 'gui.koshienMockPanel.bomb',
        defaultMessage: 'Bombs',
        description: 'Label for the remaining bombs',
    },
    inWater: {
        id: 'gui.koshienMockPanel.inWater',
        defaultMessage: 'In water!',
        description: 'Shown when the pawn is stuck in water',
    },
    journal: {
        id: 'gui.koshienMockPanel.journal',
        defaultMessage: 'Log',
        description: 'Label for the action/error log in the koshien panel',
    },
    statusPlaying: {
        id: 'gui.koshienMockPanel.statusPlaying',
        defaultMessage: 'playing',
        description: 'Player status: still playing',
    },
    statusCompleted: {
        id: 'gui.koshienMockPanel.statusCompleted',
        defaultMessage: 'GOAL!',
        description: 'Player status: reached the goal',
    },
    statusTimeup: {
        id: 'gui.koshienMockPanel.statusTimeup',
        defaultMessage: 'time up',
        description: 'Player status: ran out of turns',
    },
});

/**
 * Preload the sprites once per module (shared by every render).
 * @returns {object} - name -> HTMLImageElement (or null outside the browser).
 */
const loadSprites = () => {
    if (typeof Image === 'undefined') return {};
    const sources = Object.assign({}, ITEM_SPRITES, {
        player1: player1Sprite,
        player2: player2Sprite,
        enemyNormal,
        enemyAngry,
        enemyKill,
    });
    const sprites = {};
    for (const [name, src] of Object.entries(sources)) {
        const img = new Image();
        img.src = src;
        sprites[name] = img;
    }
    return sprites;
};
let spriteCache = null;

/**
 * Fill one board cell (terrain color + item sprite when present).
 * @param {CanvasRenderingContext2D} ctx - the 2d context.
 * @param {object} sprites - preloaded sprite images.
 * @param {number} x - the cell x.
 * @param {number} y - the cell y.
 * @param {(number|string)} cell - terrain code or item mark.
 */
const drawCell = (ctx, sprites, x, y, cell) => {
    const ch = String(cell);
    const isItem = !!ITEM_SPRITES[ch];
    ctx.fillStyle = isItem ? TERRAIN_COLORS[0] : TERRAIN_COLORS[ch] || TERRAIN_COLORS[0];
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    if (isItem && sprites[ch] && sprites[ch].complete) {
        ctx.drawImage(sprites[ch], x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    }
};

/**
 * Draw the fiend sprite for its state.
 * @param {CanvasRenderingContext2D} ctx - the 2d context.
 * @param {object} sprites - preloaded sprite images.
 * @param {object} fiend - {x, y, state} (skipped when slain).
 */
const drawFiend = (ctx, sprites, fiend) => {
    if (!fiend || fiend.state === 'done') return;
    const sprite =
        fiend.state === 'angry' ? sprites.enemyAngry
            : fiend.state === 'kill' ? sprites.enemyKill
                : sprites.enemyNormal;
    if (sprite && sprite.complete) {
        ctx.drawImage(sprite, fiend.x * TILE, fiend.y * TILE, TILE, TILE);
    }
};

/**
 * Draw the whole practice game onto the canvas.
 *
 * The 'all' view shows the true game state (with a light veil over the cells
 * the AI has not explored). The 'mine' view shows exactly what the user's AI
 * knows: each cell as of its last scan (a taken item stays visible until the
 * cell is scanned again), unexplored cells dark, and the rival only at the
 * position it was last seen.
 * @param {HTMLCanvasElement} canvas - the target canvas.
 * @param {object} snapshot - the mock state snapshot from the VM.
 * @param {object} sprites - preloaded sprite images.
 * @param {string} view - 'all' or 'mine'.
 */
const drawGame = (canvas, snapshot, sprites, view) => {
    const game = snapshot.game;
    if (!canvas || !game) return;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return; // e.g. jsdom in unit tests
    const rows = game.rows;
    const size = rows.length;
    const myMap = snapshot.myMap;
    const mine = view === 'mine';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Board cells.
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < rows[y].length; x++) {
            if (mine) {
                const known = Array.isArray(myMap) && myMap[y] ? myMap[y][x] : -1;
                if (known === -1) {
                    ctx.fillStyle = UNEXPLORED_COLOR;
                    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                } else {
                    drawCell(ctx, sprites, x, y, known);
                }
            } else {
                drawCell(ctx, sprites, x, y, rows[y][x]);
            }
        }
    }

    // Grid lines.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE + 0.5, 0);
        ctx.lineTo(i * TILE + 0.5, size * TILE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * TILE + 0.5);
        ctx.lineTo(size * TILE, i * TILE + 0.5);
        ctx.stroke();
    }

    if (mine) {
        // Only what the AI knows: the goal (told on connect), the fiend and
        // the rival as of the last look-around, and the own pawn.
        const goal = game.goal;
        ctx.strokeStyle = TERRAIN_COLORS[3];
        ctx.lineWidth = 2;
        ctx.strokeRect(goal[0] * TILE + 1, goal[1] * TILE + 1, TILE - 2, TILE - 2);
        drawFiend(ctx, sprites, snapshot.myFiend);
        const me = game.pawns.find(pawn => pawn.isUser);
        const rival = game.pawns.find(pawn => !pawn.isUser);
        if (snapshot.myRival && rival) {
            const sprite = rival.side === 1 ? sprites.player1 : sprites.player2;
            if (sprite && sprite.complete) {
                ctx.globalAlpha = 0.8;
                ctx.drawImage(sprite, snapshot.myRival[0] * TILE, snapshot.myRival[1] * TILE - 2, TILE, TILE);
                ctx.globalAlpha = 1;
            }
        }
        if (me) {
            const sprite = me.side === 1 ? sprites.player1 : sprites.player2;
            if (sprite && sprite.complete) {
                ctx.drawImage(sprite, me.x * TILE, me.y * TILE - 2, TILE, TILE);
            }
        }
        return;
    }

    // Fiend (hidden once slain).
    drawFiend(ctx, sprites, game.fiend);

    // Pawns (both on one cell -> nudge apart; finished pawns fade).
    const together =
        game.pawns.length === 2 &&
        game.pawns[0].x === game.pawns[1].x &&
        game.pawns[0].y === game.pawns[1].y;
    game.pawns.forEach((pawn, i) => {
        const sprite = pawn.side === 1 ? sprites.player1 : sprites.player2;
        if (!sprite || !sprite.complete) return;
        const nudge = together ? (i === 0 ? -TILE / 4 : TILE / 4) : 0;
        ctx.globalAlpha = pawn.status === 'playing' ? 1 : 0.55;
        ctx.drawImage(sprite, pawn.x * TILE + nudge, pawn.y * TILE - 2, TILE, TILE);
        ctx.globalAlpha = 1;
    });

    // Veil the cells the user's AI has not explored yet.
    if (Array.isArray(myMap) && myMap.length === size) {
        ctx.fillStyle = 'rgba(20, 20, 30, 0.35)';
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < myMap[y].length; x++) {
                if (myMap[y][x] === -1) {
                    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                }
            }
        }
    }
};

/**
 * Movable/minimizable panel visualizing the Koshien practice game: the whole
 * board (with the AI's unexplored cells veiled), both players, the fiend,
 * remaining actions/items, and a journal of actions and rule errors. Sized to
 * stay fully visible on a 1380x600 viewport.
 * @param {object} props - component props.
 * @param {object} props.snapshot - the latest mock state snapshot (or null).
 * @param {Function} props.onClose - called when the close button is pressed.
 * @returns {JSX.Element} - the rendered panel.
 */
const KoshienMockPanel = ({snapshot, onClose}) => {
    const intl = useIntl();
    const [expanded, setExpanded] = useState(true);
    const [view, setView] = useState('all');
    const canvasRef = useRef(null);
    const nodeRef = useRef(null);
    const journalRef = useRef(null);
    if (!spriteCache) spriteCache = loadSprites();

    const handleToggleExpanded = useCallback(() => setExpanded(value => !value), []);
    const handleViewAll = useCallback(() => setView('all'), []);
    const handleViewMine = useCallback(() => setView('mine'), []);

    const game = snapshot && snapshot.game;
    const boardSize = game ? game.rows.length * TILE : 17 * TILE;

    useEffect(() => {
        if (!expanded || !game) return;
        const canvas = canvasRef.current;
        drawGame(canvas, snapshot, spriteCache, view);
        // Redraw once more when sprites finish loading the first time.
        const pending = Object.values(spriteCache).filter(img => img && !img.complete);
        pending.forEach(img => {
            img.addEventListener('load', () => drawGame(canvas, snapshot, spriteCache, view), {once: true});
        });
    }, [snapshot, expanded, game, view]);

    useEffect(() => {
        // Keep the newest journal entry in view.
        const el = journalRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [snapshot]);

    const me = game && game.pawns.find(pawn => pawn.isUser);
    const rival = game && game.pawns.find(pawn => !pawn.isUser);
    const statusLabel = status => {
        if (status === 'completed') return intl.formatMessage(messages.statusCompleted);
        if (status === 'timeup') return intl.formatMessage(messages.statusTimeup);
        return intl.formatMessage(messages.statusPlaying);
    };

    const defaultX = typeof window === 'undefined'
        ? 0
        : Math.max(0, window.innerWidth - (boardSize + 300))
    ;

    return (
        <div className={styles.overlay}>
            <Draggable
                bounds="parent"
                defaultPosition={{x: defaultX, y: MENU_BAR_HEIGHT + 8}}
                handle={`.${styles.header}`}
                nodeRef={nodeRef}
            >
                <div
                    className={styles.panelContainer}
                    data-testid="koshien-mock-panel"
                    ref={nodeRef}
                >
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            {intl.formatMessage(messages.title)}
                        </div>
                        <div className={styles.headerButtons}>
                            <button
                                className={styles.headerButton}
                                data-testid="koshien-mock-panel-toggle"
                                title={intl.formatMessage(expanded ? messages.shrink : messages.expand)}
                                onClick={handleToggleExpanded}
                            >
                                <img
                                    alt={intl.formatMessage(expanded ? messages.shrink : messages.expand)}
                                    src={expanded ? shrinkIcon : expandIcon}
                                />
                            </button>
                            <button
                                className={styles.headerButton}
                                data-testid="koshien-mock-panel-close"
                                title={intl.formatMessage(messages.close)}
                                onClick={onClose}
                            >
                                <img
                                    alt={intl.formatMessage(messages.close)}
                                    src={closeIcon}
                                />
                            </button>
                        </div>
                    </div>
                    {expanded ? <div className={styles.body}>
                        {game ? (
                            <React.Fragment>
                                {/* The CSS size is pinned to the bitmap size so
                                    flex stretching can never distort the 1:1 tiles. */}
                                <canvas
                                    className={styles.board}
                                    data-testid="koshien-mock-panel-canvas"
                                    height={boardSize}
                                    ref={canvasRef}
                                    style={{width: `${boardSize}px`, height: `${boardSize}px`}}
                                    width={boardSize}
                                />
                                {/* Matches the board height so the journal scrolls
                                    instead of growing the panel. */}
                                <div
                                    className={styles.side}
                                    style={{height: `${boardSize}px`}}
                                >
                                    <div className={styles.viewRow}>
                                        <button
                                            aria-pressed={view === 'all'}
                                            className={view === 'all' ? styles.viewButtonActive : styles.viewButton}
                                            data-testid="koshien-mock-panel-view-all"
                                            onClick={handleViewAll}
                                        >
                                            {intl.formatMessage(messages.viewAll)}
                                        </button>
                                        <button
                                            aria-pressed={view === 'mine'}
                                            className={view === 'mine' ? styles.viewButtonActive : styles.viewButton}
                                            data-testid="koshien-mock-panel-view-mine"
                                            onClick={handleViewMine}
                                        >
                                            {intl.formatMessage(messages.viewMine)}
                                        </button>
                                    </div>
                                    <div
                                        className={styles.turnRow}
                                        data-testid="koshien-mock-panel-turn"
                                    >
                                        {`${intl.formatMessage(messages.turn)} ${game.turn} / 50`}
                                        {game.over ? (
                                            <span className={styles.gameOver}>
                                                {` ${intl.formatMessage(messages.gameOver)}`}
                                            </span>
                                        ) : null}
                                    </div>
                                    {me ? (
                                        <div
                                            className={styles.pawnCard}
                                            data-testid="koshien-mock-panel-me"
                                        >
                                            <div className={styles.pawnName}>
                                                {`${intl.formatMessage(messages.you)}: ${me.name} (player${me.side})`}
                                                <span className={styles.pawnStatus}>
                                                    {` ${statusLabel(me.status)}`}
                                                </span>
                                            </div>
                                            <div className={styles.pawnStats}>
                                                {`${intl.formatMessage(messages.score)} ${me.score} / (${me.x}:${me.y})`}
                                            </div>
                                            <div className={styles.pawnStats}>
                                                {`${intl.formatMessage(messages.actionsLeft)} ${
                                                    Math.max(0, me.actionsLimit - me.actionsUsed)
                                                } ・ ${intl.formatMessage(messages.canMove)} ${me.canMove ? '○' : '×'}`}
                                            </div>
                                            <div className={styles.pawnStats}>
                                                {`${intl.formatMessage(messages.dynamite)} ${me.dynamiteLeft} ・ ${
                                                    intl.formatMessage(messages.bomb)
                                                } ${me.bombLeft}`}
                                                {me.inWater ? (
                                                    <span className={styles.inWater}>
                                                        {` ${intl.formatMessage(messages.inWater)}`}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                    {rival ? (
                                        <div
                                            className={styles.pawnCard}
                                            data-testid="koshien-mock-panel-rival"
                                        >
                                            <div className={styles.pawnName}>
                                                {`${intl.formatMessage(messages.rival)}: player${rival.side} (${snapshot.strategy})`}
                                                <span className={styles.pawnStatus}>
                                                    {` ${statusLabel(rival.status)}`}
                                                </span>
                                            </div>
                                            <div className={styles.pawnStats}>
                                                {`${intl.formatMessage(messages.score)} ${rival.score} / (${rival.x}:${rival.y})`}
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className={styles.journalTitle}>
                                        {intl.formatMessage(messages.journal)}
                                    </div>
                                    <div
                                        className={styles.journal}
                                        data-testid="koshien-mock-panel-journal"
                                        ref={journalRef}
                                    >
                                        {(snapshot.journal || []).map((entry, i) => (
                                            <div
                                                className={
                                                    entry.kind === 'error' ? styles.journalError
                                                        : entry.kind === 'event' ? styles.journalEvent
                                                            : styles.journalAction
                                                }
                                                key={i}
                                            >
                                                {`T${entry.turn} ${entry.text}`}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </React.Fragment>
                        ) : (
                            <div
                                className={styles.notConnected}
                                data-testid="koshien-mock-panel-not-connected"
                            >
                                {intl.formatMessage(messages.notConnected)}
                            </div>
                        )}
                    </div> : null}
                </div>
            </Draggable>
        </div>
    );
};

KoshienMockPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
    snapshot: PropTypes.shape({
        connected: PropTypes.bool,
        strategy: PropTypes.string,
        game: PropTypes.object,
        myMap: PropTypes.array,
        myRival: PropTypes.array,
        myFiend: PropTypes.object,
        journal: PropTypes.arrayOf(
            PropTypes.shape({
                turn: PropTypes.number,
                kind: PropTypes.string,
                text: PropTypes.string,
            }),
        ),
    }),
};

export default KoshienMockPanel;
