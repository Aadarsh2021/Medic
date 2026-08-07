import {
  Role as SharedRole,
  AppointmentStatus as SharedAppointmentStatus,
  AppointmentType as SharedAppointmentType,
  LabOrderStatus as SharedLabOrderStatus,
  InvoiceStatus as SharedInvoiceStatus,
  ApiResponse as SharedApiResponse,
  UserDTO,
  AppointmentSlotDTO,
} from '@medcore/types';

export type Role =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'PHARMACIST'
  | 'ACCOUNTANT'
  | 'PATIENT';

export type {
  SharedRole,
  SharedAppointmentStatus,
  SharedAppointmentType,
  SharedLabOrderStatus,
  SharedInvoiceStatus,
  SharedApiResponse,
  UserDTO,
  AppointmentSlotDTO,
};

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  hospitalId?: string | null;
  hospitalName?: string;
  doctorProfile?: Doctor;
  patientProfile?: Patient;
}

export interface Hospital {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  status: string;
}

export interface Doctor {
  id: string;
  userId: string;
  specialisation: string;
  qualification: string;
  licenseNumber: string;
  consultationFee: number;
  departmentId?: string;
  weeklySchedule: string;
  digitalSignature?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  department?: {
    name: string;
  };
}

export interface Patient {
  id: string;
  userId: string;
  mrn: string;
  bloodGroup?: string;
  dob: string;
  gender: string;
  emergencyContact: string;
  medicalHistory?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  slotTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  type: 'REGULAR' | 'EMERGENCY';
  reason?: string;
  patient?: Patient;
  doctor?: Doctor;
  department?: { name: string };
  medicalRecord?: MedicalRecord;
}

export interface MedicalRecord {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  vitals: string;
  chiefComplaint: string;
  diagnosis: string;
  treatmentPlan: string;
  allergies?: string;
  vaccinations?: string;
  familyHistory?: string;
  createdAt: string;
  patient?: Patient;
  doctor?: Doctor;
  prescriptions?: Prescription[];
  labOrders?: LabOrder[];
}

export interface PrescriptionItem {
  id: string;
  medicineId: string;
  form: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  medicine: {
    name: string;
  };
}

export interface Prescription {
  id: string;
  medicalRecordId: string;
  doctorId: string;
  patientId: string;
  notes?: string;
  doctorSignature?: string;
  createdAt: string;
  items: PrescriptionItem[];
  doctor?: Doctor;
  patient?: Patient;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  refRangeMin: number;
  refRangeMax: number;
  unit: string;
  resultValue: number;
  isOutOfRange: boolean;
  technicianNotes?: string;
  reportUrl?: string;
}

export interface LabOrder {
  id: string;
  medicalRecordId: string;
  patientId: string;
  doctorId: string;
  testName: string;
  category: string;
  status: 'ORDERED' | 'SAMPLE_COLLECTED' | 'RESULT_UPLOADED' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: string;
  patient?: Patient;
  doctor?: Doctor;
  results?: LabResult[];
}

export interface MedicineBatch {
  id: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  mrp: number;
  isQuarantined: boolean;
}

export interface Medicine {
  id: string;
  hospitalId: string;
  name: string;
  category: string;
  form: string;
  reorderLevel: number;
  unitCost: number;
  mrp: number;
  totalStock?: number;
  isLowStock?: boolean;
  batches?: MedicineBatch[];
}

export interface InvoiceItem {
  id: string;
  department: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface Invoice {
  id: string;
  hospitalId: string;
  patientId: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'DRAFT' | 'FINAL' | 'PAID' | 'CANCELLED';
  paymentMethod?: string;
  paymentId?: string;
  paidAt?: string;
  createdAt: string;
  patient?: Patient;
  items: InvoiceItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
}
