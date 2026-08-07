# MedCore HMS — PRD Requirements Traceability Matrix

| PRD Section | Requirement Description | Implementation Source | Test Evidence | Status |
| :--- | :--- | :--- | :--- | :--- |
| **§1.1** | Multi-Tenant Architecture & Isolation | `apps/api/src/common/guards/tenancy.guard.ts` | `test/tenancy.test.ts` | **IMPLEMENTED + TESTED** |
| **§1.2** | 9-Role RBAC Authorization Matrix | `apps/api/src/common/guards/roles.guard.ts` | `test/rbac.test.ts` | **IMPLEMENTED + TESTED** |
| **§2.1** | Bcrypt Password Hashing (Cost Factor >= 12) | `apps/api/src/modules/auth/auth.service.ts` | `test/auth.test.ts` | **IMPLEMENTED + TESTED** |
| **§2.2** | JWT Token & Redis Session Revocation | `apps/api/src/modules/auth/auth.service.ts` | `test/redis-infrastructure.test.ts` | **IMPLEMENTED + TESTED** |
| **§2.3** | Single-Use 6-Digit Email/SMS OTP | `apps/api/src/modules/auth/auth.service.ts` | `test/redis-infrastructure.test.ts` | **IMPLEMENTED + TESTED** |
| **§3.1** | OPD Appointment Booking & Concurrency Lock | `apps/api/src/modules/appointments/appointments.service.ts` | `test/concurrency.test.ts` | **IMPLEMENTED + TESTED** |
| **§3.2** | Appointment State Machine Transitions | `apps/api/src/modules/appointments/appointments.service.ts` | `test/appointment-state-machine.test.ts` | **IMPLEMENTED + TESTED** |
| **§3.3** | Emergency Code Red Triage Bypass | `apps/api/src/modules/appointments/appointments.service.ts` | `test/appointment-state-machine.test.ts` | **IMPLEMENTED + TESTED** |
| **§4.1** | Append-Only EMR Clinical Records | `apps/api/src/modules/emr/emr.service.ts` | `test/emr.test.ts` | **IMPLEMENTED + TESTED** |
| **§4.2** | Patient Cross-Isolation & Data Privacy | `apps/api/src/modules/emr/emr.service.ts` | `test/patient-isolation.test.ts` | **IMPLEMENTED + TESTED** |
| **§5.1** | Doctor Digital Prescription & PDF Engine | `apps/api/src/modules/prescriptions`, `src/pdf` | `test/storage-pdf.test.ts` | **IMPLEMENTED + TESTED** |
| **§6.1** | Diagnostic Lab Order & Out-of-Range Alerts | `apps/api/src/modules/lab/lab.service.ts` | `test/lab-workflow.test.ts` | **IMPLEMENTED + TESTED** |
| **§7.1** | Pharmacy Formulary & FIFO Batch Allocation | `apps/api/src/modules/pharmacy/pharmacy.service.ts` | `test/pharmacy.test.ts` | **IMPLEMENTED + TESTED** |
| **§7.2** | 30-Day Expiring Stock Scanner Job | `apps/api/src/jobs/jobs.service.ts` | `test/bullmq-jobs.test.ts` | **IMPLEMENTED + TESTED** |
| **§8.1** | Invoicing Ledger & Server Amount Authority | `apps/api/src/modules/billing/billing.service.ts` | `test/billing.test.ts` | **IMPLEMENTED + TESTED** |
| **§8.2** | Stripe / Razorpay Signature & Idempotency | `apps/api/src/providers/adapters` | `test/payment-gateways.test.ts` | **IMPLEMENTED + TESTED** |
| **§9.1** | Multi-Channel Notifications (Resend/Twilio/Socket)| `apps/api/src/modules/notifications` | `test/providers-notifications.test.ts` | **IMPLEMENTED + TESTED** |
| **§10.1** | Audit Logging Engine | `apps/api/src/modules/audit/audit.service.ts` | `test/direct_index.test.ts` | **IMPLEMENTED + TESTED** |
| **§11.1** | Next.js 15 App Router Frontend | `apps/web/app/` | `npm run build:web` | **IMPLEMENTED + TESTED** |
| **§11.2** | Form Validation (Zod + React Hook Form) | `apps/web/src/views/` | `apps/web/test/forms-validation.test.ts` | **IMPLEMENTED + TESTED** |
| **§11.3** | Playwright E2E Smoke Workflows | `apps/web/e2e/app.spec.ts` | `npx playwright test` | **IMPLEMENTED + TESTED** |
