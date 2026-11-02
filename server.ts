import 'dotenv/config';
import path from 'path';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';
import {
  computeMedicalEligibility,
  computeTwelveMonthDonationTrends,
  computeFridgeInventorySummary,
  computeBagExpiryDate,
  computeVaccineScheduleStatus,
  maskDonorPhone,
  validateRapidDonationEntry,
  filterDonorDirectory,
  VALID_BLOOD_GROUPS,
  DEFAULT_COOLDOWN_DAYS,
  Role,
  FridgeBagRecord,
} from './src/utils/medicalRules';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sandhani-rmc-unit-room81-super-secret-jwt-key-2026';
const COOKIE_NAME = 'sandhani_session';

const dbPath = path.resolve(process.cwd(), 'sandhani.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Official high-craft SVG editorial photo illustrations for initial gallery seed
const INITIAL_GALLERY_SVGS = [
  {
    title: 'Annual Voluntary Blood Donation & Grouping Camp — RMCH Courtyard',
    category: 'Blood Drive Camp',
    caption:
      'Medical students screening walk-in voluntary donors for 5 transfusion-transmitted markers at Rajshahi Medical College Hospital.',
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0F172A"/><stop offset="60%" stop-color="#1E293B"/><stop offset="100%" stop-color="#7F1D1D"/></linearGradient></defs><rect width="800" height="500" fill="url(#bg1)"/><rect x="40" y="40" width="720" height="420" rx="16" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/><circle cx="630" cy="150" r="85" fill="rgba(200,16,46,0.22)" stroke="#F87171" stroke-width="1.5"/><path d="M630 105 C630 105 595 148 595 170 A35 35 0 0 0 665 170 C665 148 630 105 630 105 Z" fill="#EF4444"/><path d="M80 340 L210 340 L235 280 L265 385 L295 230 L325 360 L350 315 L385 340 L720 340" fill="none" stroke="#F87171" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><text x="80" y="120" fill="#FDE68A" font-family="sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">RMCH TRANSFUSION PAVILION · RAJSHAHI</text><text x="80" y="162" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="800">Voluntary Whole Blood Screening Desk</text><text x="80" y="198" fill="#CBD5E1" font-family="sans-serif" font-size="16">5-Marker Viral Screening · Cross-Matching · Student Medical Volunteers</text></svg>`)}`,
  },
  {
    title: 'Room 81 Founding Archive — Kazi Nurunnobi Hostel (Est. Jan 3, 1980)',
    category: 'Institutional Heritage',
    caption:
      'Commemorating the historic establishment of Sandhani Rajshahi Medical College Unit on January 3, 1980.',
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1A202C"/><stop offset="100%" stop-color="#31102F"/></linearGradient></defs><rect width="800" height="500" fill="url(#bg2)"/><rect x="40" y="40" width="720" height="420" rx="16" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/><rect x="520" y="95" width="180" height="230" rx="12" fill="rgba(255,255,255,0.05)" stroke="#FBBF24" stroke-width="1.5"/><text x="610" y="195" text-anchor="middle" fill="#FDE68A" font-family="monospace" font-size="40" font-weight="700">1980</text><text x="610" y="230" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="13" font-weight="600">ROOM 81 ARCHIVE</text><text x="80" y="125" fill="#FDE68A" font-family="sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">FOUNDED JANUARY 3, 1980</text><text x="80" y="168" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="800">Shahid Muktijoddha Kazi Nurunnobi Hostel</text><text x="80" y="205" fill="#CBD5E1" font-family="sans-serif" font-size="16">46 Years of Humanitarian Service Across North Bengal</text></svg>`)}`,
  },
  {
    title: 'Thalassemia Ward 24 Paediatric Transfusion Support — RMCH',
    category: 'Clinical Outreach',
    caption:
      'Dedicated recurring blood supply for Beta Thalassemia Major children admitted at Rajshahi Medical College Hospital Ward 24.',
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#064E3B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient></defs><rect width="800" height="500" fill="url(#bg3)"/><rect x="40" y="40" width="720" height="420" rx="16" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/><circle cx="620" cy="180" r="75" fill="rgba(16,185,129,0.18)" stroke="#34D399" stroke-width="1.5"/><path d="M595 180 L645 180 M620 155 L620 205" stroke="#6EE7B7" stroke-width="6" stroke-linecap="round"/><text x="80" y="125" fill="#6EE7B7" font-family="sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">WARD 24 PAEDIATRIC HEMATOLOGY · RMCH</text><text x="80" y="168" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="800">Thalassemia &amp; Maternal Emergency Care</text><text x="80" y="205" fill="#CBD5E1" font-family="sans-serif" font-size="16">Zero-Cost Screened Whole Blood Units for Critical Patients</text></svg>`)}`,
  },
];

function buildMemberAvatarSvg(initials: string, bgHex: string, accentHex: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="40" fill="${bgHex}"/><circle cx="120" cy="92" r="42" fill="${accentHex}" opacity="0.22"/><path d="M52 210 C52 162 188 162 188 210" fill="${accentHex}" opacity="0.22"/><circle cx="120" cy="120" r="106" fill="none" stroke="${accentHex}" stroke-opacity="0.35" stroke-width="2"/><text x="120" y="134" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="52" font-weight="800">${initials}</text></svg>`
  )}`;
}

function buildRequisitionSlipSvg(patient: string, bloodGroup: string, ward: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="600" height="380" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/><rect x="24" y="24" width="552" height="58" rx="10" fill="#991B1B"/><text x="44" y="50" fill="#FDE68A" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1.2">RAJSHAHI MEDICAL COLLEGE HOSPITAL · BLOOD REQUISITION SLIP</text><text x="44" y="70" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="800">SANDHANI TRANSFUSION REQUISITION FORM</text><rect x="450" y="105" width="110" height="90" rx="12" fill="#FEE2E2" stroke="#EF4444" stroke-width="2"/><text x="505" y="160" text-anchor="middle" fill="#B91C1C" font-family="monospace" font-size="38" font-weight="800">${bloodGroup}</text><text x="44" y="130" fill="#475569" font-family="sans-serif" font-size="13" font-weight="700">PATIENT NAME:</text><text x="165" y="130" fill="#0F172A" font-family="sans-serif" font-size="15" font-weight="800">${patient}</text><text x="44" y="165" fill="#475569" font-family="sans-serif" font-size="13" font-weight="700">WARD / BED:</text><text x="165" y="165" fill="#0F172A" font-family="sans-serif" font-size="14" font-weight="600">${ward}</text><text x="44" y="200" fill="#475569" font-family="sans-serif" font-size="13" font-weight="700">CROSS-MATCH:</text><text x="165" y="200" fill="#047857" font-family="sans-serif" font-size="14" font-weight="700">Verified by Duty Medical Officer</text><line x1="44" y1="240" x2="556" y2="240" stroke="#E2E8F0" stroke-width="2"/><rect x="44" y="265" width="210" height="65" rx="8" fill="#ECFDF5" stroke="#10B981" stroke-width="1.5"/><text x="60" y="292" fill="#065F46" font-family="sans-serif" font-size="12" font-weight="800">DUTY REGISTRAR SEAL</text><text x="60" y="312" fill="#047857" font-family="monospace" font-size="11">RMCH Dept. of Transfusion Med</text></svg>`
  )}`;
}

function getConfiguredCooldownDays(): number {
  try {
    const row = db
      .prepare('SELECT value FROM SystemSetting WHERE key = ?')
      .get('cooldown_days') as { value: string } | undefined;
    if (!row) return DEFAULT_COOLDOWN_DAYS;
    const parsed = parseInt(row.value, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_COOLDOWN_DAYS;
  } catch {
    return DEFAULT_COOLDOWN_DAYS;
  }
}

// ============================================================================
// 1. INITIALIZE SQLITE TABLES & MIGRATIONS
// ============================================================================
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'DONOR',
      bloodGroup TEXT NOT NULL,
      dob TEXT,
      gender TEXT,
      unit TEXT,
      lastDonationDate TEXT,
      isAvailable INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Campaign (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      targetBags INTEGER NOT NULL,
      coverImageUrl TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS DonationRecord (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      campaignId TEXT,
      donationDate TEXT NOT NULL,
      bagNumber TEXT,
      volumeMl INTEGER NOT NULL DEFAULT 450,
      weightKg REAL,
      hemoglobin REAL,
      notes TEXT,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY (campaignId) REFERENCES Campaign(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS GalleryPhoto (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      caption TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS EmergencyRequest (
      id TEXT PRIMARY KEY,
      patient TEXT NOT NULL,
      hospital TEXT NOT NULL,
      bloodGroup TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 1,
      urgency TEXT NOT NULL,
      phone TEXT NOT NULL,
      indication TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      requisitionPhotoUrl TEXT,
      approvedBy TEXT,
      fulfilledAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS FridgeBloodBag (
      id TEXT PRIMARY KEY,
      serialNumber TEXT NOT NULL UNIQUE,
      bloodGroup TEXT NOT NULL,
      collectionDate TEXT NOT NULL,
      expiryDate TEXT NOT NULL,
      volumeMl INTEGER NOT NULL DEFAULT 450,
      donorName TEXT NOT NULL,
      compartment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_FRIDGE',
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS VaccineCatalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      targetDisease TEXT NOT NULL,
      priceBdt INTEGER NOT NULL,
      totalDoses INTEGER NOT NULL DEFAULT 3,
      scheduleText TEXT NOT NULL,
      intervalDays INTEGER NOT NULL DEFAULT 30,
      stockCount INTEGER NOT NULL DEFAULT 100,
      storageTemp TEXT NOT NULL DEFAULT '2°C–8°C Cold Chain',
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS VaccinationRecord (
      id TEXT PRIMARY KEY,
      userId TEXT,
      patientName TEXT NOT NULL,
      patientPhone TEXT NOT NULL,
      bloodGroup TEXT NOT NULL,
      vaccineId TEXT NOT NULL,
      vaccineName TEXT NOT NULL,
      doseNumber INTEGER NOT NULL DEFAULT 1,
      totalDoses INTEGER NOT NULL DEFAULT 3,
      dateAdministered TEXT NOT NULL,
      nextDoseDate TEXT,
      certificateNo TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS SandhaniMemberProfile (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      designation TEXT NOT NULL,
      batch TEXT NOT NULL,
      bloodGroup TEXT NOT NULL,
      photoUrl TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS EyePledge (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ageBg TEXT NOT NULL,
      phone TEXT NOT NULL,
      nid TEXT NOT NULL,
      kin TEXT NOT NULL,
      kinPhone TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS SystemSetting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS AuditLog (
      id TEXT PRIMARY KEY,
      actorId TEXT NOT NULL,
      actorName TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Ensure columns on Campaign and EmergencyRequest if upgrading existing DB
  const campaignCols = db.prepare("PRAGMA table_info('Campaign')").all() as { name: string }[];
  if (!campaignCols.some((c) => c.name === 'coverImageUrl')) {
    db.exec('ALTER TABLE Campaign ADD COLUMN coverImageUrl TEXT;');
  }

  const reqCols = db.prepare("PRAGMA table_info('EmergencyRequest')").all() as { name: string }[];
  if (!reqCols.some((c) => c.name === 'requisitionPhotoUrl')) {
    db.exec('ALTER TABLE EmergencyRequest ADD COLUMN requisitionPhotoUrl TEXT;');
  }
  if (!reqCols.some((c) => c.name === 'approvedBy')) {
    db.exec('ALTER TABLE EmergencyRequest ADD COLUMN approvedBy TEXT;');
  }
  if (!reqCols.some((c) => c.name === 'fulfilledAt')) {
    db.exec('ALTER TABLE EmergencyRequest ADD COLUMN fulfilledAt TEXT;');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const daysAgoIso = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().split('T')[0];
  };
  const daysFromNowIso = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Ensure cooldown_days setting exists
  const existingCooldown = db
    .prepare('SELECT value FROM SystemSetting WHERE key = ?')
    .get('cooldown_days');
  if (!existingCooldown) {
    db.prepare('INSERT INTO SystemSetting (key, value, updatedAt) VALUES (?, ?, ?)').run(
      'cooldown_days',
      '90',
      nowIso
    );
  }

  // Ensure GalleryPhoto has initial official items if empty
  const photoCount = (
    db.prepare('SELECT COUNT(*) as count FROM GalleryPhoto').get() as { count: number }
  ).count;
  if (photoCount === 0) {
    const insertPhoto = db.prepare(`
      INSERT INTO GalleryPhoto (id, title, category, imageUrl, caption, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const p of INITIAL_GALLERY_SVGS) {
      insertPhoto.run(crypto.randomUUID(), p.title, p.category, p.imageUrl, p.caption, nowIso);
    }
  }

  // Backfill requisitionPhotoUrl and approved statuses on existing EmergencyRequests if null
  const existingReqs = db.prepare('SELECT * FROM EmergencyRequest').all() as {
    id: string;
    patient: string;
    bloodGroup: string;
    hospital: string;
    requisitionPhotoUrl: string | null;
    status: string;
  }[];
  for (const r of existingReqs) {
    if (!r.requisitionPhotoUrl) {
      db.prepare('UPDATE EmergencyRequest SET requisitionPhotoUrl = ?, approvedBy = ? WHERE id = ?').run(
        buildRequisitionSlipSvg(r.patient, r.bloodGroup, r.hospital),
        r.status === 'OPEN' ? 'Dr. Mahmudul Hasan Nirob' : null,
        r.id
      );
    }
  }

  // Seed SandhaniMemberProfile if empty
  const memberCount = (
    db.prepare('SELECT COUNT(*) as count FROM SandhaniMemberProfile').get() as { count: number }
  ).count;
  if (memberCount === 0) {
    const insertMember = db.prepare(`
      INSERT INTO SandhaniMemberProfile (id, name, phone, designation, batch, bloodGroup, photoUrl, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const initialMembers = [
      {
        name: 'Prof. Dr. A.K.M. Shamsul Alam',
        phone: '01711-000080',
        designation: 'Chief Faculty Advisor · Transfusion Medicine',
        batch: 'RMC-34th Batch (Advisor)',
        bloodGroup: 'O+',
        photoUrl: buildMemberAvatarSvg('SA', '#0F172A', '#F59E0B'),
      },
      {
        name: 'Dr. Mahmudul Hasan Nirob',
        phone: '01721-773080',
        designation: 'President · Sandhani RMC Unit',
        batch: 'RMC-61st Batch (5th Year MBBS)',
        bloodGroup: 'O+',
        photoUrl: buildMemberAvatarSvg('MN', '#7F1D1D', '#F87171'),
      },
      {
        name: 'Dr. Farzana Yasmin Orpa',
        phone: '01719-334820',
        designation: 'General Secretary · Sandhani RMC Unit',
        batch: 'RMC-61st Batch (5th Year MBBS)',
        bloodGroup: 'A+',
        photoUrl: buildMemberAvatarSvg('FO', '#1E3A8A', '#60A5FA'),
      },
      {
        name: 'Md. Rakibul Islam Sourav',
        phone: '01842-910455',
        designation: 'Blood Bank & Fridge Secretary',
        batch: 'RMC-62nd Batch (4th Year MBBS)',
        bloodGroup: 'B+',
        photoUrl: buildMemberAvatarSvg('RS', '#064E3B', '#34D399'),
      },
      {
        name: 'Nusrat Jahan Mim',
        phone: '01914-775209',
        designation: 'Vaccination & Hepatitis-B Wing Coordinator',
        batch: 'RMC-62nd Batch (4th Year MBBS)',
        bloodGroup: 'AB+',
        photoUrl: buildMemberAvatarSvg('NM', '#3B0764', '#C084FC'),
      },
      {
        name: 'Tanvir Ahmed Rifat',
        phone: '01711-904512',
        designation: 'Patient Welfare & Requisition Secretary',
        batch: 'RMC-63rd Batch (3rd Year MBBS)',
        bloodGroup: 'O-',
        photoUrl: buildMemberAvatarSvg('TR', '#1E293B', '#38BDF8'),
      },
    ];
    for (const m of initialMembers) {
      insertMember.run(
        crypto.randomUUID(),
        m.name,
        m.phone,
        m.designation,
        m.batch,
        m.bloodGroup,
        m.photoUrl,
        nowIso
      );
    }
  }

  // Seed FridgeBloodBag inventory if empty
  const fridgeCount = (
    db.prepare('SELECT COUNT(*) as count FROM FridgeBloodBag').get() as { count: number }
  ).count;
  if (fridgeCount === 0) {
    const insertBag = db.prepare(`
      INSERT INTO FridgeBloodBag (id, serialNumber, bloodGroup, collectionDate, expiryDate, volumeMl, donorName, compartment, status, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const sampleBags = [
      { sn: 'SRMC-BAG-2026-0801', bg: 'O+', daysAgo: 4, donor: 'Dr. Mahmudul Hasan Nirob', rack: 'Fridge-1 · Shelf A1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0802', bg: 'O+', daysAgo: 6, donor: 'Md. Rashedul Karim', rack: 'Fridge-1 · Shelf A1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0803', bg: 'O+', daysAgo: 9, donor: 'Ashraful Islam', rack: 'Fridge-1 · Shelf A2', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0804', bg: 'A+', daysAgo: 3, donor: 'Sadia Afrin Mim', rack: 'Fridge-1 · Shelf B1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0805', bg: 'A+', daysAgo: 8, donor: 'Kazi Nabil Hasan', rack: 'Fridge-1 · Shelf B1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0806', bg: 'B+', daysAgo: 2, donor: 'Tanvirul Islam Shihab', rack: 'Fridge-1 · Shelf C1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0807', bg: 'B+', daysAgo: 5, donor: 'Mahfuzur Rahman', rack: 'Fridge-1 · Shelf C1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0808', bg: 'B+', daysAgo: 11, donor: 'Sabbir Hossain', rack: 'Fridge-1 · Shelf C2', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0809', bg: 'AB+', daysAgo: 7, donor: 'Nusrat Jahan Tithi', rack: 'Fridge-2 · Shelf A1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0810', bg: 'AB+', daysAgo: 12, donor: 'Shakil Mahmud', rack: 'Fridge-2 · Shelf A1', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0811', bg: 'O-', daysAgo: 5, donor: 'Farhan Sadiq Rifat', rack: 'Fridge-2 · Rare Rh(-) Vault', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0812', bg: 'A-', daysAgo: 10, donor: 'Mehedi Hasan Pranto', rack: 'Fridge-2 · Rare Rh(-) Vault', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0813', bg: 'B-', daysAgo: 14, donor: 'Ariful Haque Sohan', rack: 'Fridge-2 · Rare Rh(-) Vault', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0814', bg: 'AB-', daysAgo: 30, donor: 'Tasnim Zara Chowdhury', rack: 'Fridge-2 · Rare Rh(-) Vault', status: 'IN_FRIDGE' },
      { sn: 'SRMC-BAG-2026-0790', bg: 'O+', daysAgo: 18, donor: 'Prof. Dr. Shamsul Alam', rack: 'Dispatched · Ward 24', status: 'ISSUED' },
    ];
    for (const b of sampleBags) {
      const colDate = daysAgoIso(b.daysAgo);
      const expDate = computeBagExpiryDate(colDate, 35);
      insertBag.run(
        crypto.randomUUID(),
        b.sn,
        b.bg,
        colDate,
        expDate,
        450,
        b.donor,
        b.rack,
        b.status,
        '5-Marker Negative (HIV, HBsAg, HCV, Syphilis, Malaria Screened)',
        nowIso
      );
    }
  }

  // Seed VaccineCatalog if empty
  const vaccineCount = (
    db.prepare('SELECT COUNT(*) as count FROM VaccineCatalog').get() as { count: number }
  ).count;
  if (vaccineCount === 0) {
    const insertVac = db.prepare(`
      INSERT INTO VaccineCatalog (id, name, manufacturer, targetDisease, priceBdt, totalDoses, scheduleText, intervalDays, stockCount, storageTemp, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const initialVaccines = [
      {
        id: 'vac-hepb-adult',
        name: 'Hepatitis B Recombinant Vaccine (Adult 20mcg)',
        manufacturer: 'Incepta / GSK Biologicals',
        targetDisease: 'Hepatitis B Virus (HBV) Liver Infection',
        priceBdt: 450,
        totalDoses: 3,
        scheduleText: '3-Dose Series: Day 0, Month 1, and Month 6',
        intervalDays: 30,
        stockCount: 145,
        storageTemp: '2°C–8°C Cold Chain',
      },
      {
        id: 'vac-tt-booster',
        name: 'Tetanus Toxoid (TT / Adult Td Booster)',
        manufacturer: 'Popular / Serum Institute',
        targetDisease: 'Clostridium tetani & Diphtheria Protection',
        priceBdt: 120,
        totalDoses: 2,
        scheduleText: '2-Dose Primary: Day 0 and Day 28 (Booster q10y)',
        intervalDays: 28,
        stockCount: 220,
        storageTemp: '2°C–8°C Cold Chain',
      },
      {
        id: 'vac-typhoid-tcv',
        name: 'Typhoid Conjugate Vaccine (TCV Single Dose)',
        manufacturer: 'Bharat Biotech /aci',
        targetDisease: 'Salmonella Typhi Enteric Fever',
        priceBdt: 650,
        totalDoses: 1,
        scheduleText: 'Single Intramuscular Dose (3–5 Years Immunity)',
        intervalDays: 1095,
        stockCount: 88,
        storageTemp: '2°C–8°C Cold Chain',
      },
      {
        id: 'vac-hpv-quad',
        name: 'Cervical Cancer HPV Vaccine (Quadrivalent)',
        manufacturer: 'Merck / Incepta Vaccine Division',
        targetDisease: 'Human Papillomavirus (Types 6, 11, 16, 18)',
        priceBdt: 2200,
        totalDoses: 2,
        scheduleText: '2-Dose Schedule: Month 0 and Month 6',
        intervalDays: 180,
        stockCount: 42,
        storageTemp: '2°C–8°C Cold Chain',
      },
    ];
    for (const v of initialVaccines) {
      insertVac.run(
        v.id,
        v.name,
        v.manufacturer,
        v.targetDisease,
        v.priceBdt,
        v.totalDoses,
        v.scheduleText,
        v.intervalDays,
        v.stockCount,
        v.storageTemp,
        nowIso
      );
    }
  }

  // Ensure initial Users exist if brand-new DB
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM User').get() as { count: number };
  if (existingUsers.count === 0) {
    console.log('Seeding Sandhani RMC Unit SQLite Database...');
    const passwordHash = bcrypt.hashSync('Sandhani@1980', 10);

    const insertSetting = db.prepare(
      'INSERT OR IGNORE INTO SystemSetting (key, value, updatedAt) VALUES (?, ?, ?)'
    );
    insertSetting.run('helpline_primary', '01721-773080', nowIso);
    insertSetting.run('helpline_secondary', '025888-57150', nowIso);
    insertSetting.run(
      'emergency_broadcast',
      '24/7 Duty Roster Open • Urgent O- and B- whole blood screening active at RMCH Transfusion Desk',
      nowIso
    );
    insertSetting.run('cooldown_days', '90', nowIso);
    insertSetting.run(
      'units_list',
      JSON.stringify([
        'Rajshahi Medical College (RMC Unit)',
        'Dhaka Medical College (DMC Unit)',
        'Mymensingh Medical College (MMC Unit)',
        'Chittagong Medical College (CMC Unit)',
        'MAG Osmani Medical College (SOMC Unit)',
        'Sher-e-Bangla Medical College (SBMC Unit)',
        'Rangpur Medical College (RpMC Unit)',
        'Shaheed Ziaur Rahman Medical College (SZMC Unit)',
      ]),
      nowIso
    );

    const insertUser = db.prepare(`
      INSERT INTO User (id, name, email, phone, passwordHash, role, bloodGroup, dob, gender, unit, lastDonationDate, isAvailable, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const adminId = crypto.randomUUID();
    const staffId = crypto.randomUUID();
    const primaryDonorId = crypto.randomUUID();

    insertUser.run(
      adminId,
      'Prof. Dr. A.K.M. Shamsul Alam',
      'admin@sandhanirmc.org',
      '01711000080',
      passwordHash,
      'SUPER_ADMIN',
      'O+',
      '1978-03-15',
      'Male',
      'Rajshahi Medical College (RMC Unit)',
      daysAgoIso(140),
      1,
      nowIso
    );

    insertUser.run(
      staffId,
      'Dr. Mahmudul Hasan Nirob',
      'member@sandhanirmc.org',
      '01721773080',
      passwordHash,
      'SANDHANI_MEMBER',
      'O+',
      '2001-07-22',
      'Male',
      'Rajshahi Medical College (RMC Unit)',
      daysAgoIso(115),
      1,
      nowIso
    );

    insertUser.run(
      primaryDonorId,
      'Sadia Afrin Mim',
      'donor@sandhanirmc.org',
      '01715482910',
      passwordHash,
      'DONOR',
      'A+',
      '2002-11-05',
      'Female',
      'Rajshahi Medical College (RMC Unit)',
      daysAgoIso(102),
      1,
      nowIso
    );

    const sampleDonors = [
      {
        id: crypto.randomUUID(),
        name: 'Tanvirul Islam Shihab',
        email: 'tanvir@sandhanirmc.org',
        phone: '01819630421',
        bloodGroup: 'B+',
        dob: '2001-04-12',
        gender: 'Male',
        unit: 'Rajshahi Medical College (RMC Unit)',
        lastDonationDate: daysAgoIso(95),
        isAvailable: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Farhan Sadiq Rifat',
        email: 'farhan@sandhanirmc.org',
        phone: '01711904512',
        bloodGroup: 'O-',
        dob: '2000-09-18',
        gender: 'Male',
        unit: 'Rajshahi Medical College (RMC Unit)',
        lastDonationDate: daysAgoIso(130),
        isAvailable: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Nusrat Jahan Tithi',
        email: 'nusrat@sandhanirmc.org',
        phone: '01914775209',
        bloodGroup: 'AB+',
        dob: '2003-01-30',
        gender: 'Female',
        unit: 'Rajshahi Medical College (RMC Unit)',
        lastDonationDate: daysAgoIso(78),
        isAvailable: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Mehedi Hasan Pranto',
        email: 'mehedi@sandhanirmc.org',
        phone: '01732819403',
        bloodGroup: 'A-',
        dob: '2001-12-10',
        gender: 'Male',
        unit: 'Dhaka Medical College (DMC Unit)',
        lastDonationDate: daysAgoIso(71),
        isAvailable: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Ariful Haque Sohan',
        email: 'ariful@sandhanirmc.org',
        phone: '01675309281',
        bloodGroup: 'B-',
        dob: '2000-06-25',
        gender: 'Male',
        unit: 'Rajshahi Medical College (RMC Unit)',
        lastDonationDate: daysAgoIso(64),
        isAvailable: 1,
      },
      {
        id: crypto.randomUUID(),
        name: 'Tasnim Zara Chowdhury',
        email: 'tasnim@sandhanirmc.org',
        phone: '01788512094',
        bloodGroup: 'AB-',
        dob: '2003-08-14',
        gender: 'Female',
        unit: 'Rajshahi Medical College (RMC Unit)',
        lastDonationDate: daysAgoIso(25),
        isAvailable: 0,
      },
    ];

    for (const d of sampleDonors) {
      insertUser.run(
        d.id,
        d.name,
        d.email,
        d.phone,
        passwordHash,
        'DONOR',
        d.bloodGroup,
        d.dob,
        d.gender,
        d.unit,
        d.lastDonationDate,
        d.isAvailable,
        nowIso
      );
    }

    const camp1Id = crypto.randomUUID();
    const camp2Id = crypto.randomUUID();
    const insertCampaign = db.prepare(`
      INSERT INTO Campaign (id, title, location, startDate, endDate, targetBags, coverImageUrl, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCampaign.run(
      camp1Id,
      'National Voluntary Blood Donation Day Camp — RMC Unit',
      'RMCH Premises & Kazi Nurunnobi Hostel, Rajshahi',
      daysAgoIso(2),
      daysFromNowIso(5),
      250,
      INITIAL_GALLERY_SVGS[0].imageUrl,
      nowIso
    );
    insertCampaign.run(
      camp2Id,
      'Thalassemia Support & Grouping Drive — DMC & RMC Joint Camp',
      'Rajshahi College Auditorium, Boalia',
      daysAgoIso(105),
      daysAgoIso(102),
      180,
      INITIAL_GALLERY_SVGS[2].imageUrl,
      nowIso
    );

    const insertEmergency = db.prepare(`
      INSERT INTO EmergencyRequest (id, patient, hospital, bloodGroup, units, urgency, phone, indication, status, requisitionPhotoUrl, approvedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertEmergency.run(
      crypto.randomUUID(),
      'Baby Anas (6 yrs)',
      'RMCH Thalassemia Ward 24, Bed 12',
      'B+',
      2,
      'Urgent (Today)',
      '01721-773080',
      'Beta Thalassemia Major Transfusion',
      'APPROVED',
      buildRequisitionSlipSvg('Baby Anas (6 yrs)', 'B+', 'RMCH Thalassemia Ward 24'),
      'Dr. Mahmudul Hasan Nirob',
      nowIso
    );
    insertEmergency.run(
      crypto.randomUUID(),
      'Mst. Salma Khatun',
      'RMCH Gynae & Obs Ward 14, Cabin 4',
      'O-',
      2,
      'Critical (Within 2 Hrs)',
      '01712-498301',
      'Postpartum Hemorrhage (PPH)',
      'APPROVED',
      buildRequisitionSlipSvg('Mst. Salma Khatun', 'O-', 'RMCH Gynae & Obs Ward 14'),
      'Prof. Dr. A.K.M. Shamsul Alam',
      nowIso
    );
    insertEmergency.run(
      crypto.randomUUID(),
      'Md. Abdul Latif (58 yrs)',
      'RMCH Cardiology CCU, Bed 7',
      'A+',
      1,
      'Scheduled (24 Hrs)',
      '01833-920144',
      'CABG Surgical Standby',
      'PENDING_APPROVAL',
      buildRequisitionSlipSvg('Md. Abdul Latif (58 yrs)', 'A+', 'RMCH Cardiology CCU'),
      null,
      nowIso
    );
  }

  // Seed VaccinationRecord entries if empty so Donor Portal & Staff/Admin have rich records
  const vacRecCount = (
    db.prepare('SELECT COUNT(*) as count FROM VaccinationRecord').get() as { count: number }
  ).count;
  if (vacRecCount === 0) {
    const donorUser = db
      .prepare('SELECT * FROM User WHERE lower(email) = ?')
      .get('donor@sandhanirmc.org') as { id: string; name: string; phone: string; bloodGroup: string } | undefined;
    const staffUser = db
      .prepare('SELECT * FROM User WHERE lower(email) = ?')
      .get('member@sandhanirmc.org') as { id: string; name: string; phone: string; bloodGroup: string } | undefined;

    const insertVacRec = db.prepare(`
      INSERT INTO VaccinationRecord (id, userId, patientName, patientPhone, bloodGroup, vaccineId, vaccineName, doseNumber, totalDoses, dateAdministered, nextDoseDate, certificateNo, status, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (donorUser) {
      insertVacRec.run(
        crypto.randomUUID(),
        donorUser.id,
        donorUser.name,
        donorUser.phone,
        donorUser.bloodGroup,
        'vac-hepb-adult',
        'Hepatitis B Recombinant Vaccine (Adult 20mcg)',
        1,
        3,
        daysAgoIso(45),
        daysAgoIso(15),
        'SRMC-VAC-2026-1041',
        'Dose 1/3 Completed',
        'HBsAg Screening Negative prior to Dose 1',
        nowIso
      );
      insertVacRec.run(
        crypto.randomUUID(),
        donorUser.id,
        donorUser.name,
        donorUser.phone,
        donorUser.bloodGroup,
        'vac-hepb-adult',
        'Hepatitis B Recombinant Vaccine (Adult 20mcg)',
        2,
        3,
        daysAgoIso(14),
        daysFromNowIso(136),
        'SRMC-VAC-2026-1188',
        'Dose 2/3 Given · Next: ' + daysFromNowIso(136),
        'Administered at Sandhani Room 81 Cold Chain Desk',
        nowIso
      );
      insertVacRec.run(
        crypto.randomUUID(),
        donorUser.id,
        donorUser.name,
        donorUser.phone,
        donorUser.bloodGroup,
        'vac-tt-booster',
        'Tetanus Toxoid (TT / Adult Td Booster)',
        2,
        2,
        daysAgoIso(90),
        null,
        'SRMC-VAC-2026-0912',
        'Completed (2/2 Doses)',
        'Full 10-year booster immunity achieved',
        nowIso
      );
    }

    if (staffUser) {
      insertVacRec.run(
        crypto.randomUUID(),
        staffUser.id,
        staffUser.name,
        staffUser.phone,
        staffUser.bloodGroup,
        'vac-hepb-adult',
        'Hepatitis B Recombinant Vaccine (Adult 20mcg)',
        3,
        3,
        daysAgoIso(60),
        null,
        'SRMC-VAC-2026-0704',
        'Completed (3/3 Doses)',
        'Clinical Volunteer Mandatory HBV Immunization Complete',
        nowIso
      );
    }
  }

  // Ensure historical 12-month donations exist so the 12-month trend chart has a rich baseline
  const donationCount = (
    db.prepare('SELECT COUNT(*) as count FROM DonationRecord').get() as { count: number }
  ).count;
  if (donationCount < 12) {
    const allUsers = db.prepare('SELECT id, name FROM User').all() as { id: string; name: string }[];
    const allCamps = db.prepare('SELECT id FROM Campaign').all() as { id: string }[];
    if (allUsers.length > 0) {
      const insertDonation = db.prepare(`
        INSERT INTO DonationRecord (id, userId, campaignId, donationDate, bagNumber, volumeMl, weightKg, hemoglobin, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const monthlyBagCounts = [3, 4, 3, 5, 4, 6, 5, 4, 7, 6, 5, 4];
      for (let mOffset = 11; mOffset >= 0; mOffset--) {
        const bagsInMonth = monthlyBagCounts[11 - mOffset] || 3;
        for (let b = 0; b < bagsInMonth; b++) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - mOffset, 5 + b * 3));
          const dateStr = d.toISOString().split('T')[0];
          const chosenUser = allUsers[(mOffset + b) % allUsers.length];
          const chosenCamp = allCamps.length > 0 ? allCamps[(mOffset + b) % allCamps.length].id : null;
          const bagId = `SRMC-${d.getUTCFullYear()}-${1000 + mOffset * 50 + b}`;
          insertDonation.run(
            crypto.randomUUID(),
            chosenUser.id,
            chosenCamp,
            dateStr,
            bagId,
            450,
            56 + (b % 10),
            13.2 + (b % 3) * 0.4,
            'Screened whole blood unit (5-marker negative)'
          );
        }
      }
    }
  }
}

initializeDatabase();

// ============================================================================
// 2. EXPRESS SERVER & RBAC SESSION AUTHENTICATION
// ============================================================================
interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  bloodGroup: string;
  dob: string | null;
  gender: string | null;
  unit: string | null;
  lastDonationDate: string | null;
  isAvailable: number;
  createdAt: string;
}

interface AuthenticatedRequest extends Request {
  user?: DbUser;
}

function signAndSetSession(res: Response, user: DbUser): string {
  const payload = { id: user.id, role: user.role, email: user.email, name: user.name };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

function serializeUser(u: DbUser, cooldownDays = getConfiguredCooldownDays()) {
  const eligibility = computeMedicalEligibility(u.lastDonationDate, new Date(), cooldownDays);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    bloodGroup: u.bloodGroup,
    dob: u.dob || '',
    gender: u.gender || '',
    unit: u.unit || 'Rajshahi Medical College (RMC Unit)',
    isAvailable: Boolean(u.isAvailable),
    eligibility,
  };
}

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const token = cookieToken || bearerToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = db.prepare('SELECT * FROM User WHERE id = ?').get(decoded.id) as DbUser | undefined;
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      res.status(401).json({ error: 'Session expired or user no longer exists.' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
}

function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access Denied. Required authorization tier: ${allowedRoles.join(' or ')}`,
      });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  // Allow up to 15MB JSON payload for base64 image uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser());

  // ==========================================================================
  // A. AUTHENTICATION & SESSION ENGINE (/api/auth/*)
  // ==========================================================================
  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const { name, email, phone, bloodGroup, dob, gender, unit, password } = req.body;
      if (!name || !email || !phone || !bloodGroup || !password) {
        res.status(400).json({
          error: 'Full Name, Email, Phone Number, Blood Group, and Password are required.',
        });
        return;
      }

      if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
        res.status(400).json({ error: 'Invalid Blood Group selected.' });
        return;
      }

      const cleanPhone = String(phone).replace(/\s+/g, '');
      const cleanEmail = String(email).trim().toLowerCase();

      const existing = db
        .prepare('SELECT id FROM User WHERE lower(email) = ? OR phone = ?')
        .get(cleanEmail, cleanPhone);
      if (existing) {
        res.status(409).json({
          error: 'An account with this Email or Phone Number is already registered.',
        });
        return;
      }

      const id = crypto.randomUUID();
      const passwordHash = bcrypt.hashSync(String(password), 10);
      const nowIso = new Date().toISOString();

      db.prepare(`
        INSERT INTO User (id, name, email, phone, passwordHash, role, bloodGroup, dob, gender, unit, lastDonationDate, isAvailable, createdAt)
        VALUES (?, ?, ?, ?, ?, 'DONOR', ?, ?, ?, ?, NULL, 1, ?)
      `).run(
        id,
        String(name).trim(),
        cleanEmail,
        cleanPhone,
        passwordHash,
        bloodGroup,
        dob || null,
        gender || null,
        unit || 'Rajshahi Medical College (RMC Unit)',
        nowIso
      );

      const newUser = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as DbUser;
      const token = signAndSetSession(res, newUser);

      res.status(201).json({
        message: 'Registration complete. Welcome to Sandhani.',
        token,
        user: serializeUser(newUser),
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Internal server error during registration.' });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { identifier, email, password } = req.body;
      const loginKey = String(identifier || email || '').trim();
      if (!loginKey || !password) {
        res.status(400).json({ error: 'Email/Phone and Password are required.' });
        return;
      }

      const user = db
        .prepare('SELECT * FROM User WHERE lower(email) = ? OR phone = ?')
        .get(loginKey.toLowerCase(), loginKey.replace(/\s+/g, '')) as DbUser | undefined;

      if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
        res.status(401).json({ error: 'Invalid Email/Phone or Password.' });
        return;
      }

      const token = signAndSetSession(res, user);
      res.json({
        message: `Signed in as ${user.name}`,
        token,
        user: serializeUser(user),
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error during sign-in.' });
    }
  });

  app.post('/api/auth/demo-role', (req: Request, res: Response) => {
    const { role } = req.body as { role: Role };
    const emailMap: Record<Role, string> = {
      SUPER_ADMIN: 'admin@sandhanirmc.org',
      SANDHANI_MEMBER: 'member@sandhanirmc.org',
      DONOR: 'donor@sandhanirmc.org',
    };
    const targetEmail = emailMap[role] || 'donor@sandhanirmc.org';
    let user = db
      .prepare('SELECT * FROM User WHERE lower(email) = ?')
      .get(targetEmail) as DbUser | undefined;
    if (!user) {
      user = db.prepare('SELECT * FROM User WHERE role = ? LIMIT 1').get(role) as DbUser | undefined;
    }
    if (!user) {
      res.status(404).json({ error: 'Demo account not found.' });
      return;
    }
    const token = signAndSetSession(res, user);
    res.json({
      message: `Switched active session to ${user.name} (${user.role})`,
      token,
      user: serializeUser(user),
    });
  });

  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    try {
      const cookieToken = req.cookies?.[COOKIE_NAME];
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const token = cookieToken || bearerToken;
      if (!token) {
        res.json({ user: null });
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      const user = db.prepare('SELECT * FROM User WHERE id = ?').get(decoded.id) as DbUser | undefined;
      if (!user) {
        res.clearCookie(COOKIE_NAME);
        res.json({ user: null });
        return;
      }
      res.json({ user: serializeUser(user) });
    } catch {
      res.clearCookie(COOKIE_NAME);
      res.json({ user: null });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Signed out successfully.' });
  });

  // ==========================================================================
  // PUBLIC ENDPOINTS (STRICT PRIVACY ISOLATION: MASKED DONOR PHONES)
  // ==========================================================================
  app.get('/api/public/overview', (_req: Request, res: Response) => {
    try {
      const cooldownDays = getConfiguredCooldownDays();
      const users = db
        .prepare(`
          SELECT u.*, (SELECT COUNT(*) FROM DonationRecord dr WHERE dr.userId = u.id) as donationsCount
          FROM User u
          ORDER BY u.createdAt DESC
        `)
        .all() as (DbUser & { donationsCount: number })[];

      const donationsTotal = (
        db.prepare('SELECT COUNT(*) as count FROM DonationRecord').get() as { count: number }
      ).count;
      const campaignsTotal = (
        db.prepare('SELECT COUNT(*) as count FROM Campaign').get() as { count: number }
      ).count;
      const emergencyRequests = db
        .prepare('SELECT * FROM EmergencyRequest ORDER BY createdAt DESC LIMIT 15')
        .all();
      const eyePledges = db
        .prepare('SELECT * FROM EyePledge ORDER BY createdAt DESC LIMIT 8')
        .all();
      const photos = db
        .prepare('SELECT * FROM GalleryPhoto ORDER BY createdAt DESC LIMIT 12')
        .all();
      const membersDirectory = db
        .prepare('SELECT * FROM SandhaniMemberProfile ORDER BY createdAt ASC')
        .all();
      const vaccines = db
        .prepare('SELECT * FROM VaccineCatalog ORDER BY priceBdt ASC')
        .all() as { stockCount: number }[];
      const fridgeBags = db
        .prepare('SELECT * FROM FridgeBloodBag ORDER BY collectionDate DESC')
        .all() as FridgeBagRecord[];

      const fridgeSummary = computeFridgeInventorySummary(fridgeBags, new Date());
      const vaccineStockTotal = vaccines.reduce(
        (sum, v) => sum + (Number(v.stockCount) || 0),
        0
      );

      const settingsRows = db.prepare('SELECT key, value FROM SystemSetting').all() as {
        key: string;
        value: string;
      }[];

      const settingsMap: Record<string, string> = {};
      for (const s of settingsRows) {
        settingsMap[s.key] = s.value;
      }

      const publicDonors = users.map((u) => {
        const elig = computeMedicalEligibility(u.lastDonationDate, new Date(), cooldownDays);
        return {
          id: u.id,
          name: u.name,
          bloodGroup: u.bloodGroup,
          unit: u.unit || 'Rajshahi Medical College (RMC Unit)',
          isAvailable: Boolean(u.isAvailable),
          eligibleNow: elig.isEligible && Boolean(u.isAvailable),
          badgeText: elig.badgeText,
          badgeColor: elig.badgeColor,
          lastDonationDate: elig.lastDonationDate,
          nextEligibleDate: elig.nextEligibleDate,
          donationsCount: u.donationsCount,
          maskedPhone: `${maskDonorPhone(u.phone)} (Staff Restricted)`,
        };
      });

      const board = VALID_BLOOD_GROUPS.map((bg) => {
        const readyDonors = publicDonors.filter((d) => d.bloodGroup === bg && d.eligibleNow).length;
        const bags = fridgeSummary.byBloodGroup[bg] ?? 0;
        return {
          group: bg,
          bags,
          readyDonors,
          bnStatus: bags <= 1 ? 'জরুরি মজুদ (Low)' : 'ফ্রিজে সংরক্ষিত (In Fridge)',
        };
      });

      res.json({
        settings: {
          helplinePrimary: settingsMap.helpline_primary || '01721-773080',
          helplineSecondary: settingsMap.helpline_secondary || '025888-57150',
          emergencyBroadcast:
            settingsMap.emergency_broadcast ||
            '24/7 Duty Roster Open • Urgent O- and B- whole blood screening active at RMCH Transfusion Desk',
          cooldownDays,
          googleSheetId: settingsMap.google_sheet_id || '',
          unitsList: settingsMap.units_list ? JSON.parse(settingsMap.units_list) : [],
        },
        stats: {
          bloodUnits: 148520 + donationsTotal,
          donors: 42855 + users.length,
          corneas: 3638 + eyePledges.length * 2,
          camps: 1923 + campaignsTotal,
          fridgeBagsTotal: fridgeSummary.totalInFridge,
          vaccineStockTotal,
        },
        board,
        donors: publicDonors,
        emergencyRequests,
        eyePledges,
        photos,
        membersDirectory,
        vaccines,
        fridgeSummary,
      });
    } catch (err) {
      console.error('Public overview error:', err);
      res.status(500).json({ error: 'Failed to load public overview.' });
    }
  });

  app.post('/api/public/emergency-requests', (req: Request, res: Response) => {
    try {
      const {
        patient,
        hospital,
        bloodGroup,
        units,
        urgency,
        phone,
        indication,
        requisitionPhotoUrl,
      } = req.body;
      if (!patient || !hospital || !bloodGroup || !phone) {
        res.status(400).json({
          error: 'Patient Name, Hospital/Ward, Blood Group, and Attendant Phone are required.',
        });
        return;
      }
      const id = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const photoToSave =
        requisitionPhotoUrl && String(requisitionPhotoUrl).trim()
          ? String(requisitionPhotoUrl).trim()
          : buildRequisitionSlipSvg(String(patient).trim(), bloodGroup, String(hospital).trim());

      db.prepare(`
        INSERT INTO EmergencyRequest (id, patient, hospital, bloodGroup, units, urgency, phone, indication, status, requisitionPhotoUrl, approvedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, NULL, ?)
      `).run(
        id,
        String(patient).trim(),
        String(hospital).trim(),
        bloodGroup,
        Number(units) || 1,
        urgency || 'Urgent (Today)',
        String(phone).trim(),
        indication ? String(indication).trim() : 'Emergency Whole Blood Requisition',
        photoToSave,
        nowIso
      );
      const created = db.prepare('SELECT * FROM EmergencyRequest WHERE id = ?').get(id);
      res.status(201).json({
        message: 'Emergency blood requisition submitted with slip photo (Pending Admin/Staff Approval).',
        request: created,
      });
    } catch {
      res.status(500).json({ error: 'Failed to publish emergency request.' });
    }
  });

  app.post('/api/public/eye-pledges', (req: Request, res: Response) => {
    try {
      const { name, ageBg, phone, nid, kin, kinPhone } = req.body;
      if (!name || !ageBg || !phone || !nid || !kin) {
        res.status(400).json({ error: 'All eye donation pledge fields are required.' });
        return;
      }
      const id = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO EyePledge (id, name, ageBg, phone, nid, kin, kinPhone, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        String(name).trim(),
        String(ageBg).trim(),
        String(phone).trim(),
        String(nid).trim(),
        String(kin).trim(),
        String(kinPhone || '').trim(),
        nowIso
      );
      const pledge = db.prepare('SELECT * FROM EyePledge WHERE id = ?').get(id);
      res.status(201).json({
        message: 'Posthumous eye donation pledge recorded in Sandhani registry.',
        pledge,
      });
    } catch {
      res.status(500).json({ error: 'Failed to save eye donation pledge.' });
    }
  });

  app.post('/api/public/photos', (req: Request, res: Response) => {
    try {
      const { title, category, imageUrl, caption } = req.body;
      if (!title || !imageUrl) {
        res.status(400).json({ error: 'Photo Title and Image file/URL are required.' });
        return;
      }
      const id = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO GalleryPhoto (id, title, category, imageUrl, caption, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        String(title).trim(),
        String(category || 'Blood Drive Camp').trim(),
        String(imageUrl).trim(),
        String(caption || 'Sandhani RMC Unit Official Archive').trim(),
        nowIso
      );
      const photo = db.prepare('SELECT * FROM GalleryPhoto WHERE id = ?').get(id);
      res.status(201).json({
        message: 'Official photo added to Sandhani gallery.',
        photo,
      });
    } catch {
      res.status(500).json({ error: 'Failed to upload photo.' });
    }
  });

  // ==========================================================================
  // B. UNIFIED DONOR & VACCINATION PORTAL API (/api/donor/*)
  // ==========================================================================
  app.get('/api/donor/dashboard', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      const u = req.user!;
      const cooldownDays = getConfiguredCooldownDays();
      const eligibility = computeMedicalEligibility(u.lastDonationDate, new Date(), cooldownDays);
      const donations = db
        .prepare(`
          SELECT dr.*, c.title as campaignTitle, c.location as campaignLocation
          FROM DonationRecord dr
          LEFT JOIN Campaign c ON dr.campaignId = c.id
          WHERE dr.userId = ?
          ORDER BY dr.donationDate DESC
        `)
        .all(u.id) as {
        id: string;
        donationDate: string;
        bagNumber: string | null;
        volumeMl: number;
        weightKg: number | null;
        hemoglobin: number | null;
        notes: string | null;
        campaignTitle: string | null;
        campaignLocation: string | null;
      }[];

      const vaccinations = db
        .prepare(`
          SELECT * FROM VaccinationRecord
          WHERE userId = ? OR patientPhone = ?
          ORDER BY dateAdministered DESC
        `)
        .all(u.id, u.phone);

      const vaccinesCatalog = db
        .prepare('SELECT * FROM VaccineCatalog ORDER BY priceBdt ASC')
        .all();

      res.json({
        profile: serializeUser(u, cooldownDays),
        eligibility,
        donations: donations.map((d) => ({
          id: d.id,
          donationDate: d.donationDate.split('T')[0],
          campaignTitle: d.campaignTitle || 'RMCH Transfusion Center / Walk-in',
          location: d.campaignLocation || 'Rajshahi Medical College Hospital',
          bagNumber: d.bagNumber || `CERT-${d.id.slice(0, 8).toUpperCase()}`,
          volumeMl: d.volumeMl,
          weightKg: d.weightKg,
          hemoglobin: d.hemoglobin,
          notes: d.notes || 'Screened whole blood donation',
        })),
        vaccinations,
        vaccinesCatalog,
      });
    } catch (err) {
      console.error('Donor dashboard error:', err);
      res.status(500).json({ error: 'Failed to load donor & vaccination dashboard.' });
    }
  });

  app.post('/api/donor/vaccinations', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      const u = req.user!;
      const { vaccineId, doseNumber, dateAdministered, notes } = req.body;
      const vaccine = db
        .prepare('SELECT * FROM VaccineCatalog WHERE id = ?')
        .get(vaccineId) as
        | {
            id: string;
            name: string;
            totalDoses: number;
            intervalDays: number;
            stockCount: number;
          }
        | undefined;

      if (!vaccine) {
        res.status(404).json({ error: 'Selected vaccine not found in catalog.' });
        return;
      }
      if (vaccine.stockCount <= 0) {
        res.status(400).json({ error: 'This vaccine is currently out of stock.' });
        return;
      }

      const dateIso =
        dateAdministered && String(dateAdministered).trim()
          ? String(dateAdministered).split('T')[0]
          : new Date().toISOString().split('T')[0];

      const schedule = computeVaccineScheduleStatus(
        Number(doseNumber) || 1,
        vaccine.totalDoses,
        dateIso,
        vaccine.intervalDays
      );

      const id = crypto.randomUUID();
      const certNo = `SRMC-VAC-${dateIso.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const nowIso = new Date().toISOString();

      db.prepare(`
        INSERT INTO VaccinationRecord (id, userId, patientName, patientPhone, bloodGroup, vaccineId, vaccineName, doseNumber, totalDoses, dateAdministered, nextDoseDate, certificateNo, status, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        u.id,
        u.name,
        u.phone,
        u.bloodGroup,
        vaccine.id,
        vaccine.name,
        schedule.doseNumber,
        schedule.totalDoses,
        dateIso,
        schedule.nextDoseDate,
        certNo,
        schedule.statusLabel,
        notes ? String(notes).trim() : 'Registered via Personal Vaccination Portal',
        nowIso
      );

      db.prepare('UPDATE VaccineCatalog SET stockCount = MAX(0, stockCount - 1) WHERE id = ?').run(
        vaccine.id
      );

      res.status(201).json({
        message: `Logged Dose ${schedule.doseNumber}/${schedule.totalDoses} of ${vaccine.name} (Certificate: ${certNo}).`,
      });
    } catch {
      res.status(500).json({ error: 'Failed to register vaccination dose.' });
    }
  });

  app.patch('/api/donor/profile', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      const u = req.user!;
      const { name, phone, unit, isAvailable, gender, dob } = req.body;

      const updatedName = typeof name === 'string' && name.trim() ? name.trim() : u.name;
      const updatedPhone =
        typeof phone === 'string' && phone.trim() ? phone.replace(/\s+/g, '') : u.phone;
      const updatedUnit = typeof unit === 'string' ? unit.trim() : u.unit;
      const updatedAvail =
        typeof isAvailable === 'boolean' ? (isAvailable ? 1 : 0) : u.isAvailable;
      const updatedGender = typeof gender === 'string' ? gender : u.gender;
      const updatedDob = typeof dob === 'string' ? dob : u.dob;

      db.prepare(`
        UPDATE User
        SET name = ?, phone = ?, unit = ?, isAvailable = ?, gender = ?, dob = ?
        WHERE id = ?
      `).run(
        updatedName,
        updatedPhone,
        updatedUnit,
        updatedAvail,
        updatedGender,
        updatedDob,
        u.id
      );

      const refreshed = db.prepare('SELECT * FROM User WHERE id = ?').get(u.id) as DbUser;
      res.json({
        message: 'Personal donor profile updated.',
        profile: serializeUser(refreshed),
      });
    } catch {
      res.status(400).json({
        error: 'Could not update profile. That phone number may already belong to another donor.',
      });
    }
  });

  // ==========================================================================
  // C. SANDHANI INTERNAL STAFF & ADMIN SHARED CLINICAL OPERATIONS (/api/staff/*)
  // Accessible to SANDHANI_MEMBER and SUPER_ADMIN
  // ==========================================================================
  app.get(
    '/api/staff/donors',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const cooldownDays = getConfiguredCooldownDays();
        const { bloodGroup, unit, status, search } = req.query as {
          bloodGroup?: string;
          unit?: string;
          status?: 'ALL' | 'ELIGIBLE' | 'INELIGIBLE' | 'UNAVAILABLE';
          search?: string;
        };

        const users = db
          .prepare('SELECT * FROM User ORDER BY createdAt DESC')
          .all() as DbUser[];

        const allDonations = db
          .prepare(`
            SELECT dr.*, c.title as campaignTitle
            FROM DonationRecord dr
            LEFT JOIN Campaign c ON dr.campaignId = c.id
            ORDER BY dr.donationDate DESC
          `)
          .all() as {
          id: string;
          userId: string;
          donationDate: string;
          bagNumber: string | null;
          volumeMl: number;
          weightKg: number | null;
          hemoglobin: number | null;
          notes: string | null;
          campaignTitle: string | null;
        }[];

        const donationsByUser = new Map<string, typeof allDonations>();
        for (const dr of allDonations) {
          const list = donationsByUser.get(dr.userId) || [];
          list.push(dr);
          donationsByUser.set(dr.userId, list);
        }

        const enriched = users.map((u) => {
          const elig = computeMedicalEligibility(u.lastDonationDate, new Date(), cooldownDays);
          const userDonations = donationsByUser.get(u.id) || [];
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            bloodGroup: u.bloodGroup,
            dob: u.dob,
            gender: u.gender,
            unit: u.unit || 'Rajshahi Medical College (RMC Unit)',
            isAvailable: Boolean(u.isAvailable),
            lastDonationDate: elig.lastDonationDate,
            daysElapsed: elig.daysElapsed,
            daysRemaining: elig.daysRemaining,
            nextEligibleDate: elig.nextEligibleDate,
            isEligible: elig.isEligible,
            isUpcomingWindow: elig.isUpcomingWindow,
            badgeText: elig.badgeText,
            badgeColor: elig.badgeColor,
            donationsCount: userDonations.length,
            donations: userDonations.map((d) => ({
              id: d.id,
              donationDate: d.donationDate.split('T')[0],
              campaignTitle: d.campaignTitle || 'Direct RMCH Transfusion',
              bagNumber: d.bagNumber || 'N/A',
              volumeMl: d.volumeMl,
              weightKg: d.weightKg,
              hemoglobin: d.hemoglobin,
              notes: d.notes,
            })),
          };
        });

        const filtered = filterDonorDirectory(enriched, {
          bloodGroup,
          unit,
          status,
          search,
        });

        const upcomingEligible = enriched
          .filter((d) => d.isUpcomingWindow)
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        res.json({
          cooldownDays,
          totalCount: enriched.length,
          filteredCount: filtered.length,
          donors: filtered,
          upcomingEligible,
        });
      } catch (err) {
        console.error('Staff donors error:', err);
        res.status(500).json({ error: 'Failed to load master blood donor directory.' });
      }
    }
  );

  // Blood Fridge Inventory Endpoints (Accessible to Members & Super Admins)
  app.get(
    '/api/staff/fridge',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        const bags = db
          .prepare('SELECT * FROM FridgeBloodBag ORDER BY collectionDate DESC, createdAt DESC')
          .all() as FridgeBagRecord[];
        const summary = computeFridgeInventorySummary(bags, new Date());
        res.json({ bags, summary });
      } catch {
        res.status(500).json({ error: 'Failed to load blood fridge inventory.' });
      }
    }
  );

  app.post(
    '/api/staff/fridge',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          serialNumber,
          bloodGroup,
          collectionDate,
          expiryDate,
          volumeMl,
          donorName,
          compartment,
          notes,
        } = req.body;

        if (!bloodGroup || !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
          res.status(400).json({ error: 'Valid blood group is required.' });
          return;
        }

        const colDate =
          collectionDate && String(collectionDate).trim()
            ? String(collectionDate).split('T')[0]
            : new Date().toISOString().split('T')[0];
        const expDate =
          expiryDate && String(expiryDate).trim()
            ? String(expiryDate).split('T')[0]
            : computeBagExpiryDate(colDate, 35);
        const sn =
          serialNumber && String(serialNumber).trim()
            ? String(serialNumber).trim()
            : `SRMC-BAG-${colDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        db.prepare(`
          INSERT INTO FridgeBloodBag (id, serialNumber, bloodGroup, collectionDate, expiryDate, volumeMl, donorName, compartment, status, notes, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IN_FRIDGE', ?, ?)
        `).run(
          id,
          sn,
          bloodGroup,
          colDate,
          expDate,
          Number(volumeMl) || 450,
          donorName ? String(donorName).trim() : 'Voluntary Walk-in Donor',
          compartment ? String(compartment).trim() : 'Fridge-1 · Shelf A1',
          notes ? String(notes).trim() : '5-Marker Screened Safe',
          nowIso
        );

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'FRIDGE_BAG_ADDED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Added blood bag ${sn} (${bloodGroup}) to ${compartment || 'Fridge-1'}`,
          nowIso
        );

        res.status(201).json({
          message: `Blood bag ${sn} (${bloodGroup}) stored in refrigerator.`,
        });
      } catch {
        res.status(400).json({
          error: 'Could not add blood bag. Ensure the Serial Number is unique.',
        });
      }
    }
  );

  app.patch(
    '/api/staff/fridge/:id',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { status, compartment, notes } = req.body;
        const existing = db.prepare('SELECT * FROM FridgeBloodBag WHERE id = ?').get(id) as
          | { serialNumber: string; bloodGroup: string; status: string; compartment: string; notes: string }
          | undefined;
        if (!existing) {
          res.status(404).json({ error: 'Blood bag not found.' });
          return;
        }

        const nextStatus = status || existing.status;
        const nextComp = compartment !== undefined ? String(compartment) : existing.compartment;
        const nextNotes = notes !== undefined ? String(notes) : existing.notes;

        db.prepare(`
          UPDATE FridgeBloodBag
          SET status = ?, compartment = ?, notes = ?
          WHERE id = ?
        `).run(nextStatus, nextComp, nextNotes, id);

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'FRIDGE_BAG_UPDATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Updated bag ${existing.serialNumber} (${existing.bloodGroup}) status to ${nextStatus}`,
          new Date().toISOString()
        );

        res.json({
          message: `Bag ${existing.serialNumber} updated to ${nextStatus}.`,
        });
      } catch {
        res.status(400).json({ error: 'Failed to update blood bag.' });
      }
    }
  );

  app.delete(
    '/api/staff/fridge/:id',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        db.prepare('DELETE FROM FridgeBloodBag WHERE id = ?').run(id);
        res.json({ message: 'Blood bag removed from fridge registry.' });
      } catch {
        res.status(400).json({ error: 'Failed to remove blood bag.' });
      }
    }
  );

  // Vaccination Wing Management Endpoints (Accessible to Members & Super Admins)
  app.get(
    '/api/staff/vaccinations',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        const vaccines = db
          .prepare('SELECT * FROM VaccineCatalog ORDER BY priceBdt ASC')
          .all();
        const records = db
          .prepare('SELECT * FROM VaccinationRecord ORDER BY dateAdministered DESC, createdAt DESC LIMIT 50')
          .all();
        res.json({ vaccines, records });
      } catch {
        res.status(500).json({ error: 'Failed to load vaccination wing data.' });
      }
    }
  );

  app.post(
    '/api/staff/vaccinations',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          patientName,
          patientPhone,
          bloodGroup,
          vaccineId,
          doseNumber,
          dateAdministered,
          notes,
        } = req.body;

        if (!patientName || !patientPhone || !vaccineId) {
          res.status(400).json({
            error: 'Patient Name, Phone Number, and Vaccine selection are required.',
          });
          return;
        }

        const vaccine = db
          .prepare('SELECT * FROM VaccineCatalog WHERE id = ?')
          .get(vaccineId) as
          | { id: string; name: string; totalDoses: number; intervalDays: number; stockCount: number }
          | undefined;

        if (!vaccine) {
          res.status(404).json({ error: 'Vaccine not found.' });
          return;
        }

        const cleanPhone = String(patientPhone).replace(/\s+/g, '');
        const matchedUser = db
          .prepare('SELECT id, bloodGroup FROM User WHERE phone = ?')
          .get(cleanPhone) as { id: string; bloodGroup: string } | undefined;

        const dateIso =
          dateAdministered && String(dateAdministered).trim()
            ? String(dateAdministered).split('T')[0]
            : new Date().toISOString().split('T')[0];

        const schedule = computeVaccineScheduleStatus(
          Number(doseNumber) || 1,
          vaccine.totalDoses,
          dateIso,
          vaccine.intervalDays
        );

        const certNo = `SRMC-VAC-${dateIso.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const nowIso = new Date().toISOString();

        db.prepare(`
          INSERT INTO VaccinationRecord (id, userId, patientName, patientPhone, bloodGroup, vaccineId, vaccineName, doseNumber, totalDoses, dateAdministered, nextDoseDate, certificateNo, status, notes, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          matchedUser ? matchedUser.id : null,
          String(patientName).trim(),
          cleanPhone,
          bloodGroup || matchedUser?.bloodGroup || 'O+',
          vaccine.id,
          vaccine.name,
          schedule.doseNumber,
          schedule.totalDoses,
          dateIso,
          schedule.nextDoseDate,
          certNo,
          schedule.statusLabel,
          notes ? String(notes).trim() : `Administered by ${req.user!.name}`,
          nowIso
        );

        db.prepare('UPDATE VaccineCatalog SET stockCount = MAX(0, stockCount - 1) WHERE id = ?').run(
          vaccine.id
        );

        res.status(201).json({
          message: `Recorded Dose ${schedule.doseNumber}/${schedule.totalDoses} of ${vaccine.name} for ${patientName}.`,
        });
      } catch {
        res.status(500).json({ error: 'Failed to record vaccination.' });
      }
    }
  );

  // Requisition Management Endpoints (Approve, Fulfill, Edit, Upload Photo, Delete)
  app.put(
    '/api/admin/requisitions/:id',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const {
          patient,
          hospital,
          bloodGroup,
          units,
          urgency,
          phone,
          indication,
          status,
          requisitionPhotoUrl,
        } = req.body;

        const existing = db.prepare('SELECT * FROM EmergencyRequest WHERE id = ?').get(id) as
          | {
              id: string;
              patient: string;
              hospital: string;
              bloodGroup: string;
              units: number;
              urgency: string;
              phone: string;
              indication: string;
              status: string;
              requisitionPhotoUrl: string | null;
              approvedBy: string | null;
              fulfilledAt: string | null;
            }
          | undefined;

        if (!existing) {
          res.status(404).json({ error: 'Requisition not found.' });
          return;
        }

        const nextStatus = status || existing.status;
        const nowIso = new Date().toISOString();
        const nextApprovedBy =
          nextStatus === 'APPROVED' || nextStatus === 'FULFILLED'
            ? existing.approvedBy || req.user!.name
            : existing.approvedBy;
        const nextFulfilledAt =
          nextStatus === 'FULFILLED' ? existing.fulfilledAt || nowIso : existing.fulfilledAt;

        db.prepare(`
          UPDATE EmergencyRequest
          SET patient = ?, hospital = ?, bloodGroup = ?, units = ?, urgency = ?, phone = ?, indication = ?, status = ?, requisitionPhotoUrl = ?, approvedBy = ?, fulfilledAt = ?
          WHERE id = ?
        `).run(
          patient ? String(patient).trim() : existing.patient,
          hospital ? String(hospital).trim() : existing.hospital,
          bloodGroup || existing.bloodGroup,
          units ? Number(units) : existing.units,
          urgency ? String(urgency).trim() : existing.urgency,
          phone ? String(phone).trim() : existing.phone,
          indication !== undefined ? String(indication).trim() : existing.indication,
          nextStatus,
          requisitionPhotoUrl !== undefined ? requisitionPhotoUrl : existing.requisitionPhotoUrl,
          nextApprovedBy,
          nextFulfilledAt,
          id
        );

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'REQUISITION_UPDATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Updated requisition for ${patient || existing.patient} (${bloodGroup || existing.bloodGroup}) — Status: ${nextStatus}`,
          nowIso
        );

        res.json({
          message: `Requisition for ${patient || existing.patient} updated (${nextStatus}).`,
        });
      } catch {
        res.status(400).json({ error: 'Failed to update requisition.' });
      }
    }
  );

  app.delete(
    '/api/admin/requisitions/:id',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const existing = db.prepare('SELECT patient, bloodGroup FROM EmergencyRequest WHERE id = ?').get(id) as
          | { patient: string; bloodGroup: string }
          | undefined;
        db.prepare('DELETE FROM EmergencyRequest WHERE id = ?').run(id);
        if (existing) {
          db.prepare(`
            INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
            VALUES (?, ?, ?, 'REQUISITION_REMOVED', ?, ?)
          `).run(
            crypto.randomUUID(),
            req.user!.id,
            req.user!.name,
            `Removed blood requisition for ${existing.patient} (${existing.bloodGroup})`,
            new Date().toISOString()
          );
        }
        res.json({ message: 'Blood requisition removed.' });
      } catch {
        res.status(400).json({ error: 'Failed to delete requisition.' });
      }
    }
  );

  app.patch(
    '/api/staff/donors/:id/availability',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { isAvailable } = req.body;
        const target = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as DbUser | undefined;
        if (!target) {
          res.status(404).json({ error: 'Donor not found.' });
          return;
        }

        const flagVal = isAvailable ? 1 : 0;
        db.prepare('UPDATE User SET isAvailable = ? WHERE id = ?').run(flagVal, id);

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'DONOR_AVAILABILITY_FLAGGED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Set emergency call availability of ${target.name} (${target.phone}) to ${
            flagVal ? 'Available' : 'Unavailable'
          }`,
          new Date().toISOString()
        );

        res.json({
          message: `${target.name} marked as ${flagVal ? 'Available' : 'Unavailable'}.`,
          donor: { id, isAvailable: Boolean(flagVal) },
        });
      } catch {
        res.status(400).json({ error: 'Failed to update donor availability.' });
      }
    }
  );

  app.get(
    '/api/staff/campaigns',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        const campaigns = db
          .prepare('SELECT * FROM Campaign ORDER BY startDate DESC')
          .all() as {
          id: string;
          title: string;
          location: string;
          startDate: string;
          endDate: string;
          targetBags: number;
          coverImageUrl: string | null;
        }[];

        const donations = db
          .prepare(`
            SELECT dr.*, u.name as donorName, u.bloodGroup as donorBloodGroup, u.phone as donorPhone
            FROM DonationRecord dr
            JOIN User u ON dr.userId = u.id
            ORDER BY dr.donationDate DESC
          `)
          .all() as {
          id: string;
          campaignId: string | null;
          donationDate: string;
          bagNumber: string | null;
          volumeMl: number;
          weightKg: number | null;
          hemoglobin: number | null;
          donorName: string;
          donorBloodGroup: string;
          donorPhone: string;
        }[];

        const enrichedCampaigns = campaigns.map((c) => {
          const campDonations = donations.filter((d) => d.campaignId === c.id);
          const totalVolumeMl = campDonations.reduce(
            (acc, d) => acc + (Number(d.volumeMl) || 450),
            0
          );
          return {
            ...c,
            startDate: c.startDate.split('T')[0],
            endDate: c.endDate.split('T')[0],
            collectedBags: campDonations.length,
            totalVolumeMl,
            donations: campDonations.slice(0, 15),
          };
        });

        const monthlyTrends = computeTwelveMonthDonationTrends(
          donations.map((d) => ({
            donationDate: d.donationDate,
            volumeMl: d.volumeMl,
          })),
          new Date()
        );

        res.json({
          campaigns: enrichedCampaigns,
          monthlyTrends,
        });
      } catch {
        res.status(500).json({ error: 'Failed to fetch campaigns.' });
      }
    }
  );

  app.post(
    '/api/staff/campaigns',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { title, location, startDate, endDate, targetBags, coverImageUrl } = req.body;
        if (!title || !location || !startDate || !endDate || !targetBags) {
          res.status(400).json({ error: 'All campaign fields are required.' });
          return;
        }
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        db.prepare(`
          INSERT INTO Campaign (id, title, location, startDate, endDate, targetBags, coverImageUrl, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          String(title).trim(),
          String(location).trim(),
          String(startDate),
          String(endDate),
          Number(targetBags),
          coverImageUrl ? String(coverImageUrl).trim() : null,
          nowIso
        );

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'CAMPAIGN_CREATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Created blood drive campaign "${title}" at ${location} (Target: ${targetBags} bags)`,
          nowIso
        );

        res.status(201).json({ message: 'Blood drive campaign created.' });
      } catch {
        res.status(500).json({ error: 'Failed to create campaign.' });
      }
    }
  );

  app.patch(
    '/api/staff/campaigns/:id',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { title, location, startDate, endDate, targetBags, coverImageUrl } = req.body;
        const existing = db.prepare('SELECT * FROM Campaign WHERE id = ?').get(id) as
          | {
              id: string;
              title: string;
              location: string;
              startDate: string;
              endDate: string;
              targetBags: number;
              coverImageUrl: string | null;
            }
          | undefined;
        if (!existing) {
          res.status(404).json({ error: 'Campaign not found.' });
          return;
        }

        db.prepare(`
          UPDATE Campaign
          SET title = ?, location = ?, startDate = ?, endDate = ?, targetBags = ?, coverImageUrl = ?
          WHERE id = ?
        `).run(
          title ? String(title).trim() : existing.title,
          location ? String(location).trim() : existing.location,
          startDate ? String(startDate) : existing.startDate,
          endDate ? String(endDate) : existing.endDate,
          targetBags ? Number(targetBags) : existing.targetBags,
          coverImageUrl !== undefined ? coverImageUrl : existing.coverImageUrl,
          id
        );

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'CAMPAIGN_UPDATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Updated campaign settings for "${title || existing.title}"`,
          new Date().toISOString()
        );

        res.json({ message: 'Campaign settings updated.' });
      } catch {
        res.status(400).json({ error: 'Failed to update campaign.' });
      }
    }
  );

  app.post(
    '/api/staff/donations/rapid-entry',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          donorName,
          phone,
          bloodGroup,
          age,
          weightKg,
          hemoglobin,
          donationDate,
          volumeMl,
          bagNumber,
          campaignId,
          unit,
          notes,
        } = req.body;

        const check = validateRapidDonationEntry({
          donorName,
          phone,
          bloodGroup,
          age,
          weightKg,
          hemoglobin,
          volumeMl,
        });

        if (!check.valid) {
          res.status(400).json({ error: check.error });
          return;
        }

        const cleanPhone = String(phone).replace(/\s+/g, '');
        const parsedDate =
          donationDate && String(donationDate).trim()
            ? String(donationDate).split('T')[0]
            : new Date().toISOString().split('T')[0];
        const numWeight = Number(weightKg);
        const numVolume = Number(volumeMl) || 450;
        const numHb = hemoglobin ? Number(hemoglobin) : null;
        const nowIso = new Date().toISOString();

        const runRapidEntryTx = db.transaction(() => {
          let donor = db
            .prepare('SELECT * FROM User WHERE phone = ?')
            .get(cleanPhone) as DbUser | undefined;
          let wasNewAccount = false;

          if (!donor) {
            wasNewAccount = true;
            const newUserId = crypto.randomUUID();
            const defaultPassHash = bcrypt.hashSync(cleanPhone, 10);
            const approxBirthYear = new Date().getUTCFullYear() - (parseInt(String(age), 10) || 22);
            const generatedEmail = `walkin.${cleanPhone}.${Date.now().toString().slice(-4)}@sandhanirmc.org`;

            db.prepare(`
              INSERT INTO User (id, name, email, phone, passwordHash, role, bloodGroup, dob, gender, unit, lastDonationDate, isAvailable, createdAt)
              VALUES (?, ?, ?, ?, ?, 'DONOR', ?, ?, 'Unspecified', ?, ?, 1, ?)
            `).run(
              newUserId,
              String(donorName).trim(),
              generatedEmail,
              cleanPhone,
              defaultPassHash,
              bloodGroup,
              `${approxBirthYear}-01-01`,
              unit || 'Rajshahi Medical College (RMC Unit)',
              parsedDate,
              nowIso
            );
            donor = db.prepare('SELECT * FROM User WHERE id = ?').get(newUserId) as DbUser;
          } else {
            const shouldUpdateLastDate =
              !donor.lastDonationDate || parsedDate >= donor.lastDonationDate;
            db.prepare(`
              UPDATE User
              SET lastDonationDate = ?, bloodGroup = ?
              WHERE id = ?
            `).run(
              shouldUpdateLastDate ? parsedDate : donor.lastDonationDate,
              bloodGroup || donor.bloodGroup,
              donor.id
            );
            donor = db.prepare('SELECT * FROM User WHERE id = ?').get(donor.id) as DbUser;
          }

          const generatedBag =
            bagNumber && String(bagNumber).trim()
              ? String(bagNumber).trim()
              : `SRMC-BAG-${parsedDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;

          const recordId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO DonationRecord (id, userId, campaignId, donationDate, bagNumber, volumeMl, weightKg, hemoglobin, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            recordId,
            donor.id,
            campaignId || null,
            parsedDate,
            generatedBag,
            numVolume,
            numWeight,
            numHb,
            notes
              ? String(notes).trim()
              : `Logged via Rapid On-Site Entry by ${req.user!.name}`
          );

          // Also add collected bag directly into the Blood Fridge Inventory!
          db.prepare(`
            INSERT OR IGNORE INTO FridgeBloodBag (id, serialNumber, bloodGroup, collectionDate, expiryDate, volumeMl, donorName, compartment, status, notes, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Fridge-1 · Camp Intake Rack', 'IN_FRIDGE', ?, ?)
          `).run(
            crypto.randomUUID(),
            generatedBag,
            donor.bloodGroup,
            parsedDate,
            computeBagExpiryDate(parsedDate, 35),
            numVolume,
            donor.name,
            `Collected via Rapid Entry (${numWeight}kg)`,
            nowIso
          );

          db.prepare(`
            INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
            VALUES (?, ?, ?, 'RAPID_DONATION_RECORDED', ?, ?)
          `).run(
            crypto.randomUUID(),
            req.user!.id,
            req.user!.name,
            `Logged ${numVolume}ml (${donor.bloodGroup}) from ${donor.name} (${donor.phone}) [Bag: ${generatedBag}] & stored in Fridge`,
            nowIso
          );

          return { donor, generatedBag, wasNewAccount };
        });

        const txResult = runRapidEntryTx();
        res.status(201).json({
          message: txResult.wasNewAccount
            ? `Auto-created donor profile for ${txResult.donor.name} and stored bag ${txResult.generatedBag} in fridge.`
            : `Logged donation bag ${txResult.generatedBag} for ${txResult.donor.name} and added to fridge inventory.`,
          wasNewAccount: txResult.wasNewAccount,
          bagNumber: txResult.generatedBag,
        });
      } catch (err) {
        console.error('Rapid entry error:', err);
        res.status(500).json({ error: 'Failed to record on-site donation.' });
      }
    }
  );

  // ==========================================================================
  // D. SUPER ADMIN SETTINGS PANEL API (/api/admin/*)
  // ==========================================================================
  app.get(
    '/api/admin/overview',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        const cooldownDays = getConfiguredCooldownDays();
        const users = db
          .prepare(`
            SELECT u.*, (SELECT COUNT(*) FROM DonationRecord dr WHERE dr.userId = u.id) as donationsCount
            FROM User u
            ORDER BY u.createdAt DESC
          `)
          .all() as (DbUser & { donationsCount: number })[];

        const settingsRows = db.prepare('SELECT key, value FROM SystemSetting').all() as {
          key: string;
          value: string;
        }[];
        const auditLogs = db
          .prepare('SELECT * FROM AuditLog ORDER BY createdAt DESC LIMIT 35')
          .all();
        const photos = db
          .prepare('SELECT * FROM GalleryPhoto ORDER BY createdAt DESC LIMIT 20')
          .all();
        const requisitions = db
          .prepare('SELECT * FROM EmergencyRequest ORDER BY createdAt DESC')
          .all();
        const membersDirectory = db
          .prepare('SELECT * FROM SandhaniMemberProfile ORDER BY createdAt ASC')
          .all();
        const vaccines = db
          .prepare('SELECT * FROM VaccineCatalog ORDER BY priceBdt ASC')
          .all();
        const fridgeBags = db
          .prepare('SELECT * FROM FridgeBloodBag ORDER BY collectionDate DESC')
          .all() as FridgeBagRecord[];
        const fridgeSummary = computeFridgeInventorySummary(fridgeBags, new Date());

        const settingsMap: Record<string, string> = {};
        for (const s of settingsRows) {
          settingsMap[s.key] = s.value;
        }

        res.json({
          users: users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            bloodGroup: u.bloodGroup,
            unit: u.unit || 'Rajshahi Medical College (RMC Unit)',
            donationsCount: u.donationsCount,
            createdAt: u.createdAt.split('T')[0],
          })),
          settings: {
            helplinePrimary: settingsMap.helpline_primary || '01721-773080',
            helplineSecondary: settingsMap.helpline_secondary || '025888-57150',
            emergencyBroadcast: settingsMap.emergency_broadcast || '',
            cooldownDays,
            googleSheetId: settingsMap.google_sheet_id || '',
            unitsList: settingsMap.units_list ? JSON.parse(settingsMap.units_list) : [],
          },
          photos,
          requisitions,
          membersDirectory,
          vaccines,
          fridgeBags,
          fridgeSummary,
          auditLogs,
        });
      } catch {
        res.status(500).json({ error: 'Failed to load Super Admin control panel.' });
      }
    }
  );

  // Backup Snapshot Endpoint for Google Sheets Sync & Local Export
  app.get(
    '/api/admin/backup-snapshot',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        const users = db.prepare('SELECT * FROM User ORDER BY createdAt DESC').all() as DbUser[];
        const requisitions = db
          .prepare('SELECT * FROM EmergencyRequest ORDER BY createdAt DESC')
          .all() as any[];
        const fridgeBags = db
          .prepare('SELECT * FROM FridgeBloodBag ORDER BY collectionDate DESC')
          .all() as any[];
        const vaccines = db
          .prepare('SELECT * FROM VaccineCatalog ORDER BY priceBdt ASC')
          .all() as any[];
        const members = db
          .prepare('SELECT * FROM SandhaniMemberProfile ORDER BY createdAt ASC')
          .all() as any[];

        res.json({
          generatedAt: new Date().toISOString(),
          donors: users.map((u) => ({
            name: u.name,
            bloodGroup: u.bloodGroup,
            phone: u.phone,
            email: u.email,
            unit: u.unit || 'Rajshahi Medical College (RMC Unit)',
            lastDonationDate: u.lastDonationDate,
            isAvailable: Boolean(u.isAvailable),
          })),
          requisitions: requisitions.map((r) => ({
            id: r.id,
            patient: r.patient,
            bloodGroup: r.bloodGroup,
            units: r.units,
            hospital: r.hospital,
            urgency: r.urgency,
            phone: r.phone,
            status: r.status,
            createdAt: r.createdAt.split('T')[0],
          })),
          fridgeBags: fridgeBags.map((b) => ({
            serialNumber: b.serialNumber,
            bloodGroup: b.bloodGroup,
            collectionDate: b.collectionDate,
            expiryDate: b.expiryDate,
            volumeMl: b.volumeMl,
            compartment: b.compartment,
            status: b.status,
          })),
          vaccines: vaccines.map((v) => ({
            name: v.name,
            priceBdt: v.priceBdt,
            totalDoses: v.totalDoses,
            stockCount: v.stockCount,
            scheduleText: v.scheduleText,
          })),
          members: members.map((m) => ({
            name: m.name,
            designation: m.designation,
            phone: m.phone,
            bloodGroup: m.bloodGroup,
            batch: m.batch,
          })),
        });
      } catch {
        res.status(500).json({ error: 'Failed to build backup snapshot.' });
      }
    }
  );

  // Admin: Sandhani Member Directory CRUD (Add name, phone, designation, batch, bloodGroup, photoUrl)
  app.post(
    '/api/admin/members',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { name, phone, designation, batch, bloodGroup, photoUrl } = req.body;
        if (!name || !phone || !designation) {
          res.status(400).json({
            error: 'Member Name, Phone Number, and Committee Designation are required.',
          });
          return;
        }
        const initials = String(name)
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('');
        const finalPhoto =
          photoUrl && String(photoUrl).trim()
            ? String(photoUrl).trim()
            : buildMemberAvatarSvg(initials || 'SM', '#7F1D1D', '#F87171');
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        db.prepare(`
          INSERT INTO SandhaniMemberProfile (id, name, phone, designation, batch, bloodGroup, photoUrl, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          String(name).trim(),
          String(phone).trim(),
          String(designation).trim(),
          batch ? String(batch).trim() : 'RMC Unit Volunteer',
          bloodGroup || 'O+',
          finalPhoto,
          nowIso
        );

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'MEMBER_PROFILE_ADDED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Added Sandhani member ${name} (${designation} · ${phone})`,
          nowIso
        );

        res.status(201).json({ message: `Added ${name} to Sandhani Member Directory.` });
      } catch {
        res.status(500).json({ error: 'Failed to add member profile.' });
      }
    }
  );

  app.delete(
    '/api/admin/members/:id',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        db.prepare('DELETE FROM SandhaniMemberProfile WHERE id = ?').run(id);
        res.json({ message: 'Member removed from directory.' });
      } catch {
        res.status(400).json({ error: 'Failed to remove member.' });
      }
    }
  );

  // Admin & Staff: Update Vaccine Price, Stock, Doses, or Add New Vaccine
  app.put(
    '/api/admin/vaccines/:id',
    authenticate,
    requireRole(['SANDHANI_MEMBER', 'SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { name, priceBdt, totalDoses, scheduleText, stockCount } = req.body;
        const existing = db.prepare('SELECT * FROM VaccineCatalog WHERE id = ?').get(id) as
          | {
              id: string;
              name: string;
              priceBdt: number;
              totalDoses: number;
              scheduleText: string;
              stockCount: number;
            }
          | undefined;

        if (!existing) {
          res.status(404).json({ error: 'Vaccine not found.' });
          return;
        }

        const nextPrice =
          priceBdt !== undefined ? Math.max(0, Number(priceBdt)) : existing.priceBdt;
        const nextStock =
          stockCount !== undefined ? Math.max(0, Number(stockCount)) : existing.stockCount;
        const nextDoses =
          totalDoses !== undefined ? Math.max(1, Number(totalDoses)) : existing.totalDoses;
        const nextSched =
          scheduleText !== undefined ? String(scheduleText).trim() : existing.scheduleText;
        const nextName = name !== undefined ? String(name).trim() : existing.name;
        const nowIso = new Date().toISOString();

        db.prepare(`
          UPDATE VaccineCatalog
          SET name = ?, priceBdt = ?, totalDoses = ?, scheduleText = ?, stockCount = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextName, nextPrice, nextDoses, nextSched, nextStock, nowIso, id);

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'VACCINE_CATALOG_UPDATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Updated ${nextName}: Price ৳${nextPrice}, Stock ${nextStock} doses, ${nextDoses} total doses`,
          nowIso
        );

        res.json({
          message: `Updated ${nextName} (Price: ৳${nextPrice} · Stock: ${nextStock} doses).`,
        });
      } catch {
        res.status(400).json({ error: 'Failed to update vaccine details.' });
      }
    }
  );

  app.post(
    '/api/admin/vaccines',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          name,
          manufacturer,
          targetDisease,
          priceBdt,
          totalDoses,
          scheduleText,
          intervalDays,
          stockCount,
        } = req.body;
        if (!name || priceBdt === undefined) {
          res.status(400).json({ error: 'Vaccine Name and Price (BDT) are required.' });
          return;
        }
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        db.prepare(`
          INSERT INTO VaccineCatalog (id, name, manufacturer, targetDisease, priceBdt, totalDoses, scheduleText, intervalDays, stockCount, storageTemp, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2°C–8°C Cold Chain', ?)
        `).run(
          id,
          String(name).trim(),
          manufacturer ? String(manufacturer).trim() : 'Sandhani Immunization Partner',
          targetDisease ? String(targetDisease).trim() : 'Preventable Infectious Disease',
          Math.max(0, Number(priceBdt) || 0),
          Math.max(1, Number(totalDoses) || 1),
          scheduleText ? String(scheduleText).trim() : 'Standard Clinical Dose Schedule',
          Math.max(1, Number(intervalDays) || 30),
          Math.max(0, Number(stockCount) || 50),
          nowIso
        );
        res.status(201).json({ message: `Added ${name} to Vaccine Catalog.` });
      } catch {
        res.status(500).json({ error: 'Failed to add vaccine.' });
      }
    }
  );

  app.patch(
    '/api/admin/users/:id/role',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { role, unit } = req.body as { role?: Role; unit?: string };
        const validRoles: Role[] = ['SUPER_ADMIN', 'SANDHANI_MEMBER', 'DONOR'];
        if (role && !validRoles.includes(role)) {
          res.status(400).json({ error: 'Invalid RBAC role specified.' });
          return;
        }

        const target = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as DbUser | undefined;
        if (!target) {
          res.status(404).json({ error: 'User not found.' });
          return;
        }

        const nextRole = role || target.role;
        const nextUnit = typeof unit === 'string' && unit.trim() ? unit.trim() : target.unit;

        db.prepare('UPDATE User SET role = ?, unit = ? WHERE id = ?').run(nextRole, nextUnit, id);

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'USER_ROLE_UPDATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Assigned role ${nextRole} to ${target.name} (${target.email}) [Unit: ${nextUnit}]`,
          new Date().toISOString()
        );

        res.json({
          message: `Updated ${target.name}'s role to ${nextRole}.`,
          user: { id, role: nextRole, unit: nextUnit },
        });
      } catch {
        res.status(400).json({ error: 'Failed to update user role.' });
      }
    }
  );

  app.delete(
    '/api/admin/users/:id',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        if (id === req.user!.id) {
          res.status(400).json({ error: 'Cannot delete your own active Super Admin account.' });
          return;
        }
        const target = db.prepare('SELECT * FROM User WHERE id = ?').get(id) as DbUser | undefined;
        if (!target) {
          res.status(404).json({ error: 'User not found.' });
          return;
        }

        db.prepare('DELETE FROM User WHERE id = ?').run(id);
        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'USER_DELETED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Removed user ${target.name} (${target.email}) from database`,
          new Date().toISOString()
        );

        res.json({ message: `Deleted user ${target.name}.` });
      } catch {
        res.status(400).json({ error: 'Failed to delete user.' });
      }
    }
  );

  app.put(
    '/api/admin/settings',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          helplinePrimary,
          helplineSecondary,
          emergencyBroadcast,
          cooldownDays,
          googleSheetId,
          unitsList,
        } = req.body;
        const nowIso = new Date().toISOString();

        const parsedCooldown = Math.max(
          1,
          Math.min(365, parseInt(String(cooldownDays || 90), 10) || 90)
        );

        const upsert = db.prepare(`
          INSERT INTO SystemSetting (key, value, updatedAt)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
        `);

        upsert.run('helpline_primary', String(helplinePrimary || '01721-773080').trim(), nowIso);
        upsert.run('helpline_secondary', String(helplineSecondary || '025888-57150').trim(), nowIso);
        upsert.run('emergency_broadcast', String(emergencyBroadcast || '').trim(), nowIso);
        upsert.run('cooldown_days', String(parsedCooldown), nowIso);
        if (googleSheetId !== undefined) {
          upsert.run('google_sheet_id', String(googleSheetId).trim(), nowIso);
        }
        upsert.run(
          'units_list',
          JSON.stringify(
            Array.isArray(unitsList)
              ? unitsList.map((u) => String(u).trim()).filter(Boolean)
              : []
          ),
          nowIso
        );

        db.prepare(`
          INSERT INTO AuditLog (id, actorId, actorName, action, details, createdAt)
          VALUES (?, ?, ?, 'SYSTEM_SETTINGS_UPDATED', ?, ?)
        `).run(
          crypto.randomUUID(),
          req.user!.id,
          req.user!.name,
          `Updated medical cooldown rule to ${parsedCooldown} days, helpline (${helplinePrimary}), and broadcast banner.`,
          nowIso
        );

        res.json({
          message: `Organization settings saved! Medical cooldown rule is now ${parsedCooldown} days.`,
          cooldownDays: parsedCooldown,
        });
      } catch {
        res.status(500).json({ error: 'Failed to update organization settings.' });
      }
    }
  );

  app.delete(
    '/api/admin/photos/:id',
    authenticate,
    requireRole(['SUPER_ADMIN']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        db.prepare('DELETE FROM GalleryPhoto WHERE id = ?').run(id);
        res.json({ message: 'Photo removed from official gallery.' });
      } catch {
        res.status(400).json({ error: 'Failed to remove photo.' });
      }
    }
  );

  // ==========================================================================
  // VITE MIDDLEWARE (DEVELOPMENT) OR STATIC SERVING (PRODUCTION)
  // ==========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sandhani RMC Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
