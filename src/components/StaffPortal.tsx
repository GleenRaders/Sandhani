import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CampaignItem,
  FridgeBagItem,
  StaffDonorRecord,
  VaccinationRecordItem,
  VaccineCatalogItem,
} from '../types';
import {
  MonthlyVolumePoint,
  FridgeSummaryResult,
  VALID_BLOOD_GROUPS,
} from '../utils/medicalRules';

interface StaffPortalProps {
  token: string | null;
  unitsList: string[];
  cooldownDays: number;
  onDataChanged: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({
  token,
  unitsList,
  cooldownDays,
  onDataChanged,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'UPCOMING' | 'CAMPAIGNS' | 'FRIDGE_VACCINES'>(
    'DIRECTORY'
  );
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<StaffDonorRecord[]>([]);
  const [upcomingDonors, setUpcomingDonors] = useState<StaffDonorRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyVolumePoint[]>([]);

  // Fridge & Vaccine states
  const [fridgeBags, setFridgeBags] = useState<FridgeBagItem[]>([]);
  const [fridgeSummary, setFridgeSummary] = useState<FridgeSummaryResult | null>(null);
  const [vaccines, setVaccines] = useState<VaccineCatalogItem[]>([]);
  const [vacRecords, setVacRecords] = useState<VaccinationRecordItem[]>([]);
  const [fridgeGroupFilter, setFridgeGroupFilter] = useState<string>('ALL');

  // Add Bag to Fridge form
  const [newBagSerial, setNewBagSerial] = useState('');
  const [newBagGroup, setNewBagGroup] = useState('O+');
  const [newBagDate, setNewBagDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBagDonor, setNewBagDonor] = useState('');
  const [newBagRack, setNewBagRack] = useState('Fridge-1 · Shelf A1');

  // Log Patient Vaccine Dose form
  const [vacPatientName, setVacPatientName] = useState('');
  const [vacPatientPhone, setVacPatientPhone] = useState('');
  const [vacPatientBg, setVacPatientBg] = useState('O+');
  const [vacSelectedId, setVacSelectedId] = useState('');
  const [vacDoseNum, setVacDoseNum] = useState('1');

  // Directory filters
  const [bgFilter, setBgFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'INELIGIBLE' | 'UNAVAILABLE'>(
    'ALL'
  );
  const [searchFilter, setSearchFilter] = useState('');

  // Donor history drawer/modal
  const [selectedDonorHistory, setSelectedDonorHistory] = useState<StaffDonorRecord | null>(null);

  // Rapid On-Site Entry Modal state
  const [showRapidEntryModal, setShowRapidEntryModal] = useState(false);
  const [rapidName, setRapidName] = useState('');
  const [rapidPhone, setRapidPhone] = useState('');
  const [rapidBg, setRapidBg] = useState('O+');
  const [rapidAge, setRapidAge] = useState('23');
  const [rapidWeight, setRapidWeight] = useState('58');
  const [rapidHb, setRapidHb] = useState('13.8');
  const [rapidDate, setRapidDate] = useState(new Date().toISOString().split('T')[0]);
  const [rapidVolume, setRapidVolume] = useState('450');
  const [rapidCampaignId, setRapidCampaignId] = useState('');
  const [rapidUnit, setRapidUnit] = useState(
    unitsList[0] || 'Rajshahi Medical College (RMC Unit)'
  );
  const [rapidNotes, setRapidNotes] = useState('');
  const [rapidError, setRapidError] = useState('');

  // Create / Edit Campaign Modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignItem | null>(null);
  const [campTitle, setCampTitle] = useState('');
  const [campLocation, setCampLocation] = useState('');
  const [campStart, setCampStart] = useState(new Date().toISOString().split('T')[0]);
  const [campEnd, setCampEnd] = useState(new Date().toISOString().split('T')[0]);
  const [campTarget, setCampTarget] = useState('200');
  const [campCoverImage, setCampCoverImage] = useState('');

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bloodGroup: bgFilter,
        unit: unitFilter,
        status: statusFilter,
        search: searchFilter,
      });
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [donorsRes, campsRes, fridgeRes, vacRes] = await Promise.all([
        fetch(`/api/staff/donors?${params.toString()}`, {
          headers,
          credentials: 'include',
        }),
        fetch('/api/staff/campaigns', {
          headers,
          credentials: 'include',
        }),
        fetch('/api/staff/fridge', {
          headers,
          credentials: 'include',
        }),
        fetch('/api/staff/vaccinations', {
          headers,
          credentials: 'include',
        }),
      ]);

      if (donorsRes.ok) {
        const dData = await donorsRes.json();
        setDonors(dData.donors || []);
        setUpcomingDonors(dData.upcomingEligible || []);
      }
      if (campsRes.ok) {
        const cData = await campsRes.json();
        setCampaigns(cData.campaigns || []);
        setMonthlyTrends(cData.monthlyTrends || []);
        if (cData.campaigns?.length > 0 && !rapidCampaignId) {
          setRapidCampaignId(cData.campaigns[0].id);
        }
      }
      if (fridgeRes.ok) {
        const fData = await fridgeRes.json();
        setFridgeBags(fData.bags || []);
        setFridgeSummary(fData.summary || null);
      }
      if (vacRes.ok) {
        const vData = await vacRes.json();
        setVaccines(vData.vaccines || []);
        setVacRecords(vData.records || []);
        if (vData.vaccines?.length > 0 && !vacSelectedId) {
          setVacSelectedId(vData.vaccines[0].id);
        }
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to load staff portal', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, [bgFilter, unitFilter, statusFilter, searchFilter, token]);

  const handleToggleDonorAvailability = async (donor: StaffDonorRecord) => {
    try {
      const res = await fetch(`/api/staff/donors/${donor.id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ isAvailable: !donor.isAvailable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not flag donor');
      onNotify(data.message);
      await fetchStaffData();
      onDataChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleRapidEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRapidError('');
    try {
      const res = await fetch('/api/staff/donations/rapid-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          donorName: rapidName,
          phone: rapidPhone,
          bloodGroup: rapidBg,
          age: Number(rapidAge),
          weightKg: Number(rapidWeight),
          hemoglobin: rapidHb ? Number(rapidHb) : null,
          donationDate: rapidDate,
          volumeMl: Number(rapidVolume),
          campaignId: rapidCampaignId || null,
          unit: rapidUnit,
          notes: rapidNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRapidError(data.error || 'Validation failed');
        return;
      }
      onNotify(data.message);
      setShowRapidEntryModal(false);
      setRapidName('');
      setRapidPhone('');
      setRapidNotes('');
      await fetchStaffData();
      onDataChanged();
    } catch (err: any) {
      setRapidError(err.message || 'Could not log donation');
    }
  };

  const handleCampaignPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCampCoverImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCampaign
        ? `/api/staff/campaigns/${editingCampaign.id}`
        : '/api/staff/campaigns';
      const method = editingCampaign ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          title: campTitle,
          location: campLocation,
          startDate: campStart,
          endDate: campEnd,
          targetBags: Number(campTarget),
          coverImageUrl: campCoverImage || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save campaign');
      onNotify(data.message);
      setShowCampaignModal(false);
      setEditingCampaign(null);
      await fetchStaffData();
      onDataChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleAddBagToFridge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/staff/fridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          serialNumber: newBagSerial,
          bloodGroup: newBagGroup,
          collectionDate: newBagDate,
          donorName: newBagDonor,
          compartment: newBagRack,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add bag');
      onNotify(data.message);
      setNewBagSerial('');
      setNewBagDonor('');
      await fetchStaffData();
      onDataChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleUpdateFridgeBagStatus = async (
    bagId: string,
    status: 'IN_FRIDGE' | 'ISSUED' | 'EXPIRED'
  ) => {
    try {
      const res = await fetch(`/api/staff/fridge/${bagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update bag');
      onNotify(data.message);
      await fetchStaffData();
      onDataChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleLogPatientVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/staff/vaccinations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          patientName: vacPatientName,
          patientPhone: vacPatientPhone,
          bloodGroup: vacPatientBg,
          vaccineId: vacSelectedId,
          doseNumber: Number(vacDoseNum),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log vaccine dose');
      onNotify(data.message);
      setVacPatientName('');
      setVacPatientPhone('');
      await fetchStaffData();
      onDataChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const openEditCampaign = (c: CampaignItem) => {
    setEditingCampaign(c);
    setCampTitle(c.title);
    setCampLocation(c.location);
    setCampStart(c.startDate);
    setCampEnd(c.endDate);
    setCampTarget(String(c.targetBags));
    setCampCoverImage(c.coverImageUrl || '');
    setShowCampaignModal(true);
  };

  const openCreateCampaign = () => {
    setEditingCampaign(null);
    setCampTitle('');
    setCampLocation('RMCH Premises, Rajshahi');
    setCampStart(new Date().toISOString().split('T')[0]);
    setCampEnd(new Date().toISOString().split('T')[0]);
    setCampTarget('200');
    setCampCoverImage('');
    setShowCampaignModal(true);
  };

  const total12MonthVolumeMl = monthlyTrends.reduce((sum, pt) => sum + pt.totalVolumeMl, 0);
  const total12MonthBags = monthlyTrends.reduce((sum, pt) => sum + pt.donationsCount, 0);
  const peakMonth =
    monthlyTrends.length > 0
      ? monthlyTrends.reduce((prev, curr) =>
          curr.totalVolumeMl > prev.totalVolumeMl ? curr : prev
        )
      : null;

  const filteredFridgeBags = fridgeBags.filter(
    (b) => fridgeGroupFilter === 'ALL' || b.bloodGroup === fridgeGroupFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Staff Workspace Header */}
      <div className="bg-[#1A202C] text-white rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            /portal/members · Sandhani Internal Staff Back-Office · Active Rule: {cooldownDays}-Day
            Cooldown
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
            Medical Volunteer, Blood Fridge &amp; Vaccination Operations
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Authorized staff access to unmasked donor phone numbers, serial-numbered refrigerator
            blood bags, cold-chain vaccine stock, and rapid on-site campaign entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowRapidEntryModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
          >
            Rapid On-Site Donation Entry
          </button>
          <button
            type="button"
            onClick={openCreateCampaign}
            className="px-4 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#A60D26] text-white text-xs font-bold transition-colors"
          >
            Create Blood Drive Campaign
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/70 p-1.5 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('DIRECTORY')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'DIRECTORY'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          01. Master Blood Donor Directory ({donors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('UPCOMING')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'UPCOMING'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          02. Upcoming Eligible Donors 7–30 Days ({upcomingDonors.length})
        </button>
        <button
          type="button"
          data-testid="tab-campaigns"
          onClick={() => setActiveTab('CAMPAIGNS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'CAMPAIGNS'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          03. Live Blood Drive &amp; Campaign Manager ({campaigns.length})
        </button>
        <button
          type="button"
          data-testid="tab-fridge-vaccines"
          onClick={() => setActiveTab('FRIDGE_VACCINES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'FRIDGE_VACCINES'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          04. Blood Fridge Inventory ({fridgeSummary?.totalInFridge || 0} Bags) &amp; Vaccines
        </button>
      </div>

      {/* TAB 1: MASTER BLOOD DONOR DIRECTORY */}
      {activeTab === 'DIRECTORY' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pb-4 border-b border-slate-100">
            <div>
              <label
                htmlFor="staff-bg-filter"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Blood Group (Incl. Rare Negatives)
              </label>
              <select
                id="staff-bg-filter"
                value={bgFilter}
                onChange={(e) => setBgFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                <option value="ALL">All Blood Groups</option>
                <option value="RARE_NEGATIVE">Rare Rh Negative (A-, B-, O-, AB-)</option>
                {VALID_BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    Group {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="staff-status-filter"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Eligibility Status ({cooldownDays}-Day Rule)
              </label>
              <select
                id="staff-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                <option value="ALL">All Registered Donors</option>
                <option value="ELIGIBLE">Eligible Now (≥{cooldownDays} Days &amp; Available)</option>
                <option value="INELIGIBLE">In Cooldown (&lt;{cooldownDays} Days)</option>
                <option value="UNAVAILABLE">Flagged Unavailable</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="staff-unit-filter"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                District / Medical College Unit
              </label>
              <input
                id="staff-unit-filter"
                type="text"
                value={unitFilter === 'ALL' ? '' : unitFilter}
                onChange={(e) => setUnitFilter(e.target.value ? e.target.value : 'ALL')}
                placeholder="e.g., Rajshahi or Dhaka..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="staff-search"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Search Donor Name or Phone
              </label>
              <input
                id="staff-search"
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search name, 017..., email"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Donor Name &amp; Unit</th>
                  <th className="py-3 px-4 font-semibold">Group</th>
                  <th className="py-3 px-4 font-semibold">Unmasked Phone</th>
                  <th className="py-3 px-4 font-semibold">Last Donated</th>
                  <th className="py-3 px-4 font-semibold">{cooldownDays}-Day Rule Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Direct Staff Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading master donor directory...
                    </td>
                  </tr>
                ) : donors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No donors match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  donors.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1A202C]">{d.name}</div>
                        <div className="text-slate-500">
                          {d.unit} · {d.donationsCount} Donation(s)
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono-tabular font-extrabold text-sm text-[#C8102E]">
                          {d.bloodGroup}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular font-bold text-[#1A202C]">
                        <a href={`tel:${d.phone}`} className="underline hover:text-[#C8102E]">
                          {d.phone}
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular">
                        <div>{d.lastDonationDate || 'Never'}</div>
                        {d.daysElapsed !== null && (
                          <div className="text-[11px] text-slate-400">{d.daysElapsed}d elapsed</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            !d.isAvailable
                              ? 'bg-slate-100 text-slate-600'
                              : d.badgeColor === 'GREEN'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {!d.isAvailable ? 'Flagged Unavailable' : d.badgeText}
                        </span>
                        {!d.isEligible && (
                          <div className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                            Ready: {d.nextEligibleDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`tel:${d.phone}`}
                          className="inline-block px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold transition-colors"
                        >
                          Call
                        </a>
                        <button
                          type="button"
                          onClick={() => setSelectedDonorHistory(d)}
                          className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors"
                        >
                          History ({d.donationsCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDonorAvailability(d)}
                          className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                            d.isAvailable
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-800'
                          }`}
                        >
                          {d.isAvailable ? 'Flag Unavailable' : 'Restore Available'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UPCOMING ELIGIBLE DONORS LIST (7 TO 30 DAYS) */}
      {activeTab === 'UPCOMING' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#1A202C]">
              Proactive Outreach: Cooldown Expiring Within 7 to 30 Days
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Auto-computed list of donors approaching their {cooldownDays}-day whole blood recovery
              threshold. Contact them ahead of upcoming blood drives.
            </p>
          </div>

          {upcomingDonors.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No donors currently have a cooldown expiring within the 1–30 day window.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingDonors.map((d) => (
                <div
                  key={d.id}
                  className="p-5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded bg-[#C8102E] text-white font-mono-tabular font-bold text-xs mb-1.5">
                        {d.bloodGroup}
                      </span>
                      <h3 className="text-sm font-bold text-[#1A202C]">{d.name}</h3>
                      <p className="text-xs text-slate-600">{d.unit}</p>
                    </div>
                    <div className="text-right font-mono-tabular">
                      <span className="text-xs font-extrabold text-amber-900 block">
                        In {d.daysRemaining} Days
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Date: {d.nextEligibleDate}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-amber-200/60 flex items-center justify-between text-xs">
                    <span className="font-mono-tabular font-bold text-[#1A202C]">{d.phone}</span>
                    <a
                      href={`tel:${d.phone}`}
                      className="px-3 py-1.5 rounded-lg bg-[#1A202C] text-white font-semibold hover:bg-slate-800"
                    >
                      Call for Drive Outreach
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE BLOOD DRIVE & CAMPAIGN MANAGER (WITH RECHARTS 12-MONTH LINE CHART) */}
      {activeTab === 'CAMPAIGNS' && (
        <div className="space-y-6">
          <div
            data-testid="campaign-volume-trend-card"
            className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
                  12-Month Clinical Collection Telemetry · RMCH Transfusion Registry
                </p>
                <h2 className="text-lg font-extrabold text-[#1A202C] mt-0.5">
                  Whole Blood Donation Volume Trends (Last 12 Months)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block">12-Month Volume</span>
                  <span className="text-base font-mono-tabular font-extrabold text-[#C8102E]">
                    {total12MonthVolumeMl.toLocaleString()} ml
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Total Screened Units</span>
                  <span className="text-base font-mono-tabular font-extrabold text-[#1A202C]">
                    {total12MonthBags} Bags
                  </span>
                </div>
                {peakMonth && (
                  <div>
                    <span className="text-[11px] text-slate-400 block">Peak Collection Month</span>
                    <span className="text-base font-mono-tabular font-extrabold text-emerald-700">
                      {peakMonth.monthLabel} ({peakMonth.totalVolumeMl} ml)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyTrends}
                  margin={{ top: 10, right: 24, left: 8, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    stroke="#CBD5E1"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: '#C8102E', fontSize: 11 }}
                    stroke="#CBD5E1"
                    unit=" ml"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#1A202C', fontSize: 11 }}
                    stroke="#CBD5E1"
                    unit=" bags"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1A202C',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalVolumeMl"
                    name="Collected Blood Volume (ml)"
                    stroke="#C8102E"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#C8102E', strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="donationsCount"
                    name="Screened Bags Count"
                    stroke="#1A202C"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#1A202C' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campaigns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {campaigns.map((c) => {
              const pct = Math.min(
                100,
                Math.round((c.collectedBags / Math.max(1, c.targetBags)) * 100)
              );
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between"
                >
                  {c.coverImageUrl && (
                    <div className="h-40 w-full bg-slate-900 border-b border-slate-100 overflow-hidden">
                      <img
                        src={c.coverImageUrl}
                        alt={c.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#C8102E]">
                            {c.startDate} → {c.endDate}
                          </span>
                          <h3 className="text-base font-extrabold text-[#1A202C] mt-0.5">
                            {c.title}
                          </h3>
                          <p className="text-xs text-slate-500">{c.location}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditCampaign(c)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 shrink-0"
                        >
                          Edit Campaign
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono-tabular">
                          <span className="text-slate-600">
                            Collected: <strong>{c.collectedBags}</strong> / {c.targetBags} Bags (
                            {(c.totalVolumeMl || c.collectedBags * 450).toLocaleString()} ml)
                          </span>
                          <span className="font-bold text-[#C8102E]">{pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#C8102E] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setRapidCampaignId(c.id);
                          setShowRapidEntryModal(true);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Log Walk-In Donation for This Drive
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: BLOOD FRIDGE INVENTORY & COLD-CHAIN VACCINE STOCK */}
      {activeTab === 'FRIDGE_VACCINES' && (
        <div className="space-y-8">
          {/* Top Summary Matrix of Blood Bags in Fridge */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
                  RMCH Room 81 Blood Bank Refrigerator (2°C–6°C CPDA-1 Storage)
                </p>
                <h2 className="text-lg font-extrabold text-[#1A202C] mt-0.5">
                  Live Blood Bag Refrigerator Inventory ({fridgeSummary?.totalInFridge || 0} Active
                  Bags · {(fridgeSummary?.totalVolumeMl || 0).toLocaleString()} ml)
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono-tabular text-xs font-bold">
                  {fridgeSummary?.totalInFridge || 0} Bags in Fridge
                </span>
                {(fridgeSummary?.expiringSoonCount || 0) > 0 && (
                  <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono-tabular text-xs font-bold">
                    {fridgeSummary?.expiringSoonCount} Expiring ≤7d
                  </span>
                )}
              </div>
            </div>

            {/* 8 Blood Group Fridge Counter Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {VALID_BLOOD_GROUPS.map((bg) => {
                const count = fridgeSummary?.byBloodGroup?.[bg] ?? 0;
                const active = fridgeGroupFilter === bg;
                return (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setFridgeGroupFilter(active ? 'ALL' : bg)}
                    className={`p-3.5 rounded-xl border text-center transition-all ${
                      active
                        ? 'bg-[#1A202C] text-white border-[#1A202C]'
                        : 'bg-slate-50 text-[#1A202C] border-slate-200 hover:border-[#C8102E]'
                    }`}
                  >
                    <div
                      className={`text-lg font-mono-tabular font-extrabold ${
                        active ? 'text-amber-300' : 'text-[#C8102E]'
                      }`}
                    >
                      {bg}
                    </div>
                    <div className="text-xl font-mono-tabular font-extrabold mt-0.5">
                      {count}
                    </div>
                    <div className="text-[10px] opacity-75">Bags in Fridge</div>
                  </button>
                );
              })}
            </div>

            {/* Add New Blood Bag Form */}
            <form
              onSubmit={handleAddBagToFridge}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Bag Serial Number
                </label>
                <input
                  type="text"
                  value={newBagSerial}
                  onChange={(e) => setNewBagSerial(e.target.value)}
                  placeholder="Auto or SRMC-BAG-..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Blood Group
                </label>
                <select
                  value={newBagGroup}
                  onChange={(e) => setNewBagGroup(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular font-bold bg-white"
                >
                  {VALID_BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Collection Date
                </label>
                <input
                  type="date"
                  required
                  value={newBagDate}
                  onChange={(e) => setNewBagDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Donor Name
                </label>
                <input
                  type="text"
                  value={newBagDonor}
                  onChange={(e) => setNewBagDonor(e.target.value)}
                  placeholder="Donor full name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Fridge Rack / Shelf
                </label>
                <input
                  type="text"
                  value={newBagRack}
                  onChange={(e) => setNewBagRack(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-xs font-bold"
                >
                  + Store Bag in Fridge
                </button>
              </div>
            </form>

            {/* Serial-Numbered Fridge Bags Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-3 px-4 font-semibold">Bag Serial Number</th>
                    <th className="py-3 px-4 font-semibold">Group</th>
                    <th className="py-3 px-4 font-semibold">Collection Date</th>
                    <th className="py-3 px-4 font-semibold">Expiry Date (35d)</th>
                    <th className="py-3 px-4 font-semibold">Fridge Compartment &amp; Donor</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFridgeBags.map((bag) => (
                    <tr key={bag.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular font-bold text-[#1A202C]">
                        {bag.serialNumber}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular font-extrabold text-sm text-[#C8102E]">
                        {bag.bloodGroup}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular">{bag.collectionDate}</td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-600">
                        {bag.expiryDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1A202C]">{bag.compartment}</div>
                        <div className="text-slate-500">
                          Donor: {bag.donorName} ({bag.volumeMl}ml)
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            bag.status === 'IN_FRIDGE'
                              ? 'bg-emerald-50 text-emerald-800'
                              : bag.status === 'ISSUED'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          {bag.status === 'IN_FRIDGE'
                            ? 'In Fridge (Ready)'
                            : bag.status === 'ISSUED'
                            ? 'Issued to Patient'
                            : 'Expired'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {bag.status === 'IN_FRIDGE' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateFridgeBagStatus(bag.id, 'ISSUED')}
                            className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold"
                          >
                            Dispatch / Issue Bag
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateFridgeBagStatus(bag.id, 'IN_FRIDGE')}
                            className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold"
                          >
                            Return to Fridge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cold-Chain Vaccine Stock & Patient Immunization Logger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Cold-Chain Vaccine Stock &amp; Pricing Overview
                </h2>
                <p className="text-xs text-slate-500">
                  Live vial inventory in Sandhani Room 81 Vaccine Refrigerator
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vaccines.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono-tabular text-xs font-extrabold">
                        {v.stockCount} Doses in Stock
                      </span>
                      <span className="font-mono-tabular font-extrabold text-[#C8102E] text-sm">
                        ৳ {v.priceBdt}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#1A202C]">{v.name}</div>
                    <div className="text-[11px] text-slate-500">{v.scheduleText}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Log Walk-In Patient Vaccine Dose
                </h2>
                <p className="text-xs text-slate-500">
                  Records vaccination certificate and deducts 1 vial from stock
                </p>
              </div>
              <form onSubmit={handleLogPatientVaccination} className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={vacPatientName}
                    onChange={(e) => setVacPatientName(e.target.value)}
                    placeholder="Patient Full Name"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    type="tel"
                    required
                    value={vacPatientPhone}
                    onChange={(e) => setVacPatientPhone(e.target.value)}
                    placeholder="Phone (017...)"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <select
                    value={vacSelectedId}
                    onChange={(e) => setVacSelectedId(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  >
                    {vaccines.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (৳{v.priceBdt})
                      </option>
                    ))}
                  </select>
                  <select
                    value={vacDoseNum}
                    onChange={(e) => setVacDoseNum(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular font-bold"
                  >
                    <option value="1">Dose 1</option>
                    <option value="2">Dose 2</option>
                    <option value="3">Dose 3</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Record Patient Vaccination Dose
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DONOR DONATION HISTORY */}
      {selectedDonorHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1A202C]">
                  {selectedDonorHistory.name} ({selectedDonorHistory.bloodGroup}) — Donation Log
                </h3>
                <p className="text-xs text-slate-500 font-mono-tabular">
                  Phone: {selectedDonorHistory.phone} · {selectedDonorHistory.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDonorHistory(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            {selectedDonorHistory.donations.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No donation records found for this donor.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {selectedDonorHistory.donations.map((dr) => (
                  <div
                    key={dr.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#1A202C]">{dr.campaignTitle}</div>
                      <div className="text-slate-500">
                        Bag: {dr.bagNumber} · Volume: {dr.volumeMl}ml
                      </div>
                    </div>
                    <div className="font-mono-tabular font-bold text-[#C8102E]">
                      {dr.donationDate}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: RAPID ON-SITE DONATION ENTRY */}
      {showRapidEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Live Blood Drive Volunteer Form
                </p>
                <h3 className="text-lg font-extrabold text-[#1A202C]">
                  Rapid On-Site Donation Entry (Auto-Adds to Blood Fridge)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRapidEntryModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            {rapidError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                {rapidError}
              </div>
            )}

            <form onSubmit={handleRapidEntrySubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Donor Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={rapidName}
                    onChange={(e) => setRapidName(e.target.value)}
                    placeholder="e.g. Md. Rashedul Karim"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number (Matches or Auto-Creates)
                  </label>
                  <input
                    type="tel"
                    required
                    value={rapidPhone}
                    onChange={(e) => setRapidPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={rapidBg}
                    onChange={(e) => setRapidBg(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular font-bold"
                  >
                    {VALID_BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age (18–65)
                  </label>
                  <input
                    type="number"
                    required
                    value={rapidAge}
                    onChange={(e) => setRapidAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Weight (≥45 kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={rapidWeight}
                    onChange={(e) => setRapidWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hb (g/dL, Opt)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={rapidHb}
                    onChange={(e) => setRapidHb(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Collection Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rapidDate}
                    onChange={(e) => setRapidDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Volume (ml)
                  </label>
                  <input
                    type="number"
                    required
                    value={rapidVolume}
                    onChange={(e) => setRapidVolume(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign / Drive
                  </label>
                  <select
                    value={rapidCampaignId}
                    onChange={(e) => setRapidCampaignId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  >
                    <option value="">Walk-In RMCH Transfusion</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRapidEntryModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Record Donation &amp; Store Bag in Fridge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT CAMPAIGN */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-[#1A202C]">
                {editingCampaign ? 'Edit Campaign Settings' : 'Create New Blood Drive Campaign'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCampaignModal(false)}
                className="text-xs font-semibold text-slate-500"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveCampaign} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  required
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / Venue
                </label>
                <input
                  type="text"
                  required
                  value={campLocation}
                  onChange={(e) => setCampLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={campStart}
                    onChange={(e) => setCampStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={campEnd}
                    onChange={(e) => setCampEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Bags
                  </label>
                  <input
                    type="number"
                    required
                    value={campTarget}
                    onChange={(e) => setCampTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Campaign Banner Photo (Upload Image File or Paste URL)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCampaignPhotoUpload}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                  />
                  <input
                    type="url"
                    value={campCoverImage.startsWith('data:') ? '' : campCoverImage}
                    onChange={(e) => setCampCoverImage(e.target.value)}
                    placeholder="Or paste image URL..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#C8102E] text-white text-xs font-bold"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
