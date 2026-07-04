import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://relay-handoffs.vercel.app"),
  title: "Relay — Talk when you leave. Listen when you arrive.",
  description:
    "Voice-first handoffs. Speak for 60 seconds when you stop working; the next person hears a structured catch-up when they start. Built at RAISE Summit Hackathon 2026.",
  keywords: [
    "voice handoff",
    "async standup",
    "team handoff",
    "voice notes",
    "relay",
  ],
  openGraph: {
    title: "Relay — Talk when you leave. Listen when you arrive.",
    description:
      "Turn a 60-second voice note into a structured baton your team can hear. No docs. No meetings. No lost context.",
    type: "website",
    siteName: "Relay",
  },
  twitter: {
    card: "summary_large_image",
    title: "Relay — voice-first work handoffs",
    description:
      "Talk for 60 seconds when you leave. Hear a 20-second recap when you arrive.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0d0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="ambient" aria-hidden />
        {children}
        <div className="noise" aria-hidden />
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "var(--popover)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
      </body>
    </html>
  );
}
