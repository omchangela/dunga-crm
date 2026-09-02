import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConditionalShell } from "@/components/layout/conditional-shell";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoftLeads — Software Leads Admin Panel",
  description: "Internal software leads management tool for tracking client projects.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ConditionalShell>{children}</ConditionalShell>
        </AuthProvider>
      </body>
    </html>
  );
}
