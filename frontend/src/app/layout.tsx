import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VerifyTrade — Fair DeFi Execution",
  description:
    "Cryptographically verified DeFi trade execution on Arbitrum, powered by 0G AI.",
  keywords: ["DeFi", "blockchain", "trading", "0G", "Arbitrum", "zkProof"],
  openGraph: {
    title: "VerifyTrade",
    description: "Fair DeFi trading with cryptographic proofs",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
