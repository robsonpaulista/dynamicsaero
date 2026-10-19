import type { Metadata, Viewport } from "next";
import { Michroma, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source",
});

const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-michroma",
});

export const metadata: Metadata = {
  title: {
    default: "Dynamics Aero",
    template: "%s · Dynamics Aero",
  },
  description:
    "Gestão à vista de aeronaves particulares: itinerários, despesas, hangar, pessoal, manutenção e rateio.",
  applicationName: "Dynamics Aero",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1E293B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sourceSans.variable} ${michroma.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${sourceSans.className} min-h-full`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
