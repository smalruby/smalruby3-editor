import analytics from '../../../src/lib/analytics';
import {
    OLD_SMALRUBY_TUTORIAL_IDS,
    TUTORIAL_URL_CATEGORY,
    reportTutorialUrlNotFound,
    tutorialUrlNotFoundEvent,
} from '../../../src/lib/tutorial-url-analytics';

jest.mock('../../../src/lib/analytics', () => ({
    __esModule: true,
    default: { event: jest.fn() },
}));

describe('tutorialUrlNotFoundEvent', () => {
    test('sends an old Smalruby tutorial id as the label', () => {
        expect(tutorialUrlNotFoundEvent('chat1Basic1')).toEqual({
            category: TUTORIAL_URL_CATEGORY,
            action: 'not_found',
            label: 'chat1Basic1',
        });
    });

    test('sends unknown for an id that is not in the allow-list', () => {
        expect(tutorialUrlNotFoundEvent('my-secret-class-42')).toEqual({
            category: 'tutorial_url',
            action: 'not_found',
            label: 'unknown',
        });
    });

    test('sends unknown for a non-string value', () => {
        expect(tutorialUrlNotFoundEvent(null).label).toBe('unknown');
        expect(tutorialUrlNotFoundEvent(['chat1Basic1']).label).toBe('unknown');
    });

    test('does not let prototype keys through the allow-list', () => {
        expect(tutorialUrlNotFoundEvent('constructor').label).toBe('unknown');
        expect(tutorialUrlNotFoundEvent('toString').label).toBe('unknown');
    });

    test('allow-list covers every tutorial id that Smalruby used to link to', () => {
        expect(OLD_SMALRUBY_TUTORIAL_IDS).toEqual([
            'chat1Basic1',
            'chat1Basic2',
            'chat1Basic3',
            'chat2Sprites1',
            'chat2Sprites2',
            'chat2Sprites3',
            'chat3Mesh1',
            'chat3Mesh2',
            'chat3Mesh3',
            'gettingStartedCostume',
            'gettingStartedSprites',
            'rubyBasics1Numbers',
            'rubyBasics2Strings',
            'rubyBasics3Variables',
            'rubyBasics4Arrays',
            'rubyBasics5Blocks',
            'rubyBasics6Methods',
            'rubyBasics7Next',
        ]);
    });
});

describe('reportTutorialUrlNotFound', () => {
    beforeEach(() => {
        analytics.event.mockReset();
    });

    test('sends the event through analytics', () => {
        reportTutorialUrlNotFound('rubyBasics1Numbers');
        expect(analytics.event).toHaveBeenCalledWith({
            category: 'tutorial_url',
            action: 'not_found',
            label: 'rubyBasics1Numbers',
        });
    });

    test('swallows errors from analytics', () => {
        analytics.event.mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => reportTutorialUrlNotFound('chat3Mesh1')).not.toThrow();
    });
});
