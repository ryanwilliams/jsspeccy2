var path = require('path');
var webpack = require('webpack');
var fs = require('fs');

var banner = `@license JSSpeccy v2.2.1 - http://jsspeccy.zxdemo.org/
Copyright 2014 Matt Westcott <matt@west.co.tt> and contributors

This program is free software: you can redistribute it and/or modify it under the terms of
the GNU General Public License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.
If not, see <http://www.gnu.org/licenses/>.`;


var isProduction = (process.env.NODE_ENV === 'production');

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
    path: path.join(__dirname, './dist/'),
    filename: isProduction ? '[name].min.js' : '[name].js',
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
  },

  plugins: [
    new webpack.BannerPlugin(banner),
  ]
}
