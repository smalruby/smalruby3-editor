const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

// Load environment variables from monorepo root
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

// Plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const assetsManifest = require('./src/assetsManifest.json');

const ScratchWebpackConfigBuilder = require('scratch-webpack-configuration');

// const STATIC_PATH = process.env.STATIC_PATH || '/static';

const commonHtmlWebpackPluginOptions = {
    // Google Tag Manager ID
    // Looks like 'GTM-XXXXXXX'
    gtm_id: process.env.GTM_ID || '',

    // Google Tag Manager env & auth info for alterative GTM environments
    // Looks like '&gtm_auth=0123456789abcdefghijklm&gtm_preview=env-00&gtm_cookies_win=x'
    // Taken from the middle of: GTM -> Admin -> Environments -> (environment) -> Get Snippet
    // Blank for production
    gtm_env_auth: process.env.GTM_ENV_AUTH || ''
};

const cssModuleExceptions = [
    /\.raw\.css$/, // Allow for overriding CSS classes from libraries
    /[\\/]driver\.js[\\/].*\.css$/ // driver.js CSS
];

const baseConfig = new ScratchWebpackConfigBuilder(
    {
        rootPath: path.resolve(__dirname),
        enableReact: true,
        enableTs: true,
        shouldSplitChunks: false,
        cssModuleExceptions
    })
    .setTarget('browserslist')
    .merge({
        output: {
            assetModuleFilename: 'static/assets/[name].[hash][ext][query]',
            library: {
                name: 'GUI',
                type: 'umd2'
            },
            // Do not clean the JS files before building as we have two outputs to the same
            // dist directory (the regular and the standalone version)
            clean: false
        },
        resolve: {
            fallback: {
                Buffer: require.resolve('buffer/'),
                stream: require.resolve('stream-browserify'),
                process: require.resolve('process/browser'),
                // Node.js built-ins used by prism-parser.js and @tensorflow-models/speech-commands
                // Provide false fallback so webpack doesn't try to polyfill them for browser
                wasi: false,
                fs: false,
                path: false,
                util: false
            },
            alias: {}
        }
    })
    .addPlugin(new webpack.ProvidePlugin({
        process: 'process/browser'
    }))
    .addModuleRule({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
        resolve: {
            fullySpecified: false
        }
    })
    .addModuleRule({
        test: /\.wasm$/,
        exclude: /prism\.wasm$/,
        type: 'asset/resource'
    })
    .addModuleRule({
        // Embed prism.wasm as Base64 data URL so it works with file:// protocol
        // (used in integration tests). fetch() and XHR are blocked by CORS when
        // the page is loaded via file://.
        test: /prism\.wasm$/,
        type: 'asset/inline'
    })
    .addModuleRule({
        test: /\.(svg|png|wav|mp3|gif|jpg)$/,
        resourceQuery: /^$/, // reject any query string
        type: 'asset' // let webpack decide on the best type of asset
    })
    .addPlugin(new webpack.DefinePlugin({
        'process.env.DEBUG': Boolean(process.env.DEBUG),
        'process.env.GA_ID': `"${process.env.GA_ID || 'UA-000000-01'}"`,
        'process.env.GTM_ENV_AUTH': `"${process.env.GTM_ENV_AUTH || ''}"`,
        'process.env.GTM_ID': process.env.GTM_ID ? `"${process.env.GTM_ID}"` : null,
        'process.env.GOOGLE_CLIENT_ID': `"${process.env.GOOGLE_CLIENT_ID || ''}"`,
        'process.env.GOOGLE_API_KEY': `"${process.env.GOOGLE_API_KEY || ''}"`,
        'process.env.MESH_GRAPHQL_ENDPOINT': `"${process.env.MESH_GRAPHQL_ENDPOINT || ''}"`,
        'process.env.MESH_API_KEY': `"${process.env.MESH_API_KEY || ''}"`,
        'process.env.MESH_AWS_REGION': `"${process.env.MESH_AWS_REGION || ''}"`,
        'process.env.MESH_DATA_UPDATE_INTERVAL_MS': `"${process.env.MESH_DATA_UPDATE_INTERVAL_MS || ''}"`,
        'process.env.MESH_EVENT_BATCH_INTERVAL_MS': `"${process.env.MESH_EVENT_BATCH_INTERVAL_MS || ''}"`,
        'process.env.MESH_PERIODIC_DATA_SYNC_INTERVAL_MS': `"${process.env.MESH_PERIODIC_DATA_SYNC_INTERVAL_MS || ''}"`,
        'process.env.MESH_NETWORK_FILTER': `"${process.env.MESH_NETWORK_FILTER || ''}"`,
        'process.env.RUBYTEE_RELAY_ENDPOINT': `"${process.env.RUBYTEE_RELAY_ENDPOINT || ''}"`,
        // === Smalruby: Start of classroom API ===
        'process.env.CLASSROOM_API_ENDPOINT': `"${process.env.CLASSROOM_API_ENDPOINT || ''}"`,
        'process.env.CLASSROOM_REFRESH_INTERVAL_MS': `"${process.env.CLASSROOM_REFRESH_INTERVAL_MS || '30000'}"`,
        'process.env.MICROSOFT_CLIENT_ID': `"${process.env.MICROSOFT_CLIENT_ID || ''}"`,
        // === Smalruby: End of classroom API ===
        'process.env.MAX_USER_MESSAGE_LENGTH': `"${process.env.MAX_USER_MESSAGE_LENGTH || '250'}"`,
        'process.env.MIN_USER_MESSAGE_LENGTH': `"${process.env.MIN_USER_MESSAGE_LENGTH || '10'}"`,
        // === Smalruby: version update notification ===
        'process.env.COMMIT_SHA': `"${process.env.COMMIT_SHA || ''}"`
    }))
    .addPlugin(new CopyWebpackPlugin({
        patterns: [
            {
                from: path.dirname(require.resolve('scratch-blocks/package.json')) + '/media',
                to: 'static/blocks-media/default'
            },
            {
                from: path.dirname(require.resolve('scratch-blocks/package.json')) + '/media',
                to: 'static/blocks-media/high-contrast'
            },
            {
                // overwrite some of the default block media with high-contrast versions
                // this entry must come after copying scratch-blocks/media into the high-contrast directory
                from: 'src/lib/settings/color-mode/high-contrast/blocks-media',
                to: 'static/blocks-media/high-contrast',
                force: true
            },
            {
                context: '../../node_modules/@smalruby/scratch-vm/dist/web',
                from: 'extension-worker.{js,js.map}',
                noErrorOnMissing: true
            },
            {
                context: '../../node_modules/scratch-storage/dist/web',
                from: 'chunks/fetch-worker.*.{js,js.map}',
                noErrorOnMissing: true
            },
            {
                context: '../../node_modules/scratch-storage/dist/web',
                from: 'chunks/vendors-*.{js,js.map}',
                noErrorOnMissing: true
            },
            {
                from: '../../node_modules/@mediapipe/face_detection',
                to: 'chunks/mediapipe/face_detection'
            }
        ]
    }));

