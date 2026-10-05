/**
 * Single entry point for the shared contract. Both apps import from `@dme/contracts`
 * so the wire format is compiled and type-checked exactly once.
 */
export * from './domains/index.js'
export * from './http/index.js'