export type Role = 'SUPER_ADMIN' | 'SANDHANI_MEMBER' | 'DONOR';

export const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof VALID_BLOOD_GROUPS)[number];

export const DEFAULT_COOLDOWN_DAYS = 90; // Default Bangladesh clinical whole blood interval (configurable by Super Admin)
export const MIN_DONOR_WEIGHT_KG = 45;
export const CPDA1_SHELF_LIFE_DAYS = 35; // Standard whole-blood refrigerator shelf life (2°C–6°C)

export interface MedicalEligibilityResult {
  lastDonationDate: string | null;
  daysElapsed: number | null;
  daysRemaining: number;
  cooldownDays: number;
  isEligible: boolean;
  isUpcomingWindow: boolean; // Cooldown expiring within 1 to 30 days
  nextEligibleDate: string;
  badgeText: string;
  badgeColor: 'GREEN' | 'ORANGE';
}

/**
 * Computes automated whole blood donation eligibility using a configurable cooldown interval (default 90 days).
 */
export function computeMedicalEligibility(
  lastDonationDateInput: string | Date | null | undefined,
  referenceDate: Date = new Date(),
  cooldownDaysInput: number = DEFAULT_COOLDOWN_DAYS
): MedicalEligibilityResult {
  const cooldownDays =
    Number.isFinite(cooldownDaysInput) && cooldownDaysInput >= 1
      ? Math.round(cooldownDaysInput)
      : DEFAULT_COOLDOWN_DAYS;

  const refIso = referenceDate.toISOString().split('T')[0];

  if (!lastDonationDateInput) {
    return {
      lastDonationDate: null,
      daysElapsed: null,
      daysRemaining: 0,
      cooldownDays,
      isEligible: true,
      isUpcomingWindow: false,
      nextEligibleDate: refIso,
      badgeText: 'Eligible to Donate',
      badgeColor: 'GREEN',
    };
  }

  const lastDate = new Date(lastDonationDateInput);
  if (Number.isNaN(lastDate.getTime())) {
    return {
      lastDonationDate: null,
      daysElapsed: null,
      daysRemaining: 0,
      cooldownDays,
      isEligible: true,
      isUpcomingWindow: false,
      nextEligibleDate: refIso,
      badgeText: 'Eligible to Donate',
      badgeColor: 'GREEN',
    };
  }

  // Normalize both dates to UTC midnight for exact calendar-day arithmetic
  const refUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
  const lastUtc = Date.UTC(
    lastDate.getUTCFullYear(),
    lastDate.getUTCMonth(),
    lastDate.getUTCDate()
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.max(0, Math.floor((refUtc - lastUtc) / msPerDay));
  const daysRemaining = Math.max(0, cooldownDays - daysElapsed);
  const nextEligibleObj = new Date(lastUtc + cooldownDays * msPerDay);
  const nextEligibleDate = nextEligibleObj.toISOString().split('T')[0];
  const isEligible = daysElapsed >= cooldownDays;
  const isUpcomingWindow = !isEligible && daysRemaining >= 1 && daysRemaining <= 30;

  return {
    lastDonationDate: new Date(lastUtc).toISOString().split('T')[0],
    daysElapsed,
    daysRemaining,
    cooldownDays,
    isEligible,
    isUpcomingWindow,
    nextEligibleDate,
    badgeText: isEligible ? 'Eligible to Donate' : `Eligible in ${daysRemaining} Days`,
    badgeColor: isEligible ? 'GREEN' : 'ORANGE',
  };
}

export interface MonthlyVolumePoint {
  monthKey: string; // "2026-06"
  monthLabel: string; // "Jun 26"
  totalVolumeMl: number;
  donationsCount: number;
}

/**
 * Computes a 12-month time series of blood donation volume (ml) and bag counts ending at referenceDate's month.
 */
export function computeTwelveMonthDonationTrends(
  donations: { donationDate: string; volumeMl: number }[],
  referenceDate: Date = new Date()
): MonthlyVolumePoint[] {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const points: MonthlyVolumePoint[] = [];
  const map = new Map<string, MonthlyVolumePoint>();

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();

  for (let offset = 11; offset >= 0; offset--) {
    const d = new Date(Date.UTC(refYear, refMonth - offset, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = `${monthNames[m]} '${String(y).slice(-2)}`;
    const pt: MonthlyVolumePoint = {
      monthKey: key,
      monthLabel: label,
      totalVolumeMl: 0,
      donationsCount: 0,
    };
    points.push(pt);
    map.set(key, pt);
  }

  for (const item of donations) {
    if (!item.donationDate) continue;
    const key = item.donationDate.slice(0, 7);
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalVolumeMl += Number(item.volumeMl) || 450;
      bucket.donationsCount += 1;
    }
  }

  return points;
}

export interface FridgeBagRecord {
  id: string;
  serialNumber: string;
  bloodGroup: string;
  collectionDate: string;
  expiryDate?: string | null;
  volumeMl: number;
  donorName?: string | null;
  compartment?: string | null;
  status: 'IN_FRIDGE' | 'ISSUED' | 'EXPIRED';
}

export interface FridgeSummaryResult {
  totalInFridge: number;
  totalVolumeMl: number;
  byBloodGroup: Record<BloodGroup, number>;
  expiringSoonCount: number;
}

/**
 * Computes live blood fridge inventory counts by blood group and flags bags expiring within 7 days.
 */
export function computeFridgeInventorySummary(
  bags: FridgeBagRecord[],
  referenceDate: Date = new Date()
): FridgeSummaryResult {
  const byBloodGroup: Record<BloodGroup, number> = {
    'A+': 0,
    'A-': 0,
    'B+': 0,
    'B-': 0,
    'AB+': 0,
    'AB-': 0,
    'O+': 0,
    'O-': 0,
  };

  let totalInFridge = 0;
  let totalVolumeMl = 0;
  let expiringSoonCount = 0;

  const refUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
  const msPerDay = 1000 * 60 * 60 * 24;

  for (const bag of bags) {
    if (bag.status !== 'IN_FRIDGE') continue;
    totalInFridge += 1;
    totalVolumeMl += Number(bag.volumeMl) || 450;
    if (VALID_BLOOD_GROUPS.includes(bag.bloodGroup as BloodGroup)) {
      byBloodGroup[bag.bloodGroup as BloodGroup] += 1;
    }

    const expDateStr =
      bag.expiryDate ||
      computeBagExpiryDate(bag.collectionDate, CPDA1_SHELF_LIFE_DAYS);
    const expDate = new Date(expDateStr);
    if (!Number.isNaN(expDate.getTime())) {
      const expUtc = Date.UTC(
        expDate.getUTCFullYear(),
        expDate.getUTCMonth(),
        expDate.getUTCDate()
      );
      const daysLeft = Math.floor((expUtc - refUtc) / msPerDay);
      if (daysLeft <= 7) {
        expiringSoonCount += 1;
      }
    }
  }

  return {
    totalInFridge,
    totalVolumeMl,
    byBloodGroup,
    expiringSoonCount,
  };
}

export function computeBagExpiryDate(
  collectionDateIso: string,
  shelfLifeDays: number = CPDA1_SHELF_LIFE_DAYS
): string {
  const d = new Date(collectionDateIso);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + shelfLifeDays);
    return fallback.toISOString().split('T')[0];
  }
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const exp = new Date(utc + shelfLifeDays * 24 * 60 * 60 * 1000);
  return exp.toISOString().split('T')[0];
}