if (!process.env.CI) {
    baseConfig.addPlugin(new webpack.ProgressPlugin());
}

// build the shipping library in `dist/`
const distConfig = baseConfig.clone()
    .merge({
        entry: {
            'scratch-gui': path.join(__dirname, 'src/index.ts')
        },
        output: {
            // We need the public path to be relative, because of scratch-desktop and scratch-android
            // - if the publicPath is static here (defaults to `/`), they are unable to load their assets,
            // which depend on a relative path resolution.
            // (e.g. `/tmp/*path-to-packaged-dist*/static/assets` in scratch-desktop)
            publicPath: 'auto',
            path: path.resolve(__dirname, 'dist')
        }
    })
    .addExternals(['react', 'react-dom', 'redux', 'react-redux'])
    .addPlugin(
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/lib/libraries/*.json',
                    to: 'libraries',
                    flatten: true
                }
            ]
        })
    );

// build the shipping library in `dist/` bundled with react, react-dom, redux, etc.
const distStandaloneConfig = baseConfig.clone()
    .merge({
        entry: {
            'scratch-gui-standalone': path.join(__dirname, 'src/index-standalone.tsx')
        },
        output: {
            path: path.resolve(__dirname, 'dist')
        }
    });

// build the examples and debugging tools in `build/`
const buildConfig = baseConfig.clone()
    .enableDevServer(process.env.PORT || 8601)
    .merge({
        entry: {
            gui: './src/playground/index.jsx',
            // === Smalruby: Start of Microsoft auth redirect ===
            'auth-redirect': './src/playground/auth-redirect.js'
            // === Smalruby: End of Microsoft auth redirect ===
            // Removed unused entry points to reduce build time:
            // guistandalone: './src/playground/standalone.jsx',
            // blocksonly: './src/playground/blocks-only.jsx',
            // compatibilitytesting: './src/playground/compatibility-testing.jsx',
            // player: './src/playground/player.jsx'
        },
        output: {
            path: path.resolve(__dirname, 'build'),

            // This output is loaded using a file:// scheme from the local file system.
            // Having `publicPath: '/'` (the default) means the `gui.js` file in `build/index.html`
            // would be looked for at the root of the filesystem, which is incorrect.
            // Hence, we're resetting the public path to be relative.
            // PUBLIC_PATH can be set for GitHub Pages subdirectory deployments (e.g. /smalruby3-editor/).
            publicPath: process.env.PUBLIC_PATH || ''
        }
    })
    .addPlugin(new HtmlWebpackPlugin({
        ...commonHtmlWebpackPluginOptions,
        chunks: ['gui'],
        template: 'src/playground/index.ejs',
        title: 'Smalruby',
        originTrials: JSON.parse(fs.readFileSync('origin-trials.json')),
        pwa: process.env.NODE_ENV === 'production'
    }))
    // Removed unused HTML files to reduce build time:
    // .addPlugin(new HtmlWebpackPlugin({
    //     ...commonHtmlWebpackPluginOptions,
    //     chunks: ['guistandalone'],
    //     filename: 'standalone.html',
    //     template: 'src/playground/index.ejs',
    //     title: 'Smalruby: Standalone Mode',
    //     originTrials: JSON.parse(fs.readFileSync('origin-trials.json')),
    //     pwa: process.env.NODE_ENV === 'production'
    // }))
    // .addPlugin(new HtmlWebpackPlugin({
    //     ...commonHtmlWebpackPluginOptions,
    //     chunks: ['blocksonly'],
    //     filename: 'blocks-only.html',
    //     template: 'src/playground/index.ejs',
    //     title: 'Smalruby: Blocks Only Example',
    //     originTrials: JSON.parse(fs.readFileSync('origin-trials.json')),
    //     pwa: process.env.NODE_ENV === 'production'
    // }))
    // .addPlugin(new HtmlWebpackPlugin({
    //     ...commonHtmlWebpackPluginOptions,
    //     chunks: ['compatibilitytesting'],
    //     filename: 'compatibility-testing.html',
    //     template: 'src/playground/index.ejs',
    //     title: 'Smalruby: Compatibility Testing',
    //     originTrials: JSON.parse(fs.readFileSync('origin-trials.json')),
    //     pwa: process.env.NODE_ENV === 'production'
    // }))
    // .addPlugin(new HtmlWebpackPlugin({
    //     ...commonHtmlWebpackPluginOptions,
    //     chunks: ['player'],
    //     filename: 'player.html',
    //     template: 'src/playground/index.ejs',
    //     title: 'Smalruby: Player Example',
    //     originTrials: JSON.parse(fs.readFileSync('origin-trials.json')),
    //     pwa: process.env.NODE_ENV === 'production'
    // }))
    .addPlugin(new CopyWebpackPlugin({
        patterns: [
            {
                from: 'static',
                to: 'static'
            },
            {
                from: 'legal',
                to: '.',
                globOptions: { dot: true }
            },
            {
                from: 'extensions/**',
                to: 'static',
                context: 'src/examples'
            }
        ]
    }));

const buildWithPwaConfig = buildConfig.clone()
    .addPlugin(
        new WorkboxPlugin.GenerateSW({
            disableDevLogs: !process.env.DEBUG,
            clientsClaim: true,
            skipWaiting: true,
            additionalManifestEntries: assetsManifest,
            exclude: [
                /\.DS_Store/,
                /version\.json$/ // === Smalruby: exclude from precache for version update notification ===
            ],
            maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
            // Don't add revision to files that already have hash in filename
            dontCacheBustURLsMatching: /\.[0-9a-f]{8,}\./
        })
    )
    .addPlugin(
        new WebpackPwaManifest({
            publicPath: './',
            name: 'Smalruby',
            short_name: 'Smalruby',
            description: 'GraphicaL User Interface for creating and running Smalruby 3.0 projects',
            background_color: '#ffffff',
            orientation: 'any',
            crossorigin: 'use-credentials',
            inject: true,
            ios: {
                'apple-mobile-web-app-title': 'Smalruby',
                'apple-mobile-web-app-status-bar-style': 'default'
            },
            icons: [
                {
                    src: path.resolve('static/pwa-icon.png'),
                    sizes: [96, 128, 192, 256, 384, 512] // multiple sizes
                }
            ]
        })
    );

// build the production website in `dist/` with HTML, PWA, and optimized assets
const distWithHtmlConfig = buildConfig.clone()
    .merge({
        devtool: false, // Disable source maps for production
        output: {
            // Add contenthash for cache busting, except auth-redirect which is
            // referenced by a static HTML file (legal/auth-redirect.html) with a
            // fixed <script src="auth-redirect.js"> tag.
            filename: (pathData) =>
                pathData.chunk.name === 'auth-redirect'
                    ? '[name].js'
                    : '[name].[contenthash].js',
            path: path.resolve(__dirname, 'dist'),
            clean: false
        },
        optimization: {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    minify: TerserPlugin.esbuildMinify
                })
            ]
        }
    })
    .addPlugin(
        new WorkboxPlugin.GenerateSW({
            disableDevLogs: !process.env.DEBUG,
            clientsClaim: true,
            skipWaiting: true,
            additionalManifestEntries: assetsManifest,
            exclude: [
                /\.DS_Store/,
                /version\.json$/ // === Smalruby: exclude from precache for version update notification ===
            ],
            maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
            // Don't add revision to files that already have hash in filename
            dontCacheBustURLsMatching: /\.[0-9a-f]{8,}\./
        })
    )
    .addPlugin(
        new WebpackPwaManifest({
            publicPath: './',
            name: 'Smalruby',
            short_name: 'Smalruby',
            description: 'GraphicaL User Interface for creating and running Smalruby 3.0 projects',
            background_color: '#ffffff',
            orientation: 'any',
            crossorigin: 'use-credentials',
            inject: true,
            ios: {
                'apple-mobile-web-app-title': 'Smalruby',
                'apple-mobile-web-app-status-bar-style': 'default'
            },
            icons: [
                {
                    src: path.resolve('static/pwa-icon.png'),
                    sizes: [96, 128, 192, 256, 384, 512] // multiple sizes
                }
            ]
        })
    );

// Skip building `dist/` unless explicitly requested
// It roughly doubles build time and isn't needed for `scratch-gui` development
// If you need non-production `dist/` for local dev, such as for `scratch-www` work, you can run something like:
// `BUILD_MODE=dist npm run build`
const buildDist = process.env.NODE_ENV === 'production' || process.env.BUILD_MODE === 'dist';

let config;
switch (process.env.BUILD_TYPE) {
case 'dist': config = distConfig.get(); break;
case 'dist-standalone': config = distStandaloneConfig.get(); break;
case 'dist-html': {
    config = distWithHtmlConfig.get();
    // In production (dist-html), prism.wasm is served over HTTPS so fetch() is available.
    // Use asset/resource to emit a separate file (better caching, smaller bundle, streaming compile).
    // The file:// fallback (asset/inline + atob) is only needed for integration tests.
    const wasmRule = config.module.rules.find(r => r.test && r.test.toString() === '/prism\\.wasm$/');
    if (wasmRule) {
        wasmRule.type = 'asset/resource';
    }
    break;
}
default: config = buildWithPwaConfig.get(); break;
}

const finalConfig = buildDist ? config : buildConfig.get();

// Override devServer headers to allow Google Picker API to work
// Must be done after .get() to ensure it's not overridden by ScratchWebpackConfigBuilder
if (!buildDist && finalConfig.devServer) {
    finalConfig.devServer.headers = {
        ...finalConfig.devServer.headers,
        'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
    };
}

module.exports = finalConfig;
