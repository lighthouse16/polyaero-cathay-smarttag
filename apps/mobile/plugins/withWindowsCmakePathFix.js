const { withAppBuildGradle } = require('@expo/config-plugins');

const CMAKE_OBJECT_PATH_FIX = `        externalNativeBuild {
            cmake {
                if (System.getProperty("os.name").toLowerCase().contains("windows")) {
                    arguments "-DCMAKE_OBJECT_PATH_MAX=245"
                }
            }
        }`;

module.exports = function withWindowsCmakePathFix(config) {
  return withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    if (contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      return modConfig;
    }
    const anchor = 'REACT_NATIVE_RELEASE_LEVEL';
    const lines = contents.split('\n');
    const idx = lines.findIndex((line) => line.includes(anchor));
    if (idx !== -1) {
      lines.splice(idx + 1, 0, CMAKE_OBJECT_PATH_FIX);
      modConfig.modResults.contents = lines.join('\n');
    }
    return modConfig;
  });
};
