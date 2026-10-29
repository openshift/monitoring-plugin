import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { Configuration, DefinePlugin, NormalModuleReplacementPlugin } from 'webpack';
import 'webpack-dev-server';

const harness = path.resolve(__dirname, 'cypress/logging/harness');

const config: Configuration = {
  mode: 'development',
  entry: path.join(harness, 'app.tsx'),
  output: { path: path.resolve(__dirname, 'dist-logging'), publicPath: '/' },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'esbuild-loader',
        options: { target: 'es2021' },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(svg|png|woff2?|ttf|eot)$/, type: 'asset/resource' },
      { test: /\.m?js/, resolve: { fullySpecified: false } },
    ],
  },
  plugins: [
    new DefinePlugin({
      'process.env.I18N_NAMESPACE': JSON.stringify('plugin__monitoring-console-plugin'),
    }),
    new NormalModuleReplacementPlugin(/^@openshift-console\/dynamic-plugin-sdk$/, (resource) => {
      if (resource.context !== harness) resource.request = path.join(harness, 'sdk.tsx');
    }),
    new HtmlWebpackPlugin({ template: path.join(harness, 'index.html') }),
  ],
  devServer: { port: 9003, historyApiFallback: true, hot: false },
};

export default config;
