import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { NewRequestForm } from "./_new-request-form";

export const metadata = { title: "New Document Request" };
export const dynamic = "force-dynamic";

export default async function NewDocumentRequestPage() {
  await requireAuth();

  const activeEmployees = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      positionTitle: employees.positionTitle,
    })
    .from(employees)
    .where(eq(employees.status, "active"))
    .orderBy(asc(employees.lastName), asc(employees.firstName));

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/employees/documents/requests">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            New Document Request
          </h1>
          <p className="text-sm text-muted-foreground">
            Submit a document certification request on behalf of an employee
          </p>
        </div>
      </header>

      <div className="max-w-2xl">
        <NewRequestForm employees={activeEmployees} />
      </div>
    </div>
  );
}
