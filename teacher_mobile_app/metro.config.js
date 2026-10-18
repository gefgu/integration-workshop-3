// The phone app shares the bench protocol with the website and the bench UI (../protocol).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../protocol')];
module.exports = config;
