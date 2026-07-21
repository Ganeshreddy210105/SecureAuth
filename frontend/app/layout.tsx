import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ClientBackground from "@/components/ClientBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SecureAuth - Premium JWT & OAuth2 Identity Platform",
  description: "Enterprise-grade, Apple-quality authentication platform featuring passwordless OTP, token rotation, and developer dashboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col relative text-[#F8FAFC]">
        <Providers>
          <ClientBackground />
          <div className="flex-1 flex flex-col justify-center items-center w-full min-h-screen relative z-10">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
