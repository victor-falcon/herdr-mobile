// app.json plus what a build decides: CI numbers each APK (HERDR_BUILD), so a newer
// one always installs over an older one, and the app knows where to look for them.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, versionCode: Number(process.env.HERDR_BUILD) || config.android.versionCode },
  extra: { ...config.extra, releasesRepo: "victor-falcon/herdr-mobile" },
});
