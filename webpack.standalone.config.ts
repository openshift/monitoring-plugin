/* eslint-env node */

import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import { Configuration as WebpackConfiguration } from 'webpack';
import { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';
import * as path from 'path';

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}

const config: Configuration = {
  mode: 'development',
  entry: './e2e-tests-app.tsx',
  context: path.resolve(__dirname, 'src'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]-bundle.js',
    chunkFilename: '[name]-chunk.js',
    publicPath: '/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(jsx?|tsx?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        exclude: /node_modules\/(?!(@patternfly|@openshift-console)\/).*/,
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
            },
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              sassOptions: {
                outputStyle: 'compressed',
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|woff2?|ttf|eot|otf)(\?.*$|$)/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[ext]',
        },
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  devServer: {
    static: './dist',
    historyApiFallback: {
      index: '/index.html',
    },
    port: 9003,
    // Allow bridge running in a container to connect to the plugin dev server.
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization'
    },
    devMiddleware: {
      writeToDisk: true,
    },
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/dynamic-plugin-sdk/, (resource) => {
      if (!resource.contextInfo.issuer.includes('cypress/dummy')) {
        resource.request = path.resolve(__dirname, 'cypress/dummy');
      }
    }),
    new webpack.NormalModuleReplacementPlugin(/@console\//, (resource) => {
      resource.request = path.resolve(__dirname, 'cypress/dummy-sdk-internal');
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'e2e-tests-index.html'),
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, 'locales'), to: 'locales' }],
    }),
  ],
  devtool: 'source-map',
  optimization: {
    chunkIds: 'named',
    minimize: false,
  },
};

export default config;
