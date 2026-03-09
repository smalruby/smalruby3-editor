// === Smalruby: This file is Smalruby-specific (unit tests for Touch pointer event patches) ===
import {patchTouchForPointerEvents} from '../../../src/lib/blocks-touch-patch';

describe('patchTouchForPointerEvents', () => {
    let mockScratchBlocks;

    beforeEach(() => {
        // Create a mock ScratchBlocks.Touch that mirrors the original behavior
        mockScratchBlocks = {
            Touch: {
                touchIdentifier_: null,
                getTouchIdentifierFromEvent (e) {
                    return (e.changedTouches && e.changedTouches[0] &&
                        e.changedTouches[0].identifier != undefined &&
                        e.changedTouches[0].identifier != null)
                        ? e.changedTouches[0].identifier : 'mouse';
                },
                checkTouchIdentifier (e) {
                    const identifier = this.getTouchIdentifierFromEvent(e);
                    if (this.touchIdentifier_ != undefined &&
                        this.touchIdentifier_ != null) {
                        return this.touchIdentifier_ == identifier; // eslint-disable-line eqeqeq
                    }
                    if (e.type == 'mousedown' || e.type == 'touchstart') { // eslint-disable-line eqeqeq
                        this.touchIdentifier_ = identifier;
                        return true;
                    }
                    return false;
                },
                isMouseOrTouchEvent (e) {
                    return e.type.startsWith('touch') || e.type.startsWith('mouse');
                }
            },
            utils: {
                startsWith (str, prefix) {
                    return str.startsWith(prefix);
                }
            }
        };
    });

    describe('before patch (original behavior)', () => {
        test('checkTouchIdentifier returns true for mousedown', () => {
            const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'mousedown'});
            expect(result).toBe(true);
        });

        test('checkTouchIdentifier returns true for touchstart', () => {
            const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'touchstart'});
            expect(result).toBe(true);
        });

        test('checkTouchIdentifier returns false for pointerdown', () => {
            const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'pointerdown'});
            expect(result).toBe(false);
        });

        test('isMouseOrTouchEvent returns false for pointer events', () => {
            const result = mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'pointerdown'});
            expect(result).toBe(false);
        });
    });

    describe('after patch', () => {
        beforeEach(() => {
            patchTouchForPointerEvents(mockScratchBlocks);
        });

        describe('checkTouchIdentifier', () => {
            test('still returns true for mousedown', () => {
                const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'mousedown'});
                expect(result).toBe(true);
            });

            test('still returns true for touchstart', () => {
                const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'touchstart'});
                expect(result).toBe(true);
            });

            test('returns true for pointerdown', () => {
                const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'pointerdown'});
                expect(result).toBe(true);
            });

            test('sets touchIdentifier_ on pointerdown', () => {
                mockScratchBlocks.Touch.checkTouchIdentifier({type: 'pointerdown'});
                expect(mockScratchBlocks.Touch.touchIdentifier_).toBe('mouse');
            });

            test('tracks identifier across pointer events', () => {
                // Start gesture with pointerdown
                const startResult = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'pointerdown'});
                expect(startResult).toBe(true);

                // Continue with pointermove - same identifier should match
                const moveResult = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'pointermove'});
                expect(moveResult).toBe(true);
            });

            test('returns false for unknown event types when no identifier set', () => {
                const result = mockScratchBlocks.Touch.checkTouchIdentifier({type: 'click'});
                expect(result).toBe(false);
            });

            test('handles touch identifier from changedTouches', () => {
                const touchEvent = {
                    type: 'pointerdown',
                    changedTouches: [{identifier: 42}]
                };
                const result = mockScratchBlocks.Touch.checkTouchIdentifier(touchEvent);
                expect(result).toBe(true);
                expect(mockScratchBlocks.Touch.touchIdentifier_).toBe(42);
            });
        });

        describe('isMouseOrTouchEvent', () => {
            test('still returns true for mouse events', () => {
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'mousedown'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'mousemove'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'mouseup'})).toBe(true);
            });

            test('still returns true for touch events', () => {
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'touchstart'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'touchmove'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'touchend'})).toBe(true);
            });

            test('returns true for pointer events', () => {
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'pointerdown'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'pointermove'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'pointerup'})).toBe(true);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'pointercancel'})).toBe(true);
            });

            test('returns false for non-input events', () => {
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'click'})).toBe(false);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'keydown'})).toBe(false);
                expect(mockScratchBlocks.Touch.isMouseOrTouchEvent({type: 'wheel'})).toBe(false);
            });
        });
    });
});
