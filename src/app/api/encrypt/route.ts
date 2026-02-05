import { encryptWithNewSaltIvNode } from "@/lib/crypto-node"
import { makeOsencFilename, osencToBlobBytes } from "@/lib/osenc"

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
    const { salt, iv, iterations, ciphertextWithTag } = encryptWithNewSaltIvNode({
      plaintext: bytes,
      password,
    })

    const osencBytes = osencToBlobBytes({
      iterations,
      salt,
      iv,
      originalSize: file.size,
      filename: file.name || "file.bin",
      mime: file.type || "application/octet-stream",
      ciphertextWithTag,
    })

    const downloadName = makeOsencFilename(file.name || "file.bin")
    return new Response(Buffer.from(osencBytes), {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${downloadName.replaceAll('"', "")}"`,
        "cache-control": "no-store",
        "x-download-filename": downloadName,
      },
    })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Encryption failed", { status: 500 })
  }
}
