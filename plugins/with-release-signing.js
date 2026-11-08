// Signs release APKs with the fork's own key, so every build installs over the last.
// Gradle reads the key from a properties file named by HERDR_SIGNING (storeFile,
// storePassword, keyAlias, keyPassword); without one, release builds keep the debug key.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE = `
        release {
            def signing = System.getenv("HERDR_SIGNING")
            if (signing) {
                def props = new Properties()
                file(signing).withInputStream { props.load(it) }
                storeFile file(props["storeFile"])
                storePassword props["storePassword"]
                keyAlias props["keyAlias"]
                keyPassword props["keyPassword"]
            }
        }`;

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes('System.getenv("HERDR_SIGNING")')) return c;
    gradle = gradle.replace(/signingConfigs \{\n/, (m) => m + RELEASE.slice(1) + "\n");
    // The release build type: the second "signingConfig signingConfigs.debug".
    const at = gradle.indexOf("signingConfig signingConfigs.debug", gradle.indexOf("buildTypes {"));
    const release = gradle.indexOf("signingConfig signingConfigs.debug", at + 1);
    if (release < 0) throw new Error("with-release-signing: no release signingConfig to replace");
    gradle =
      gradle.slice(0, release) +
      'signingConfig System.getenv("HERDR_SIGNING") ? signingConfigs.release : signingConfigs.debug' +
      gradle.slice(release + "signingConfig signingConfigs.debug".length);
    c.modResults.contents = gradle;
    return c;
  });
