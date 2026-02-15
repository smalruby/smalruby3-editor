// Setup Opal and opal-parser for Jest tests
const fs = require('fs');
const path = require('path');

// Load setup-opal.js which contains both opal.min.js and opal-parser.min.js
const setupOpalPath = path.join(__dirname, '../static/javascripts/setup-opal.js');

if (fs.existsSync(setupOpalPath)) {
    // Load the setup-opal.js file
    const setupOpalContent = fs.readFileSync(setupOpalPath, 'utf8');
    eval(setupOpalContent); // eslint-disable-line no-eval

    // Make Opal available globally
    if (typeof Opal !== 'undefined') {
        global.Opal = Opal;
    }
} else {
    console.error('setup-opal.js not found. Run npm run setup:opal first.');
}
