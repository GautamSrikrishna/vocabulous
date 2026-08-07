import type { Metadata, Viewport } from "next";
import { Baloo_Tamma_2 } from "next/font/google";

import "./globals.css";

/**
 * Baloo Tamma 2 is the one rounded, friendly face that covers *both* Latin and
 * Kannada, so English and Kannada answers look like the same app rather than
 * two different ones bolted together.
 */
const roundFont = Baloo_Tamma_2({
  subsets: ["latin", "kannada"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-round",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vocabulous — the Word Wizard",
  description:
    "Type or say a word and the Word Wizard finds its meaning, synonym, antonym and an example sentence, in English or Kannada.",
};

export const viewport: Viewport = {
  themeColor: "#fff3d6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roundFont.variable}>
      <body>{children}</body>
    </html>
  );
}
