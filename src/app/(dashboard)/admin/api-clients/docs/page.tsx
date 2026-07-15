import type { Metadata } from "next";

import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { API_SCOPES } from "@/lib/api/v1/scopes";

export const metadata: Metadata = {
  title: "API v1 Reference — Admin",
};

/**
 * /admin/api-clients/docs — static developer reference for the public REST
 * API v1 (TOR 3.3.1–3.3.16). Server component, no client JS.
 */

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted p-4 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

interface EndpointRow {
  method: string;
  path: string;
  scope: string;
  summary: string;
}

const ENDPOINTS: EndpointRow[] = [
  {
    method: "POST",
    path: "/api/v1/oauth/token",
    scope: "— (client credentials)",
    summary: "OAuth 2.0 client_credentials grant → 1-hour Bearer JWT.",
  },
  {
    method: "GET",
    path: "/api/v1/employees",
    scope: "employees:read",
    summary:
      "List employees. Filters: office_id, status, appointment_type, updated_since. Pagination: page, limit (max 200).",
  },
  {
    method: "POST",
    path: "/api/v1/employees",
    scope: "employees:write",
    summary: "Create an employee (201 + Location header).",
  },
  {
    method: "GET",
    path: "/api/v1/employees/{id}",
    scope: "employees:read",
    summary: "Read one employee.",
  },
  {
    method: "PATCH",
    path: "/api/v1/employees/{id}",
    scope: "employees:write",
    summary: "Partial update (snake_case fields, at least one).",
  },
  {
    method: "DELETE",
    path: "/api/v1/employees/{id}",
    scope: "employees:write",
    summary: "Soft delete (204). Personnel records are never hard-deleted.",
  },
  {
    method: "POST",
    path: "/api/v1/employees/batch",
    scope: "employees:write",
    summary:
      "Up to 500 create/update operations, applied per-item (not all-or-nothing) with per-item statuses.",
  },
  {
    method: "GET",
    path: "/api/v1/leave-balances",
    scope: "leave:read",
    summary:
      "Leave credit ledger balances. Requires employee_id or office_id; optional year (defaults to current).",
  },
  {
    method: "GET",
    path: "/api/v1/payroll/journal-entries",
    scope: "payroll:read",
    summary:
      "Balanced journal entries per approved/paid payroll period (PAY-015 accounting integration). ?period_id=<uuid>, formats json | xml | csv.",
  },
  {
    method: "POST",
    path: "/api/v1/jobs",
    scope: "jobs:write",
    summary:
      "Submit an async job: payroll_journal_export or employee_report. Response carries the final job state + result_url.",
  },
  {
    method: "GET",
    path: "/api/v1/jobs",
    scope: "jobs:read",
    summary: "List your client's jobs (status / job_type filters).",
  },
  {
    method: "GET",
    path: "/api/v1/jobs/{id}",
    scope: "jobs:read",
    summary: "Job status and result URL (tenant-isolated; foreign ids → 404).",
  },
];

