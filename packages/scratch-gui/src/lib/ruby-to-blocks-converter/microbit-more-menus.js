// === Smalruby: This file is Smalruby-specific (menu constants for micro:bit More extension) ===

export const MicrobitMore = 'microbit';
export const MicrobitMoreLegacy = 'microbit_more'; // backward compatibility
export const MicrobitMoreData = 'microbit.data';
export const MicrobitMoreDataLegacy = 'microbit_more.data'; // backward compatibility

export const ButtonIDMenu = [
    'A',
    'B'
];
export const ButtonIDMenuLower = ButtonIDMenu.map(x => x.toLowerCase());

export const ButtonEventMenu = [
    'down',
    'up',
    'click'
];

export const TouchIDMenu = [
    'LOGO',
    'P0',
    'P1',
    'P2'
];
export const TouchIDMenuLower = TouchIDMenu.map(x => x.toLowerCase());

export const TouchEventMenu = {
    touched: 'DOWN',
    released: 'UP',
    tapped: 'CLICK'
};

export const GestureMenu = {
    TILT_UP: 'tilted_front',
    TILT_DOWN: 'tilted_back',
    TILT_LEFT: 'tilted_left',
    TILT_RIGHT: 'tilted_right',
    FACE_UP: 'face up',
    FACE_DOWN: 'face down',
    FREEFALL: 'freefall',
    G3: '3G',
    G6: '6G',
    G8: '8G',
    SHAKE: 'shake',
    JUMPED: 'jumped',
    MOVED: 'moved',
    TILTED: 'tilted_any'
};
export const GestureMenuLower = Object.entries(GestureMenu).map(x => x[1].toLowerCase());
export const GestureMenuValue = Object.entries(GestureMenu).map(x => x[0]);

export const AnalogIn = [0, 1, 2];
export const AnalogInPin = AnalogIn.map(x => `p${x}`);
export const Gpio = [
    0, 1, 2,
    8,
    13, 14, 15, 16
];
export const GpioPin = Gpio.map(x => `p${x}`);

export const AccelerationMenu = [
    'x',
    'y',
    'z',
    'absolute'
];

export const PinModeMenu = [
    'NONE',
    'UP',
    'DOWN'
];
export const PinModeMenuLower = PinModeMenu.map(x => x.toLowerCase());

export const DigitalValueMenu = {
    high: 'true',
    low: 'false'
};
export const DigitalValueMenuLower = Object.keys(DigitalValueMenu);
export const DigitalValueMenuValue = Object.entries(DigitalValueMenu).map(x => x[1]);

export const PinEventTypeMenu = {
    none: 'NONE',
    pulse: 'ON_PULSE',
    edge: 'ON_EDGE'
};
export const PinEventTypeMenuLower = Object.keys(PinEventTypeMenu);
export const PinEventTypeMenuValue = Object.entries(PinEventTypeMenu).map(x => x[1]);

export const PinEventMenu = {
    PULSE_LOW: 'low pulse',
    PULSE_HIGH: 'high pulse',
    FALL: 'fall',
    RISE: 'rise'
};
export const PinEventMenuLower = Object.entries(PinEventMenu).map(x => x[1]);
export const PinEventMenuValue = Object.keys(PinEventMenu);

export const ConnectionStateMenu = [
    'connected',
    'disconnected'
];

export const TouchPinIDMenu = {
    0: 'P0',
    1: 'P1',
    2: 'P2'
};
export const TouchPinIDMenuLower = Object.keys(TouchPinIDMenu);
export const TouchPinIDMenuValue = Object.values(TouchPinIDMenu);

export const TiltDirectionMenu = {
    front: 'FRONT',
    back: 'BACK',
    left: 'LEFT',
    right: 'RIGHT',
    any: 'ANY'
};
export const TiltDirectionMenuLower = Object.keys(TiltDirectionMenu);
export const TiltDirectionMenuValue = Object.values(TiltDirectionMenu);

export const TiltAngleDirectionMenu = {
    front: 'FRONT',
    back: 'BACK',
    left: 'LEFT',
    right: 'RIGHT'
};
export const TiltAngleDirectionMenuLower = Object.keys(TiltAngleDirectionMenu);
export const TiltAngleDirectionMenuValue = Object.values(TiltAngleDirectionMenu);
