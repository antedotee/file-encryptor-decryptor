# `.osenc` container format

The app stores encrypted files in a simple binary container called `.osenc`.

## Crypto

- Cipher: `AES-256-GCM`
- KDF: `PBKDF2-HMAC-SHA256`
- Salt: 16 bytes (random per file)
- IV: 12 bytes (random per file)
- PBKDF2 iterations: default `310000`
- Auth tag: included at end of ciphertext (16 bytes, as produced by AES-GCM)

## Binary layout (v1)

All integers are big-endian.

```
magic           6 bytes   ASCII "OSENC1"
version         1 byte    0x01
iterations      4 bytes   uint32
originalSize    4 bytes   uint32
saltLen         1 byte    uint8
ivLen           1 byte    uint8
filenameLen     2 bytes   uint16
mimeLen         2 bytes   uint16
salt            saltLen
iv              ivLen
filename        filenameLen  UTF-8
mime            mimeLen      UTF-8
ciphertext      rest (includes AES-GCM tag)
```

## Why this format (OS angle)

- Mirrors how real systems define binary file formats (magic bytes, versioning, headers, payload).
- Encourages thinking about parsing, validation, and “trusting input” (important systems topic).

