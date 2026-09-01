/* eslint-env node */

import CopyWebpackPlugin from 'copy-webpack-plugin';
import { DefinePlugin, Configuration as WebpackConfiguration } from 'webpack';
import { Configuration as WebpackDevServerConfiguration } from 'webpack-dev-server';
import * as path from 'path';
import { ConsoleRemotePlugin } from '@openshift-console/dynamic-plugin-sdk-webpack';
import pkg from './package.json';

interface Configuration extends WebpackConfiguration {
  devServer?: WebpackDevServerConfiguration;
}

const config: Configuration = {
  mode: 'development',
  // No regular entry points. The remote container entry is handled by ConsoleRemotePlugin.
  entry: {},
  context: path.resolve(__dirname, 'src'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]-bundle.js',
    chunkFilename: '[name]-chunk.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      // @console/internal modules are provided by the OpenShift Console at runtime.
      // Stub them out during development builds to prevent webpack resolution errors.
      '@console/internal': false,
      '@console/shared': false,
      // Alias for all source modules — use @/ instead of relative imports.
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        exclude: /node_modules\/(?!(@patternfly|@openshift-console\/plugin-shared)\/).*/,
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
    hot: false,
    liveReload: true,
    port: process.env.PORT || 9001,
    // Allow bridge running in a container to connect to the plugin dev server.
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization',
    },
    devMiddleware: {
      writeToDisk: true,
    },
  },
  plugins: [
    new ConsoleRemotePlugin({
      pluginMetadata: process.env.CONSOLE_PLUGIN_NAME
        ? { ...pkg.consolePlugin, name: process.env.CONSOLE_PLUGIN_NAME }
        : undefined,
      validateExtensionIntegrity: false,
      extensions: [],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'locales'),
          to({ absoluteFilename }) {
            if (!absoluteFilename) {
              return 'locales/[path][name][ext]';
            }
            const i18nNamespace = `plugin__${process.env.CONSOLE_PLUGIN_NAME ?? 'monitoring-plugin'}`;
            const relativePath = path.relative(
              path.resolve(__dirname, 'locales'),
              absoluteFilename,
            );
            return path.join(
              'locales',
              relativePath.replace('plugin__monitoring-plugin', i18nNamespace),
            );
          },
        },
      ],
    }),
    new DefinePlugin({
      // Build-time injection of proxy path for config module
      PERSES_PROXY_BASE_URL: JSON.stringify('/api/proxy/plugin/monitoring-console-plugin/perses'),
      'process.env.I18N_NAMESPACE': JSON.stringify(
        `plugin__${process.env.CONSOLE_PLUGIN_NAME ?? 'monitoring-plugin'}`,
      ),
    }),
  ],
  devtool: 'source-map',
  optimization: {
    chunkIds: 'named',
    minimize: false,
  },
  stats: {
    errorDetails: true,
  },
  ignoreWarnings: [
    (warning) => {
      // Since we are adding all features in dynamically on the backend, we want to
      // suppress the warning that what were are building does not have any extensions
      if (warning.message === 'Plugin has no extensions') {
        return true;
      }
      return false;
    },
  ],
};

if (process.env.NODE_ENV === 'production') {
  config.mode = 'production';
  config.output.filename = '[name]-bundle-[hash].min.js';
  config.output.chunkFilename = '[name]-chunk-[chunkhash].min.js';
  config.optimization.chunkIds = 'deterministic';
  config.optimization.minimize = true;
  config.devtool = false;

  // Use default esbuild-loader for prod
  config.module.rules?.unshift({
    test: /\.[jt]sx?$/,
    loader: 'esbuild-loader',
    options: {
      target: 'es2021',
    },
  });
} else {
  config.module.rules?.unshift({
    test: /\.(jsx?|tsx?)$/,
    exclude: /node_modules/,
    use: {
      loader: 'swc-loader',
    },
  });
}

export default config;
