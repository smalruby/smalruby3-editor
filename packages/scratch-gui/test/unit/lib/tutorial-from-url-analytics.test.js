import { detectTutorialId } from '../../../src/lib/tutorial-from-url';
import { reportTutorialUrlNotFound } from '../../../src/lib/tutorial-url-analytics';

jest.mock('../../../src/lib/tutorial-url-analytics', () => ({
    reportTutorialUrlNotFound: jest.fn(),
}));

describe('detectTutorialId', () => {
    beforeEach(() => {
        reportTutorialUrlNotFound.mockReset();
    });

    test('finds an upstream tutorial by its url id', () => {
        expect(detectTutorialId({ tutorial: 'getStarted' })).toBe('intro-move-sayhello');
        expect(reportTutorialUrlNotFound).not.toHaveBeenCalled();
    });

    test('returns all for the tutorial list', () => {
        expect(detectTutorialId({ tutorial: 'all' })).toBe('all');
        expect(reportTutorialUrlNotFound).not.toHaveBeenCalled();
    });

    test('returns null without a tutorial parameter', () => {
        expect(detectTutorialId({})).toBeNull();
        expect(reportTutorialUrlNotFound).not.toHaveBeenCalled();
    });

    test('reports a tutorial that no longer exists', () => {
        expect(detectTutorialId({ tutorial: 'chat1Basic1' })).toBeNull();
        expect(reportTutorialUrlNotFound).toHaveBeenCalledWith('chat1Basic1');
    });

    test('uses the first value when the parameter is repeated', () => {
        expect(detectTutorialId({ tutorial: ['rubyBasics1Numbers', 'getStarted'] })).toBeNull();
        expect(reportTutorialUrlNotFound).toHaveBeenCalledWith('rubyBasics1Numbers');
    });
});
