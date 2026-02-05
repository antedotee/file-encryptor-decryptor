# OS Concepts Mapping (for your report)

This project is intentionally designed to let you explain **Operating Systems** topics using a real (but safe) feature: file encryption.

## 1) File systems & system calls

In a native OS program, you’d read/write files via system calls like `open()`, `read()`, `write()`, `close()`.

In this project:
- **Local mode** reads a file via the browser’s File API (`File.arrayBuffer()`), which is *sandboxed* and requires explicit user permission.
- **Server mode** reads bytes uploaded in a request and returns bytes in a response. The server never gets direct access to your disk.

Talking points:
- Permission model differences (OS discretionary access control vs browser user-consent sandbox).
- Why “upload” is fundamentally different from “read a path on disk”.

## 2) Processes, isolation, and trust boundaries

- **Browser mode:** encryption runs inside your browser process. OS scheduling and memory management determine performance and responsiveness.
- **Vercel server mode:** code runs inside an isolated runtime (serverless function), like a short-lived, constrained process.

Talking points:
- Isolation as a security mechanism (process boundaries, containerization).
- Least privilege: the server function cannot access your files unless you send them.

## 3) Memory management & performance

Encryption is buffer-based: the file becomes bytes, bytes are transformed, then downloaded.

Talking points:
- RAM pressure and garbage collection for large buffers.
- Why server mode restricts size: serverless functions have limited memory/time.
- CPU-bound work: encryption competes for CPU time with UI rendering.

## 4) Security properties & threat model

This project uses:
- **AES-256-GCM**: confidentiality + integrity (detects tampering).
- **PBKDF2-SHA256**: turns a password into a 256-bit key with a per-file random salt.

Talking points:
- Brute force costs: iteration count increases attacker cost.
- Why integrity matters (detecting modified ciphertext).
- Defense in depth: OS permissions + encryption + app sandboxing.

## 5) Practical constraints (real-world OS relevance)

- Local mode is “offline first” — avoids network transmission entirely.
- Server mode demonstrates platform limits (runtime constraints) — similar to resource quotas and scheduling.

