import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting MedCore HMS database seeding for NestJS API...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Create Address
  const addressCity = await prisma.address.create({
    data: {
      street: '100 Health Avenue, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      country: 'India',
    },
  });

  const addressApex = await prisma.address.create({
    data: {
      street: '45 Care Boulevard, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560034',
      country: 'India',
    },
  });

  // 2. Create Hospitals (Tenants)
  const hospCity = await prisma.hospital.upsert({
    where: { code: 'MED-CITY' },
    update: {},
    create: {
      name: 'MedCore City Hospital',
      code: 'MED-CITY',
      address: '100 Health Avenue, Bandra West, Mumbai',
      phone: '+91 22 2640 9999',
      email: 'contact@medcore-city.org',
      status: 'VERIFIED',
      addressId: addressCity.id,
    },
  });

  const hospApex = await prisma.hospital.upsert({
    where: { code: 'APEX-HEALTH' },
    update: {},
    create: {
      name: 'Apex Healthcare Centre',
      code: 'APEX-HEALTH',
      address: '45 Care Boulevard, Koramangala, Bengaluru',
      phone: '+91 80 4112 8888',
      email: 'info@apexhealth.org',
      status: 'VERIFIED',
      addressId: addressApex.id,
    },
  });

  // 3. Create Super Admin User
  await prisma.user.upsert({
    where: { email: 'superadmin@medcore.org' },
    update: {},
    create: {
      email: 'superadmin@medcore.org',
      passwordHash,
      firstName: 'System',
      lastName: 'SuperAdmin',
      phone: '+91 98000 00000',
      role: 'SUPER_ADMIN',
      hospitalId: null,
      isVerified: true,
    },
  });

  // 4. Create Staff Users for MedCore City
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@medcore-city.org' },
    update: {},
    create: {
      email: 'admin@medcore-city.org',
      passwordHash,
      firstName: 'Rajesh',
      lastName: 'Mehta',
      phone: '+91 98200 11111',
      role: 'HOSPITAL_ADMIN',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  const nurseUser = await prisma.user.upsert({
    where: { email: 'nurse@medcore-city.org' },
    update: {},
    create: {
      email: 'nurse@medcore-city.org',
      passwordHash,
      firstName: 'Priya',
      lastName: 'Nair',
      phone: '+91 98200 22222',
      role: 'NURSE',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  const receptionistUser = await prisma.user.upsert({
    where: { email: 'reception@medcore-city.org' },
    update: {},
    create: {
      email: 'reception@medcore-city.org',
      passwordHash,
      firstName: 'Sunita',
      lastName: 'Rao',
      phone: '+91 98200 33333',
      role: 'RECEPTIONIST',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  const labTechUser = await prisma.user.upsert({
    where: { email: 'labtech@medcore-city.org' },
    update: {},
    create: {
      email: 'labtech@medcore-city.org',
      passwordHash,
      firstName: 'Vikram',
      lastName: 'Deshmukh',
      phone: '+91 98200 44444',
      role: 'LAB_TECHNICIAN',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  const pharmacistUser = await prisma.user.upsert({
    where: { email: 'pharmacist@medcore-city.org' },
    update: {},
    create: {
      email: 'pharmacist@medcore-city.org',
      passwordHash,
      firstName: 'Anil',
      lastName: 'Kapoor',
      phone: '+91 98200 55555',
      role: 'PHARMACIST',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  const accountantUser = await prisma.user.upsert({
    where: { email: 'accountant@medcore-city.org' },
    update: {},
    create: {
      email: 'accountant@medcore-city.org',
      passwordHash,
      firstName: 'Ramesh',
      lastName: 'Shah',
      phone: '+91 98200 66666',
      role: 'ACCOUNTANT',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  // 5. Create Departments for MedCore City
  const deptCardio = await prisma.department.create({
    data: { name: 'Cardiology', code: 'CARD', hospitalId: hospCity.id },
  });
  const deptNeuro = await prisma.department.create({
    data: { name: 'Neurology', code: 'NEUR', hospitalId: hospCity.id },
  });
  const deptOrtho = await prisma.department.create({
    data: { name: 'Orthopedics', code: 'ORTH', hospitalId: hospCity.id },
  });
  const deptPedia = await prisma.department.create({
    data: { name: 'Pediatrics', code: 'PED', hospitalId: hospCity.id },
  });

  // 6. Create Doctor Users & Profiles
  const docUser1 = await prisma.user.upsert({
    where: { email: 'dr.sharma@medcore.org' },
    update: {},
    create: {
      email: 'dr.sharma@medcore.org',
      passwordHash,
      firstName: 'Arjun',
      lastName: 'Sharma',
      phone: '+91 98111 22222',
      role: 'DOCTOR',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  const docProfile1 = await prisma.doctor.upsert({
    where: { userId: docUser1.id },
    update: {},
    create: {
      userId: docUser1.id,
      specialisation: 'Cardiology',
      qualification: 'MBBS, MD (Cardiology), FACC',
      licenseNumber: 'MCI-2012-88741',
      consultationFee: 750.00,
      departmentId: deptCardio.id,
      weeklySchedule: 'Mon-Fri: 09:00-17:00',
      digitalSignature: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><text x="10" y="25" font-family="cursive">Dr. A. Sharma</text></svg>',
    },
  });

  const docUser2 = await prisma.user.upsert({
    where: { email: 'dr.verma@medcore.org' },
    update: {},
    create: {
      email: 'dr.verma@medcore.org',
      passwordHash,
      firstName: 'Kavita',
      lastName: 'Verma',
      phone: '+91 98111 33333',
      role: 'DOCTOR',
      hospitalId: hospCity.id,
      isVerified: true,
    },
  });

  await prisma.doctor.upsert({
    where: { userId: docUser2.id },
    update: {},
    create: {
      userId: docUser2.id,
      specialisation: 'Neurology',
      qualification: 'MBBS, DM (Neurology)',
      licenseNumber: 'MCI-2015-44120',
      consultationFee: 900.00,
      departmentId: deptNeuro.id,
      weeklySchedule: 'Mon-Thu: 10:00-16:00',
      digitalSignature: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><text x="10" y="25" font-family="cursive">Dr. K. Verma</text></svg>',
    },
  });

  // Additional 6 Doctors to reach 8 doctors total
  const additionalDoctors = [
    { email: 'dr.gupta@medcore.org', firstName: 'Suresh', lastName: 'Gupta', spec: 'Orthopedics', qual: 'MS (Ortho)', lic: 'MCI-2010-9901', deptId: deptOrtho.id, fee: 650.00 },
    { email: 'dr.patel@medcore.org', firstName: 'Neha', lastName: 'Patel', spec: 'Pediatrics', qual: 'MD (Pedia)', lic: 'MCI-2016-1234', deptId: deptPedia.id, fee: 500.00 },
    { email: 'dr.iyer@medcore.org', firstName: 'Raman', lastName: 'Iyer', spec: 'Cardiology', qual: 'DM (Cardio)', lic: 'MCI-2008-5678', deptId: deptCardio.id, fee: 850.00 },
    { email: 'dr.joshi@medcore.org', firstName: 'Meera', lastName: 'Joshi', spec: 'General Medicine', qual: 'MD (Gen Med)', lic: 'MCI-2014-9101', deptId: deptCardio.id, fee: 600.00 },
    { email: 'dr.singh@medcore.org', firstName: 'Harpreet', lastName: 'Singh', spec: 'Neurology', qual: 'MCh (Neurosurgery)', lic: 'MCI-2011-1121', deptId: deptNeuro.id, fee: 1200.00 },
    { email: 'dr.reddy@medcore.org', firstName: 'Anusha', lastName: 'Reddy', spec: 'Orthopedics', qual: 'DNB (Ortho)', lic: 'MCI-2017-3141', deptId: deptOrtho.id, fee: 700.00 },
  ];

  for (const d of additionalDoctors) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        passwordHash,
        firstName: d.firstName,
        lastName: d.lastName,
        phone: '+91 98111 99999',
        role: 'DOCTOR',
        hospitalId: hospCity.id,
        isVerified: true,
      },
    });

    await prisma.doctor.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        specialisation: d.spec,
        qualification: d.qual,
        licenseNumber: d.lic,
        consultationFee: d.fee,
        departmentId: d.deptId,
      },
    });
  }

  // 7. Create 30 Patients
  let patient1Profile: any = null;
  for (let i = 1; i <= 30; i++) {
    const email = `patient${i}@example.com`;
    const mrn = `MRN-2026-${1000 + i}`;

    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        firstName: `PatientFirstName${i}`,
        lastName: `PatientLastName${i}`,
        phone: `+91 99000 ${String(10000 + i).slice(-5)}`,
        role: 'PATIENT',
        hospitalId: hospCity.id,
        isVerified: true,
      },
    });

    const p = await prisma.patient.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        hospitalId: hospCity.id,
        mrn,
        bloodGroup: i % 4 === 0 ? 'O+' : i % 3 === 0 ? 'A+' : i % 2 === 0 ? 'B+' : 'AB+',
        dob: '1985-05-15',
        gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
        emergencyContact: '+91 98989 89898',
        medicalHistory: 'No major surgeries. Known mild asthma.',
      },
    });

    if (i === 1) patient1Profile = p;
  }

  // 8. Create Medicines & Batches
  const medAmox = await prisma.medicine.create({
    data: {
      hospitalId: hospCity.id,
      name: 'Amoxicillin 500mg',
      category: 'Antibiotic',
      form: 'Capsule',
      reorderLevel: 25,
      unitCost: 12.00,
      mrp: 18.50,
      batches: {
        create: [
          { batchNumber: 'AMX-2024-A', mfgDate: '2024-01-10', expiryDate: '2026-12-31', quantity: 150, unitCost: 12.00, mrp: 18.50 },
          { batchNumber: 'AMX-2023-EXP', mfgDate: '2023-01-10', expiryDate: '2025-01-01', quantity: 50, unitCost: 10.00, mrp: 15.00 }, // Expired
        ],
      },
    },
  });

  await prisma.medicine.create({
    data: {
      hospitalId: hospCity.id,
      name: 'Paracetamol 650mg',
      category: 'Analgesic',
      form: 'Tablet',
      reorderLevel: 50,
      unitCost: 2.50,
      mrp: 5.00,
      batches: {
        create: [
          { batchNumber: 'PCM-2024-X', mfgDate: '2024-02-01', expiryDate: '2027-02-01', quantity: 500, unitCost: 2.50, mrp: 5.00 },
        ],
      },
    },
  });

  await prisma.medicine.create({
    data: {
      hospitalId: hospCity.id,
      name: 'Atorvastatin 10mg',
      category: 'Cardia',
      form: 'Tablet',
      reorderLevel: 30,
      unitCost: 8.00,
      mrp: 14.00,
      batches: {
        create: [
          { batchNumber: 'ATV-2025-C', mfgDate: '2024-03-15', expiryDate: '2026-09-30', quantity: 10, unitCost: 8.00, mrp: 14.00 }, // Low stock
        ],
      },
    },
  });

  // Clear previous sample transactional data for idempotent seeding
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.labResult.deleteMany({});
  await prisma.labOrder.deleteMany({});
  await prisma.prescriptionItem.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.medicalRecord.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.room.deleteMany({});

  // 9. Create Inpatient Room
  await prisma.room.create({
    data: {
      hospitalId: hospCity.id,
      roomNumber: '101-A',
      bedNumber: 'BED-1',
      roomType: 'PRIVATE',
      status: 'AVAILABLE',
      dailyRate: 3500.00,
    },
  });

  // 10. Create Appointment, EMR, Prescription, Lab Order, and Invoice
  const appt = await prisma.appointment.create({
    data: {
      hospitalId: hospCity.id,
      patientId: patient1Profile.id,
      doctorId: docProfile1.id,
      departmentId: deptCardio.id,
      appointmentDate: '2026-08-10',
      slotTime: '10:30',
      status: 'COMPLETED',
      type: 'REGULAR',
      reason: 'Routine chest tightness and fatigue checkup',
    },
  });

  const emr = await prisma.medicalRecord.create({
    data: {
      appointmentId: appt.id,
      patientId: patient1Profile.id,
      doctorId: docProfile1.id,
      hospitalId: hospCity.id,
      vitals: JSON.stringify({ bp: '120/80', pulse: 72, temp: '98.6F', tempUnit: 'F', spO2: 99, height: 175, weight: 70, bmi: 22.9 }),
      chiefComplaint: 'Chest tightness after mild exertion for 3 days',
      diagnosis: 'I20.9 - Angina pectoris, unspecified / Mild hypertension',
      treatmentPlan: 'Prescribed anti-hypertensive medication. Ordered Lipid Profile and ECG.',
      allergies: 'Penicillin (mild rash)',
      vaccinations: 'COVID-19 (3 doses), Hepatitis B',
      familyHistory: 'Father had CAD at age 55.',
    },
  });

  await prisma.prescription.create({
    data: {
      medicalRecordId: emr.id,
      doctorId: docProfile1.id,
      patientId: patient1Profile.id,
      hospitalId: hospCity.id,
      notes: 'Take medicines after meals.',
      doctorSignature: docProfile1.digitalSignature,
      items: {
        create: [
          { medicineId: medAmox.id, form: 'Capsule', dosage: '500mg', frequency: 'BD (Twice daily)', durationDays: 5, instructions: 'After breakfast and dinner' },
        ],
      },
    },
  });

  await prisma.labOrder.create({
    data: {
      medicalRecordId: emr.id,
      patientId: patient1Profile.id,
      doctorId: docProfile1.id,
      hospitalId: hospCity.id,
      testName: 'Lipid Profile & Serum Cholesterol',
      category: 'Biochemistry',
      status: 'APPROVED',
      sampleCollectedAt: new Date(),
      approvedBy: 'Dr. Arjun Sharma',
      results: {
        create: [
          { refRangeMin: 130, refRangeMax: 200, unit: 'mg/dL', resultValue: 245, isOutOfRange: true, technicianNotes: 'Elevated total cholesterol' },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      hospitalId: hospCity.id,
      patientId: patient1Profile.id,
      appointmentId: appt.id,
      invoiceNumber: 'INV-2026-000001',
      subtotal: 1250.00,
      tax: 62.50,
      discount: 50.00,
      total: 1262.50,
      status: 'PAID',
      paymentMethod: 'STRIPE',
      paymentId: 'ch_3M0000000000000',
      paidAt: new Date(),
      items: {
        create: [
          { department: 'Consultation', description: 'Cardiology Specialist Fee', quantity: 1, unitPrice: 750.00, totalAmount: 750.00 },
          { department: 'Laboratory', description: 'Lipid Profile Test', quantity: 1, unitPrice: 500.00, totalAmount: 500.00 },
        ],
      },
    },
  });

  console.log('✅ MedCore HMS database seeded successfully for NestJS API!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
