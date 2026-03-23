import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

const PREFIX = 'dw_'

/** Generate a new random API key (plain text — shown to user once) */
export function generateApiKey(): string {
  return PREFIX + randomBytes(32).toString('hex')
}

/**
 * Extract the key prefix used for fast DB lookup.
 * Takes the first 16 hex chars after the 'dw_' prefix (8 bytes of entropy).
 * The prefix is not a secret — it's stored unhashed alongside the argon2 hash.
 */
export function extractKeyPrefix(key: string): string {
  return key.slice(PREFIX.length, PREFIX.length + 16)
}

/** Hash an API key for storage */
export async function hashApiKey(key: string): Promise<string> {
  return argon2.hash(key, { type: argon2.argon2id })
}

/** Verify a plain-text API key against a stored hash */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, key)
  } catch {
    return false
  }
}
