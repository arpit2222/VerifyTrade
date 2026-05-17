/** @type {import('next').NextConfig} */
const nextConfig = {
  // ---------------------------------------------------------------------------
  // Rendering strategy
  // ---------------------------------------------------------------------------
  // Keep default — pages can opt into SSG/ISR individually
  // reactStrictMode catches issues in dev without impacting prod
  reactStrictMode: true,

  // ---------------------------------------------------------------------------
  // Experimental features
  // ---------------------------------------------------------------------------
  experimental: {
    // App Router is stable in Next 14; no flag needed
    // Enable server actions for form handling
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },

  // ---------------------------------------------------------------------------
  // Webpack overrides — required for ethers.js / wagmi in browser bundles
  // ---------------------------------------------------------------------------
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfill Node.js modules that ethers.js expects in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        "pino-pretty": false,
        lokijs: false,
        encoding: false,
      };
    }

    // Alias react-native module for both server and client bundles.
    // MetaMask SDK pulls in @react-native-async-storage during SSR even
    // though it's only used in client components — stub it out everywhere.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };

    // Suppress "Critical dependency" warnings from WalletConnect internals
    config.externals.push("pino-pretty", "lokijs", "encoding");

    return config;
  },

  // ---------------------------------------------------------------------------
  // Images — allow external token logo hosts
  // ---------------------------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
      },
      {
        protocol: "https",
        hostname: "tokens.1inch.io",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Environment variables exposed to the browser
  // All NEXT_PUBLIC_* vars in .env are auto-exposed; list extras here
  // ---------------------------------------------------------------------------
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },

  // ---------------------------------------------------------------------------
  // Redirects
  // ---------------------------------------------------------------------------
  async redirects() {
    return [
      {
        source: "/",
        destination: "/trade",
        permanent: false,
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Headers — basic security hardening
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
