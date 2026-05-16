import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { WalletProvider } from "@/components/WalletProvider";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VerifyTrade — Fair DeFi Execution",
  description:
    "Cryptographically verified DeFi trade execution on Arbitrum, powered by 0G AI.",
  keywords: ["DeFi", "blockchain", "trading", "0G", "Arbitrum", "TEE", "MEV"],
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
  const cookie = cookies().get("wagmi.store")?.value ?? null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        <WalletProvider cookie={cookie}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
