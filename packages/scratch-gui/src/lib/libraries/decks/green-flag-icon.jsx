import React from 'react';
// Green flag icon for inline use in tutorial step titles. Shared by
// index.jsx (chat decks) and decks/categories/*.jsx (issue #932).
import greenFlagIcon from '../../../components/green-flag/icon--green-flag.svg';

const GreenFlagIcon = () => (
    <img
        src={greenFlagIcon}
        style={{
            display: 'inline-block',
            height: '1.2em',
            verticalAlign: 'middle',
            margin: '0 0.1em',
        }}
    />
);

export default GreenFlagIcon;
