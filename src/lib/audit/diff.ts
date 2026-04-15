/**
 * Pure utility — no server dependencies.
 * Safe to import in both Server Components and Client Components.
 */

/**
 * Returns only the fields that changed between oldValues and newValues.
 * Used for compact diff views in the audit log detail dialog.
 */
export function diffValues(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): { field: string; old: unknown; new: unknown }[] {
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const diffs: { field: string; old: unknown; new: unknown }[] = [];

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({ field: key, old: oldVal, new: newVal });
    }
  }

  return diffs;
}
