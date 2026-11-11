const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

const CMAKE_OBJECT_PATH_FIX = `        externalNativeBuild {
            cmake {
                if (System.getProperty("os.name").toLowerCase().contains("windows")) {
                    arguments "-DCMAKE_OBJECT_PATH_MAX=245"
                }
            }
        }`;

const APP_STAGING_DIR_FIX = `    externalNativeBuild {
        cmake {
            if (System.getProperty("os.name").toLowerCase().contains("windows")) {
                buildStagingDirectory new File(rootProject.projectDir.toPath().root.toString(), ".rn-cxx/app")
            }
        }
    }`;

const SUBPROJECTS_CMAKE_FIX = `
if (System.getProperty("os.name").toLowerCase().contains("windows")) {
  subprojects { subproject ->
    subproject.plugins.withId("com.android.library") {
      subproject.android {
        defaultConfig {
          externalNativeBuild {
            cmake {
              arguments "-DCMAKE_OBJECT_PATH_MAX=245"
            }
          }
        }
      }
    }
  }
}
`;

module.exports = function withWindowsCmakePathFix(config) {
  config = withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      const anchor = 'REACT_NATIVE_RELEASE_LEVEL';
      const lines = contents.split('\n');
      const idx = lines.findIndex((line) => line.includes(anchor));
      if (idx !== -1) {
        lines.splice(idx + 1, 0, CMAKE_OBJECT_PATH_FIX);
        contents = lines.join('\n');
      }
    } else {
      contents = contents.replace(/CMAKE_OBJECT_PATH_MAX=\d+/g, 'CMAKE_OBJECT_PATH_MAX=245');
    }
    if (!contents.includes('buildStagingDirectory')) {
      const resourcesAnchor = 'ignoreAssetsPattern';
      const lines = contents.split('\n');
      const rIdx = lines.findIndex((line) => line.includes(resourcesAnchor));
      if (rIdx !== -1 && rIdx + 1 < lines.length && lines[rIdx + 1].trim() === '}') {
        lines.splice(rIdx + 2, 0, APP_STAGING_DIR_FIX);
        contents = lines.join('\n');
      }
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  config = withProjectBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    if (!contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      modConfig.modResults.contents = contents + '\n' + SUBPROJECTS_CMAKE_FIX;
    }
    return modConfig;
  });

  return config;
};
