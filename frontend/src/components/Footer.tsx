import Link from "next/link";
import { Shield, Github } from "lucide-react";

const NAV_LINKS = [
  { href: "/trade",     label: "Trade"     },
  { href: "/verify",    label: "Verify"    },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agent",     label: "Agent"     },
];

const TECH_LINKS = [
  { href: "https://0g.ai",                       label: "0G Network" },
  { href: "https://arbitrum.io",                 label: "Arbitrum"   },
  { href: "https://eips.ethereum.org/EIPS/eip-7857", label: "ERC-7857"  },
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-400" aria-hidden />
              <span className="text-sm font-semibold text-zinc-200">VerifyTrade</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Fair DeFi execution — every order encrypted, TEE-executed, and
              proven on-chain via 0G Network.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Navigation</p>
            <ul className="space-y-1.5">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech stack */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Built With</p>
            <ul className="space-y-1.5">
              {TECH_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <span>Built for 0G APAC Hackathon 2026</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors"
            aria-label="View source on GitHub"
          >
            <Github className="h-3.5 w-3.5" aria-hidden />
            Open Source
          </a>
        </div>
      </div>
    </footer>
  );
}
