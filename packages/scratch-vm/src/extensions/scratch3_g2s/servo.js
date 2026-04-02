/**
 * This is a class to represent a servo motor
 */
export default class Servo {

    /**
     * Constructor of Servo instance.
     * @param {AkadakoBoard} board - connecting akadako board
     * @param {number} pin - the pin the servo is connected to
     */
    constructor (board, pin) {
        /**
         * Connecting akadako board
         * @type {import('./akadako-board').default}
         */
        this.board = board;

        /**
         * The pin the servo is connected
         * @type {number}
         */
        this.pin = pin;

        /**
         * This servo is busy or not
         * @type {boolean}
         */
        this.isBusy = false;

        /**
         * Current angle of this servo arm
         * @type {number}
         */
        this.angle = 0;
        this.mtx = false;
    }

    /**
     * Turn this to the angle
     * @param {number} angle - degree to turn
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    turn (angle) {
        let servoValue = 90 - angle; // convert from zero centered clockwise
        servoValue = Math.min(180, Math.max(0, servoValue));
        this.board.pinMode(this.pin, this.board.MODES.SERVO);
        return this.board.servoWrite(this.pin, servoValue);
    }

    /**
     * Turn this to the angle with the speed
     * @param {number} angle - degree to turn
     * @param {number} speed - turn speed
     */
    async turnWithSpeed (angle, speed) {
        if (speed <= 0) return; // Do not rotate when the speed is zero or less.

        const MAX_SPEED = 100;
        speed = Math.min(MAX_SPEED, speed);
        angle = Math.min(90, Math.max(-90, angle));

        const startAngle = this.angle;
        const SPEED_ADJUSTER = 40.0;
        const step = Math.abs(Math.round(((angle - startAngle) / 180.0) * (100.0 / (speed / SPEED_ADJUSTER))));
        const stepAngle = (angle - startAngle) / step;

        if (angle === startAngle || speed === MAX_SPEED) {
            this.angle = angle;
            await this.turn(this.angle);
            return;
        }

        for (let i = 0; i < step; i++) {
            this.angle += stepAngle;
            await this.turn(this.angle);
        }
    }
}
