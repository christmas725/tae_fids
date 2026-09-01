import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TAE FIDS",
    short_name: "TAE FIDS",
    description: "대구국제공항 실시간 출발·도착 FIDS",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#155db0",
    orientation: "any",
    lang: "ko-KR",
    icons: [
      {
        src: "/icons/tae-fids.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
