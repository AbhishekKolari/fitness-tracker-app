const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
config.transformer.babelTransformerPath = require.resolve('./sql-transformer');

module.exports = config;
