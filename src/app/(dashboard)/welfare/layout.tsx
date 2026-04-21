import type { ReactNode } from "react";

export const metadata = {
  title: {
    default: "Welfare & Benefits",
    template: "%s · Welfare & Benefits",
  },
};

interface WelfareLayoutProps {
  children: ReactNode;
}

/**
 * Employee Welfare & Benefits Module (EWBM) layout.
 *
 * Deliberately minimal — the parent (dashboard) layout provides the app shell
 * (sidebar + top nav). This layout just scopes metadata to the /welfare tree.
 */
export default function WelfareLayout({ children }: WelfareLayoutProps) {
  return <div>{children}</div>;
}
