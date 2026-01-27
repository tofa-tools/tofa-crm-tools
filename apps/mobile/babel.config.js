module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'transform-define',
        {
          'process.env.EXPO_ROUTER_APP_ROOT': './app',
          'process.env.EXPO_ROUTER_IMPORT_MODE': 'lazy',
          'process.env.EXPO_ROUTER_ABS_APP_ROOT': './app',
        },
      ],
    ],
  };
};
