import {
  Role,
  MedicalEligibilityResult,
  MonthlyVolumePoint,
  FridgeSummaryResult,
} from './utils/medicalRules';

export type ActivePortalView = 'PUBLIC' | 'DONOR' | 'STAFF' | 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  bloodGroup: string;
  dob: string;
  gender: string;
  unit: string;
  isAvailable: boolean;
  eligibility: MedicalEligibilityResult;
}

export interface GalleryPhotoItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
}

export interface SandhaniMemberDirectoryItem {
  id: string;
  name: string;
  phone: string;
  designation: string;
  batch: string;
  bloodGroup: string;
  photoUrl: string;
  createdAt: string;
}

export interface FridgeBagItem {
  id: string;
  serialNumber: string;
  bloodGroup: string;
  collectionDate: string;
  expiryDate: string;
  volumeMl: number;
  donorName: string;
  compartment: string;
  status: 'IN_FRIDGE' | 'ISSUED' | 'EXPIRED';
  notes: string;
  createdAt: string;
}

export interface VaccineCatalogItem {
  id: string;
  name: string;
  manufacturer: string;
  targetDisease: string;
  priceBdt: number;
  totalDoses: number;
  scheduleText: string;
  intervalDays: number;
  stockCount: number;
  storageTemp: string;
  updatedAt: string;
}

export interface VaccinationRecordItem {
  id: string;
  userId: string | null;
  patientName: string;
  patientPhone: string;
  bloodGroup: string;
  vaccineId: string;
  vaccineName: string;
  doseNumber: number;
  totalDoses: number;
  dateAdministered: string;
  nextDoseDate: string | null;
  certificateNo: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface BloodGroupBoardItem {
  group: string;
  bags: number;
  readyDonors: number;
  bnStatus: string;
}

export interface PublicDonorCard {
  id: string;
  name: string;
  bloodGroup: string;
  unit: string;
  isAvailable: boolean;
  eligibleNow: boolean;
  badgeText: string;
  badgeColor: 'GREEN' | 'ORANGE';
  lastDonationDate: string | null;
  nextEligibleDate: string;
  donationsCount: number;
  maskedPhone: string;
}

export type RequisitionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'OPEN' | 'FULFILLED';

export interface EmergencyRequestItem {
  id: string;
  patient: string;
  hospital: string;
  bloodGroup: string;
  units: number;
  urgency: string;
  phone: string;
  indication: string;
  status: string;
  requisitionPhotoUrl?: string | null;
  approvedBy?: string | null;
  fulfilledAt?: string | null;
  createdAt: string;
}

export interface EyePledgeItem {
  id: string;
  name: string;
  ageBg: string;
  phone: string;
  nid: string;
  kin: string;
  kinPhone: string;
  createdAt: string;
}

export interface OrganizationSettings {
  helplinePrimary: string;
  helplineSecondary: string;
  emergencyBroadcast: string;
  cooldownDays: number;
  googleSheetId?: string;
  unitsList: string[];
}

export interface PublicOverviewData {
  settings: OrganizationSettings;
  stats: {
    bloodUnits: number;
    donors: number;
    corneas: number;
    camps: number;
    fridgeBagsTotal: number;
    vaccineStockTotal: number;
  };
  board: BloodGroupBoardItem[];
  donors: PublicDonorCard[];
  emergencyRequests: EmergencyRequestItem[];
  eyePledges: EyePledgeItem[];
  photos: GalleryPhotoItem[];
  membersDirectory: SandhaniMemberDirectoryItem[];
  vaccines: VaccineCatalogItem[];
  fridgeSummary: FridgeSummaryResult;
}

export interface DonationRecordItem {
  id: string;
  donationDate: string;
  campaignTitle: string;
  location?: string;
  bagNumber: string;
  volumeMl: number;
  weightKg: number | null;
  hemoglobin: number | null;
  notes: string | null;
}

export interface StaffDonorRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  bloodGroup: string;
  dob: string | null;
  gender: string | null;
  unit: string;
  isAvailable: boolean;
  lastDonationDate: string | null;
  daysElapsed: number | null;
  daysRemaining: number;
  nextEligibleDate: string;
  isEligible: boolean;
  isUpcomingWindow: boolean;
  badgeText: string;
  badgeColor: 'GREEN' | 'ORANGE';
  donationsCount: number;
  donations: DonationRecordItem[];
}

export interface CampaignItem {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  targetBags: number;
  coverImageUrl?: string | null;
  collectedBags: number;
  totalVolumeMl: number;
  donations: {
    id: string;
    donationDate: string;
    bagNumber: string | null;
    volumeMl: number;
    weightKg: number | null;
    hemoglobin: number | null;
    donorName: string;
    donorBloodGroup: string;
    donorPhone: string;
  }[];
}

export interface StaffCampaignsResponse {
  campaigns: CampaignItem[];
  monthlyTrends: MonthlyVolumePoint[];
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  bloodGroup: string;
  unit: string;
  donationsCount: number;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  createdAt: string;
}
