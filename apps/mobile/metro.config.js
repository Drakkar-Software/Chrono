// Metro config for the Chrono monorepo.
//
// Watches the workspace root and resolves the workspace packages
// (@chrono/sdk, @chrono/ui) from SOURCE so the app never depends on a prebuilt
// dist. Package `exports` is enabled for subpath resolution.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.unstable_enablePackageExports = true;

const sdkSrc = path.resolve(workspaceRoot, 'packages/sdk/src');
const uiSrc = path.resolve(workspaceRoot, 'packages/ui/src');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Resolve @chrono/sdk (and its subpaths like @chrono/sdk/schema) from source.
  if (moduleName === '@chrono/sdk') {
    return { type: 'sourceFile', filePath: path.resolve(sdkSrc, 'index.ts') };
  }
  if (moduleName.startsWith('@chrono/sdk/')) {
    const sub = moduleName.slice('@chrono/sdk/'.length);
    return { type: 'sourceFile', filePath: path.resolve(sdkSrc, `${sub}.ts`) };
  }
  // Resolve @chrono/ui from source (its internal .native/.web splits then
  // resolve via the platform extension normally).
  if (moduleName === '@chrono/ui') {
    return { type: 'sourceFile', filePath: path.resolve(uiSrc, 'index.ts') };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
