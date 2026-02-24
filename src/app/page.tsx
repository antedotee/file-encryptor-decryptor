import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">File Encryptor & Decryptor (OS Project)</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Encrypt files into a portable <span className="font-mono">.osenc</span> container using{" "}
          <span className="font-medium">AES-256-GCM</span> and password-based key derivation (PBKDF2).
          The UI is Next.js, and the “backend” runs as Node.js API routes on Vercel.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/encrypt"
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Encrypt a file
          </Link>
          <Link
            href="/decrypt"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          >
            Decrypt a file
          </Link>
          <Link
            href="/keys"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          >
            Key Management
          </Link>
          <Link
            href="/os"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
          >
            Connect to OS concepts
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">User space vs kernel space</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            You trigger encryption in the app (user space). The OS mediates file access and CPU time, and
            Vercel runs backend code in an isolated runtime.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">File systems & permissions</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            The browser reads files via sandboxed APIs; the backend can only use ephemeral storage and never
            touches your disk directly.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Security properties</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            AES-GCM provides confidentiality + integrity; the password is turned into a key using PBKDF2 with
            per-file salt.
          </p>
        </div>
      </section>
    </div>
  );
}
