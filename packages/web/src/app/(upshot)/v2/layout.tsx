import { Newsreader } from "next/font/google";
import { UpshootShell } from "@/components/upshot/shell";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export default function UpshootLayout({ children }: { children: React.ReactNode }) {
  return (
    <UpshootShell newsreaderClassName={newsreader.variable}>
      {children}
    </UpshootShell>
  );
}
