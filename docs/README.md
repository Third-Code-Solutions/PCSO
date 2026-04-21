# PCSO HRIS Documentation Index

Use this page as the entry point for onboarding, audits, and operational handoff.

## Recommended Reading Order

1. `PROJECT_STRUCTURE.md` — repository map and ownership by folder
2. `ARCHITECTURE.md` — system design and data flow
3. `DEPLOYMENT.md` — environment setup, secrets, and release process
4. `RUNBOOK.md` — operations and incident procedures
5. `SECURITY.md` — security controls, RLS posture, and privacy handling
6. `ACCOUNTS.md` — account lifecycle and access administration
7. `CONTRIBUTING.md` + `CONVENTIONS.md` — development standards

## Module and Delivery References

- `TECHNICAL-MODULE-SUMMARY.md` — module-level delivery snapshot
- `TECHNICAL-MODULE-IMPLEMENTATION-STATUS.md` — implementation progress detail
- `TECHNICAL-MODULE-USER-GUIDE.md` — operator usage references
- `LDM_COMPLETION_SUMMARY.md` and `LDM_USAGE_GUIDE.md` — LDM package artifacts

## Handoff Notes

- Keep documentation updates in the same pull request as behavior changes.
- Do not store credentials in docs; use environment variables and secret stores.
- For transfer packages, provide a fresh git clone where possible instead of a local zipped workspace.
