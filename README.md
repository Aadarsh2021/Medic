# 🏥 MedCore HMS — Enterprise Multi-Tenant Hospital Management System

[![NestJS](https://img.shields.io/badge/NestJS-10.4.22-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.81.3-FF4400)](https://docs.bullmq.io/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-23.11.1-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

MedCore HMS is a state-of-the-art, enterprise-grade, multi-tenant Hospital Management System built with NestJS, PostgreSQL 16, Prisma ORM, Redis 7, BullMQ, Puppeteer, and React. It provides complete clinical, administrative, financial, and operational automation for modern hospitals and multi-center healthcare networks.

---

## 🚀 Key Features & Capabilities

### 🛡️ Multi-Tenancy & Tenant Security
- **Strict Data Isolation**: Enforced application-wide tenant isolation (`hospitalId` token verification) across PostgreSQL, Redis state, and storage adapters.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions across 9 system roles (`SUPER_ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `LAB_TECHNICIAN`, `PHARMACIST`, `ACCOUNTANT`, `PATIENT`).

### 🔐 Authentication & Session Security
- **JWT Refresh Rotation**: Redis 7 session tracking with short-lived access tokens, refresh token rotation, and reuse attack auto-revocation.
- **Brute-Force & Rate Limiting**: Redis-backed rate limiting on authentication routes with multi-attempt lockout.
- **WebSocket Gateway Security**: Authenticated Socket.IO connections with room-level tenant isolation (`hospital_{hospitalId}`).

### 📋 Clinical & Patient Workflows
- **Electronic Medical Records (EMR)**: Comprehensive medical record entry including vitals, chief complaints, ICD-10 diagnoses, and treatment plans.
- **Appointment Scheduling**: Real-time slot management backed by PostgreSQL partial unique indexes (`Appointment_doctor_slot_unique_idx`) preventing double-booking and race conditions under concurrent bookings.
- **Pharmacy & Inventory**: Medicine catalog management, multi-batch tracking, expiry monitoring, and auto-quarantine.
- **Laboratory Workflow**: Lab test ordering, sample collection tracking, reference range validation, and out-of-range flag detection.
- **Inpatient Room Management**: Bed allocation, daily rate tracking, and availability states.

### ⚙️ Background Processing & Asynchronous Jobs (BullMQ 5 + Redis 7)
- **Appointment Reminders**: Automated 24-hour and 1-hour email/SMS reminder queues with cancellation protection and idempotency keys.
- **Medicine Expiry Monitor**: Daily recurring worker scanning inventory batches and flagging expiring medicines.
- **Notification Queue**: Multi-channel notification delivery (In-App, Email, SMS).
- **PDF Generation Processor**: Asynchronous PDF rendering queue using real Headless Chromium/Puppeteer instances.

### 📄 Document Engine & Secure File Uploads
- **Puppeteer PDF Rendering**: High-performance server-side rendering for **Prescriptions** and **Invoices** featuring custom CSS styling, dynamic barcode/signature rendering, and HTML injection escaping (`XSS` safe).
- **Secure File Storage**: Storage abstraction supporting `LocalStorageAdapter` and `S3StorageAdapter`.
- **Upload Security**: File magic-byte signature validation, Sharp image decoding/re-encoding (stripping EXIF metadata), path traversal filename sanitization, and category size limits.

---

## 📁 Repository Architecture

This project is organized as a clean, efficient TypeScript Monorepo:

```text
.
├── apps/
│   ├── api/                  # NestJS 10 REST & WebSocket API Backend
│   │   ├── prisma/           # Schema definitions, seed scripts, & migration SQLs
│   │   ├── src/              # Application modules, guards, processors, & services
│   │   └── test/             # Complete E2E integration test suites (15 suites)
│   └── web/                  # Modern React 18 + Vite Healthcare Dashboard UI
├── packages/
│   └── types/                # Shared TypeScript DTOs, Enums, & Contract Interfaces
├── docker-compose.yml        # Multi-container setup (API, Web, PostgreSQL 16, Redis 7)
├── package.json              # Monorepo workspace configuration & package scripts
└── README.md
```

---

## 🛠️ Tech Stack & Infrastructure

- **Backend Framework**: NestJS 10 (Node.js 20 LTS runtime)
- **Database & ORM**: PostgreSQL 16 with Prisma ORM 5.22
- **Caching & Session Store**: Redis 7 & `ioredis`
- **Background Jobs**: BullMQ 5
- **Document Engine**: Puppeteer 23 (Headless Chromium) & Sharp 0.33
- **Frontend Framework**: React 18, Vite 5, TailwindCSS, Framer Motion, Lucide Icons
- **Language & Tooling**: TypeScript 5.9, Jest 29, Supertest

---

## 🏁 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL**: `v16.x` (Running on port `5432`)
- **Redis**: `v7.x` (Running on port `6379`)

---

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Aadarsh2021/Medic.git
   cd Medic
   ```

2. **Install Workspace Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `apps/api/.env`:
   ```env
   PORT=5555
   DATABASE_URL="postgresql://medcore_admin:medcore_password_2026@127.0.0.1:5432/medcore_hms?schema=public"
   REDIS_HOST="127.0.0.1"
   REDIS_PORT=6379
   JWT_SECRET="medcore_jwt_super_secret_key_2026_change_in_production"
   JWT_REFRESH_SECRET="medcore_jwt_refresh_secret_key_2026_change_in_production"
   CORS_ORIGIN="http://localhost:5173"
   ```

4. **Apply Database Migrations & Seed Fixtures**:
   ```bash
   cd apps/api
   npx prisma migrate deploy
   npx prisma generate
   npx ts-node prisma/seed.ts
   cd ../..
   ```

---

## 💻 Running the Application

### Development Mode
To start both the API backend and Frontend dashboard concurrently:
```bash
npm run dev
```
- **Backend API**: `http://localhost:5555`
- **Frontend Dashboard**: `http://localhost:5173`
- **Swagger Open API Docs**: `http://localhost:5555/api/docs`

### Individual Workspace Launch
```bash
# Run API Backend only
npm --prefix apps/api run start:dev

# Run Web Frontend only
npm --prefix apps/web run dev
```

---

## 🏗️ Production Build

To verify and build all workspace packages (`@medcore/types`, `apps/api`, `apps/web`):
```bash
npm run build
```

---

## 🧪 Testing & Quality Assurance

MedCore HMS includes an extensive, zero-flakiness E2E test suite covering security, concurrency, state machines, job queues, upload safety, and PDF generation:

```bash
npm run test:api -- --forceExit --detectOpenHandles --runInBand
```

### Verified Baseline Results
```text
PASS test/storage-pdf.test.ts (13.315 s)
PASS test/websocket-security.test.ts
PASS test/rbac.test.ts
PASS test/lab-workflow.test.ts
PASS test/auth.test.ts
PASS test/appointment-state-machine.test.ts
PASS test/emr.test.ts
PASS test/concurrency.test.ts
PASS test/billing.test.ts
PASS test/patient-isolation.test.ts
PASS test/redis-infrastructure.test.ts
PASS test/tenancy.test.ts
PASS test/pharmacy.test.ts
PASS test/direct_index.test.ts
PASS test/bullmq-jobs.test.ts

Test Suites: 15 passed, 15 total
Tests:       111 passed, 111 total
Snapshots:   0 total
Time:        54.493 s
```

---

## 🐳 Docker Deployment

To launch the full system inside containerized environments:
```bash
docker-compose up --build -d
```

---

## 📄 License

This repository is distributed under the MIT License. See `LICENSE` for details.
