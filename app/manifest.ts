import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DarDoc",
    short_name: "DarDoc",
    description: "BoomHealth lab bookings dashboard",
    start_url: "/dashboard/bookings",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1419",
    theme_color: "#119da4",
    lang: "en",
    categories: ["medical", "health", "business"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],
  }
}
