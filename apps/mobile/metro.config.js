const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch workspace packages and hoisted node_modules without crawling .venv, .next, or android build artifacts
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(workspaceRoot, 'packages'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 2. Let Metro resolve packages in the workspace
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Exclude heavy non-mobile / build directories from Metro file map
const escapedRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const extraBlocks = [
  new RegExp(`^${escapedRoot}[\\\\/](android|ios|dist)[\\\\/].*`),
];
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, ...extraBlocks]
  : existingBlockList
    ? [existingBlockList, ...extraBlocks]
    : extraBlocks;

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
