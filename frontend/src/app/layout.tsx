import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { WalletProvider } from "@/components/WalletProvider";
import { ToastProvider }  from "@/components/Toast";
import { Footer }         from "@/components/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VerifyTrade — Fair DeFi Execution",
  description:
    "Cryptographically verified DeFi trade execution on Arbitrum, powered by 0G AI. Every trade encrypted, TEE-executed, and proven on-chain.",
  keywords: ["DeFi", "blockchain", "trading", "0G", "Arbitrum", "TEE", "MEV", "fairness proof", "crypto"],
  openGraph: {
    title: "VerifyTrade — Fair DeFi Execution",
    description: "Every trade encrypted on 0G Storage, executed in a TEE via 0G Compute, and proven on-chain. MEV-proof DeFi.",
    type: "website",
    siteName: "VerifyTrade",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "VerifyTrade — Fair DeFi Execution" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VerifyTrade — Fair DeFi Execution",
    description: "MEV-proof DeFi powered by 0G Storage, Compute, and on-chain fairness proofs.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://verifytrade.xyz"),
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
            <Footer />
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
