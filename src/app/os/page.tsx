export default function OsConceptsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">How this connects to Operating Systems</h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          This project is intentionally “small” cryptography wrapped around OS concepts: files, permissions,
          processes, memory, isolation, and the limits of running code on a platform (Vercel).
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">1) File systems & access control</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            In a native OS app you’d call system calls like <span className="font-mono">open/read/write</span>.
            In the browser, file access is mediated by a sandbox (you must explicitly pick a file). On Vercel,
            server code cannot see your disk at all.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">2) Processes, isolation, and “who runs my code”</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Local mode runs encryption in your browser process. Server mode runs inside an isolated Node.js
            serverless function (limited time/CPU/memory) — similar to a constrained process sandbox.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">3) Memory management</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Encrypting requires reading bytes into RAM (buffers). Bigger files = more memory pressure and more
            GC work. That’s why server mode enforces a small file limit.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">4) Security primitives & threat model</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            AES-GCM gives confidentiality + integrity (tamper detection). PBKDF2 slows brute-force attacks.
            The OS concept here is “defense in depth”: even if a file is copied, it stays protected.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">Suggested OS write-up topics</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>Compare browser sandbox file APIs vs OS syscalls.</li>
          <li>Explain why serverless functions behave like short-lived processes.</li>
          <li>Discuss CPU scheduling: encryption is CPU-bound; UI needs responsiveness.</li>
          <li>Discuss permissions: who is allowed to read plaintext vs ciphertext.</li>
          <li>Discuss storage: ephemeral /tmp vs persistent disks.</li>
        </ul>
      </section>
    </div>
  )
}

