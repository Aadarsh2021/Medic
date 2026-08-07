# 🏥 MedCore HMS — Multi-Tenant Hospital Management System

MedCore HMS is a multi-tenant Hospital Management System (HMS) built as a TypeScript monorepo with NestJS, PostgreSQL 16, Prisma 5, Redis 7, BullMQ, Puppeteer, Next.js 15 App Router, and React 19.

It provides role-based clinical, administrative, diagnostic, pharmacy, billing, and patient portal workflows.

---

## 🎯 What the System Does

- **Multi-Tenancy & Data Isolation**: Enforces tenant boundary isolation (`hospitalId` filtering) across PostgreSQL database records, Redis session state, and file storage abstractions.
- **9-Role RBAC Authorization**: Role-Based Access Control enforcing permissions across `SUPER_ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `LAB_TECHNICIAN`, `PHARMACIST`, `ACCOUNTANT`, and `PATIENT`.
- **Authentication & Security**: Bcrypt password hashing (cost factor 12), JWT access tokens, Redis refresh token rotation, 6-digit email/SMS OTP verification with single-use deletion, and rate limiting.
- **OPD Appointment Engine**: Real-time consultation slot management backed by database partial unique index constraints (`Appointment_doctor_slot_unique_idx`) preventing double booking under concurrent requests.
- **Clinical EMR & Prescriptions**: Append-only medical records (`MedicalRecord`), vitals tracking, ICD-10 diagnosis coding, and Puppeteer PDF prescription rendering with digital signatures.
- **Pathology Laboratory**: Test ordering, specimen sample collection, observed result entry, reference range min/max auto-validation, and out-of-range outlier alerts.
- **Pharmacy Inventory & FIFO Dispensing**: Medicine formulary management, multi-batch tracking, First-In First-Out (FIFO) stock allocation, expiry validation, and 30-day expiring stock background jobs.
- **Billing & Multi-Provider Payments**: Server-authoritative invoice aggregation, Stripe and Razorpay payment provider adapters, webhook signature verification, and idempotency protection.
- **Multi-Channel Notifications**: Real-time Socket.IO WebSocket events, Resend email adapter, and Twilio SMS adapter with zero-cost local development fallbacks.

---

## 🛠️ Tech Stack

### Backend (`apps/api`)
- **Framework**: NestJS 10 (Node.js 20 LTS runtime)
- **Database & ORM**: PostgreSQL 16 with Prisma 5.22
- **Cache & Session**: Redis 7 & `ioredis`
- **Background Queues**: BullMQ 5
- **Document Engine**: Puppeteer 23 (Headless Chromium) & Sharp 0.33

### Frontend (`apps/web`)
- **Framework**: Next.js 15 (App Router) & React 19
- **Styling**: Tailwind CSS & Shadcn UI primitives
- **State Management**: TanStack Query v5 & Zustand 5
- **Form Handling & Validation**: React Hook Form & Zod

### Testing & Infrastructure
- **Backend Tests**: Jest 29 & Supertest (17 Suites, 126 Tests)
- **Frontend Tests**: Vitest 4 & React Testing Library (13 Tests)
- **E2E Automation**: Playwright 1.51 (Chromium Smoke Suite)
- **Containers**: Docker & Docker Compose (`medcore_api`, `medcore_postgres`, `medcore_redis`)

---

## 📁 Repository Architecture

```text
MedCore HMS Monorepo/
├── apps/
│   ├── api/                  # NestJS 10 REST & WebSocket API
│   │   ├── prisma/           # Schema, migrations, and seed scripts
│   │   ├── src/              # Modules (auth, appointments, emr, lab, pharmacy, billing)
│   │   └── test/             # 17 Jest integration test suites
│   └── web/                  # Next.js 15 App Router Frontend
│       ├── app/              # App Router layouts, pages, and providers
│       ├── src/              # Views, Zustand stores, and Shadcn primitives
│       ├── test/             # Vitest form validation schema unit tests
│       └── e2e/              # Playwright Chromium E2E smoke tests
├── packages/
│   └── types/                # Shared domain DTOs, Enums, and TypeScript contracts
├── docs/                     # PRD compliance, traceability, and ER diagrams
├── docker-compose.yml        # Docker evaluator infrastructure
├── package.json              # Workspace scripts
└── README.md
```

---

## 🏁 Quick Start & Evaluator Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker Desktop**: Recommended for PostgreSQL 16 & Redis 7

---

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/Aadarsh2021/Medic.git
cd Medic
npm install
```

