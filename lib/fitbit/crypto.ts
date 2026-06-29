import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM at-rest encryption for Fitbit OAuth tokens. The key lives only in
// the server env (TOKEN_ENC_KEY, base64 of 32 random bytes), so even a full DB
// dump yields useless ciphertext. Format: base64(iv[12] | tag[16] | ciphertext).

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY
  if (!raw) throw new Error('TOKEN_ENC_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be base64 of 32 bytes')
  return key
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
