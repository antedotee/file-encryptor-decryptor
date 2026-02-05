import crypto from "node:crypto"

export const DEFAULT_ITERATIONS = 310_000
export const SALT_BYTES = 16
export const IV_BYTES = 12
export const GCM_TAG_BYTES = 16

export function randomBytesNode(length: number): Uint8Array {
  return new Uint8Array(crypto.randomBytes(length))
}

export function deriveAesKeyNode(params: {
  password: string
  salt: Uint8Array
  iterations: number
}): Buffer {
  return crypto.pbkdf2Sync(params.password, params.salt, params.iterations, 32, "sha256")
}

export function encryptBytesNode(params: {
  plaintext: Uint8Array
  password: string
  salt: Uint8Array
  iv: Uint8Array
  iterations: number
}): Uint8Array {
  const key = deriveAesKeyNode({
    password: params.password,
    salt: params.salt,
    iterations: params.iterations,
  })
  const cipher = crypto.createCipheriv("aes-256-gcm", key, params.iv)
  const ciphertext = Buffer.concat([cipher.update(params.plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return new Uint8Array(Buffer.concat([ciphertext, tag]))
}

export function decryptBytesNode(params: {
  ciphertextWithTag: Uint8Array
  password: string
  salt: Uint8Array
  iv: Uint8Array
  iterations: number
}): Uint8Array {
  const key = deriveAesKeyNode({
    password: params.password,
    salt: params.salt,
    iterations: params.iterations,
  })
  if (params.ciphertextWithTag.byteLength < GCM_TAG_BYTES) throw new Error("Ciphertext too small")
  const ciphertext = params.ciphertextWithTag.slice(0, -GCM_TAG_BYTES)
  const tag = params.ciphertextWithTag.slice(-GCM_TAG_BYTES)

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, params.iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return new Uint8Array(plaintext)
}

export function encryptWithNewSaltIvNode(params: {
  plaintext: Uint8Array
  password: string
  iterations?: number
}): { salt: Uint8Array; iv: Uint8Array; iterations: number; ciphertextWithTag: Uint8Array } {
  const iterations = params.iterations ?? DEFAULT_ITERATIONS
  const salt = randomBytesNode(SALT_BYTES)
  const iv = randomBytesNode(IV_BYTES)
  const ciphertextWithTag = encryptBytesNode({
    plaintext: params.plaintext,
    password: params.password,
    salt,
    iv,
    iterations,
  })
  return { salt, iv, iterations, ciphertextWithTag }
}

