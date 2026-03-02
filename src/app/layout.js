import { Press_Start_2P, Rye } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

const rye = Rye({
  variable: "--font-saloon",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "Nexus Arcade",
  description: "The Dustbowl Emulator Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${pressStart.variable} ${rye.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
