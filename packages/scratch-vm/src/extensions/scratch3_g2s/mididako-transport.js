import {EventEmitter} from 'events';


/**
 * This class represents a transport layer using WebMIDI for firmata.js.
 */
class MidiDakoTransport extends EventEmitter {

    /**
     * Construct a WebMIDI transport.
     * @param {MIDIInput} input read data from the MIDI device
     * @param {MIDIOutput} output send data to the MIDI device
     */
    constructor (input, output) {
        super();
        this.input = input;
        this.output = output;
        this.isOpen = this.isConnected();
    }

    /**
     * Whether it is connected or not.
     * @returns {boolean} True for connected.
     */
    isConnected () {
        return this.input.state === 'connected' && this.output.state === 'connected';
    }

    /**
     * It was called when the state of a MIDIPort was changed.
     * It will emit open/close event for firmata-io.
     * @param {Event} event changed state of a MIDIPort [input | output]
     */
    onStateChange (event) {
        if (event.port.state === 'connected') {
            if (!this.isOpen) {
                if (this.input.state === 'connected' && this.output.state === 'connected') {
                    this.isOpen = true;
                    this.emit('open');
                }
            }
            return;
        }
        if (event.port.state === 'disconnected') {
            if (this.isOpen) {
                this.isOpen = false;
                this.emit('error');
            }
            return;
        }
    }

    /**
     * It was called when a message came from the input port.
     * @param {MIDIMessageEvent} message data from the input port
     */
    onMidiMessage (message) {
        this.emit('data', this.convertFromReceived(message.data));
    }

    /**
     * Open input and output port.
     * @returns {Promise<string?>} null or error message
     */
    async open () {
        this.input.onstatechange = event => {
            this.onStateChange(event);
        };
        this.output.onstatechange = event => {
            this.onStateChange(event);
        };
        this.input.onmidimessage = message => {
            this.onMidiMessage(message);
        };
        try {
            await this.input.open();
            await this.output.open();
        } catch (error) {
            return error;
        }
    }


    /**
     * Close input and output port.
     * @returns {Promise<string?>} null or error message.
     */
    async close () {
        try {
            this.input.onstatechange = null;
            this.output.onstatechange = null;
            this.input.onmidimessage = null;
            await this.input.close();
            await this.output.close();
        } catch (error) {
            return error;
        }
    }

    /**
     * Send data to the output port.
     * @param {Buffer} buff Send it to output.
     * @param {Function} callback A function to be called when the data was sent.
     */
    write (buff, callback) {
        if (!this.isConnected()) {
            this.isOpen = false;
            this.emit('error');
            return;
        }
        this.output.send(this.convertToSend(buff));
        if (typeof callback === 'function') {
            callback();
        }
    }

    /**
     * Convert the original Firmata data to a MIDI data to be sent.
     * @param {Buffer} buff Original data.
     * @returns {Uint8Array} Converted data.
     */
    convertToSend (buff) {
        const data = [...buff];
        if (data[0] === 0xF9) { // report version
            // do nothing cause WebMIDI reserved status is not allowed [0xF9]
            return [];
        }
        if (data[0] === 0xF4) { // set PinMode
            // changed cause WebMIDI reserved status is not allowed [0xF4]
            return [0xA0, data[1], data[2]];
        }
        if (data[0] === 0xF0 && data[1] === 0x79) { // query firmware
            // do nothing cause the board freeze
            return [];
        }
        if ((data.length === 3) && (data[0] === 0xF0) && (data[2] === 0xF7)) { // one byte SysEx
            // add a dummy byte cause Windows Chrome(v105) WebMIDI does not send one byte SysEx.
            data.splice(2, 0, 0x00);
            return data;
        }
        return data;
    }

    /**
     * Convert the received MIDI data to a Firmata data.
     * @param {Uint8Array} data Original data.
     * @returns {Uint8Array} Converted data.
     */
    convertFromReceived (data) {
        return data;
    }
}

export default MidiDakoTransport;
