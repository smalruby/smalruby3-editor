import {EventEmitter} from 'events';
import AkaDakoBoard from './akadako-board';

/**
 * Manager object which serves AkaDako boards.
 */
export class AkaDakoConnector extends EventEmitter {

    /**
     * Event name for reporting that a board removed.
     * @const {string}
     */
    static get BOARD_REMOVED () {
        return 'BOARD_REMOVED';
    }

    /**
     * Event name for reporting that a board added.
     * @const {string}
     */
    static get BOARD_ADDED () {
        return 'BOARD_ADDED';
    }

    /**
     * Constructor of this instance.
     * @param {Runtime} runtime - Scratch runtime object
     */
    constructor (runtime) {
        super();
        
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        /**
         * Available boards
         * @type {Array<AkaDakoBoard>}
         */
        this.boards = [];

        /**
         * Selection rules for MIDIPort
         */
        this.midiPortFilters = [
            {manufacturer: null, name: /STEAM BOX/},
            {manufacturer: null, name: /MidiDako/},
            {manufacturer: null, name: /AkaDako/}
        ];

        /**
         * Settings for WebSerial
         */
        this.serialPortOptions = {
            filters: [
                {usbVendorId: 0x04D8, usbProductId: 0xE83A}, // Licensed for AkaDako
                {usbVendorId: 0x04D8, usbProductId: 0x000A}, // Dev board
                {usbVendorId: 0x04D9, usbProductId: 0xB534} // Use in the future
            ]
        };

        /**
         * Flag whether to use serial or not
         * @type {boolean}
         */
        this.useSerial = true;
    }

    /**
     * Return connected board which is confirmed with the options.
     * @param {object} options serial port options
     * @param {Array<{usbVendorId, usbProductId}>} options.filters allay of filters
     * @returns {AkaDakoBoard?} first board which confirmed with options
     */
    findBoard (options) {
        if (this.boards.length === 0) return;
        if (!options || !options.filters) return this.boards[0];
        return this.boards.find(aBoard => (aBoard.isConnected() && options.filters.some(filter =>
            ((filter.usbVendorId === aBoard.portInfo.usbVendorId) &&
                    (filter.usbProductId === aBoard.portInfo.usbProductId)))));
    }

    /**
     * Add a board to the boards holder.
     * @param {AkaDakoBoard} newBoard the board to be added
     */
    addBoard (newBoard) {
        this.boards.push(newBoard);
        this.emit(AkaDakoConnector.BOARD_ADDED, newBoard);
    }

    /**
     * Remove a board from the boards holder.
     * @param {AkaDakoBoard} removal the board to be removed
     */
    removeBoard (removal) {
        const indexOfRemoval = this.boards.indexOf(removal);
        if (indexOfRemoval < 0) return; // not found
        this.boards.splice(indexOfRemoval, 1);
        this.emit(AkaDakoConnector.BOARD_ADDED, removal);
    }

    /**
     * Return a connected AkaDako board
     * @param {string} extensionId - ID of the extension which is requesting
     * @returns {Promise<AkaDakoBoard>} a Promise which resolves a connected AkaDako board or reject with reason
     */
    connectedBoard (extensionId) {
        const connectedBoard = this.findBoard();
        if (connectedBoard) {
            // share a board object
            return Promise.resolve(connectedBoard);
        }
        return this.connectMIDI(extensionId)
            .catch(reason => {
                if (this.useSerial) {
                    return this.connectSerial(extensionId);
                }
                return Promise.reject(reason);
            });
    }

    connectSerial (extensionId) {
        if (!('serial' in navigator)) {
            return Promise.reject(new Error('This browser does not support Web Serial API.'));
        }
        const newBoard = new AkaDakoBoard(this.runtime);
        newBoard.extensionId = extensionId;
        return newBoard.connectSerial(this.serialPortOptions)
            .then(connected => {
                this.addBoard(connected);
                connected.once(AkaDakoBoard.RELEASED, () => {
                    this.removeBoard(connected);
                    this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED, {
                        name: connected.name,
                        path: connected.portInfo
                    });
                });
                return connected;
            });
    }

    /**
     * Return a connected AkaDako board via MIDI interface
     * @param {string} extensionId - ID of the extension which is requesting
     * @returns {Promise<AkaDakoBoard>} a Promise which resolves a connected AkaDako board or reject with reason
     */
    connectMIDI (extensionId) {
        const newBoard = new AkaDakoBoard(this.runtime);
        newBoard.extensionId = extensionId;
        return newBoard.connectMIDI(this.midiPortFilters)
            .then(connected => {
                this.addBoard(connected);
                connected.once(AkaDakoBoard.RELEASED, () => {
                    this.removeBoard(connected);
                    this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED, {
                        name: connected.name,
                        path: connected.portInfo
                    });
                });
                return connected;
            });
    }
}

/**
 * Return a shared AkaDako connector object
 * @param {Runtime} runtime - Scratch runtime object
 * @returns {AkaDakoConnector} a AkaDako connector object
 */
export const getAkaDakoConnector = runtime => {
    if (!runtime.akaDakoConnector) {
        runtime.akaDakoConnector = new AkaDakoConnector(runtime);
    }
    return runtime.akaDakoConnector;
};
