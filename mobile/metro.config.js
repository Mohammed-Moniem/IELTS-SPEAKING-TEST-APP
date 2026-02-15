const path = require("path");
const os = require("os");
const { getDefaultConfig } = require("@expo/metro-config");
const MetroResolver = require("metro-resolver");

if (typeof os.availableParallelism !== "function") {
  os.availableParallelism = () => os.cpus()?.length ?? 1;
}

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const asyncRequireRealPath = path.join(
  projectRoot,
  "node_modules/@expo/metro-config/build/async-require.js"
);

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    typeof moduleName === "string" &&
    (moduleName.includes(
      "expo/node_modules/@expo/metro-config/build/async-require.js"
    ) ||
      moduleName.includes("@expo/metro-config/build/async-require.js"))
  ) {
    return {
      type: "sourceFile",
      filePath: asyncRequireRealPath,
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return MetroResolver.resolve(context, moduleName, platform);
};

module.exports = config;
