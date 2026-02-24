"use client"

import {
  exportPrivateKeyJwkWeb,
  exportPublicKeySpkiBase64Web,
  generateRsaKeyPairWeb,
  importPrivateKeyJwkWeb,
} from "@/lib/crypto-web"
import { downloadBlob } from "@/lib/download"
import { useEffect, useState, useRef } from "react"

type PublicKeyContact = {
  id: string
  label: string
  publicKeyBase64: string
}

function loadContacts(): PublicKeyContact[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem("osencpk_contacts")
  if (!raw) return []
  try {
    return JSON.parse(raw) as PublicKeyContact[]
  } catch {
    return []
  }
}

function saveContacts(contacts: PublicKeyContact[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem("osencpk_contacts", JSON.stringify(contacts))
}

export default function KeysPage() {
  const [hasKeypair, setHasKeypair] = useState(false)
  const [publicKey, setPublicKey] = useState("")
  const [contacts, setContacts] = useState<PublicKeyContact[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [newPublicKey, setNewPublicKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const devicePub = window.localStorage.getItem("osencpk_device_public_spki_b64")
    if (devicePub) {
      setHasKeypair(true)
      setPublicKey(devicePub)
    }
    setContacts(loadContacts())
  }, [])

  async function onGenerateKeypair() {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const { publicKey, privateKey } = await generateRsaKeyPairWeb()
      const publicKeyBase64 = await exportPublicKeySpkiBase64Web(publicKey)
      const privateJwk = await exportPrivateKeyJwkWeb(privateKey)

      if (typeof window !== "undefined") {
        window.localStorage.setItem("osencpk_device_public_spki_b64", publicKeyBase64)
        window.localStorage.setItem("osencpk_device_private_jwk", JSON.stringify(privateJwk))
      }

      setHasKeypair(true)
      setPublicKey(publicKeyBase64)
      setMessage("Keypair generated and stored in this browser.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate keypair.")
    } finally {
      setBusy(false)
    }
  }

  function onExportPrivateKey() {
    setError(null)
    setMessage(null)
    const privateJwkJson = window.localStorage.getItem("osencpk_device_private_jwk")
    const publicKeyB64 = window.localStorage.getItem("osencpk_device_public_spki_b64")
    if (!privateJwkJson || !publicKeyB64) {
      setError("No keypair to export.")
      return
    }
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      publicKey: publicKeyB64,
      privateKey: JSON.parse(privateJwkJson),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    downloadBlob(blob, `osenc-keypair-backup-${Date.now()}.json`)
    setMessage("Keypair exported. Store this file securely — anyone with it can decrypt your files!")
  }

  async function onImportPrivateKey(fileOrText: File | string) {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      let jsonText: string
      if (fileOrText instanceof File) {
        jsonText = await fileOrText.text()
      } else {
        jsonText = fileOrText
      }

      const parsed = JSON.parse(jsonText)
      
      // Support both raw JWK and our export format
      let privateJwk: JsonWebKey
      let publicKeyB64: string | null = null
      
      if (parsed.privateKey && parsed.publicKey) {
        // Our export format
        privateJwk = parsed.privateKey
        publicKeyB64 = parsed.publicKey
      } else if (parsed.kty === "RSA") {
        // Raw JWK format
        privateJwk = parsed
      } else {
        throw new Error("Invalid key file format")
      }

      // Validate the key by trying to import it
      const importedKey = await importPrivateKeyJwkWeb(privateJwk)
      
      // If we don't have the public key, derive it
      if (!publicKeyB64) {
        // Re-export to get public key (this extracts just public components)
        const publicKey = await window.crypto.subtle.importKey(
          "jwk",
          { ...privateJwk, d: undefined, p: undefined, q: undefined, dp: undefined, dq: undefined, qi: undefined },
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt"]
        )
        const spki = await window.crypto.subtle.exportKey("spki", publicKey)
        publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(spki)))
      }

      // Save to localStorage
      window.localStorage.setItem("osencpk_device_private_jwk", JSON.stringify(privateJwk))
      window.localStorage.setItem("osencpk_device_public_spki_b64", publicKeyB64)

      setHasKeypair(true)
      setPublicKey(publicKeyB64)
      setMessage("Keypair imported successfully!")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import keypair.")
    } finally {
      setBusy(false)
      if (importFileRef.current) importFileRef.current.value = ""
    }
  }

  function onAddContact() {
    setError(null)
    setMessage(null)
    const label = newLabel.trim()
    const pub = newPublicKey.trim()
    if (!label || !pub) {
      setError("Enter both a label and a public key.")
      return
    }
    const contact: PublicKeyContact = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label,
      publicKeyBase64: pub,
    }
    const next = [...contacts, contact]
    setContacts(next)
    saveContacts(next)
    setNewLabel("")
    setNewPublicKey("")
    setMessage("Recipient added.")
  }

  function onRemoveContact(id: string) {
    setError(null)
    setMessage(null)
    const next = contacts.filter((c) => c.id !== id)
    setContacts(next)
    saveContacts(next)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <section className="space-y-3">
        <h1 className="text-lg font-semibold">Key Management</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Generate and store a device keypair in this browser and manage recipient public keys for public-key
          encryption.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">My device keypair</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Your keypair is stored in this browser's localStorage. Share your <strong>public key</strong> with others so they can encrypt files for you.
          Keep your <strong>private key</strong> secret — export a backup in case you clear browser data!
        </p>
        {hasKeypair ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Public key (base64, safe to share)</div>
            <textarea
              className="block h-32 w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs font-mono dark:border-white/10 dark:bg-black"
              readOnly
              value={publicKey}
              aria-label="My device public key (base64, safe to share)"
            />
          </div>
        ) : (
          <div className="text-xs text-zinc-600 dark:text-zinc-400">No keypair yet in this browser.</div>
        )}
        
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerateKeypair}
            disabled={busy}
            className="inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {busy ? "Working…" : hasKeypair ? "Regenerate keypair" : "Generate keypair"}
          </button>
          
          {hasKeypair ? (
            <button
              type="button"
              onClick={onExportPrivateKey}
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
            >
              Export keypair (backup)
            </button>
          ) : null}
          
          <label className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5">
            Import keypair
            <input
              ref={importFileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onImportPrivateKey(file)
              }}
            />
          </label>
        </div>
        
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          <strong>Important:</strong> Export your keypair to back it up. If you clear browser data or switch devices, you'll need this backup to decrypt files encrypted for you.
        </div>
        {hasKeypair ? (
          <div className="text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Regenerating will make you unable to decrypt files that were encrypted for your old public key.
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Known recipients</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Add public keys from other devices or people here. They will appear as options when encrypting with public
          keys.
        </p>

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <div className="text-xs font-medium">Label</div>
              <input
                className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-black"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Alice's laptop"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <div className="text-xs font-medium">Public key (base64 from their browser)</div>
              <textarea
                className="block h-24 w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs font-mono dark:border-white/10 dark:bg-black"
                value={newPublicKey}
                onChange={(e) => setNewPublicKey(e.target.value)}
                placeholder="Paste their exported public key here"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={onAddContact}
            className="mt-2 inline-flex items-center rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Add recipient
          </button>
        </div>

        {contacts.length > 0 ? (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-black"
              >
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.label}</div>
                  <div className="mt-1 line-clamp-2 break-all font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                    {c.publicKeyBase64}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveContact(c.id)}
                  className="rounded-full border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-zinc-600 dark:text-zinc-400">No recipients saved yet.</div>
        )}
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
          {message}
        </div>
      ) : null}
    </div>
  )
}

