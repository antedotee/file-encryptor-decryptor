"use client"

import { toArrayBuffer } from "@/lib/bytes"
import {
  encryptForPublicKeyWeb,
  encryptWithNewSaltIvWeb,
  importPublicKeySpkiBase64Web,
} from "@/lib/crypto-web"
import { downloadBlob } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import { makeOsencFilename, osencToBlobBytes } from "@/lib/osenc"
import { encodeOsencPk, makeOsencPkFilename } from "@/lib/osencpk"
import { useEffect, useMemo, useState } from "react"

const MAX_SERVER_FILE_BYTES = 4_500_000

type Mode = "local" | "server"
type EncryptionKind = "password" | "publicKey"

type PublicKeyContact = {
  id: string
  label: string
  publicKeyBase64: string
}

export default function EncryptClient() {
  const [mode, setMode] = useState<Mode>("local")
  const [encryptionKind, setEncryptionKind] = useState<EncryptionKind>("password")
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<PublicKeyContact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem("osencpk_contacts")
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PublicKeyContact[]
        setContacts(parsed)
      } catch {
        // ignore malformed local storage
      }
    }
  }, [])

  const serverDisabledReason = useMemo(() => {
    if (!file) return null
    if (file.size > MAX_SERVER_FILE_BYTES) {
      return `Server mode supports up to ${formatBytes(MAX_SERVER_FILE_BYTES)} (Vercel/serverless limits). Use Local mode.`
    }
    if (encryptionKind === "publicKey") {
      return "Public-key encryption runs only in Local (browser) mode."
    }
    return null
  }, [file, encryptionKind])

  async function onEncrypt() {
    setError(null)
    if (!file) return setError("Pick a file to encrypt.")
    if (encryptionKind === "password" && password.trim().length < 8) {
      return setError("Use a password of at least 8 characters.")
    }
    if (encryptionKind === "publicKey") {
      if (mode !== "local") {
        return setError("Public-key encryption is only supported in Local (browser) mode.")
      }
      if (!contacts.length) {
        return setError("Add at least one recipient public key on the Key Management page first.")
      }
      if (selectedContactIds.size === 0) {
        return setError("Select at least one recipient to encrypt for.")
      }
    }

    setBusy(true)
    try {
      if (encryptionKind === "password") {
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
      } else {
        // Public-key encryption for multiple recipients
        const selectedContacts = contacts.filter((c) => selectedContactIds.has(c.id))
        if (selectedContacts.length === 0) throw new Error("No recipients selected.")

        const bytes = new Uint8Array(await file.arrayBuffer())
        
        // Import all recipient public keys
        const recipients: { label: string; publicKey: CryptoKey }[] = []
        for (const contact of selectedContacts) {
          const publicKey = await importPublicKeySpkiBase64Web(contact.publicKeyBase64)
          recipients.push({ label: contact.label, publicKey })
        }

        const { iv, wrappedKeys, ciphertextWithTag } = await encryptForPublicKeyWeb({
          plaintext: bytes,
          recipients,
        })

        const osencPkBytes = encodeOsencPk({
          iv,
          wrappedKeys,
          ciphertextWithTag,
          originalSize: file.size,
          filename: file.name,
          mime: file.type || "application/octet-stream",
        })

        downloadBlob(
          new Blob([toArrayBuffer(osencPkBytes)], { type: "application/json" }),
          makeOsencPkFilename(file.name)
        )
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

        {encryptionKind === "password" ? (
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
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium">Encryption type</div>
        <button
          type="button"
          onClick={() => setEncryptionKind("password")}
          className={`rounded-full px-3 py-1 text-sm ${
            encryptionKind === "password"
              ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          }`}
        >
          Password (compatible with today)
        </button>
        <button
          type="button"
          onClick={() => setEncryptionKind("publicKey")}
          className={`rounded-full px-3 py-1 text-sm ${
            encryptionKind === "publicKey"
              ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          }`}
        >
          Public key (no password needed)
        </button>
      </div>

      {encryptionKind === "publicKey" ? (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium">Recipients (select one or more)</div>
          {contacts.length === 0 ? (
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              No recipients configured yet. Add contacts on the Key Management page first.
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(selectedContactIds)
                      if (e.target.checked) {
                        next.add(c.id)
                      } else {
                        next.delete(c.id)
                      }
                      setSelectedContactIds(next)
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 dark:border-zinc-600"
                  />
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">{c.label}</span>
                </label>
              ))}
            </div>
          )}
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            File will be encrypted so only the holder of the corresponding private key can decrypt it, in their browser.
          </div>
        </div>
      ) : null}

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
