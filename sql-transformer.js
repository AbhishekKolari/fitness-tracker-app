const path = require('path');

const upstreamTransformer = require('@expo/metro-config/build/babel-transformer');

module.exports.transform = function (params) {
  if (params.filename.endsWith('.sql')) {
    return upstreamTransformer.transform({
      ...params,
      src: `module.exports = ${JSON.stringify(params.src)};`,
    });
  }
  return upstreamTransformer.transform(params);
};
