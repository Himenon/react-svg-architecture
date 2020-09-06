/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as path from "path";

import { CleanWebpackPlugin } from "clean-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import express from "express";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import OptimizeCssAssetsPlugin from "optimize-css-assets-webpack-plugin";
import resolvePkg from "resolve-pkg";
import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import ManifestPlugin from "webpack-manifest-plugin";

const ForkTsCheckerNotifierWebpackPlugin = require("fork-ts-checker-notifier-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const FriendlyErrorsWebpackPlugin = require("friendly-errors-webpack-plugin");

const rootPath = path.resolve(__dirname, "./");
const appPath = (nextPath: string) => path.join(rootPath, nextPath);

const pkg = require("./package.json");

const find = (inputPath: string) => {
  const result = resolvePkg(inputPath);
  if (!result) {
    throw new Error(`Not found: ${inputPath}`);
  }
  return result;
};

export const generateConfig = (isProduction: boolean): webpack.Configuration => {
  const isCI = process.env.CI;
  const tsLoader: webpack.RuleSetUse = {
    loader: "ts-loader",
    options: {
      configFile: "tsconfig.json",
      transpileOnly: true,
    },
  };

  const babelLoader: webpack.RuleSetUse = {
    loader: "babel-loader",
    options: {
      cacheDirectory: true,
      presets: ["@babel/preset-env"],
    },
  };

  const cssLoaders: webpack.RuleSetUse = [
    {
      loader: "css-loader",
      options: {
        localsConvention: "camelCase",
        importLoaders: 2,
      },
    },
    {
      loader: "postcss-loader",
      options: {
        plugins: [
          require("autoprefixer")({
            grid: true,
          }),
        ],
      },
    },
    {
      loader: "sass-loader",
      options: {
        implementation: require("sass"),
        sassOptions: {
          fiber: false,
        },
      },
    },
  ];

  return {
    mode: isProduction ? "production" : "development",
    target: "web",
    optimization: {
      minimize: isProduction,
      runtimeChunk: false,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
            },
          },
        }),
        new OptimizeCssAssetsPlugin({
          assetNameRegExp: /\.optimize\.css$/g,
          cssProcessor: require("cssnano"),
          cssProcessorPluginOptions: {
            preset: ["default", { discardComments: { removeAll: true } }],
          },
          canPrint: true,
        }),
      ],
      splitChunks: {
        chunks: "initial",
        cacheGroups: {
          default: false,
          vendors: false,
          lib: {
            name: "lib",
            chunks: "initial",
            minChunks: 2,
            test: ({ resource: filePath, context: dirPath }, chunk) => {
              return [/src/].some((pattern) => pattern.test(filePath));
            },
            enforce: true,
          },
          vendor: {
            name: "vendor",
            chunks: "initial",
            test: /node_modules/,
            enforce: true,
          },
        },
      },
    },
    entry: {
      application: ["core-js", "regenerator-runtime/runtime", isProduction ? "./src/application.tsx" : "./src/develop.tsx"],
    },
    // @ts-ignore
    devServer: {
      contentBase: appPath("dist"),
      compress: true,
      port: 9000,
      open: true,
      historyApiFallback: true,
      before: (app: express.Application, _server: any) => {
        app.use(
          isProduction ? "/scripts/react.production.min.js" : "/scripts/react.development.js",
          express.static(find(isProduction ? "react/umd/react.production.min.js" : "react/umd/react.development.js")),
        );
        app.use(
          isProduction ? "scripts/react-dom.production.min.js" : "scripts/react-dom.development.js",
          express.static(find(isProduction ? "react-dom/umd/react-dom.production.min.js" : "react-dom/umd/react-dom.development.js")),
        );
      },
    },
    devtool: isProduction ? "cheap-source-map" : "inline-source-map",
    plugins: [
      isProduction &&
        !isCI &&
        new BundleAnalyzerPlugin({
          analyzerMode: "disabled",
        }),
      new FriendlyErrorsWebpackPlugin(),
      new ForkTsCheckerWebpackPlugin(),
      new ForkTsCheckerNotifierWebpackPlugin({ excludeWarnings: true }),
      new webpack.HotModuleReplacementPlugin(),
      new CleanWebpackPlugin(),
      isProduction &&
        new MiniCssExtractPlugin({
          filename: "stylesheets/[name].[contenthash:8].css",
          chunkFilename: "stylesheets/[name].[contenthash:8].chunk.css",
        }),
      new HtmlWebpackPlugin({
        title: pkg.name,
        template: "public/index.html",
        React: isProduction ? "scripts/react.production.min.js" : "scripts/react.development.js",
        ReactDOM: isProduction ? "scripts/react-dom.production.min.js" : "scripts/react-dom.development.js",
      }),
      new ManifestPlugin(),
      new CopyPlugin({
        patterns: [
          { from: find("react/umd/react.production.min.js"), to: "scripts" },
          { from: find("react-dom/umd/react-dom.production.min.js"), to: "scripts" },
        ],
      }),
    ].filter(Boolean),
    output: {
      filename: "scripts/[name].bundle.js",
      path: appPath("dist"),
    },
    externals: {
      react: "React",
      "react-dom": "ReactDOM",
    },
    resolve: {
      extensions: [".js", ".ts", ".tsx", ".scss", ".json"],
      alias: {
        React: appPath("node_modules/react"),
        ReactDOM: appPath("node_modules/react-dom"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: [/__tests__/, /node_modules/],
          loaders: [babelLoader, tsLoader],
        },
        {
          test: /\.scss$/,
          loaders: [isProduction ? MiniCssExtractPlugin.loader : "style-loader", ...cssLoaders].filter(Boolean) as webpack.RuleSetUse,
        },
        {
          test: /ReactToastify.css|quill.snow.css/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: { url: false },
            },
          ],
        },
        {
          test: /\.js$/,
          loader: babelLoader,
        },
      ],
    },
  };
};

export default generateConfig(process.env.NODE_ENV === "production");
