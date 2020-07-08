const path = require('path');

module.exports = {
  entry: './ts/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: 'static/js/skredview.js',
    path: path.resolve(__dirname),
  },
};
