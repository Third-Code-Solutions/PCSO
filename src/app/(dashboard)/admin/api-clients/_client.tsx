"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Power, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { API_SCOPES } from "@/lib/api/v1/scopes";
import {
  createApiClient,
  deleteApiClient,
  rotateApiClientSecret,
  setApiClientActive,
} from "./actions";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiClientRow {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface RevealedKey {
  title: string;
  plaintextKey: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

// ─── One-time key reveal dialog ──────────────────────────────────────────────

function KeyRevealDialog({
  revealed,
  onClose,
}: {
  revealed: RevealedKey | null;
  onClose: () => void;
}) {
  async function copyKey() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.plaintextKey);
      toast.success("API key copied to clipboard");
    } catch {
      toast.error("Could not copy — select the key text manually");
    }
  }

  return (
    <Dialog
      open={revealed !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {revealed?.title}
          </DialogTitle>
          <DialogDescription>
            This key is shown <strong>only once</strong>. Store it in your
            integration&apos;s secret manager now — it cannot be retrieved
            later, only rotated.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted p-3">
          <code className="break-all font-mono text-xs">
            {revealed?.plaintextKey}
          </code>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={copyKey}
            className="gap-2"
          >
            <Copy className="h-4 w-4" /> Copy key
          </Button>
          <Button size="sm" onClick={onClose}>
            I have stored the key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create dialog ───────────────────────────────────────────────────────────

const DEFAULT_RATE_LIMIT = "60";

export function CreateApiClientButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [revealed, setRevealed] = React.useState<RevealedKey | null>(null);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>([]);
  const [rateLimit, setRateLimit] = React.useState(DEFAULT_RATE_LIMIT);
  const [expiresAt, setExpiresAt] = React.useState("");

  function toggleScope(scope: string, checked: boolean) {
    setScopes((current) =>
      checked ? [...current, scope] : current.filter((s) => s !== scope),
    );
  }

  function resetForm() {
    setName("");
    setDescription("");
    setScopes([]);
    setRateLimit(DEFAULT_RATE_LIMIT);
    setExpiresAt("");
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (scopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }
    setPending(true);
    try {
      const result = await createApiClient({
        name: name.trim(),
        description: description.trim() || undefined,
        scopes,
        rateLimitPerMinute: Number(rateLimit) || 60,
        expiresAt: expiresAt || undefined,
      });
      setOpen(false);
      resetForm();
      setRevealed({
        title: `API key for “${result.name}”`,
        plaintextKey: result.plaintextKey,
      });
      toast.success("API client created");
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="gap-2 bg-pcso-navy text-white hover:bg-pcso-navy-light"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" /> New API Client
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API client</DialogTitle>
            <DialogDescription>
              Issues a static API key (and OAuth 2.0 client credentials) for a
              system integration. Scopes follow least-privilege — grant only
              what the integration needs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="api-client-name">Name</Label>
              <Input
                id="api-client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PCSO Accounting System"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="api-client-description">Description</Label>
              <Textarea
                id="api-client-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What system uses this credential, and who owns it?"
                rows={2}
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Scopes</Label>
              <div className="space-y-2 rounded-md border p-3">
                {API_SCOPES.map((definition) => (
                  <label
                    key={definition.scope}
                    className="flex cursor-pointer items-start gap-2"
                  >
                    <Checkbox
                      checked={scopes.includes(definition.scope)}
                      onCheckedChange={(checked) =>
                        toggleScope(definition.scope, checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      <code className="font-mono text-xs font-semibold">
                        {definition.scope}
                      </code>
                      <span className="block text-xs text-muted-foreground">
                        {definition.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="api-client-rate">Rate limit (req/min)</Label>
                <Input
                  id="api-client-rate"
                  type="number"
                  min={1}
                  max={10000}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api-client-expiry">Expiry (optional)</Label>
                <Input
                  id="api-client-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={pending}>
              {pending ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KeyRevealDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

// ─── Clients table ───────────────────────────────────────────────────────────

export function ApiClientsTable({ clients }: { clients: ApiClientRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [revealed, setRevealed] = React.useState<RevealedKey | null>(null);

  async function run(
    id: string,
    fn: () => Promise<void>,
    successMessage: string,
  ) {
    setPendingId(id);
    try {
      await fn();
      toast.success(successMessage);
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  async function handleRotate(row: ApiClientRow) {
    if (
      !window.confirm(
        `Rotate the secret for “${row.name}”? The current key stops working immediately.`,
      )
    ) {
      return;
    }
    setPendingId(row.id);
    try {
      const result = await rotateApiClientSecret({ id: row.id });
      setRevealed({
        title: `New API key for “${row.name}”`,
        plaintextKey: result.plaintextKey,
      });
      toast.success("Secret rotated");
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No API clients yet. Create one to let an external system (accounting,
        CSC, biometric middleware) call the v1 API.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key prefix</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead className="text-right">Limit/min</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.name}</div>
                  {row.description ? (
                    <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                      {row.description}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <code className="font-mono text-xs">pcso_{row.clientId}</code>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[260px] flex-wrap gap-1">
                    {row.scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.rateLimitPerMinute}
                </TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(row.lastUsedAt)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.expiresAt ? formatDate(row.expiresAt) : "Never"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Rotate secret"
                      disabled={pendingId === row.id}
                      onClick={() => void handleRotate(row)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title={row.isActive ? "Deactivate" : "Activate"}
                      disabled={pendingId === row.id}
                      onClick={() =>
                        void run(
                          row.id,
                          () =>
                            setApiClientActive({
                              id: row.id,
                              isActive: !row.isActive,
                            }),
                          row.isActive
                            ? "Client deactivated"
                            : "Client activated",
                        )
                      }
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                      disabled={pendingId === row.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete API client “${row.name}”? Its key stops working immediately. (Soft delete — the audit trail is retained.)`,
                          )
                        ) {
                          void run(
                            row.id,
                            () => deleteApiClient({ id: row.id }),
                            "Client deleted",
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <KeyRevealDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}
