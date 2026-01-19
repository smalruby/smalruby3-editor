// Post-build script to fix fetch-worker paths for GitHub Pages subdirectory deployments
// This script runs after webpack build and modifies the generated JavaScript files
// to ensure correct worker loading when PUBLIC_PATH is set for subdirectory deployments

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

// these aren't set in ESM mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// base/root path for the project
const basePath = path.join(__dirname, '..');
const buildPath = path.join(basePath, 'build');

/**
 * Fix fetch-worker paths in JavaScript files for subdirectory deployments
 * @param {string} filePath - Path to the JavaScript file
 * @param {string} publicPath - The public path (e.g., '/smalruby3-gui/')
 */
const fixFetchWorkerPaths = (filePath, publicPath) => {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Replace relative "chunks/" paths with absolute paths including publicPath
    const fixedContent = content.replace(
        /return "chunks\/" \+ "fetch-worker"/g,
        `return "${publicPath}chunks/" + "fetch-worker"`
    ).replace(
        /[=]>"chunks\/fetch-worker\./g,
        `=>"${publicPath}chunks/fetch-worker.`
    );

    if (content === fixedContent) {
        console.info(`No fetch-worker paths found in ${path.relative(basePath, filePath)}`);
    } else {
        fs.writeFileSync(filePath, fixedContent);
        console.info(`Fixed fetch-worker paths in ${path.relative(basePath, filePath)}`);
    }
};

const postbuild = () => {
    const publicPath = process.env.PUBLIC_PATH;

    if (!publicPath) {
        console.info('PUBLIC_PATH not set - skipping fetch-worker path fixes');
        return;
    }

    console.info(`PUBLIC_PATH is set to: ${publicPath}`);
    console.info('Fixing fetch-worker paths for subdirectory deployment...');

    // Files that need fetch-worker path fixes
    const filesToFix = [
        path.join(buildPath, 'gui.js'),
        path.join(buildPath, 'player.js')
    ];

    for (const filePath of filesToFix) {
        fixFetchWorkerPaths(filePath, publicPath);
    }
};

postbuild();
console.info('Post-build script complete');
process.exit(0);
