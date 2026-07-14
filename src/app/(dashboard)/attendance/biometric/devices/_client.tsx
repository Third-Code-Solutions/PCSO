"use client";

/**
 * Biometric device registry client (TOR 1.5.2 / TAM-004).
 *
 * - Device table: mode, format, office, status, last poll outcome
 * - Register dialog → shows the generated API key ONCE on success
 * - Edit dialog, activate/deactivate, and per-device "Pull now" trigger
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBiometricDevice,
  updateBiometricDevice,
  setBiometricDeviceActive,
  pullBiometricDeviceNow,
} from "./actions";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DeviceRow {
  id: string;
  name: string;
  vendor: string | null;
  serialNumber: string | null;
  officeId: string | null;
  officeName: string | null;
  mode: "push" | "pull" | "manual";
  payloadFormat: "csv" | "json" | "xml";
  pullUrl: string | null;
  pollIntervalMinutes: number;
  isActive: boolean;
  /** ISO string */
  lastPolledAt: string | null;
  lastPullStatus: string | null;
  lastPullMessage: string | null;
}

export interface OfficeOption {
  id: string;
  name: string;
}

interface Props {
  devices: DeviceRow[];
  offices: OfficeOption[];
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface DeviceForm {
  name: string;
  vendor: string;
  serialNumber: string;
  officeId: string;
  mode: "push" | "pull" | "manual";
  payloadFormat: "csv" | "json" | "xml";
  pullUrl: string;
  pollIntervalMinutes: string;
}

const EMPTY_FORM: DeviceForm = {
  name: "",
  vendor: "",
  serialNumber: "",
  officeId: "",
  mode: "push",
  payloadFormat: "csv",
  pullUrl: "",
  pollIntervalMinutes: "60",
};

function formToInput(form: DeviceForm) {
  return {
    name: form.name.trim(),
    vendor: form.vendor.trim() || null,
    serialNumber: form.serialNumber.trim() || null,
    officeId: form.officeId || null,
    mode: form.mode,
    payloadFormat: form.payloadFormat,
    pullUrl: form.pullUrl.trim() || null,
    pollIntervalMinutes: Number(form.pollIntervalMinutes) || 60,
  };
}

const SELECT_CLASS =
  "mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#C8A84B] focus:outline-none";

const MODE_LABELS: Record<DeviceRow["mode"], string> = {
  push: "Push (device sends)",
  pull: "Pull (scheduled poll)",
  manual: "Manual pull only",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BiometricDevicesClient({ devices, offices }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"register" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeviceForm>(EMPTY_FORM);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [pullingId, setPullingId] = useState<string | null>(null);

  const set = (field: keyof DeviceForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  function openRegister() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialog("register");
  }

  function openEdit(device: DeviceRow) {
    setForm({
      name: device.name,
      vendor: device.vendor ?? "",
      serialNumber: device.serialNumber ?? "",
      officeId: device.officeId ?? "",
      mode: device.mode,
      payloadFormat: device.payloadFormat,
      pullUrl: device.pullUrl ?? "",
      pollIntervalMinutes: String(device.pollIntervalMinutes),
    });
    setEditingId(device.id);
    setDialog("edit");
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        if (dialog === "register") {
          const res = await createBiometricDevice(formToInput(form));
          setDialog(null);
          setRevealedKey(res.apiKey);
          toast.success("Device registered.");
        } else if (dialog === "edit" && editingId) {
          await updateBiometricDevice({ id: editingId, ...formToInput(form) });
          setDialog(null);
          toast.success("Device updated.");
        }
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function handleToggleActive(device: DeviceRow) {
    const verb = device.isActive ? "Deactivate" : "Reactivate";
    if (
      !window.confirm(
        `${verb} "${device.name}"? ${
          device.isActive
            ? "Its API key will stop authenticating and it will no longer be polled."
            : "It will authenticate and be polled again."
        }`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await setBiometricDeviceActive({
          id: device.id,
          isActive: !device.isActive,
        });
        toast.success(
          `Device ${device.isActive ? "deactivated" : "reactivated"}.`,
        );
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function handlePullNow(device: DeviceRow) {
    setPullingId(device.id);
    startTransition(async () => {
      try {
        const res = await pullBiometricDeviceNow({ deviceId: device.id });
        if (res.success) {
          toast.success(
            `Pulled ${device.name}: ${res.imported} imported, ${res.unmatchedBadges} unmatched badges.`,
          );
        } else {
          toast.error(`Pull failed: ${res.message}`);
        }
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Pull failed");
      } finally {
        setPullingId(null);
      }
    });
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      toast.success("API key copied to clipboard.");
    } catch {
      toast.error("Copy failed — select and copy the key manually.");
    }
  }

  const needsPullUrl = form.mode !== "push";

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={openRegister}
          className="bg-[#0B2545] text-[#FAF4E6] hover:bg-[#13315C]"
        >
          + Register Device
        </Button>
      </div>

      {/* Devices table */}
      <div className="overflow-x-auto rounded-xl border border-[#0B2545]/10 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {[
                "Device",
                "Office",
                "Mode",
                "Format",
                "Status",
                "Last Poll",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {devices.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No devices registered. Register a device to receive biometric
                  data via push or pull.
                </td>
              </tr>
            )}
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[#0B2545]">
                    {device.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[device.vendor, device.serialNumber]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {device.officeName ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {MODE_LABELS[device.mode]}
                  {device.mode === "pull" && (
                    <div className="text-xs text-gray-400">
                      every {device.pollIntervalMinutes} min
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm uppercase text-gray-700">
                  {device.payloadFormat}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      device.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {device.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {device.lastPolledAt ? (
                    <div>
                      <div>
                        {format(
                          new Date(device.lastPolledAt),
                          "MMM d, yyyy h:mm a",
                        )}
                      </div>
                      <div
                        className={`text-xs ${
                          device.lastPullStatus === "success"
                            ? "text-green-700"
                            : device.lastPullStatus === "partial"
                              ? "text-amber-700"
                              : "text-red-700"
                        }`}
                        title={device.lastPullMessage ?? undefined}
                      >
                        {device.lastPullStatus ?? "—"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {device.mode !== "push" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending || !device.isActive}
                        onClick={() => handlePullNow(device)}
                      >
                        {pullingId === device.id ? "Pulling…" : "Pull now"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => openEdit(device)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      className={
                        device.isActive
                          ? "text-red-700 hover:bg-red-50"
                          : "text-green-700 hover:bg-green-50"
                      }
                      onClick={() => handleToggleActive(device)}
                    >
                      {device.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Register / Edit dialog */}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog === "register" ? "Register Device" : "Edit Device"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "register"
                ? "An API key is generated on registration and shown once. Push devices authenticate with it; pull devices are polled at the URL below."
                : "Update the device's connection settings. The API key cannot be viewed or changed."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="dev-name">Device name</Label>
              <Input
                id="dev-name"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Head Office Lobby BFR-1"
              />
            </div>
            <div>
              <Label htmlFor="dev-vendor">Vendor</Label>
              <Input
                id="dev-vendor"
                value={form.vendor}
                onChange={(e) => set("vendor")(e.target.value)}
                placeholder="ZKTeco"
              />
            </div>
            <div>
              <Label htmlFor="dev-serial">Serial number</Label>
              <Input
                id="dev-serial"
                value={form.serialNumber}
                onChange={(e) => set("serialNumber")(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="dev-office">Office</Label>
              <select
                id="dev-office"
                className={SELECT_CLASS}
                value={form.officeId}
                onChange={(e) => set("officeId")(e.target.value)}
              >
                <option value="">Unassigned</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="dev-mode">Mode</Label>
              <select
                id="dev-mode"
                className={SELECT_CLASS}
                value={form.mode}
                onChange={(e) => set("mode")(e.target.value)}
              >
                <option value="push">Push (device sends)</option>
                <option value="pull">Pull (scheduled poll)</option>
                <option value="manual">Manual pull only</option>
              </select>
            </div>
            <div>
              <Label htmlFor="dev-format">Payload format</Label>
              <select
                id="dev-format"
                className={SELECT_CLASS}
                value={form.payloadFormat}
                onChange={(e) => set("payloadFormat")(e.target.value)}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
              </select>
            </div>
            {needsPullUrl && (
              <>
                <div className="sm:col-span-2">
                  <Label htmlFor="dev-url">Pull URL</Label>
                  <Input
                    id="dev-url"
                    value={form.pullUrl}
                    onChange={(e) => set("pullUrl")(e.target.value)}
                    placeholder="http://10.0.4.21/records/export"
                  />
                </div>
                {form.mode === "pull" && (
                  <div>
                    <Label htmlFor="dev-interval">
                      Poll interval (minutes)
                    </Label>
                    <Input
                      id="dev-interval"
                      type="number"
                      min={5}
                      max={1440}
                      value={form.pollIntervalMinutes}
                      onChange={(e) =>
                        set("pollIntervalMinutes")(e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || form.name.trim().length < 2}
              className="bg-[#0B2545] text-[#FAF4E6] hover:bg-[#13315C]"
            >
              {isPending
                ? "Saving…"
                : dialog === "register"
                  ? "Register"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time API key reveal */}
      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => !open && setRevealedKey(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Device API Key</DialogTitle>
            <DialogDescription>
              Copy this key into the device configuration now. It is shown only
              once — the system stores a hash and cannot recover it. If lost,
              register the device again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <code className="block break-all font-mono text-sm text-[#0B2545]">
              {revealedKey}
            </code>
          </div>
          <p className="text-xs text-gray-500">
            Push devices send it as{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">
              Authorization: Bearer &lt;key&gt;
            </code>{" "}
            to{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">
              /api/attendance/biometric/push
            </code>
            .
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={copyKey}>
              Copy key
            </Button>
            <Button
              onClick={() => setRevealedKey(null)}
              className="bg-[#0B2545] text-[#FAF4E6] hover:bg-[#13315C]"
            >
              I have saved the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
