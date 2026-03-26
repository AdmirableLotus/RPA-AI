import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Beat Show — RPA",
  description: "Your AI-powered guide to The Beat Show",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
