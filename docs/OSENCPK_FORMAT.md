```markdown
# `.osencpk` container format (Public-Key Encryption)

The app stores public-key encrypted files in a JSON-based container called `.osencpk`.

## Crypto

- **Hybrid encryption**: Combines asymmetric (RSA) and symmetric (AES) encryption
- RSA algorithm: `RSA-OAEP` with SHA-256
- RSA key size: 4096 bits
- AES cipher: `AES-256-GCM`
- IV: 12 bytes (random per file)
- Auth tag: included in ciphertext (AES-GCM)

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│  ENCRYPTION (sender side)                                   │
│  1. Generate random 256-bit AES key                         │
│  2. Encrypt FILE with AES-GCM → ciphertext + tag            │
│  3. For EACH recipient: encrypt AES key with their PUBLIC KEY│
│  4. Package: wrappedKeys[] + iv + ciphertext → .osencpk     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DECRYPTION (recipient side)                                │
│  1. Try each wrappedKey with RSA PRIVATE KEY                │
│  2. If one succeeds → get AES key                           │
│  3. Decrypt ciphertext with AES key → original file         │
└─────────────────────────────────────────────────────────────┘
```

## JSON structure (v2 - current, supports multiple recipients)

```json
{
  "v": 2,
  "iv": "<base64>",
  "wrappedKeys": [
    { "label": "Alice's laptop", "wrappedKey": "<base64>" },
    { "label": "Bob's phone", "wrappedKey": "<base64>" }
  ],
  "ciphertext": "<base64>",
  "filename": "original-name.txt",
  "mime": "text/plain",
  "originalSize": 12345
}
```

| Field | Description |
|-------|-------------|
| `v` | Version number (2 for multi-recipient) |
| `iv` | 12-byte initialization vector (base64) |
| `wrappedKeys` | Array of wrapped AES keys, one per recipient |
| `wrappedKeys[].label` | Friendly name of the recipient |
| `wrappedKeys[].wrappedKey` | AES-256 key encrypted with that recipient's RSA public key (base64) |
| `ciphertext` | File encrypted with AES-256-GCM, includes auth tag (base64) |
| `filename` | Original filename (UTF-8) |
| `mime` | MIME type of original file |
| `originalSize` | Size of original file in bytes |

## JSON structure (v1 - legacy, single recipient)

```json
{
  "v": 1,
  "iv": "<base64>",
  "wrappedKey": "<base64>",
  "ciphertext": "<base64>",
  "filename": "original-name.txt",
  "mime": "text/plain",
  "originalSize": 12345
}
```

The decoder handles both v1 and v2 formats automatically.

## Key storage (browser localStorage)

- `osencpk_device_public_spki_b64`: Your public key in SPKI format (base64)
- `osencpk_device_private_jwk`: Your private key in JWK format (JSON string)
- `osencpk_contacts`: Array of recipient public keys with labels

## Why this format (OS angle)

- Demonstrates **asymmetric cryptography** concepts (public vs private keys)
- Shows **key exchange** without shared secrets
- Illustrates **hybrid encryption** (combine strengths of RSA + AES)
- Relates to OS concepts: trust boundaries, identity, secure channels
```
