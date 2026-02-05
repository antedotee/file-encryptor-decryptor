import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OS File Encryptor/Decryptor",
  description: "Encrypt and decrypt files while learning operating systems concepts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
          <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-white/10 dark:bg-black/50">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">
                OSENC
              </Link>
              <nav className="flex items-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
                <Link className="hover:text-zinc-950 dark:hover:text-white" href="/encrypt">
                  Encrypt
                </Link>
                <Link className="hover:text-zinc-950 dark:hover:text-white" href="/decrypt">
                  Decrypt
                </Link>
                <Link className="hover:text-zinc-950 dark:hover:text-white" href="/os">
                  OS Concepts
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-zinc-500">
            Built for Operating Systems coursework. No files are stored on the server.
          </footer>
        </div>
      </body>
    </html>
  );
}
