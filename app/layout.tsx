import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ders Çalışma Uygulaması",
  description: "Maarif Modeli uyumlu, yapay zeka destekli ders çalışma platformu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}