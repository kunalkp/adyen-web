const webpack = require('webpack');
const merge = require('webpack-merge');
const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const webpackConfig = require('./webpack.config');
const checkoutDevServer = require('../server');
const currentVersion = require('./version')();
const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3020';
const resolve = dir => path.resolve(__dirname, dir);

// NOTE: The first page in the array will be considered the index page.
const htmlPages = [
    'Dropin',
    'Card',
    'Components',
    'SecuredFields',
    'SecuredFieldsPure',
    'IssuerLists',
    'Voucher',
    'QRCode',
    'Giftcards',
    'OpenInvoice'
];

const htmlPageGenerator = name =>
    new HTMLWebpackPlugin({
        filename: name === htmlPages[0] ? 'index.html' : `${name.toLowerCase()}/index.html`,
        template: path.join(__dirname, `../playground/${name}/${name}.html`),
        templateParameters: () => ({ htmlWebpackPlugin: { htmlPages } }),
        inject: 'body',
        chunks: [`AdyenDemo${name}`],
        chunksSortMode: 'manual'
    });

const entriesReducer = (acc, cur) => {
    acc[`AdyenDemo${cur}`] = path.join(__dirname, `../playground/${cur}/${cur}.js`);
    return acc;
};

const generatedPages = htmlPages.map(htmlPageGenerator);
const generatedEntries = htmlPages.reduce(entriesReducer, {});

module.exports = merge(webpackConfig, {
    mode: 'development',
    plugins: [
        ...generatedPages,
        new webpack.HotModuleReplacementPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                __SF_ENV__: JSON.stringify(process.env.SF_ENV || 'build'),
                __CLIENT_KEY__: JSON.stringify(process.env.CLIENT_KEY || null),
                VERSION: JSON.stringify(currentVersion.ADYEN_WEB_VERSION),
                COMMIT_HASH: JSON.stringify(currentVersion.COMMIT_HASH),
                COMMIT_BRANCH: JSON.stringify(currentVersion.COMMIT_BRANCH)
            }
        })
    ],
    devtool: 'cheap-module-source-map',
    entry: {
        ...generatedEntries,
        AdyenCheckout: path.join(__dirname, '../src/index.ts')
    },
    output: {
        pathinfo: true,
        library: '[name]',
        libraryTarget: 'var',
        libraryExport: 'default'
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx|mjs)$/,
                enforce: 'pre',
                use: [
                    {
                        loader: 'eslint-loader',
                        options: {
                            emitWarning: true
                        }
                    }
                ],
                include: [resolve('../src')],
                exclude: [resolve('../node_modules')]
            },
            {
                test: /\.(ts|tsx)$/,
                enforce: 'pre',
                use: [
                    {
                        loader: 'eslint-loader',
                        options: {
                            emitWarning: true
                        }
                    }
                ],
                include: [resolve('../src')],
                exclude: [resolve('../node_modules')]
            },
            {
                // "oneOf" will traverse all following loaders until one will
                // match the requirements. When no loader matches it will fall
                // back to the "file" loader at the end of the loader list.
                oneOf: [
                    // "url" loader works just like "file" loader but it also embeds
                    // assets smaller than specified size as data URLs to avoid requests.
                    {
                        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            name: 'static/media/[name].[hash:8].[ext]'
                        }
                    },
                    {
                        test: [/\.js?$/],
                        include: [resolve('../src'), resolve('../demo')],
                        exclude: /node_modules/,
                        use: [
                            {
                                loader: 'ts-loader',
                                options: { configFile: resolve('../tsconfig.json') }
                            }
                        ]
                    },
                    {
                        test: [/\.ts?$/, /\.tsx?$/],
                        include: [resolve('../src'), resolve('../playground')],
                        exclude: /node_modules/,
                        use: [
                            {
                                loader: 'ts-loader',
                                options: { configFile: resolve('../tsconfig.json') }
                            }
                        ]
                    },
                    {
                        test: /\.scss$/,
                        exclude: /\.module.scss$/,
                        resolve: { extensions: ['.scss'] },
                        use: [
                            {
                                loader: 'style-loader'
                            },
                            {
                                loader: 'css-loader'
                            },
                            {
                                loader: 'postcss-loader',
                                options: { config: { path: 'config/' } }
                            },
                            {
                                loader: 'sass-loader'
                            }
                        ]
                    },
                    {
                        test: /\.module.scss$/,
                        resolve: {
                            extensions: ['.scss']
                        },
                        use: [
                            {
                                loader: 'style-loader'
                            },
                            {
                                loader: 'css-loader',
                                options: { modules: true, sourceMap: true }
                            },
                            {
                                loader: 'postcss-loader',
                                options: { config: { path: 'config/' } }
                            },
                            {
                                loader: 'sass-loader'
                            }
                        ]
                    },
                    // "file" loader makes sure assets end up in the `build` folder.
                    // When you `import` an asset, you get its filename.
                    // This loader doesn't use a "test" so it will catch all modules
                    // that fall through the other loaders.
                    {
                        loader: 'file-loader',
                        // Exclude `js` files to keep "css" loader working as it injects
                        // it's runtime that would otherwise be processed through "file" loader.
                        // Also exclude `html` and `json` extensions so they get processed
                        // by webpacks internal loaders.
                        exclude: [/\.(js|jsx|ts|tsx|mjs)$/, /\.html$/, /\.json$/],
                        options: {
                            name: 'static/media/[name].[hash:8].[ext]'
                        }
                    }
                ]
            }
        ]
    },
    devServer: {
        before: app => checkoutDevServer(app),
        port,
        host,
        https: false,
        // publicPath: '/',
        inline: true,

        // Enable hot reloading server. It will provide /sockjs-node/ endpoint
        // for the WebpackDevServer client so it can learn when the files were
        // updated. The WebpackDevServer client is included as an entry point
        // in the Webpack development configuration. Note that only changes
        // to CSS are currently hot reloaded. JS changes will refresh the browser.
        hot: true,

        // Enable gzip compression of generated files.
        compress: true,

        // Silence WebpackDevServer's own logs since they're generally not useful.
        // It will still show compile warnings and errors with this setting.
        clientLogLevel: 'none',

        // By default files from `contentBase` will not trigger a page reload.
        watchContentBase: false,

        // Reportedly, this avoids CPU overload on some systems.
        // https://github.com/facebook/create-react-app/issues/293
        // src/node_modules is not ignored to support absolute imports
        // https://github.com/facebook/create-react-app/issues/1065
        watchOptions: {
            ignore: /node_modules/,
            aggregateTimeout: 200,
            poll: 500
        },

        overlay: false
    }
});
