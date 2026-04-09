import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import LandingContent from "../landing/LandingContent";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ohunjal AI - Your AI Workout Planner in 3 Seconds",
  description:
    "3.2x per week avg. 94% completion rate. AI builds your daily routine based on your condition.",
  openGraph: {
    title: "Ohunjal AI - Your AI Workout Planner in 3 Seconds",
    description:
      "3.2x per week avg. 94% completion rate. AI builds your daily routine based on your condition.",
    type: "website",
    locale: "en_US",
    siteName: "Ohunjal AI",
    url: "https://ohunjal.com/en",
  },
};

export default function LandingPageEn() {
  return (
    <div className={instrumentSans.variable}>
      <LandingContent locale="en" />
    </div>
  );
}