export default async function ApiDocsPage() {
  await requirePermission("admin", "view");

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Public REST API v1 Reference"
        description="Machine-to-machine interface for PCSO HRIS integrations — TOR 3.3.1–3.3.16 (API-001…API-008)."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "API Clients", href: "/admin/api-clients" },
          { label: "Docs" },
        ]}
      />

      <div className="max-w-4xl space-y-10">
        <Section title="Base URL & Versioning">
          <p className="text-sm text-muted-foreground">
            All endpoints live under <Code>/api/v1</Code> (TOR 3.3.5 naming:{" "}
            <Code>{"/api/v1/{resource}/{id}"}</Code>). Breaking changes ship as{" "}
            <Code>/api/v2</Code> — v1 contracts stay stable. Every response sets{" "}
            <Code>Cache-Control: no-store</Code>.
          </p>
        </Section>

        <Section title="Authentication (TOR 3.3.2 / 3.3.3)">
          <p className="text-sm text-muted-foreground">
            Two credential styles, both sent in the <Code>Authorization</Code>{" "}
            header. Credentials are issued on the{" "}
            <Code>/admin/api-clients</Code> page and shown exactly once.
          </p>
          <h3 className="text-sm font-semibold">1 — Static API key</h3>
          <CodeBlock>{`GET /api/v1/employees?status=active
Authorization: Bearer pcso_<clientId>.<secret>`}</CodeBlock>
          <h3 className="text-sm font-semibold">
            2 — OAuth 2.0 client credentials
          </h3>
          <CodeBlock>{`POST /api/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=<clientId>&client_secret=<secret>&scope=employees:read

→ 200 { "access_token": "<jwt>", "token_type": "Bearer",
        "expires_in": 3600, "scope": "employees:read" }

GET /api/v1/employees
Authorization: Bearer <jwt>`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            Access tokens are HS256 JWTs valid for 1 hour, signed with the{" "}
            <Code>API_JWT_SECRET</Code> environment variable. When that variable
            is not configured, the OAuth flow answers <Code>503</Code> and
            static API keys remain the supported method. A token&apos;s
            effective scopes are always intersected with the client&apos;s{" "}
            <em>current</em> grants, so revoking a scope (or deactivating the
            client) takes effect immediately.
          </p>
        </Section>

        <Section title="Scopes">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">Scope</th>
                  <th className="p-2 font-medium">Grants</th>
                </tr>
              </thead>
              <tbody>
                {API_SCOPES.map((scope) => (
                  <tr key={scope.scope} className="border-t">
                    <td className="p-2">
                      <Code>{scope.scope}</Code>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {scope.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Endpoints (TOR 3.3.5 / 3.3.6 / 3.3.7)">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">Method</th>
                  <th className="p-2 font-medium">Path</th>
                  <th className="p-2 font-medium">Scope</th>
                  <th className="p-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((endpoint) => (
                  <tr
                    key={`${endpoint.method} ${endpoint.path}`}
                    className="border-t align-top"
                  >
                    <td className="p-2 font-mono text-xs font-semibold">
                      {endpoint.method}
                    </td>
                    <td className="p-2 font-mono text-xs">{endpoint.path}</td>
                    <td className="p-2 font-mono text-xs">{endpoint.scope}</td>
                    <td className="p-2 text-muted-foreground">
                      {endpoint.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Errors — RFC 7807 (TOR 3.3.14)">
          <p className="text-sm text-muted-foreground">
            Every error is <Code>application/problem+json</Code>. OAuth error
            codes ride in the <Code>error</Code> extension member; validation
            failures include a zod-flattened <Code>errors</Code> member.
          </p>
          <CodeBlock>{`HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "The authenticated client is missing required scopes.",
  "error": "insufficient_scope",
  "required_scopes": ["employees:write"],
  "missing_scopes": ["employees:write"]
}`}</CodeBlock>
        </Section>

        <Section title="Response formats — JSON & XML (TOR 3.3.9 / 3.3.10)">
          <p className="text-sm text-muted-foreground">
            JSON is the default. Request XML with <Code>?format=xml</Code>{" "}
            (wins) or <Code>Accept: application/xml</Code>. Arrays serialize as
            repeated elements. The journal-entries endpoint additionally
            supports <Code>?format=csv</Code> for the accounting system.
          </p>
          <CodeBlock>{`GET /api/v1/payroll/journal-entries?period_id=…&format=xml

<?xml version="1.0" encoding="UTF-8"?>
<journal>
  <data>
    <period_name>General Payroll 2026-06 (2nd half)</period_name>
    <entries><account>Personnel Services</account><type>Debit</type>…</entries>
    <entries><account>Due to BIR</account><type>Credit</type>…</entries>
  </data>
</journal>`}</CodeBlock>
        </Section>

        <Section title="Batch semantics (TOR 3.3.6)">
          <p className="text-sm text-muted-foreground">
            <Code>POST /api/v1/employees/batch</Code> accepts up to 500
            operations. Items are applied independently — a failure never rolls
            back the rest. Each item reports its own HTTP-style status.
          </p>
          <CodeBlock>{`{
  "operations": [
    { "method": "create", "data": { "employee_no": "PCSO-2026-0001", … } },
    { "method": "update", "id": "9c7d…", "data": { "status": "on_leave" } }
  ]
}

→ 200 {
  "results": [
    { "index": 0, "method": "create", "status": 201, "id": "…" },
    { "index": 1, "method": "update", "status": 200, "id": "9c7d…" }
  ],
  "summary": { "total": 2, "succeeded": 2, "failed": 0 }
}`}</CodeBlock>
        </Section>

        <Section title="Async jobs (TOR 3.3.15)">
          <p className="text-sm text-muted-foreground">
            Long-running exports run through the job queue. Submitting a job
            creates a durable <Code>queued</Code> record which is processed
            within the same request (up to 300&nbsp;s); the response returns the
            final state. Poll <Code>GET /api/v1/jobs/{"{id}"}</Code> if the
            connection drops — the row survives. Artifacts are private Supabase
            Storage objects addressed by a 7-day signed <Code>result_url</Code>.
          </p>
          <CodeBlock>{`POST /api/v1/jobs
{ "job_type": "payroll_journal_export",
  "params": { "date_from": "2026-01-01", "date_to": "2026-06-30", "format": "csv" } }

POST /api/v1/jobs
{ "job_type": "employee_report",
  "params": { "status": "active", "columns": ["officeName", "positionTitle", "salaryGrade"] } }`}</CodeBlock>
        </Section>

        <Section title="Rate limiting (TOR 3.3.13 / API-005)">
          <p className="text-sm text-muted-foreground">
            Each client has its own requests-per-minute ceiling (configured on
            the client record, default 60). Exceeding it returns{" "}
            <Code>429</Code> problem+json with <Code>Retry-After</Code>,{" "}
            <Code>X-RateLimit-Limit</Code> and{" "}
            <Code>X-RateLimit-Remaining: 0</Code> headers. The token endpoint is
            additionally limited per source IP.
          </p>
        </Section>

        <Section title="CSC integration readiness (TOR 3.3.16)">
          <p className="text-sm text-muted-foreground">
            When the Civil Service Commission publishes prescribed interface
            specifications, conformant endpoints will be exposed under this same
            v1 surface: the credential model (scoped API clients /
            OAuth&nbsp;2.0), RFC&nbsp;7807 errors, JSON/XML negotiation and the
            async job queue documented above are the building blocks a CSC
            adapter plugs into — a new scope (e.g. <Code>csc:submit</Code>) plus
            routes, no architectural change.
          </p>
        </Section>
      </div>
    </div>
  );
}
