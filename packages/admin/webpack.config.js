/**
 * Minimal webpack config for the operator admin SPA (EPIC #1073).
 *
 * Deliberately hand-rolled (not ScratchWebpackConfigBuilder): this package
 * ships a small standalone React app under smalruby.app/admin/ with hash
 * routing, no workers, no PWA and no scratch-vm — the builder's machinery
 * would be dead weight.
 */
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.jsx',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'admin.[contenthash].js',
        // Served from smalruby.app/admin/ (gh-pages destination_dir).
        publicPath: process.env.PUBLIC_PATH || '/admin/',
        clean: true
    },
    resolve: {
        extensions: ['.js', '.jsx']
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: 'babel-loader'
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Smalruby Admin',
            meta: {viewport: 'width=device-width, initial-scale=1'}
        }),
        new webpack.DefinePlugin({
            'process.env.ADMIN_API_ENDPOINT': JSON.stringify(process.env.ADMIN_API_ENDPOINT || ''),
            'process.env.ADMIN_GOOGLE_CLIENT_ID': JSON.stringify(process.env.ADMIN_GOOGLE_CLIENT_ID || ''),
            'process.env.BUG_REPORT_API_ENDPOINT': JSON.stringify(process.env.BUG_REPORT_API_ENDPOINT || '')
        })
    ],
    devServer: {
        port: process.env.PORT || 8602,
        // Rewrite unknown paths (including the slashless /admin) to the SPA
        // index, which lives under publicPath — GitHub Pages does the
        // trailing-slash redirect in production, the dev server does not.
        historyApiFallback: {index: '/admin/'}
    },
    devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map'
};
