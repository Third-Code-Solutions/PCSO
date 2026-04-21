import type { ReactNode } from "react";

/**
 * Recruitment & Placement Module (RPM) layout.
 *
 * Deliberately minimal — the parent (dashboard) layout already provides the
 * app shell (sidebar + top nav). This layout just scopes metadata to the
 * /recruitment tree.
 */
export const metadata = {
  title: {
    default: "Recruitment",
    template: "%s · Recruitment",
  },
};

interface RecruitmentLayoutProps {
  children: ReactNode;
}

export default function RecruitmentLayout({
  children,
}: RecruitmentLayoutProps) {
  return <div>{children}</div>;
}
