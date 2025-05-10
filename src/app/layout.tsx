import type { Metadata } from "next";
import "./globals.css";

import fontVariables from "@/styles/fonts";
import Theme from "@/utils/themeWrapper";
import { FlowProvider } from "@/context/FlowContext";

export const metadata: Metadata = {
  title: "cowriting-experiment",
  description: "Research Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontVariables} antialiased`}>
        <FlowProvider>
          <Theme>{children}</Theme>
        </FlowProvider>
      </body>
    </html>
  );
}
