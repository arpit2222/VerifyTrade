import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://verifytrade.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/trade`,     lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/verify`,    lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE_URL}/dashboard`, lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE_URL}/agent`,     lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
  ];
}
