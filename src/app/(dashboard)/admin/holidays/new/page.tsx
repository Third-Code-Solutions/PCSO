import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { NewHolidayForm } from "./_client";

export const metadata: Metadata = { title: "Add Holiday — Admin" };

export default async function NewHolidayPage() {
  await requirePermission("admin", "edit");
  return <NewHolidayForm />;
}
