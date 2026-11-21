// === Smalruby: This file is Smalruby-specific (renamed extension card for the transition period) ===
import React from 'react';
import { FormattedMessage } from 'react-intl';
// The pictures of the old card are the Smalrubot S1 robot, as in the old teaching materials.
import legacyInsetIconURL from './legacy-smalrubot-s1-small.png';
import legacyIconURL from './legacy-smalrubot-s1.png';

/**
 * The extension that the old card loads. There is only one extension; the old
 * card is just a second way to reach it under the old name.
 */
const SMALRUBOT_S1_EXTENSION_ID = 'smalrubotS1';

/**
 * The key of the old card in the extension library. It is not an extension ID:
 * it only keeps the React key and the DOM id of the two cards apart.
 */
const SMALRUBOT_S1_LEGACY_CARD_ID = 'smalrubotS1Legacy';

/**
 * The last day (local time) on which the old card is shown. The old name
 * "Smalrubot S1" stays selectable for one year so that existing teaching
 * materials keep working. After this day the card disappears by itself; its
 * code is then removed (see docs/extension-smalrubot-s1/README.md).
 */
const SMALRUBOT_S1_LEGACY_CARD_LAST_DAY = '2027-11-30';

/** The alert shown after the old card is chosen (src/lib/alerts/index.jsx). */
const SMALRUBOT_S1_RENAMED_ALERT_ID = 'smalrubotS1Renamed';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Format a date as YYYY-MM-DD in local time.
 * @param {Date} date - The date.
 * @returns {string} The local date string.
 */
const toLocalDateString = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * Whether the old card is still shown on the given date.
 * @param {Date} now - The current date.
 * @param {string} [lastDay] - The last day (YYYY-MM-DD) to show the card.
 * @returns {boolean} True until the end of the last day (local time).
 */
const isLegacyCardShown = (now, lastDay = SMALRUBOT_S1_LEGACY_CARD_LAST_DAY) => {
    if (!(now instanceof Date) || isNaN(now.getTime())) return false;
    return toLocalDateString(now) <= lastDay;
};

/**
 * Build the old card with the old name and the old pictures. It copies the connection settings of the current card so
 * that the library item looks and behaves like a normal extension card.
 * @param {object} canonical - The current "ArtecRobo" card.
 * @returns {object} The old "Smalrubot S1" card.
 */
const makeLegacyCard = (canonical) => ({
    ...canonical,
    name: (
        <FormattedMessage
            defaultMessage="Smalrubot S1"
            description="Name of the old card for the ArtecRobo extension, shown during the transition period"
            id="gui.smalruby3.extension.smalrubotS1Legacy.name"
        />
    ),
    description: (
        <FormattedMessage
            defaultMessage="The former name of ArtecRobo. Choosing it adds ArtecRobo."
            description="Description of the old card for the ArtecRobo extension"
            id="gui.smalruby3.extension.smalrubotS1Legacy.description"
        />
    ),
    extensionId: SMALRUBOT_S1_LEGACY_CARD_ID,
    iconURL: legacyIconURL,
    insetIconURL: legacyInsetIconURL,
    featured: true,
    tags: ['smalrubot', 'smalrubot s1', 'スモウルボット', 'スモウルボットS1', 'artecrobo', 'studuino'],
    legacyOf: SMALRUBOT_S1_EXTENSION_ID,
    renamedAlertId: SMALRUBOT_S1_RENAMED_ALERT_ID,
});

/**
 * Add the old card right after the current card while the transition period
 * lasts. The list given is not changed.
 * @param {Array<object>} content - The extension library content.
 * @param {Date} now - The current date.
 * @param {string} [lastDay] - The last day (YYYY-MM-DD) to show the card.
 * @returns {Array<object>} The content with the old card, or the same content.
 */
const withLegacyCards = (content, now, lastDay = SMALRUBOT_S1_LEGACY_CARD_LAST_DAY) => {
    if (!isLegacyCardShown(now, lastDay)) return content;
    const index = content.findIndex((item) => item.extensionId === SMALRUBOT_S1_EXTENSION_ID);
    if (index < 0) return content;
    const result = content.slice();
    result.splice(index + 1, 0, makeLegacyCard(content[index]));
    return result;
};

/**
 * Turn a chosen card into the card to load. The old card loads the current
 * extension and asks for the rename alert.
 * @param {object} item - The chosen library item.
 * @param {Array<object>} content - The extension library content.
 * @returns {{item: object, alertId: (string|null)}} The card to load and the alert to show.
 */
const resolveLegacyCard = (item, content) => {
    if (!item || !item.legacyOf) return { item, alertId: null };
    const canonical = content.find((ext) => ext.extensionId === item.legacyOf);
    return {
        item: canonical || { ...item, extensionId: item.legacyOf },
        alertId: item.renamedAlertId || null,
    };
};

export {
    SMALRUBOT_S1_EXTENSION_ID,
    SMALRUBOT_S1_LEGACY_CARD_ID,
    SMALRUBOT_S1_LEGACY_CARD_LAST_DAY,
    SMALRUBOT_S1_RENAMED_ALERT_ID,
    isLegacyCardShown,
    makeLegacyCard,
    resolveLegacyCard,
    withLegacyCards,
};
