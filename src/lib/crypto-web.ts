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

// Public-key (asymmetric) helpers for browser-only hybrid encryption.
// These are used for: generate device keypair, export/import keys, and
// encrypting a random AES key for a recipient's public key.

export async function generateRsaKeyPairWeb(): Promise<CryptoKeyPair> {
  const c = requireWebCrypto()
  return c.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  )
}

function bytesToBase64Web(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return globalThis.btoa(binary)
}

function base64ToBytesWeb(base64: string): Uint8Array {
  const binary = globalThis.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function exportPublicKeySpkiBase64Web(publicKey: CryptoKey): Promise<string> {
  const c = requireWebCrypto()
  const spki = await c.subtle.exportKey("spki", publicKey)
  return bytesToBase64Web(new Uint8Array(spki))
}

export async function importPublicKeySpkiBase64Web(base64: string): Promise<CryptoKey> {
  const c = requireWebCrypto()
  const bytes = base64ToBytesWeb(base64)
  return c.subtle.importKey(
    "spki",
    toArrayBuffer(bytes),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  )
}

export async function exportPrivateKeyJwkWeb(privateKey: CryptoKey): Promise<JsonWebKey> {
  const c = requireWebCrypto()
  return c.subtle.exportKey("jwk", privateKey)
}

export async function importPrivateKeyJwkWeb(jwk: JsonWebKey): Promise<CryptoKey> {
  const c = requireWebCrypto()
  return c.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  )
}

export type PublicKeyCiphertextWeb = {
  iv: Uint8Array
  wrappedKey: Uint8Array
  ciphertextWithTag: Uint8Array
}

export async function encryptForPublicKeyWeb(params: {
  plaintext: Uint8Array
  recipientPublicKey: CryptoKey
}): Promise<PublicKeyCiphertextWeb> {
  const c = requireWebCrypto() as any

  const aesKey = await c.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  )

  const iv = randomBytesWeb(IV_BYTES)
  const ciphertext = await c.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    params.plaintext as any
  )
  const ciphertextWithTag = new Uint8Array(ciphertext)

  const rawAesKey = new Uint8Array(await c.subtle.exportKey("raw", aesKey))
  const wrappedKeyBuf = await c.subtle.encrypt({ name: "RSA-OAEP" }, params.recipientPublicKey, rawAesKey)
  const wrappedKey = new Uint8Array(wrappedKeyBuf)

  return { iv, wrappedKey, ciphertextWithTag }
}

export async function decryptForPrivateKeyWeb(params: {
  iv: Uint8Array
  wrappedKey: Uint8Array
  ciphertextWithTag: Uint8Array
  recipientPrivateKey: CryptoKey
}): Promise<Uint8Array> {
  const c = requireWebCrypto() as any

  const rawAesKeyBuf = await c.subtle.decrypt(
    { name: "RSA-OAEP" },
    params.recipientPrivateKey,
    params.wrappedKey as any
  )
  const rawAesKey = new Uint8Array(rawAesKeyBuf)

  const aesKey = await c.subtle.importKey(
    "raw",
    rawAesKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["decrypt"]
  )

  const plaintext = await c.subtle.decrypt(
    { name: "AES-GCM", iv: params.iv },
    aesKey,
    params.ciphertextWithTag as any
  )

  return new Uint8Array(plaintext)
}
