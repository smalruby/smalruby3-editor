/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import alerts, { AlertLevels } from '../../../src/lib/alerts/index.jsx';
import extensionLibraryContent from '../../../src/lib/libraries/extensions/index.jsx';
import {
    SMALRUBOT_S1_EXTENSION_ID,
    SMALRUBOT_S1_LEGACY_CARD_ID,
    SMALRUBOT_S1_LEGACY_CARD_LAST_DAY,
    SMALRUBOT_S1_RENAMED_ALERT_ID,
    isLegacyCardShown,
    resolveLegacyCard,
    withLegacyCards,
} from '../../../src/lib/libraries/extensions/smalrubot-s1/legacy-card.jsx';
import en from '../../../src/locales/en.js';
import jaHira from '../../../src/locales/ja-Hira.js';
import ja from '../../../src/locales/ja.js';

const BEFORE_END = new Date(2026, 10, 19, 12, 0, 0);
const LAST_DAY_LATE = new Date(2027, 10, 30, 23, 59, 59);
const AFTER_END = new Date(2027, 11, 1, 0, 0, 0);

describe('isLegacyCardShown', () => {
    test('should keep the old card until 2027-11-30', () => {
        expect(SMALRUBOT_S1_LEGACY_CARD_LAST_DAY).toBe('2027-11-30');
    });

    test('should show the old card before the last day', () => {
        expect(isLegacyCardShown(BEFORE_END)).toBe(true);
    });

    test('should show the old card until the end of the last day', () => {
        expect(isLegacyCardShown(LAST_DAY_LATE)).toBe(true);
    });

    test('should hide the old card after the last day', () => {
        expect(isLegacyCardShown(AFTER_END)).toBe(false);
    });

    test('should follow the given last day', () => {
        expect(isLegacyCardShown(BEFORE_END, '2026-11-18')).toBe(false);
    });

    test('should hide the old card when the date is invalid', () => {
        expect(isLegacyCardShown(new Date('invalid'))).toBe(false);
        expect(isLegacyCardShown(null)).toBe(false);
    });
});

describe('withLegacyCards', () => {
    test('should add the old card right after the current card', () => {
        const content = withLegacyCards(extensionLibraryContent, BEFORE_END);
        const index = content.findIndex(item => item.extensionId === SMALRUBOT_S1_EXTENSION_ID);
        expect(content).toHaveLength(extensionLibraryContent.length + 1);
        expect(content[index + 1].extensionId).toBe(SMALRUBOT_S1_LEGACY_CARD_ID);
        expect(content[index + 1].legacyOf).toBe(SMALRUBOT_S1_EXTENSION_ID);
    });

    test('should keep the keys of the cards unique', () => {
        const content = withLegacyCards(extensionLibraryContent, BEFORE_END);
        const ids = content.map(item => item.extensionId).filter(Boolean);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('should not change the given list', () => {
        const before = extensionLibraryContent.length;
        withLegacyCards(extensionLibraryContent, BEFORE_END);
        expect(extensionLibraryContent).toHaveLength(before);
        expect(extensionLibraryContent.some(item => item.legacyOf)).toBe(false);
    });

    test('should not add the old card after the last day', () => {
        expect(withLegacyCards(extensionLibraryContent, AFTER_END)).toBe(extensionLibraryContent);
    });

    test('should let the old card be found by its old names', () => {
        const legacy = withLegacyCards(extensionLibraryContent, BEFORE_END).find(item => item.legacyOf);
        expect(legacy.tags).toEqual(expect.arrayContaining(['smalrubot', 'スモウルボット']));
    });

    test('should show the old name and say that it is the former name', () => {
        const legacy = withLegacyCards(extensionLibraryContent, BEFORE_END).find(item => item.legacyOf);
        const { container } = render(
            <IntlProvider
                locale="ja"
                messages={ja}
            >
                <div>
                    {legacy.name}
                    {legacy.description}
                </div>
            </IntlProvider>,
        );
        expect(container).toHaveTextContent('スモウルボットS1');
        expect(container).toHaveTextContent('アーテックロボの前の名前です');
    });
});

describe('resolveLegacyCard', () => {
    test('should load the current extension and ask for the alert when the old card is chosen', () => {
        const legacy = withLegacyCards(extensionLibraryContent, BEFORE_END).find(item => item.legacyOf);
        const { item, alertId } = resolveLegacyCard(legacy, extensionLibraryContent);
        expect(item.extensionId).toBe(SMALRUBOT_S1_EXTENSION_ID);
        expect(item.launchPeripheralConnectionFlow).toBe(true);
        expect(alertId).toBe(SMALRUBOT_S1_RENAMED_ALERT_ID);
    });

    test('should leave the other cards as they are', () => {
        const current = extensionLibraryContent.find(ext => ext.extensionId === SMALRUBOT_S1_EXTENSION_ID);
        expect(resolveLegacyCard(current, extensionLibraryContent)).toEqual({ item: current, alertId: null });
    });
});

describe('Smalrubot S1 renamed alert', () => {
    test('should be defined with a close button', () => {
        const alert = alerts.find(a => a.alertId === SMALRUBOT_S1_RENAMED_ALERT_ID);
        expect(alert).toBeDefined();
        expect(alert.closeButton).toBe(true);
    });

    test('should use a level that has a background so the text is readable over the modal', () => {
        const alert = alerts.find(a => a.alertId === SMALRUBOT_S1_RENAMED_ALERT_ID);
        expect(alert.level).toBe(AlertLevels.INFO_BLUE);
    });

    test.each([
        ['ja', ja, 'アーテックロボ」に名前が変わりました'],
        ['ja-Hira', jaHira, 'アーテックロボ」になまえがかわりました'],
        ['en', en, 'Smalrubot S1 is now called'],
    ])('should tell about the rename in %s', (locale, messages, text) => {
        const alert = alerts.find(a => a.alertId === SMALRUBOT_S1_RENAMED_ALERT_ID);
        const { getByTestId } = render(
            <IntlProvider
                locale={locale}
                messages={messages}
            >
                {alert.content}
            </IntlProvider>,
        );
        expect(getByTestId('smalrubot-s1-renamed-alert')).toHaveTextContent(text);
    });
});
