export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  RECEPTIONIST = 'RECEPTIONIST',
  LAB_TECHNICIAN = 'LAB_TECHNICIAN',
  PHARMACIST = 'PHARMACIST',
  ACCOUNTANT = 'ACCOUNTANT',
  PATIENT = 'PATIENT',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentType {
  REGULAR = 'REGULAR',
  EMERGENCY = 'EMERGENCY',
}

export enum LabOrderStatus {
  ORDERED = 'ORDERED',
  SAMPLE_COLLECTED = 'SAMPLE_COLLECTED',
  RESULT_UPLOADED = 'RESULT_UPLOADED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  FINAL = 'FINAL',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export interface UserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  hospitalId?: string | null;
  hospitalName?: string;
}

export interface AppointmentSlotDTO {
  slotTime: string;
  isAvailable: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
