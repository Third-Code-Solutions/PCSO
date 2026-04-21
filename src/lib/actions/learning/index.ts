/**
 * Learning & Development Module (LDM) Actions
 *
 * Server actions for M6 - Complete implementation of PRD LDM-001 through LDM-015
 */

// Training Programs (LDM-001, LDM-002)
export {
  createTrainingProgram,
  updateTrainingProgram,
  deactivateTrainingProgram,
  getTrainingProgram,
  listActivePrograms,
  listMandatoryPrograms,
} from "./programs";

// Training Providers (LDM-003)
export {
  createTrainingProvider,
  updateTrainingProvider,
  deactivateTrainingProvider,
  getTrainingProvider,
  listActiveProviders,
} from "./providers";

// Training Runs (LDM-004, LDM-005, LDM-008)
export {
  scheduleTraining,
  updateTrainingRun,
  submitScheduleForApproval,
  approveSchedule,
  cancelSchedule,
  setupApprovalChain,
  getTrainingRun,
  computeTrainingCost,
} from "./runs";

// Participants (LDM-006, LDM-009)
export {
  addParticipant,
  removeParticipant,
  confirmAttendance,
  markParticipantCompleted,
  getParticipantsByRun,
} from "./participants";

// Certificates (LDM-010)
export {
  generateTrainingCertificate,
  getCertificate,
  getCertificateByNumber,
  listCertificates,
} from "./certificates";

// Competency Assessment & TNA (LDM-012, LDM-013)
export {
  recordCompetencyAssessment,
  getEmployeeAssessments,
  runTrainingNeedsAnalysis,
  getEmployeeTNAGaps,
  resolveGap,
} from "./competency";

// Compliance & Reports (LDM-007, LDM-011, LDM-015)
export {
  getMandatoryComplianceReport,
  getComplianceSummary,
  getTrainingExpenseReport,
  getTrainingExpenseSummary,
} from "./compliance";
