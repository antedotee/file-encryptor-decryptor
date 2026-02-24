# OS File Encryptor/Decryptor (Next.js + Node on Vercel)

Encrypt any file into a portable `.osenc` container and decrypt it back — built as an **Operating Systems**-themed project.

## What you built (OS perspective)

- **File system APIs:** The browser can only read files you explicitly select (sandboxed access vs OS syscalls).
- **Processes & isolation:** “Server mode” runs as an isolated Node.js serverless function on Vercel (constrained process).
- **Memory management:** Encryption is byte-buffer based; larger files mean more RAM/GC pressure.
- **Security primitives:** Uses **AES-256-GCM** (confidentiality + integrity) and **PBKDF2-SHA256** (password → key).

More details: `docs/OS_CONCEPTS.md`.

## Features

- Encrypt / decrypt in **Local mode** (in your browser, no upload)
- Encrypt / decrypt in **Server mode** (Node.js API routes on Vercel) for small files
- Portable binary container format: `.osenc` (spec: `docs/OSENC_FORMAT.md`)
- **Public-key encryption** (`.osencpk`): Encrypt files for a specific recipient without sharing passwords
  - Generate RSA-4096 keypairs in your browser
  - Share your public key; keep your private key local
  - Hybrid encryption: RSA-OAEP wraps a random AES-256-GCM key

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind
- Node.js crypto (server mode)
- WebCrypto (local/browser mode)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy (Vercel)

### Option A: Vercel UI (recommended)

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Deploy (Preview or Production).

### Option B: Vercel CLI (preview)

```bash
npx vercel deploy -y
```

## Notes / limitations

- Server mode enforces a small file limit (serverless/runtime constraints).
- No files are stored on the server; everything is processed in-memory.
- If you forget the password, encrypted files can’t be recovered.

