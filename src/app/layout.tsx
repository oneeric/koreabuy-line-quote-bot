import type { ReactNode } from "react";

export const metadata = {
  title: "韓國代購 LINE 報價 Bot",
  description: "Internal LINE quote bot for Korea buying service.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
