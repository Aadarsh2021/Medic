# MedCore HMS Entity Relationship (ER) Diagram

```mermaid
erDiagram
    Hospital ||--o{ User : "hosts"
    Hospital ||--o{ Department : "contains"
    Hospital ||--o{ Room : "manages"
    Hospital ||--o{ Patient : "registers"
    Hospital ||--o{ Medicine : "inventories"

    User ||--o| Doctor : "has profile"
    User ||--o| Patient : "has profile"

    Department ||--o{ Doctor : "employs"
    Department ||--o{ Appointment : "schedules"

    Doctor ||--o{ Appointment : "conducts"
    Doctor ||--o{ MedicalRecord : "creates"
    Doctor ||--o{ Prescription : "authorizes"
    Doctor ||--o{ LabOrder : "requests"

    Patient ||--o{ Appointment : "attends"
    Patient ||--o{ MedicalRecord : "owns"
    Patient ||--o{ Invoice : "billed"

    Appointment ||--o| MedicalRecord : "generates"
    Appointment ||--o| Invoice : "billed for"

    MedicalRecord ||--o{ Prescription : "includes"
    MedicalRecord ||--o{ LabOrder : "triggers"

    Prescription ||--o{ PrescriptionItem : "contains"
    Medicine ||--o{ PrescriptionItem : "dispensed in"
    Medicine ||--o{ MedicineBatch : "stocked in"

    LabOrder ||--o{ LabResult : "produces"

    Invoice ||--o{ InvoiceItem : "aggregates"
```

## Core Models Normalization
- **3NF Normalization**: Clean separation between generic `User` authentication records and role-specific `Doctor` / `Patient` extension models.
- **Audit Logs & Soft Deletes**: Medical records are append-only. Patients and doctors feature soft delete capability (`deletedAt`).
