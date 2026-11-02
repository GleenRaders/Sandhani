import React, { useEffect, useState } from 'react';
import {
  DonationRecordItem,
  UserProfile,
  VaccinationRecordItem,
  VaccineCatalogItem,
} from '../types';
import { MedicalEligibilityResult } from '../utils/medicalRules';

interface DonorPortalProps {
  token: string | null;
  onProfileUpdated: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const DonorPortal: React.FC<DonorPortalProps> = ({
  token,
  onProfileUpdated,
  onNotify,
}) => {
  const [profileMode, setProfileMode] = useState<'BLOOD_DONATION' | 'VACCINATION'>(
    'BLOOD_DONATION'
  );
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [eligibility, setEligibility] = useState<MedicalEligibilityResult | null>(null);
  const [donations, setDonations] = useState<DonationRecordItem[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecordItem[]>([]);
  const [vaccinesCatalog, setVaccinesCatalog] = useState<VaccineCatalogItem[]>([]);

  // Editable profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [unit, setUnit] = useState('');
  const [dob, setDob] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  // Vaccination Dose Booking / Logging Form
  const [selectedVaccineId, setSelectedVaccineId] = useState('');
  const [selectedDoseNum, setSelectedDoseNum] = useState('1');
  const [vaccineDate, setVaccineDate] = useState(new Date().toISOString().split('T')[0]);
  const [vaccineNotes, setVaccineNotes] = useState('');
  const [submittingVaccine, setSubmittingVaccine] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/donor/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load personal profile');
      const data = await res.json();
      setProfile(data.profile);
      setEligibility(data.eligibility);
      setDonations(data.donations || []);
      setVaccinations(data.vaccinations || []);
      setVaccinesCatalog(data.vaccinesCatalog || []);
      if (data.vaccinesCatalog?.length > 0 && !selectedVaccineId) {
        setSelectedVaccineId(data.vaccinesCatalog[0].id);
      }
      setName(data.profile.name);
      setPhone(data.profile.phone);
      setUnit(data.profile.unit);
      setDob(data.profile.dob || '');
      setIsAvailable(data.profile.isAvailable);
    } catch (err: any) {
      onNotify(err.message || 'Could not load profile', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/donor/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          phone,
          unit,
          dob,
          isAvailable,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setProfile(data.profile);
      onProfileUpdated();
      onNotify('Personal profile & contact preferences updated.');
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmergencyAvailability = async (nextVal: boolean) => {
    setIsAvailable(nextVal);
    try {
      const res = await fetch('/api/donor/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ isAvailable: nextVal }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        onProfileUpdated();
        onNotify(
          `Emergency call availability set to ${
            nextVal ? 'Available (Yes)' : 'Paused (No)'
          }.`
        );
      }
    } catch {
      onNotify('Failed to update availability toggle.', true);
    }
  };

  const handleRecordVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaccineId) return;
    setSubmittingVaccine(true);
    try {
      const res = await fetch('/api/donor/vaccinations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          vaccineId: selectedVaccineId,
          doseNumber: Number(selectedDoseNum),
          dateAdministered: vaccineDate,
          notes: vaccineNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log vaccination');
      onNotify(data.message);
      setVaccineNotes('');
      await fetchDashboard();
      onProfileUpdated();
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setSubmittingVaccine(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Loading unified personal blood donation &amp; vaccination profile...
      </div>
    );
  }

  if (!profile || !eligibility) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-red-600">
        Unable to load personal profile. Please sign in again.
      </div>
    );
  }

  const activeCooldownRule = eligibility.cooldownDays || 90;
  const chosenVaccineObj = vaccinesCatalog.find((v) => v.id === selectedVaccineId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Unified Personal Profile Header */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1A202C] to-[#2D0C14] text-white rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[#C8102E] text-white font-mono-tabular font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-lg">
            {profile.bloodGroup}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              /dashboard/donor · Unified Personal Health &amp; Donor Profile
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-0.5">{profile.name}</h1>
            <p className="text-xs text-slate-300 mt-1 font-mono-tabular">
              {profile.unit} · {profile.email} · {profile.phone}
            </p>
          </div>
        </div>

        {/* Unified Selector: Blood Donation OR Vaccination */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700">
          <button
            type="button"
            data-testid="profile-tab-blood"
            onClick={() => setProfileMode('BLOOD_DONATION')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
              profileMode === 'BLOOD_DONATION'
                ? 'bg-[#C8102E] text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            01. Blood Donation Profile ({donations.length})
          </button>
          <button
            type="button"
            data-testid="profile-tab-vaccination"
            onClick={() => setProfileMode('VACCINATION')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
              profileMode === 'VACCINATION'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            02. Vaccination &amp; Immunization ({vaccinations.length})
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: BLOOD DONATION PROFILE                                       */}
      {/* ==================================================================== */}
      {profileMode === 'BLOOD_DONATION' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 5 Cols: Donation Status Card */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Donation Status &amp; {activeCooldownRule}-Day Rule Engine
                </h2>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    eligibility.badgeColor === 'GREEN'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {eligibility.badgeText}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <dt className="text-slate-500">Last Donated Date</dt>
                  <dd className="font-mono-tabular font-bold text-[#1A202C] text-sm mt-1">
                    {eligibility.lastDonationDate || 'No Prior Record'}
                  </dd>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <dt className="text-slate-500">Days Elapsed</dt>
                  <dd className="font-mono-tabular font-bold text-[#C8102E] text-sm mt-1">
                    {eligibility.daysElapsed !== null
                      ? `${eligibility.daysElapsed} Days`
                      : 'Ready Now'}
                  </dd>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <dt className="text-slate-500">Next Eligible Donation Date</dt>
                  <dd className="font-mono-tabular font-bold text-emerald-700 text-sm mt-1">
                    {eligibility.isEligible ? 'Eligible Today' : eligibility.nextEligibleDate}
                  </dd>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <dt className="text-slate-500">
                    Cooldown Remaining ({activeCooldownRule}d Rule)
                  </dt>
                  <dd className="font-mono-tabular font-bold text-[#1A202C] text-sm mt-1">
                    {eligibility.daysRemaining} Days
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-slate-500 leading-relaxed">
                Sandhani RMC Unit enforces an active clinical cooldown interval of{' '}
                <strong className="text-slate-700">{activeCooldownRule} days</strong> between whole
                blood donations. Once {activeCooldownRule} days have elapsed since your last
                recorded donation, your status automatically transitions to Eligible to Donate.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-[#1A202C]">
                    Available for Emergency Calls
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Current state:{' '}
                    {isAvailable ? 'Yes — Active on RMCH Roster' : 'No — Temporarily Paused'}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Available for Emergency Calls"
                    checked={isAvailable}
                    onChange={(e) => handleToggleEmergencyAvailability(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#C8102E] focus:ring-[#C8102E]"
                  />
                  <span className="text-xs font-bold text-[#1A202C]">
                    {isAvailable ? 'Yes' : 'No'}
                  </span>
                </label>
              </div>
            </div>

            {/* Right 7 Cols: Profile Management Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Profile &amp; Contact Management
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your personal phone number, current city or medical college unit, and
                  demographic details.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="donor-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="donor-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="donor-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Phone Number
                    </label>
                    <input
                      id="donor-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="donor-unit"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Current City / Address / Medical College Unit
                    </label>
                    <input
                      id="donor-unit"
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="donor-dob"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Date of Birth
                    </label>
                    <input
                      id="donor-dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular focus:outline-none focus:border-[#C8102E]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving Profile...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Personal Donation History Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Personal Whole Blood Donation History
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified blood donation logs, campaign sites, volume collected, and bag
                  certificate IDs.
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-[#C8102E]">
                {donations.length} Total Donations
              </span>
            </div>

            {donations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No donations logged yet. Visit the Sandhani RMCH Transfusion Desk or an upcoming
                camp to donate.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="py-3 px-4 font-semibold">Donation Date</th>
                      <th className="py-3 px-4 font-semibold">Camp / Hospital Location</th>
                      <th className="py-3 px-4 font-semibold">Units / Volume</th>
                      <th className="py-3 px-4 font-semibold">Certificate / Bag ID</th>
                      <th className="py-3 px-4 font-semibold">Clinical Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {donations.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono-tabular font-bold text-[#1A202C]">
                          {d.donationDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#1A202C]">{d.campaignTitle}</div>
                          <div className="text-slate-500">{d.location}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular font-semibold">
                          1 Unit ({d.volumeMl} ml)
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular font-bold text-[#C8102E]">
                          {d.bagNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{d.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: VACCINATION & IMMUNIZATION PROFILE                           */}
      {/* ==================================================================== */}
      {profileMode === 'VACCINATION' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 5 Cols: Personal Immunization Summary & Dose Card */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#1A202C]">
                    Personal Immunization Summary
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sandhani Room 81 Cold-Chain Vaccination Registry
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono-tabular">
                  {vaccinations.length} Doses Logged
                </span>
              </div>

              <div className="space-y-3">
                {vaccinations.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    No vaccine doses recorded under your profile yet. Use the form on the right to
                    book or record a vaccination dose.
                  </div>
                ) : (
                  vaccinations.slice(0, 3).map((vac) => (
                    <div
                      key={vac.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#1A202C]">
                          {vac.vaccineName}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono-tabular text-[11px] font-bold">
                          Dose {vac.doseNumber}/{vac.totalDoses}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 font-mono-tabular">
                        <span>Given: {vac.dateAdministered}</span>
                        <span className="font-bold text-[#C8102E]">
                          {vac.nextDoseDate ? `Next: ${vac.nextDoseDate}` : 'Series Complete'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-tabular">
                        Certificate: {vac.certificateNo}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right 7 Cols: Book / Record New Vaccination Dose */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Book or Record a Vaccination Dose
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a vaccine from Sandhani’s cold-chain catalog to log your dose and calculate
                  your next scheduled immunization date.
                </p>
              </div>

              <form onSubmit={handleRecordVaccination} className="space-y-4">
                <div>
                  <label
                    htmlFor="vac-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Select Vaccine (Live Price &amp; Cold-Chain Stock)
                  </label>
                  <select
                    id="vac-select"
                    value={selectedVaccineId}
                    onChange={(e) => setSelectedVaccineId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-[#1A202C]"
                  >
                    {vaccinesCatalog.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — ৳{v.priceBdt} BDT/dose ({v.stockCount} in stock · {v.totalDoses}{' '}
                        doses total)
                      </option>
                    ))}
                  </select>
                </div>

                {chosenVaccineObj && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-emerald-950">
                        {chosenVaccineObj.scheduleText}
                      </div>
                      <div className="text-emerald-800 mt-0.5">
                        Target: {chosenVaccineObj.targetDisease} · Storage:{' '}
                        {chosenVaccineObj.storageTemp}
                      </div>
                    </div>
                    <div className="text-right font-mono-tabular">
                      <div className="text-sm font-extrabold text-emerald-950">
                        ৳ {chosenVaccineObj.priceBdt} BDT
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        {chosenVaccineObj.stockCount} vials available
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="vac-dose-num"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Dose Number
                    </label>
                    <select
                      id="vac-dose-num"
                      value={selectedDoseNum}
                      onChange={(e) => setSelectedDoseNum(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular font-bold"
                    >
                      {Array.from(
                        { length: chosenVaccineObj?.totalDoses || 3 },
                        (_, idx) => idx + 1
                      ).map((num) => (
                        <option key={num} value={String(num)}>
                          Dose {num} of {chosenVaccineObj?.totalDoses || 3}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="vac-date"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Date Administered / Scheduled
                    </label>
                    <input
                      id="vac-date"
                      type="date"
                      required
                      value={vaccineDate}
                      onChange={(e) => setVaccineDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="vac-notes"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Clinical Notes / Screening Status (Optional)
                  </label>
                  <input
                    id="vac-notes"
                    type="text"
                    value={vaccineNotes}
                    onChange={(e) => setVaccineNotes(e.target.value)}
                    placeholder="e.g. HBsAg negative verified at Sandhani Room 81"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingVaccine}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                  >
                    {submittingVaccine
                      ? 'Recording Dose...'
                      : 'Record Vaccine Dose & Generate Certificate'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Personal Vaccination History Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Personal Vaccination &amp; Immunization Certificate Log
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete record of vaccine doses administered, next scheduled dose dates, and
                  certificate numbers.
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-emerald-700">
                {vaccinations.length} Recorded Doses
              </span>
            </div>

            {vaccinations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No vaccination records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="py-3 px-4 font-semibold">Vaccine Name</th>
                      <th className="py-3 px-4 font-semibold">Dose Progress</th>
                      <th className="py-3 px-4 font-semibold">Date Administered</th>
                      <th className="py-3 px-4 font-semibold">Next Dose Due</th>
                      <th className="py-3 px-4 font-semibold">Certificate ID</th>
                      <th className="py-3 px-4 font-semibold">Status &amp; Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vaccinations.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-bold text-[#1A202C]">{v.vaccineName}</td>
                        <td className="py-3.5 px-4 font-mono-tabular font-bold text-emerald-700">
                          Dose {v.doseNumber} of {v.totalDoses}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular">{v.dateAdministered}</td>
                        <td className="py-3.5 px-4 font-mono-tabular font-semibold text-[#C8102E]">
                          {v.nextDoseDate || 'Completed'}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular font-bold text-slate-800">
                          {v.certificateNo}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{v.status}</div>
                          <div className="text-slate-500">{v.notes}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
