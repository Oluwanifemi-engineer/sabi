import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabi — Understand before you sign",
  description:
    "Sabi explains school letters in your language, checks understanding, and creates signed proof that consent was informed. Built for parents with limited English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
