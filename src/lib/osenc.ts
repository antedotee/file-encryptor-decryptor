import { concatBytes, utf8Decode, utf8Encode } from "@/lib/bytes"

const MAGIC = utf8Encode("OSENC1") // 6 bytes
const VERSION = 1

export type OsencEnvelope = {
  version: 1
  iterations: number
  salt: Uint8Array
  iv: Uint8Array
  originalSize: number
  filename: string
  mime: string
  ciphertextWithTag: Uint8Array
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, false)
}
function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false)
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, false)
}
function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, false)
}

export function encodeOsenc(envelope: Omit<OsencEnvelope, "version">): Uint8Array {
  const filenameBytes = utf8Encode(envelope.filename)
  const mimeBytes = utf8Encode(envelope.mime)

  if (envelope.iterations <= 0 || !Number.isSafeInteger(envelope.iterations)) {
    throw new Error("Invalid iterations")
  }
  if (envelope.originalSize < 0 || !Number.isSafeInteger(envelope.originalSize)) {
    throw new Error("Invalid originalSize")
  }
  if (filenameBytes.byteLength > 65535) throw new Error("Filename too long")
  if (mimeBytes.byteLength > 65535) throw new Error("MIME too long")
  if (envelope.salt.byteLength > 255) throw new Error("Salt too long")
  if (envelope.iv.byteLength > 255) throw new Error("IV too long")

  const headerLen =
    MAGIC.byteLength + // magic
    1 + // version
    4 + // iterations
    4 + // originalSize
    1 + // saltLen
    1 + // ivLen
    2 + // filenameLen
    2 // mimeLen

  const metaLen =
    envelope.salt.byteLength +
    envelope.iv.byteLength +
    filenameBytes.byteLength +
    mimeBytes.byteLength

  const totalLen = headerLen + metaLen + envelope.ciphertextWithTag.byteLength
  const out = new Uint8Array(totalLen)
  out.set(MAGIC, 0)

  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
  let offset = MAGIC.byteLength
  view.setUint8(offset, VERSION)
  offset += 1
  writeU32(view, offset, envelope.iterations)
  offset += 4
  writeU32(view, offset, envelope.originalSize)
  offset += 4
  view.setUint8(offset, envelope.salt.byteLength)
  offset += 1
  view.setUint8(offset, envelope.iv.byteLength)
  offset += 1
  writeU16(view, offset, filenameBytes.byteLength)
  offset += 2
  writeU16(view, offset, mimeBytes.byteLength)
  offset += 2

  out.set(envelope.salt, offset)
  offset += envelope.salt.byteLength
  out.set(envelope.iv, offset)
  offset += envelope.iv.byteLength
  out.set(filenameBytes, offset)
  offset += filenameBytes.byteLength
  out.set(mimeBytes, offset)
  offset += mimeBytes.byteLength
  out.set(envelope.ciphertextWithTag, offset)

  return out
}

export function decodeOsenc(fileBytes: Uint8Array): OsencEnvelope {
  if (fileBytes.byteLength < MAGIC.byteLength + 1 + 4 + 4 + 1 + 1 + 2 + 2) {
    throw new Error("Invalid OSENC: too small")
  }
  for (let i = 0; i < MAGIC.byteLength; i++) {
    if (fileBytes[i] !== MAGIC[i]) throw new Error("Invalid OSENC: bad magic")
  }

  const view = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength)
  let offset = MAGIC.byteLength
  const version = view.getUint8(offset)
  offset += 1
  if (version !== VERSION) throw new Error(`Unsupported OSENC version: ${version}`)

  const iterations = readU32(view, offset)
  offset += 4
  const originalSize = readU32(view, offset)
  offset += 4

  const saltLen = view.getUint8(offset)
  offset += 1
  const ivLen = view.getUint8(offset)
  offset += 1
  const filenameLen = readU16(view, offset)
  offset += 2
  const mimeLen = readU16(view, offset)
  offset += 2

  const metaLen = saltLen + ivLen + filenameLen + mimeLen
  const remaining = fileBytes.byteLength - offset
  if (remaining < metaLen + 16) throw new Error("Invalid OSENC: truncated") // at least tag

  const salt = fileBytes.slice(offset, offset + saltLen)
  offset += saltLen
  const iv = fileBytes.slice(offset, offset + ivLen)
  offset += ivLen
  const filename = utf8Decode(fileBytes.slice(offset, offset + filenameLen))
  offset += filenameLen
  const mime = utf8Decode(fileBytes.slice(offset, offset + mimeLen))
  offset += mimeLen
  const ciphertextWithTag = fileBytes.slice(offset)

  return {
    version: 1,
    iterations,
    salt,
    iv,
    originalSize,
    filename,
    mime,
    ciphertextWithTag,
  }
}

export function makeOsencFilename(originalName: string): string {
  if (!originalName) return "file.osenc"
  return originalName.endsWith(".osenc") ? originalName : `${originalName}.osenc`
}

export function stripOsencSuffix(name: string): string {
  return name.endsWith(".osenc") ? name.slice(0, -".osenc".length) : name
}

export function osencToBlobBytes(envelope: Omit<OsencEnvelope, "version">): Uint8Array {
  return encodeOsenc(envelope)
}

export function mergeCiphertextAndTag(ciphertext: Uint8Array, tag: Uint8Array): Uint8Array {
  return concatBytes([ciphertext, tag])
}

