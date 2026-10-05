import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import type { PasswordHasher } from '../application/ports/auth.ports'

/** Cost 12 is ~250ms on commodity hardware — slow enough to be a real cost. */
const COST = 12

/** bcrypt adapter. Chosen over Argon2 to avoid a native build dependency. */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  public hash(plain: string): Promise<string> {
    return hash(plain, COST)
  }

  public verify(plain: string, digest: string): Promise<boolean> {
    return compare(plain, digest)
  }
}
