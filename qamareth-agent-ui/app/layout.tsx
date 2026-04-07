import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Qamareth Agent System",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=IBM+Plex+Mono&family=IBM+Plex+Serif:ital,wght@0,400;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink text-parchment font-body antialiased">
        <nav className="flex gap-6 px-6 py-3 border-b border-border bg-surface">
          <a href="/chat"       className="font-mono text-xs text-parchment-dim hover:text-parchment tracking-widest">CHAT</a>
          <a href="/templates"  className="font-mono text-xs text-parchment-dim hover:text-parchment tracking-widest">TEMPLATES</a>
          <a href="/tasks"      className="font-mono text-xs text-parchment-dim hover:text-parchment tracking-widest">TASKS</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
