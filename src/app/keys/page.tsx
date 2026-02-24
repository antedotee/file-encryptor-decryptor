"use client"

import {
  exportPrivateKeyJwkWeb,
  exportPublicKeySpkiBase64Web,
  generateRsaKeyPairWeb,
} from "@/lib/crypto-web"
import { useEffect, useState } from "react"

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
          The private key never leaves this browser. Share only your public key with others so they can encrypt files
          specifically for this device.
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
        <button
          type="button"
          onClick={onGenerateKeypair}
          disabled={busy}
          className="mt-2 inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {busy ? "Generating…" : hasKeypair ? "Regenerate keypair" : "Generate keypair"}
        </button>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Regenerating will make you unable to decrypt files that were encrypted for your old public key.
        </div>
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

