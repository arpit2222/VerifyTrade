import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/trade", "/verify", "/dashboard", "/agent"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://verifytrade.xyz"}/sitemap.xml`,
  };
}
