/**
 * Babel is used only to *transform* test files, never to type-check them.
 *
 * TypeScript 7 is a native compiler and does not expose the JavaScript compiler
 * API that ts-jest needs, so `ts-jest` cannot be used here. Types are checked by
 * `pnpm typecheck` (tsc --noEmit over the whole package, tests included); Babel
 * just strips types, which is faster and keeps the two concerns separate.
 *
 * `transform-typescript-metadata` emits `design:type` metadata so Nest's
 * constructor injection works in tests that build a controller by hand.
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-typescript', { onlyRemoveTypeImports: true }],
  ],
  plugins: [
    // `legacy: true` matches the `experimentalDecorators` flag tsc compiles with,
    // so a decorated class means the same thing in tests as in the build.
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['transform-typescript-metadata', { emitDecoratorMetadata: true }],
  ],
}
