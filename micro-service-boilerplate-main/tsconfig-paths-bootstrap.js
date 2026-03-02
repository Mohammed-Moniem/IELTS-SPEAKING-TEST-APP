/**
 * Runtime path-alias resolver for production builds.
 *
 * TypeScript's `tsc` preserves path aliases (e.g. @services/*, @models/*) in the
 * emitted JavaScript.  Node.js cannot resolve those at runtime, so we register
 * tsconfig-paths with `baseUrl` pointing at the compiled `dist/` directory.
 *
 * Usage:  node -r ./tsconfig-paths-bootstrap.js dist/src/app.js
 */

const { register } = require('tsconfig-paths');
const { compilerOptions } = require('./tsconfig.json');

register({
  baseUrl: './dist',
  paths: compilerOptions.paths,
});
