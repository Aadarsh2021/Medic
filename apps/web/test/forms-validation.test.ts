import { describe, test, expect } from 'vitest';
import { z } from 'zod';

const appointmentSchema = z.object({
  doctorId: z.string().min(1, 'Please select a specialist physician'),
  patientId: z.string().optional(),
  appointmentDate: z.string().min(1, 'Please select a valid consultation date'),
  slotTime: z.string().optional(),
  type: z.enum(['REGULAR', 'EMERGENCY']),
  reason: z.string().optional(),
});

const emrSchema = z.object({
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  treatmentPlan: z.string().min(1, 'Treatment plan is required'),
  allergies: z.string().optional(),
  vaccinations: z.string().optional(),
  familyHistory: z.string().optional(),
  bp: z.string().min(1, 'Blood pressure is required'),
  pulse: z.number({ invalid_type_error: 'Pulse must be a number' }).min(30, 'Pulse min 30').max(220, 'Pulse max 220'),
  temp: z.number({ invalid_type_error: 'Temp must be a number' }).min(90, 'Temp min 90').max(110, 'Temp max 110'),
  spo2: z.number({ invalid_type_error: 'SpO2 must be a number' }).min(50, 'SpO2 min 50').max(100, 'SpO2 max 100'),
  height: z.number({ invalid_type_error: 'Height must be a number' }).min(30, 'Height min 30').max(250, 'Height max 250'),
  weight: z.number({ invalid_type_error: 'Weight must be a number' }).min(1, 'Weight min 1').max(300, 'Weight max 300'),
});

const labResultSchema = z
  .object({
    resultValue: z.number({ invalid_type_error: 'Result value must be a number' }),
    refRangeMin: z.number({ invalid_type_error: 'Min range must be a number' }),
    refRangeMax: z.number({ invalid_type_error: 'Max range must be a number' }),
    unit: z.string().min(1, 'Unit is required (e.g. mg/dL, g/dL)'),
    technicianNotes: z.string().optional(),
  })
  .refine((data) => data.refRangeMax > data.refRangeMin, {
    message: 'Reference maximum must be greater than minimum range',
    path: ['refRangeMax'],
  });

const dispenseSchema = z.object({
  quantityToDispense: z
    .number({ invalid_type_error: 'Dispense quantity must be a positive integer' })
    .int('Quantity must be an integer')
    .min(1, 'Dispense quantity must be at least 1 unit'),
});

describe('MedCore HMS Frontend Form Validation Schemas', () => {
  describe('Appointment Schema Validation', () => {
    test('rejects missing doctorId', () => {
      const res = appointmentSchema.safeParse({ doctorId: '', appointmentDate: '2026-08-10', type: 'REGULAR' });
      expect(res.success).toBe(false);
    });

    test('rejects missing appointmentDate', () => {
      const res = appointmentSchema.safeParse({ doctorId: 'doc-123', appointmentDate: '', type: 'REGULAR' });
      expect(res.success).toBe(false);
    });

    test('accepts valid regular appointment', () => {
      const res = appointmentSchema.safeParse({ doctorId: 'doc-123', appointmentDate: '2026-08-10', slotTime: '10:00', type: 'REGULAR' });
      expect(res.success).toBe(true);
    });

    test('accepts valid emergency triage appointment', () => {
      const res = appointmentSchema.safeParse({ doctorId: 'doc-123', appointmentDate: '2026-08-10', type: 'EMERGENCY', reason: 'Chest Pain' });
      expect(res.success).toBe(true);
    });
  });

  describe('EMR Schema Validation', () => {
    test('rejects invalid pulse below 30 bpm', () => {
      const res = emrSchema.safeParse({ chiefComplaint: 'Fatigue', diagnosis: 'I10', treatmentPlan: 'Diet', bp: '120/80', pulse: 20, temp: 98.6, spo2: 98, height: 170, weight: 70 });
      expect(res.success).toBe(false);
    });

    test('rejects invalid SpO2 below 50%', () => {
      const res = emrSchema.safeParse({ chiefComplaint: 'Fatigue', diagnosis: 'I10', treatmentPlan: 'Diet', bp: '120/80', pulse: 72, temp: 98.6, spo2: 40, height: 170, weight: 70 });
      expect(res.success).toBe(false);
    });

    test('rejects negative weight', () => {
      const res = emrSchema.safeParse({ chiefComplaint: 'Fatigue', diagnosis: 'I10', treatmentPlan: 'Diet', bp: '120/80', pulse: 72, temp: 98.6, spo2: 98, height: 170, weight: -5 });
      expect(res.success).toBe(false);
    });

    test('accepts valid physiological vitals', () => {
      const res = emrSchema.safeParse({ chiefComplaint: 'Chest pain', diagnosis: 'I10 Hypertension', treatmentPlan: 'Telmisartan 40mg', bp: '130/85', pulse: 78, temp: 98.4, spo2: 99, height: 175, weight: 75 });
      expect(res.success).toBe(true);
    });
  });

  describe('Lab Result Schema Validation', () => {
    test('rejects refRangeMax less than refRangeMin', () => {
      const res = labResultSchema.safeParse({ resultValue: 150, refRangeMin: 200, refRangeMax: 100, unit: 'mg/dL' });
      expect(res.success).toBe(false);
    });

    test('accepts valid lab result submission', () => {
      const res = labResultSchema.safeParse({ resultValue: 235, refRangeMin: 120, refRangeMax: 200, unit: 'mg/dL' });
      expect(res.success).toBe(true);
    });
  });

  describe('Pharmacy Dispense Schema Validation', () => {
    test('rejects zero quantity', () => {
      const res = dispenseSchema.safeParse({ quantityToDispense: 0 });
      expect(res.success).toBe(false);
    });

    test('rejects negative quantity', () => {
      const res = dispenseSchema.safeParse({ quantityToDispense: -10 });
      expect(res.success).toBe(false);
    });

    test('accepts positive integer quantity', () => {
      const res = dispenseSchema.safeParse({ quantityToDispense: 5 });
      expect(res.success).toBe(true);
    });
  });
});
