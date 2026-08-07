import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS",
  description: "This is POS system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