---

### Step 2: Start Infrastructure Containers
```bash
docker compose up -d postgres redis
```
*Starts PostgreSQL 16 on port `5432` and Redis 7 on port `6379`.*

---

### Step 3: Run Database Migrations & Seed Data
```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
npx ts-node prisma/seed.ts
cd ../..
```

---

### Step 4: Launch Applications
```bash
# Start NestJS API (Port 5555)
npm run start:api

# In a second terminal, start Next.js Frontend (Port 3000)
npm run start:web
```

- **Next.js Web App**: `http://localhost:3000`
- **NestJS REST API**: `http://localhost:5555`
- **Swagger API Docs**: `http://localhost:5555/api/docs`

---

## 🔑 Evaluator Demo Accounts

All accounts use password: `Password123!`

| Role | Demo Email | Primary Scope |
| :--- | :--- | :--- |
| **Super Admin** | `superadmin@medcore.org` | Global hospital onboarding & analytics |
| **Hospital Admin** | `admin@medcore-city.org` | Staff & department management |
| **Doctor** | `dr.sharma@medcore.org` | Clinical EMR, prescriptions, lab orders |
| **Nurse** | `nurse@medcore-city.org` | Patient vitals & OPD scheduling |
| **Receptionist** | `reception@medcore-city.org` | Patient registration & appointment booking |
| **Lab Technician** | `labtech@medcore-city.org` | Sample collection & result entry |
| **Pharmacist** | `pharmacist@medcore-city.org` | Inventory formulary & FIFO dispensing |
| **Accountant** | `accountant@medcore-city.org` | Invoices, ledger, & payment status |
| **Patient** | `patient1@example.com` | Personal health timeline & reports |

---

## 🧪 Verified Test Suite & Coverage Baseline

### 1. Backend Integration Tests (Jest)
```bash
npm run test:api -- --forceExit --detectOpenHandles --runInBand
```
- **Result**: **17/17 test suites passed, 126/126 tests passed**.
- **Backend Line Coverage**: **72.15%** (Exceeds PRD mandatory target of >70%).

### 2. Frontend Validation Tests (Vitest)
```bash
npm --prefix apps/web run test
```
- **Result**: **1/1 file passed, 13/13 schema unit tests passed**.

### 3. Playwright E2E Smoke Workflows
```bash
# Start Next.js dev server on port 3000 first, then run:
npx --prefix apps/web playwright test
```
- **Result**: **3/3 Playwright smoke workflows passed on Chromium**.

### 4. Monorepo Production Build
```bash
npm run build
```
- **Result**: **PASS** (Compiles `@medcore/types`, `apps/api`, and `apps/web` with 0 errors).

---

## 📚 API Documentation & Open API Specification

NestJS Swagger OpenAPI documentation is configured and accessible live at:
`http://localhost:5555/api/docs`

---

## 🔐 Security & Governance Notes

- **Multi-Tenancy**: Application-layer tenant scoping via `req.user.hospitalId`.
- **Password Security**: Bcrypt cost factor 12.
- **Session Management**: JWT access tokens and Redis 7 refresh token rotation.
- **OTP Verification**: Redis 6-digit email/SMS OTP with immediate single-use deletion.
- **Payment Verification**: Server-authoritative invoice totals and HMAC webhook signature checks.
- **HIPAA-Aware Design**: Enforces role access boundaries, audit logging (`AuditService`), and tenant data isolation.

---

## 📄 PRD Traceability & Documentation

- **Original PRD**: [`docs/PRD.docx`](file:///c:/Users/thaku/OneDrive/Desktop/Intermo/Project%202/docs/PRD.docx)
- **PRD Traceability Matrix**: [`docs/PRD_TRACEABILITY.md`](file:///c:/Users/thaku/OneDrive/Desktop/Intermo/Project%202/docs/PRD_TRACEABILITY.md)
- **PRD Compliance Audit Report**: [`docs/PRD_COMPLIANCE_AUDIT.md`](file:///c:/Users/thaku/OneDrive/Desktop/Intermo/Project%202/docs/PRD_COMPLIANCE_AUDIT.md)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
