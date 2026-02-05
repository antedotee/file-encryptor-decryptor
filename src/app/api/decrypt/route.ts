import { decryptBytesNode } from "@/lib/crypto-node"
import { decodeOsenc } from "@/lib/osenc"

export const runtime = "nodejs"

const MAX_FILE_BYTES = 4_500_000

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file")
    const password = String(form.get("password") ?? "")

    if (!file || typeof file === "string") return new Response("Missing file", { status: 400 })
    if (password.trim().length < 8) return new Response("Password must be at least 8 characters", { status: 400 })
    if (file.size > MAX_FILE_BYTES) {
      return new Response(`File too large (max ${MAX_FILE_BYTES} bytes)`, { status: 413 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const envelope = decodeOsenc(bytes)

    const plaintext = decryptBytesNode({
      ciphertextWithTag: envelope.ciphertextWithTag,
      password,
      salt: envelope.salt,
      iv: envelope.iv,
      iterations: envelope.iterations,
    })

    const downloadName = envelope.filename || "decrypted.bin"
    return new Response(Buffer.from(plaintext), {
      status: 200,
      headers: {
        "content-type": envelope.mime || "application/octet-stream",
        "content-disposition": `attachment; filename="${downloadName.replaceAll('"', "")}"`,
        "cache-control": "no-store",
        "x-download-filename": downloadName,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Decryption failed"
    const status = msg.toLowerCase().includes("password") ? 400 : 500
    return new Response(msg, { status })
  }
}