export interface VaccineDoseScheduleOutcome {
  doseNumber: number;
  totalDoses: number;
  isSeriesCompleted: boolean;
  nextDoseDate: string | null;
  statusLabel: string;
}

/**
 * Computes next scheduled vaccine dose date and series completion status.
 */
export function computeVaccineScheduleStatus(
  doseNumber: number,
  totalDoses: number,
  administeredDateIso: string,
  intervalDays: number = 30
): VaccineDoseScheduleOutcome {
  const safeDose = Math.max(1, Math.round(Number(doseNumber) || 1));
  const safeTotal = Math.max(safeDose, Math.round(Number(totalDoses) || 3));
  const isSeriesCompleted = safeDose >= safeTotal;

  if (isSeriesCompleted) {
    return {
      doseNumber: safeDose,
      totalDoses: safeTotal,
      isSeriesCompleted: true,
      nextDoseDate: null,
      statusLabel: `Completed (${safeDose}/${safeTotal} Doses)`,
    };
  }

  const d = new Date(administeredDateIso);
  const baseUtc = Number.isNaN(d.getTime())
    ? Date.now()
    : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const nextObj = new Date(baseUtc + Math.max(1, intervalDays) * 24 * 60 * 60 * 1000);
  const nextDoseDate = nextObj.toISOString().split('T')[0];

  return {
    doseNumber: safeDose,
    totalDoses: safeTotal,
    isSeriesCompleted: false,
    nextDoseDate,
    statusLabel: `Dose ${safeDose}/${safeTotal} Given · Next: ${nextDoseDate}`,
  };
}

