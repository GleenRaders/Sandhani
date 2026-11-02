import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMedicalEligibility,
  computeTwelveMonthDonationTrends,
  computeFridgeInventorySummary,
  computeVaccineScheduleStatus,
  validateRapidDonationEntry,
  maskDonorPhone,
  filterDonorDirectory,
} from './medicalRules';

test('computeMedicalEligibility marks donor with >= 90 days elapsed as GREEN / Eligible to Donate', () => {
  const ref = new Date('2026-11-01T00:00:00Z');
  const res = computeMedicalEligibility('2026-07-20', ref, 90);
  assert.equal(res.isEligible, true);
  assert.equal(res.badgeColor, 'GREEN');
  assert.equal(res.badgeText, 'Eligible to Donate');
  assert.equal(res.daysElapsed, 104);
});

test('computeMedicalEligibility supports custom admin-configured cooldown interval (e.g. 120 days)', () => {
  const ref = new Date('2026-11-01T00:00:00Z');
  const res = computeMedicalEligibility('2026-07-20', ref, 120);
  assert.equal(res.isEligible, false);
  assert.equal(res.cooldownDays, 120);
  assert.equal(res.daysRemaining, 16);
  assert.equal(res.badgeColor, 'ORANGE');
  assert.equal(res.badgeText, 'Eligible in 16 Days');
});

test('computeTwelveMonthDonationTrends builds 12 ordered monthly buckets and sums volumeMl accurately', () => {
  const ref = new Date('2026-11-15T00:00:00Z');
  const series = computeTwelveMonthDonationTrends(
    [
      { donationDate: '2026-11-02', volumeMl: 450 },
      { donationDate: '2026-11-10', volumeMl: 450 },
      { donationDate: '2026-08-14', volumeMl: 500 },
    ],
    ref
  );
  assert.equal(series.length, 12);
  assert.equal(series[0].monthKey, '2025-12');
  assert.equal(series[11].monthKey, '2026-11');
  assert.equal(series[11].totalVolumeMl, 900);
  assert.equal(series[11].donationsCount, 2);
});

test('computeFridgeInventorySummary counts active fridge bags by blood group and flags expiring bags', () => {
  const ref = new Date('2026-11-01T00:00:00Z');
  const summary = computeFridgeInventorySummary(
    [
      {
        id: '1',
        serialNumber: 'SRMC-BAG-101',
        bloodGroup: 'O+',
        collectionDate: '2026-10-25',
        expiryDate: '2026-11-29',
        volumeMl: 450,
        status: 'IN_FRIDGE',
      },
      {
        id: '2',
        serialNumber: 'SRMC-BAG-102',
        bloodGroup: 'O-',
        collectionDate: '2026-10-01',
        expiryDate: '2026-11-05', // 4 days left -> expiringSoon
        volumeMl: 450,
        status: 'IN_FRIDGE',
      },
      {
        id: '3',
        serialNumber: 'SRMC-BAG-103',
        bloodGroup: 'O+',
        collectionDate: '2026-10-10',
        expiryDate: '2026-11-14',
        volumeMl: 450,
        status: 'ISSUED',
      },
    ],
    ref
  );
  assert.equal(summary.totalInFridge, 2);
  assert.equal(summary.totalVolumeMl, 900);
  assert.equal(summary.byBloodGroup['O+'], 1);
  assert.equal(summary.byBloodGroup['O-'], 1);
  assert.equal(summary.expiringSoonCount, 1);
});

test('computeVaccineScheduleStatus computes next dose date and series completion', () => {
  const dose1 = computeVaccineScheduleStatus(1, 3, '2026-11-01', 30);
  assert.equal(dose1.isSeriesCompleted, false);
  assert.equal(dose1.nextDoseDate, '2026-12-01');

  const dose3 = computeVaccineScheduleStatus(3, 3, '2026-11-01', 30);
  assert.equal(dose3.isSeriesCompleted, true);
  assert.equal(dose3.nextDoseDate, null);
});

test('validateRapidDonationEntry enforces >= 45kg weight requirement and valid blood group', () => {
  const underweight = validateRapidDonationEntry({
    donorName: 'Test Donor',
    phone: '01711223344',
    bloodGroup: 'O+',
    age: 22,
    weightKg: 42,
  });
  assert.equal(underweight.valid, false);

  const valid = validateRapidDonationEntry({
    donorName: 'Test Donor',
    phone: '01711223344',
    bloodGroup: 'O-',
    age: 23,
    weightKg: 58,
  });
  assert.equal(valid.valid, true);
});

test('maskDonorPhone redacts private digits for public/donor role isolation', () => {
  assert.equal(maskDonorPhone('01721773080'), '01721-XXXXXX');
});

test('filterDonorDirectory filters rare negative groups and eligibility accurately', () => {
  const sample = [
    { name: 'A', bloodGroup: 'O-', unit: 'Rajshahi Medical College', isEligible: true, isAvailable: true },
    { name: 'B', bloodGroup: 'A+', unit: 'Dhaka Medical College', isEligible: true, isAvailable: true },
    { name: 'C', bloodGroup: 'B-', unit: 'Rajshahi Medical College', isEligible: false, isAvailable: true },
  ];
  const rareEligible = filterDonorDirectory(sample, {
    bloodGroup: 'RARE_NEGATIVE',
    status: 'ELIGIBLE',
  });
  assert.equal(rareEligible.length, 1);
  assert.equal(rareEligible[0].name, 'A');
});
