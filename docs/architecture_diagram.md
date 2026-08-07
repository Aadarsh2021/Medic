# MedCore HMS System Architecture Diagram

```mermaid
graph TD
    Client["Browser Client<br/>(Next.js 15 App Router + React 19)"]
    Nginx["Nginx / Port Forwarding<br/>(Port 3000 / 5555)"]
    API["NestJS API Server<br/>(Port 5555)"]
    SocketIO["Socket.IO Server<br/>(Real-Time Notification Gateway)"]
    AuthGuard["JWT + RBAC Guards<br/>(9 System Roles + Tenancy Guard)"]
    Prisma["Prisma ORM Layer"]
    DB[("PostgreSQL 16 Database<br/>(Multi-Tenant Isolation)")]
    Redis[("Redis 7 Cache & Store<br/>(Session Tokens, BullMQ & Rate Limits)")]
    Services["Third-Party Provider Adapters<br/>(Stripe/Razorpay, Resend Email, Twilio SMS)"]

    Client <-->|HTTPS REST + WebSockets| Nginx
    Nginx <--> API
    API <--> SocketIO
    API --> AuthGuard
    AuthGuard --> Prisma
    Prisma <--> DB
    API <--> Redis
    API <--> Services
```

## Architectural Highlights
1. **Multi-Tenancy Strategy**: Row-Level Multi-Tenancy where every database table containing tenant-scoped data carries a mandatory `hospitalId` foreign key. NestJS `TenancyGuard` validates all incoming request parameters against the caller's JWT token scope.
2. **Role-Based Access Control (RBAC)**: Fine-grained permissions matrix across 9 distinct roles (`SUPER_ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `LAB_TECHNICIAN`, `PHARMACIST`, `ACCOUNTANT`, `PATIENT`).
3. **Concurrency-Safe Scheduling Engine**: Database transaction locking on slot allocation to guarantee that no doctor or patient is double-booked simultaneously (`Appointment_doctor_slot_unique_idx`).
4. **FIFO Pharmacy Inventory**: Automated First-In First-Out batch allocation that quarantines and blocks expired medicine stock from being dispensed.
5. **Real-Time Notification Gateway**: Socket.IO bi-directional WebSocket event bus delivering instant in-app alerts for lab result approvals, emergency bookings, and payment status receipts.