/**
 * Privacy masking for public and general donor views.
 */
export function maskDonorPhone(phone: string): string {
  const cleaned = String(phone || '').trim();
  if (cleaned.length < 5) return 'XXXXX-XXXXXX';
  return `${cleaned.slice(0, 5)}-XXXXXX`;
}

export interface RapidEntryInput {
  donorName?: string;
  phone?: string;
  bloodGroup?: string;
  age?: number | string;
  weightKg?: number | string;
  hemoglobin?: number | string | null;
  volumeMl?: number | string;
}

export interface ValidationOutcome {
  valid: boolean;
  error?: string;
}

export function validateRapidDonationEntry(input: RapidEntryInput): ValidationOutcome {
  if (!input.donorName || !String(input.donorName).trim()) {
    return { valid: false, error: 'Donor full name is required.' };
  }
  if (!input.phone || String(input.phone).replace(/\s+/g, '').length < 8) {
    return { valid: false, error: 'Valid donor phone number is required.' };
  }
  if (!input.bloodGroup || !VALID_BLOOD_GROUPS.includes(input.bloodGroup as BloodGroup)) {
    return { valid: false, error: 'Valid blood group (A+, A-, B+, B-, AB+, AB-, O+, O-) is required.' };
  }
  const weight = Number(input.weightKg);
  if (Number.isNaN(weight) || weight < MIN_DONOR_WEIGHT_KG) {
    return {
      valid: false,
      error: `Clinical Safety Rule: Donor weight must be at least ${MIN_DONOR_WEIGHT_KG} kg for safe whole blood collection.`,
    };
  }
  if (input.age !== undefined && input.age !== '') {
    const ageNum = Number(input.age);
    if (Number.isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      return {
        valid: false,
        error: 'Clinical Safety Rule: Donor age must be between 18 and 65 years.',
      };
    }
  }
  return { valid: true };
}

export interface FilterableDonor {
  name: string;
  phone?: string;
  email?: string;
  bloodGroup: string;
  unit: string;
  isEligible: boolean;
  isAvailable: boolean;
}

export interface DonorDirectoryFilter {
  bloodGroup?: string;
  unit?: string;
  status?: 'ALL' | 'ELIGIBLE' | 'INELIGIBLE' | 'UNAVAILABLE';
  search?: string;
}

export function filterDonorDirectory<T extends FilterableDonor>(
  donors: T[],
  filter: DonorDirectoryFilter
): T[] {
  return donors.filter((d) => {
    if (filter.bloodGroup && filter.bloodGroup !== 'ALL') {
      if (filter.bloodGroup === 'RARE_NEGATIVE') {
        if (!d.bloodGroup.endsWith('-')) return false;
      } else if (d.bloodGroup !== filter.bloodGroup) {
        return false;
      }
    }
    if (filter.unit && filter.unit !== 'ALL' && filter.unit.trim() !== '') {
      if (!d.unit.toLowerCase().includes(filter.unit.trim().toLowerCase())) {
        return false;
      }
    }
    if (filter.status === 'ELIGIBLE' && !(d.isEligible && d.isAvailable)) {
      return false;
    }
    if (filter.status === 'INELIGIBLE' && d.isEligible) {
      return false;
    }
    if (filter.status === 'UNAVAILABLE' && d.isAvailable) {
      return false;
    }
    if (filter.search && filter.search.trim() !== '') {
      const q = filter.search.trim().toLowerCase();
      const hay = `${d.name} ${d.phone || ''} ${d.email || ''} ${d.unit} ${d.bloodGroup}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
