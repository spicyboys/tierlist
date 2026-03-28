import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";
import { getAuthenticatedAppForUser } from "@/lib/firebase/server";
import PageHeader from "@/components/PageHeader";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "TierMaker - Create & Share Tier Lists",
  description:
    "Create, edit, and share tier lists with real-time collaboration",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { currentUser } = await getAuthenticatedAppForUser();
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950`}
      >
        <Providers>
          <div className="min-h-screen bg-gray-950 text-white">
            <PageHeader
              initialUser={
                // Map Firebase User to our app's User type. We need to do this or we get an infinite loop
                // from the user serialization.
                currentUser
                  ? { id: currentUser.uid, name: currentUser.displayName || "" }
                  : null
              }
            />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
