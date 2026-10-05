import { InvalidCredentialsError, ValidationError } from '../../../shared/domain/domain.errors'

export const USER_ROLES = ['marketing_lead', 'lifecycle_marketer', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value)
}

export const MIN_PASSWORD_LENGTH = 8

/**
 * A workspace member.
 *
 * The password hash never appears here: the domain deals in identities, and
 * credential material belongs to the authentication use case.
 */
export class User {
  public constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
  ) {}

  public get initials(): string {
    return this.fullName
      .split(' ')
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  }

  public get displayName(): string {
    return this.fullName
  }
}

/** Email as a value object, so normalisation happens once and cannot be skipped. */
export class EmailAddress {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  private constructor(public readonly value: string) {}

  public static create(raw: string): EmailAddress {
    const normalised = raw.trim().toLowerCase()
    if (!EmailAddress.PATTERN.test(normalised)) {
      throw new ValidationError('Enter a valid email address.', { email: ['Enter a valid email address.'] })
    }
    return new EmailAddress(normalised)
  }

  public equals(other: EmailAddress): boolean {
    return this.value === other.value
  }
}

/** A password as received from a request, checked before it ever reaches storage. */
export class PlainPassword {
  private constructor(public readonly value: string) {}

  public static create(raw: string): PlainPassword {
    if (raw.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError('Password is too short.', {
        password: [`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`],
      })
    }
    return new PlainPassword(raw)
  }

  /** Constant-shape comparison is delegated to the hasher adapter. */
  public verifyAgainst(hash: string, hasher: PasswordVerifier): Promise<boolean> {
    return hasher.verify(this.value, hash)
  }
}

export interface PasswordVerifier {
  verify(plain: string, hash: string): Promise<boolean>
}

export interface Credentials {
  readonly email: EmailAddress
  readonly password: PlainPassword
}

export function assertCredentials(email: string, password: string): Credentials {
  return { email: EmailAddress.create(email), password: PlainPassword.create(password) }
}

/** Throws when the account exists but is no longer allowed in. */
export function assertActive(user: User): void {
  if (!user.isActive) {
    throw new InvalidCredentialsError('Those credentials are not valid.')
  }
}