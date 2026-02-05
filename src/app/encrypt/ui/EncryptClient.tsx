"use client"

import { toArrayBuffer } from "@/lib/bytes"
import { encryptWithNewSaltIvWeb } from "@/lib/crypto-web"
import { downloadBlob } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import { makeOsencFilename, osencToBlobBytes } from "@/lib/osenc"
import { useMemo, useState } from "react"

const MAX_SERVER_FILE_BYTES = 4_500_000

type Mode = "local" | "server"

export default function EncryptClient() {
  const [mode, setMode] = useState<Mode>("local")
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serverDisabledReason = useMemo(() => {
    if (!file) return null
    if (file.size > MAX_SERVER_FILE_BYTES) {
      return `Server mode supports up to ${formatBytes(MAX_SERVER_FILE_BYTES)} (Vercel/serverless limits). Use Local mode.`
    }
    return null
  }, [file])

  async function onEncrypt() {
    setError(null)
    if (!file) return setError("Pick a file to encrypt.")
    if (password.trim().length < 8) return setError("Use a password of at least 8 characters.")

    setBusy(true)
    try {
      if (mode === "local") {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const { salt, iv, iterations, ciphertextWithTag } = await encryptWithNewSaltIvWeb({
          plaintext: bytes,
          password,
        })
        const osencBytes = osencToBlobBytes({
          iterations,
          salt,
          iv,
          originalSize: file.size,
          filename: file.name,
          mime: file.type || "application/octet-stream",
          ciphertextWithTag,
        })
        downloadBlob(
          new Blob([toArrayBuffer(osencBytes)], { type: "application/octet-stream" }),
          makeOsencFilename(file.name)
        )
      } else {
        if (serverDisabledReason) throw new Error(serverDisabledReason)
        const form = new FormData()
        form.set("file", file)
        form.set("password", password)
        const res = await fetch("/api/encrypt", { method: "POST", body: form })
        if (!res.ok) throw new Error(await res.text())
        const blob = await res.blob()
        const name = res.headers.get("x-download-filename") ?? makeOsencFilename(file.name)
        downloadBlob(blob, name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encryption failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <div className="text-sm font-medium">File</div>
          <input
            type="file"
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
            placeholder="At least 8 characters"
          />
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Password is used to derive a key (PBKDF2). It is not stored.
          </div>
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
          onClick={onEncrypt}
          disabled={busy}
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {busy ? "Encrypting…" : "Encrypt & Download"}
        </button>
      </div>
    </div>
  )
}
