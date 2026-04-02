const path = require('path');
const webpack = require('webpack');

// Load environment variables from monorepo root
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

const CopyWebpackPlugin = require('copy-webpack-plugin');

const ScratchWebpackConfigBuilder = require('scratch-webpack-configuration');

const common = {
    libraryName: 'scratch-vm',
    rootPath: path.resolve(__dirname)
};

const nodeBuilder = new ScratchWebpackConfigBuilder(common)
    .setTarget('node')
    .merge({
        entry: {
            'extension-worker': path.join(__dirname, 'src/extension-support/extension-worker.js')
        },
        output: {
            library: {
                name: 'VirtualMachine'
            }
        }
    })
    .addModuleRule({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
        resolve: {
            fullySpecified: false
        }
    });

const webBuilder = new ScratchWebpackConfigBuilder(common)
    .setTarget('browserslist')
    .merge({
        entry: {
            'extension-worker': path.join(__dirname, 'src/extension-support/extension-worker.js')
        },
        resolve: {
            fallback: {
                Buffer: require.resolve('buffer/'),
                // @tensorflow-models/speech-commands references Node.js built-ins
                fs: false,
                util: false
            }
        },
        output: {
            library: {
                name: 'VirtualMachine'
            }
        }
    })
    .addModuleRule({
        test: require.resolve('./src/index.js'),
        loader: 'expose-loader',
        options: {
            exposes: 'VirtualMachine'
        }
    })
    .addModuleRule({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
        resolve: {
            fullySpecified: false
        }
    })
    .addPlugin(new webpack.DefinePlugin({
        'process.env.DEBUG': JSON.stringify(process.env.DEBUG),
        'process.env.MESH_GRAPHQL_ENDPOINT': JSON.stringify(process.env.MESH_GRAPHQL_ENDPOINT),
        'process.env.MESH_API_KEY': JSON.stringify(process.env.MESH_API_KEY),
        'process.env.MESH_AWS_REGION': JSON.stringify(process.env.MESH_AWS_REGION),
        'process.env.MESH_DATA_UPDATE_INTERVAL_MS': JSON.stringify(process.env.MESH_DATA_UPDATE_INTERVAL_MS),
        'process.env.MESH_EVENT_BATCH_INTERVAL_MS': JSON.stringify(process.env.MESH_EVENT_BATCH_INTERVAL_MS)
    }));

const playgroundBuilder = webBuilder
    .clone()
    .merge({
        devServer: {
            contentBase: false,
            host: '0.0.0.0',
            port: process.env.PORT || 8073
        },
        performance: {
            hints: false
        },
        entry: {
            'benchmark': './src/playground/benchmark',
            'video-sensing-extension-debug':
                './src/extensions/scratch3_video_sensing/debug',
            'extension-worker': path.join(
                __dirname,
                'src/extension-support/extension-worker.js'
            )
        },
        output: {
            path: path.resolve(__dirname, 'playground'),
            library: {
                name: 'VirtualMachine'
            }
        }
    })
    .addModuleRule({
        test: require.resolve('stats.js/build/stats.min.js'),
        loader: 'script-loader'
    })
    .addModuleRule({
        test: require.resolve(
            './src/extensions/scratch3_video_sensing/debug.js'
        ),
        loader: 'expose-loader',
        options: {
            exposes: 'Scratch3VideoSensingDebug'
        }
    })
    .addModuleRule({
        test: require.resolve('scratch-blocks/dist/vertical.js'),
        loader: 'expose-loader',
        options: {
            exposes: 'Blockly'
        }
    })
    .addModuleRule({
        test: require.resolve('scratch-audio/src/index.js'),
        loader: 'expose-loader',
        options: {
            exposes: 'AudioEngine'
        }
    })
    .addModuleRule({
        test: require.resolve('scratch-storage'),
        loader: 'expose-loader',
        options: {
            exposes: 'ScratchStorage ScratchStorage'
        }
    })
    .addModuleRule({
        test: require.resolve('@smalruby/scratch-render'),
        loader: 'expose-loader',
        options: {
            exposes: 'ScratchRender'
        }
    })
    .addModuleRule({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
        resolve: {
            fullySpecified: false
        }
    })
    .addPlugin(
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.dirname(require.resolve('scratch-blocks/package.json')) + '/media',
                    to: 'media'
                },
                {
                    from: '../../node_modules/scratch-storage/dist/web'
                },
                {
                    from: '../../node_modules/@smalruby/scratch-render/dist/web'
                },
                {
                    from: '../../node_modules/@smalruby/scratch-svg-renderer/dist/web'
                },
                {
                    from: 'src/playground'
                }
            ]
        })
    );

module.exports = [
    playgroundBuilder.get(), // webpack-dev-server only looks at the first configuration
    nodeBuilder.get(),
    webBuilder.get()
];
