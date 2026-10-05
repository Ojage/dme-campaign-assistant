import * as z from 'zod/v4'
import { idSchema, isoDateTimeSchema } from '../shared.js'

/** Roles recognised by the workspace. */
export const userRoleSchema = z.enum(['marketing_lead', 'lifecycle_marketer', 'admin'])
export type UserRole = z.infer<typeof userRoleSchema>

export const userSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
})
export type User = z.infer<typeof userSchema>

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Bounded so an attacker cannot hash an unbounded payload.
  password: z.string().min(8).max(128),
})
export type Credentials = z.infer<typeof credentialsSchema>

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>

/**
 * Access tokens are short lived and held in memory only; the refresh token is the
 * only credential the browser persists.
 */
export const accessTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Access token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
  user: userSchema,
})
export type AccessToken = z.infer<typeof accessTokenSchema>

/** Response of a refresh or a session restore — no new refresh token is issued. */
export const sessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>