// Native Maps keys are embedded in app binaries and require provider restrictions.
module.exports = ({ config }) => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosMapsKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      ...(androidMapsKey && {
        config: {
          ...config.android?.config,
          googleMaps: { apiKey: androidMapsKey },
        },
      }),
    },
    ios: {
      ...config.ios,
      ...(iosMapsKey && {
        config: {
          ...config.ios?.config,
          googleMapsApiKey: iosMapsKey,
        },
      }),
    },
  };
};
