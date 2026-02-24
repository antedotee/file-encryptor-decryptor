"use client"

import { utf8Decode, utf8Encode } from "@/lib/bytes"

// v1: single recipient (legacy)
export type OsencPkEnvelopeV1 = {
  v: 1
  iv: string
  wrappedKey: string
  ciphertext: string
  filename: string
  mime: string
  originalSize: number
}

// v2: multiple recipients
export type WrappedKeyEntry = {
  label: string
  wrappedKey: string
}

export type OsencPkEnvelopeV2 = {
  v: 2
  iv: string
  wrappedKeys: WrappedKeyEntry[]
  ciphertext: string
  filename: string
  mime: string
  originalSize: number
}

export type OsencPkEnvelope = OsencPkEnvelopeV1 | OsencPkEnvelopeV2

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return globalThis.btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export function encodeOsencPk(params: {
  iv: Uint8Array
  wrappedKeys: { label: string; wrappedKey: Uint8Array }[]
  ciphertextWithTag: Uint8Array
  filename: string
  mime: string
  originalSize: number
}): Uint8Array {
  const envelope: OsencPkEnvelopeV2 = {
    v: 2,
    iv: bytesToBase64(params.iv),
    wrappedKeys: params.wrappedKeys.map((wk) => ({
      label: wk.label,
      wrappedKey: bytesToBase64(wk.wrappedKey),
    })),
    ciphertext: bytesToBase64(params.ciphertextWithTag),
    filename: params.filename,
    mime: params.mime,
    originalSize: params.originalSize,
  }
  const json = JSON.stringify(envelope)
  return utf8Encode(json)
}

export function decodeOsencPk(bytes: Uint8Array): {
  iv: Uint8Array
  wrappedKeys: { label: string; wrappedKey: Uint8Array }[]
  ciphertextWithTag: Uint8Array
  filename: string
  mime: string
  originalSize: number
} {
  const json = utf8Decode(bytes)
  let parsed: OsencPkEnvelope
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Invalid OSENCPK: not valid JSON")
  }
  
  if (parsed.v !== 1 && parsed.v !== 2) {
    throw new Error("Invalid OSENCPK: unsupported version")
  }
  
  if (!parsed.iv || !parsed.ciphertext) {
    throw new Error("Invalid OSENCPK: missing fields")
  }

  // Handle v1 (single recipient) and v2 (multiple recipients)
  let wrappedKeys: { label: string; wrappedKey: Uint8Array }[]
  
  if (parsed.v === 1) {
    // Legacy v1 format with single wrappedKey
    if (!parsed.wrappedKey) {
      throw new Error("Invalid OSENCPK v1: missing wrappedKey")
    }
    wrappedKeys = [{ label: "Recipient", wrappedKey: base64ToBytes(parsed.wrappedKey) }]
  } else {
    // v2 format with multiple wrappedKeys
    if (!parsed.wrappedKeys || !Array.isArray(parsed.wrappedKeys) || parsed.wrappedKeys.length === 0) {
      throw new Error("Invalid OSENCPK v2: missing or empty wrappedKeys")
    }
    wrappedKeys = parsed.wrappedKeys.map((wk) => ({
      label: wk.label || "Unknown",
      wrappedKey: base64ToBytes(wk.wrappedKey),
    }))
  }

  return {
    iv: base64ToBytes(parsed.iv),
    wrappedKeys,
    ciphertextWithTag: base64ToBytes(parsed.ciphertext),
    filename: parsed.filename || "file",
    mime: parsed.mime || "application/octet-stream",
    originalSize: parsed.originalSize ?? 0,
  }
}

export function makeOsencPkFilename(originalName: string): string {
  if (!originalName) return "file.osencpk"
  return originalName.endsWith(".osencpk") ? originalName : `${originalName}.osencpk`
}

