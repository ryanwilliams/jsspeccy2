var path = require('path');

module.exports = {
  devServer: {
    inline: true
  },
  devtool: 'source-map',

  entry: {
    jsspeccy: ['./src/main.js'],
  },

  resolve: {
    extensions: ['.js'],
  },

  output: {
    path: path.resolve('./build/'),
    filename: '[name].js'
  },

  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          cacheDirectory: './cache/'
        }
      },

      {
        test: /\.(rom|z80|sna|tap|tzx)$/,
        exclude: /node_modules/,
        loader: './rom-loader',
        query: {
          cacheDirectory: './cache/'
        }
      }
    ]
  }
}
