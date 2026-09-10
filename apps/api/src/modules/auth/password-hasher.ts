import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing (spec §20 — never plain text). Argon2id with OWASP
 * baseline parameters. Centralized so the algorithm can be upgraded
 * (rehash-on-login) without touching consumers.
 */
@Injectable()
export class PasswordHasher {
  private readonly options = {
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  } as const;

  hash(plain: string): Promise<string> {
    return hash(plain, this.options);
  }

  verify(hashValue: string, plain: string): Promise<boolean> {
    return verify(hashValue, plain);
  }
}
