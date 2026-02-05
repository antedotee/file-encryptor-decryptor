"use client"

import { toArrayBuffer, utf8Encode } from "@/lib/bytes"

export const DEFAULT_ITERATIONS = 310_000
export const SALT_BYTES = 16
export const IV_BYTES = 12

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto not available")
  return globalThis.crypto
}

export function randomBytesWeb(length: number): Uint8Array {
  const c = requireWebCrypto()
  const out = new Uint8Array(length)
  c.getRandomValues(out)
  return out
}

export async function deriveAesKeyWeb(params: {
  password: string
  salt: Uint8Array
  iterations: number
}): Promise<CryptoKey> {
  const c = requireWebCrypto()
  const passwordBytes = utf8Encode(params.password)
  const baseKey = await c.subtle.importKey(
    "raw",
    toArrayBuffer(passwordBytes),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )
  return c.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(params.salt),
      iterations: params.iterations,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptBytesWeb(params: {
  plaintext: Uint8Array
  password: string
  salt: Uint8Array
  iv: Uint8Array
  iterations: number
}): Promise<Uint8Array> {
  const c = requireWebCrypto()
  const key = await deriveAesKeyWeb({
    password: params.password,
    salt: params.salt,
    iterations: params.iterations,
  })
  const iv = new Uint8Array(toArrayBuffer(params.iv))
  const ciphertext = await c.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toArrayBuffer(params.plaintext)
  )
  return new Uint8Array(ciphertext) // includes tag
}

export async function decryptBytesWeb(params: {
  ciphertextWithTag: Uint8Array
  password: string
  salt: Uint8Array
  iv: Uint8Array
  iterations: number
}): Promise<Uint8Array> {
  const c = requireWebCrypto()
  const key = await deriveAesKeyWeb({
    password: params.password,
    salt: params.salt,
    iterations: params.iterations,
  })
  const iv = new Uint8Array(toArrayBuffer(params.iv))
  const plaintext = await c.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    toArrayBuffer(params.ciphertextWithTag)
  )
  return new Uint8Array(plaintext)
}

export async function encryptWithNewSaltIvWeb(params: {
  plaintext: Uint8Array
  password: string
  iterations?: number
}): Promise<{ salt: Uint8Array; iv: Uint8Array; iterations: number; ciphertextWithTag: Uint8Array }> {
  const iterations = params.iterations ?? DEFAULT_ITERATIONS
  const salt = randomBytesWeb(SALT_BYTES)
  const iv = randomBytesWeb(IV_BYTES)
  const ciphertextWithTag = await encryptBytesWeb({
    plaintext: params.plaintext,
    password: params.password,
    salt,
    iv,
    iterations,
  })
  return { salt, iv, iterations, ciphertextWithTag }
}
