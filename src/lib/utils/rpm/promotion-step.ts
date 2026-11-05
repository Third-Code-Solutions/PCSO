/**
 * Step for an internal appointee on the new grade: the lowest step that pays
 * at least their current salary, so a promotion never cuts pay (step 1 only
 * when it already pays enough). Falls back to the top step when none does.
 */
export function promotionStep(
  currentSalary: number,
  newGradeSteps: ReadonlyArray<{ step: number; monthlySalary: number }>,
): number {
  const sorted = [...newGradeSteps].sort((a, b) => a.step - b.step);
  if (sorted.length === 0) return 1;
  const fit = sorted.find((s) => s.monthlySalary >= currentSalary);
  return (fit ?? sorted[sorted.length - 1]!).step;
}
