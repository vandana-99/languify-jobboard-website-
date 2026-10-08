import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Job Board | Languify",
  description: "Explore your next opportunity in Product, Consulting, Growth, Business, and Design with Languify.",
  robots: { index: false, follow: false },
  icons: { icon: { url: "/languify-original.webp", type: "image/webp" }, shortcut: "/languify-original.webp" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
