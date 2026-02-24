"use client"

import { utf8Decode, utf8Encode } from "@/lib/bytes"

export type OsencPkEnvelope = {
  v: 1
  iv: string
  wrappedKey: string
  ciphertext: string
  filename: string
  mime: string
  originalSize: number
}

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
  wrappedKey: Uint8Array
  ciphertextWithTag: Uint8Array
  filename: string
  mime: string
  originalSize: number
}): Uint8Array {
  const envelope: OsencPkEnvelope = {
    v: 1,
    iv: bytesToBase64(params.iv),
    wrappedKey: bytesToBase64(params.wrappedKey),
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
  wrappedKey: Uint8Array
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
  if (parsed.v !== 1) throw new Error("Invalid OSENCPK: unsupported version")
  if (!parsed.iv || !parsed.wrappedKey || !parsed.ciphertext) {
    throw new Error("Invalid OSENCPK: missing fields")
  }

  return {
    iv: base64ToBytes(parsed.iv),
    wrappedKey: base64ToBytes(parsed.wrappedKey),
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

