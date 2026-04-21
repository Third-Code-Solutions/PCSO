/**
 * Tolerant result unwrapper. Sibling agents own the action modules under
 * `@/lib/actions/rpm/*`, but they ship at least two shapes in parallel:
 *
 *   { ok: true, data } | { ok: false, error }
 *   { data } | { error }
 *
 * This helper accepts either and returns a value or null. Keep the shape
 * surface as `unknown` so the integrator can tighten types centrally.
 */
export function unwrap<T>(result: unknown): T | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if ("error" in r && r.error) return null;
  if ("ok" in r && r.ok === false) return null;
  if ("data" in r) return (r.data as T) ?? null;
  return null;
}

/** True when the action returned a success envelope. */
export function isOk(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  if ("error" in r && r.error) return false;
  if ("ok" in r && r.ok === false) return false;
  return "data" in r;
}
