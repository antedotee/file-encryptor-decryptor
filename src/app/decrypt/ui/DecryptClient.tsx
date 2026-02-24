"use client"

import { toArrayBuffer } from "@/lib/bytes"
import { decryptBytesWeb, decryptForPrivateKeyWeb, importPrivateKeyJwkWeb } from "@/lib/crypto-web"
import { downloadBlob } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import { decodeOsenc } from "@/lib/osenc"
import { decodeOsencPk } from "@/lib/osencpk"
import { useMemo, useState } from "react"

const MAX_SERVER_FILE_BYTES = 4_500_000

type Mode = "local" | "server"

export default function DecryptClient() {
  const [mode, setMode] = useState<Mode>("local")
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serverDisabledReason = useMemo(() => {
    if (!file) return null
    if (file.size > MAX_SERVER_FILE_BYTES) {
      return `Server mode supports up to ${formatBytes(MAX_SERVER_FILE_BYTES)}. Use Local mode.`
    }
    return null
  }, [file])

  async function onDecrypt() {
    setError(null)
    if (!file) return setError("Pick a .osenc file to decrypt.")
    const isPkFile = file.name.endsWith(".osencpk")
    if (!isPkFile && password.trim().length < 8) {
      return setError("Use the same password (min 8 chars).")
    }

    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const isPk = isPkFile || (() => {
        // quick heuristic: .osencpk is JSON, .osenc is binary
        const firstByte = bytes[0]
        return firstByte === 0x7b || firstByte === 0x5b // '{' or '['
      })()

      if (isPk) {
        if (mode !== "local") {
          throw new Error("Public-key encrypted files can only be decrypted in Local (browser) mode.")
        }

        const privateJwkJson = typeof window !== "undefined" ? window.localStorage.getItem("osencpk_device_private_jwk") : null
        if (!privateJwkJson) {
          throw new Error("No private key found. Generate or import your keypair on the Key Management page first.")
        }

        const privateJwk = JSON.parse(privateJwkJson) as JsonWebKey
        const privateKey = await importPrivateKeyJwkWeb(privateJwk)

        const pkEnvelope = decodeOsencPk(bytes)
        const plaintext = await decryptForPrivateKeyWeb({
          iv: pkEnvelope.iv,
          wrappedKey: pkEnvelope.wrappedKey,
          ciphertextWithTag: pkEnvelope.ciphertextWithTag,
          recipientPrivateKey: privateKey,
        })

        const outName = pkEnvelope.filename || "decrypted.bin"
        const mime = pkEnvelope.mime || "application/octet-stream"
        downloadBlob(new Blob([toArrayBuffer(plaintext)], { type: mime }), outName)
      } else if (mode === "local") {
        const envelope = decodeOsenc(bytes)
        const plaintext = await decryptBytesWeb({
          ciphertextWithTag: envelope.ciphertextWithTag,
          password,
          salt: envelope.salt,
          iv: envelope.iv,
          iterations: envelope.iterations,
        })
        const outName = envelope.filename || "decrypted.bin"
        const mime = envelope.mime || "application/octet-stream"
        downloadBlob(new Blob([toArrayBuffer(plaintext)], { type: mime }), outName)
      } else {
        if (serverDisabledReason) throw new Error(serverDisabledReason)
        const form = new FormData()
        form.set("file", file)
        form.set("password", password)
        const res = await fetch("/api/decrypt", { method: "POST", body: form })
        if (!res.ok) throw new Error(await res.text())
        const blob = await res.blob()
        const name = res.headers.get("x-download-filename") ?? "decrypted.bin"
        downloadBlob(blob, name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <div className="text-sm font-medium">Encrypted file (.osenc or .osencpk)</div>
          <input
            type="file"
            accept=".osenc,.osencpk,application/octet-stream,application/json"
            className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              {file.name} · {formatBytes(file.size)}
            </div>
          ) : null}
        </label>

        <label className="space-y-2">
          <div className="text-sm font-medium">Password</div>
          <input
            type="password"
            className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Same password used to encrypt"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium">Mode</div>
        <button
          type="button"
          onClick={() => setMode("local")}
          className={`rounded-full px-3 py-1 text-sm ${
            mode === "local"
              ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          }`}
        >
          Local (browser)
        </button>
        <button
          type="button"
          onClick={() => setMode("server")}
          disabled={!!serverDisabledReason}
          className={`rounded-full px-3 py-1 text-sm ${
            mode === "server"
              ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          } ${serverDisabledReason ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Server (Node on Vercel)
        </button>
        {serverDisabledReason ? (
          <div className="text-xs text-amber-700 dark:text-amber-300">{serverDisabledReason}</div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={onDecrypt}
          disabled={busy}
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {busy ? "Decrypting…" : "Decrypt & Download"}
        </button>
      </div>
    </div>
  )
}
