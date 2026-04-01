import {
    parseIntelHex,
    isMacOS,
    isFirmwareFlashSupported,
    SMALRUBOT_S1_BOARD,
} from '../../../src/lib/smalrubot-firmware-flasher';

describe('smalrubot-firmware-flasher', () => {
    describe('parseIntelHex', () => {
        test('should parse a simple data record', () => {
            const hex = ':0300000002000AFB\n:00000001FF\n';
            const result = parseIntelHex(hex);
            expect(result).toEqual(new Uint8Array([0x02, 0x00, 0x0a]));
        });

        test('should parse multiple data records', () => {
            const hex = [':020000000C9451', ':020002000C9449', ':00000001FF'].join('\n');
            const result = parseIntelHex(hex);
            expect(result).toEqual(new Uint8Array([0x0c, 0x94, 0x0c, 0x94]));
        });

        test('should ignore non-data records (except EOF)', () => {
            const hex = [
                ':020000040000FA', // extended linear address (type 04) - ignored
                ':020000000200FC', // data (type 00)
                ':00000001FF', // EOF (type 01)
            ].join('\n');
            const result = parseIntelHex(hex);
            expect(result).toEqual(new Uint8Array([0x02, 0x00]));
        });

        test('should stop at EOF record', () => {
            const hex = [
                ':020000000C9451',
                ':00000001FF',
                ':020002000C9449', // after EOF, should be ignored
            ].join('\n');
            const result = parseIntelHex(hex);
            expect(result).toEqual(new Uint8Array([0x0c, 0x94]));
        });

        test('should handle empty input', () => {
            const result = parseIntelHex('');
            expect(result).toEqual(new Uint8Array([]));
        });

        test('should handle lines without colon prefix', () => {
            const hex = ['not a hex line', ':020000000C9451', '', ':00000001FF'].join('\n');
            const result = parseIntelHex(hex);
            expect(result).toEqual(new Uint8Array([0x0c, 0x94]));
        });

        test('should handle Windows-style line endings', () => {
            const hex = ':020000000C9451\r\n:00000001FF\r\n';
            const result = parseIntelHex(hex);
            expect(result).toEqual(new Uint8Array([0x0c, 0x94]));
        });
    });

    describe('isMacOS', () => {
        const originalNavigator = global.navigator;

        afterEach(() => {
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true,
                configurable: true,
            });
        });

        test('should return true when userAgentData.platform is macOS', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    userAgentData: { platform: 'macOS' },
                    platform: 'Win32',
                },
                writable: true,
                configurable: true,
            });
            expect(isMacOS()).toBe(true);
        });

        test('should return false when userAgentData.platform is Windows', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    userAgentData: { platform: 'Windows' },
                    platform: 'Win32',
                },
                writable: true,
                configurable: true,
            });
            expect(isMacOS()).toBe(false);
        });

        test('should fall back to navigator.platform when userAgentData is unavailable', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    platform: 'MacIntel',
                },
                writable: true,
                configurable: true,
            });
            expect(isMacOS()).toBe(true);
        });

        test('should return false for Linux platform', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    platform: 'Linux x86_64',
                },
                writable: true,
                configurable: true,
            });
            expect(isMacOS()).toBe(false);
        });
    });

    describe('isFirmwareFlashSupported', () => {
        const originalNavigator = global.navigator;

        afterEach(() => {
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true,
                configurable: true,
            });
        });

        test('should return false when WebSerial is not available', () => {
            Object.defineProperty(global, 'navigator', {
                value: { platform: 'Win32' },
                writable: true,
                configurable: true,
            });
            expect(isFirmwareFlashSupported()).toBe(false);
        });

        test('should return false on macOS even with WebSerial', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    serial: { requestPort: jest.fn() },
                    platform: 'MacIntel',
                },
                writable: true,
                configurable: true,
            });
            expect(isFirmwareFlashSupported()).toBe(false);
        });

        test('should return true on Windows with WebSerial', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    serial: { requestPort: jest.fn() },
                    userAgentData: { platform: 'Windows' },
                    platform: 'Win32',
                },
                writable: true,
                configurable: true,
            });
            expect(isFirmwareFlashSupported()).toBe(true);
        });

        test('should return true on ChromeOS with WebSerial', () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    serial: { requestPort: jest.fn() },
                    userAgentData: { platform: 'Chrome OS' },
                    platform: 'Linux x86_64',
                },
                writable: true,
                configurable: true,
            });
            expect(isFirmwareFlashSupported()).toBe(true);
        });
    });

    describe('SMALRUBOT_S1_BOARD', () => {
        test('should have correct board configuration', () => {
            expect(SMALRUBOT_S1_BOARD.baudRate).toBe(115200);
            expect(SMALRUBOT_S1_BOARD.pageSize).toBe(128);
            expect(SMALRUBOT_S1_BOARD.signature).toEqual(new Uint8Array([0x1e, 0x94, 0x06]));
            expect(SMALRUBOT_S1_BOARD.timeout).toBe(400);
        });

        test('should have USB filters for Prolific PL2303 variants', () => {
            expect(SMALRUBOT_S1_BOARD.usbFilters).toEqual([
                { usbVendorId: 0x067b, usbProductId: 0x2303 },
                { usbVendorId: 0x067b, usbProductId: 0x23a3 },
                { usbVendorId: 0x067b, usbProductId: 0x23f3 },
            ]);
        });
    });
});
