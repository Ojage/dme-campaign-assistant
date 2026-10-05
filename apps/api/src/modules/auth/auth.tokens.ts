/**
 * Injection tokens for the auth module's outbound ports.
 *
 * Use cases depend on these symbols rather than on adapter classes, which is what
 * lets a test swap in a fake without touching the composition root.
 */
export const AUTH_PORTS = {
  userRepository: Symbol('AUTH.userRepository'),
  passwordHasher: Symbol('AUTH.passwordHasher'),
  tokenService: Symbol('AUTH.tokenService'),
  sessionRepository: Symbol('AUTH.sessionRepository'),
} as const

export type AuthPorts = typeof AUTH_PORTS