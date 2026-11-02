import React, { useState } from 'react';
import { PublicOverviewData } from '../types';
import { VALID_BLOOD_GROUPS } from '../utils/medicalRules';

interface PublicPortalProps {
  overview: PublicOverviewData;
  onOpenModal: (modal: 'LOGIN' | 'REGISTER' | 'EMERGENCY_REQUEST' | 'EYE_PLEDGE') => void;
  onNavigateProfile?: () => void;
  onRefreshPublic: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  overview,
  onOpenModal,
  onNavigateProfile,
  onRefreshPublic,
  onNotify,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyEligible, setOnlyEligible] = useState<boolean>(false);

  // Public Photo Upload Modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCategory, setPhotoCategory] = useState('Blood Drive Camp');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Lightbox for viewing Requisition Slip Photo
  const [previewSlip, setPreviewSlip] = useState<{
    patient: string;
    bloodGroup: string;
    hospital: string;
    url: string;
  } | null>(null);

  const cooldownDays = overview.settings.cooldownDays || 90;

  const filteredDonors = overview.donors.filter((d) => {
    if (selectedGroup !== 'ALL') {
      if (selectedGroup === 'RARE_NEGATIVE') {
        if (!d.bloodGroup.endsWith('-')) return false;
      } else if (d.bloodGroup !== selectedGroup) {
        return false;
      }
    }
    if (onlyEligible && !d.eligibleNow) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      if (
        !d.name.toLowerCase().includes(q) &&
        !d.unit.toLowerCase().includes(q) &&
        !d.bloodGroup.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoTitle.trim() || !photoDataUrl.trim()) {
      onNotify('Please provide a photo title and select an image file or URL.', true);
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await fetch('/api/public/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: photoTitle,
          category: photoCategory,
          imageUrl: photoDataUrl,
          caption: photoCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not upload photo');
      onNotify(data.message);
      setShowPhotoModal(false);
      setPhotoTitle('');
      setPhotoCaption('');
      setPhotoDataUrl('');
      onRefreshPublic();
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* 1. MODERN EDITORIAL HERO WITH LIVE FRIDGE & VACCINE TELEMETRY */}
      <section className="relative bg-gradient-to-br from-[#0F172A] via-[#1A202C] to-[#2A0810] text-white overflow-hidden border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left 7 Cols: Institutional Headline, Mission & Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-amber-300 text-xs font-semibold tracking-wide">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span>
                  সন্ধানী, রাজশাহী মেডিকেল কলেজ ইউনিট · Est. January 3, 1980 · Room 81 Heritage
                </span>
              </div>

              <h1
                className="font-extrabold tracking-tight text-white leading-[1.07]"
                style={{ fontSize: 'clamp(2.25rem, 4vw + 0.5rem, 3.65rem)' }}
              >
                Screened Whole Blood, Cold-Chain Vaccines &amp; 24/7 Patient Care at RMCH.
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-[64ch]">
                Operated by medical students of Rajshahi Medical College since 1980. Coordinate
                verified 5-marker screened blood bags directly from our refrigerator vault, submit
                emergency hospital requisitions with slip photos, and access subsidized Hepatitis-B,
                Tetanus, and HPV immunization.
              </p>

              {/* Bengali Institutional Motto Banner */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-w-xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-amber-300">
                    “স্বেচ্ছায় রক্তদান, মরণোত্তর চক্ষুদান এবং সমাজসেবা”
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Voluntary Blood Donation · Cold-Chain Vaccination Wing · Posthumous Eye Bank
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-400">Cooldown Rule</div>
                  <div className="text-sm font-mono-tabular font-extrabold text-white">
                    {cooldownDays} Days
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenModal('REGISTER')}
                  className="px-6 py-3.5 rounded-xl bg-[#C8102E] hover:bg-[#A60D26] text-white font-bold text-sm transition-colors shadow-lg shadow-[#C8102E]/25"
                >
                  Register Blood &amp; Vaccine Profile
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModal('EMERGENCY_REQUEST')}
                  className="px-5 py-3.5 rounded-xl bg-white text-[#1A202C] hover:bg-slate-100 font-bold text-sm transition-colors"
                >
                  Submit Blood Requisition + Photo
                </button>
                {onNavigateProfile && (
                  <button
                    type="button"
                    onClick={onNavigateProfile}
                    className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/20 transition-colors"
                  >
                    My Blood &amp; Vaccine Profile
                  </button>
                )}
              </div>

              {/* Section Jump Bar */}
              <div className="pt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="text-slate-400 font-semibold">Quick Jump:</span>
                <a
                  href="#blood-bank"
                  className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Fridge Blood Stock ({overview.stats.fridgeBagsTotal} Bags)
                </a>
                <a
                  href="#requisition-wall"
                  className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Emergency Requisitions ({overview.emergencyRequests.length})
                </a>
                <a
                  href="#vaccination-wing"
                  className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Vaccination &amp; Prices ({overview.vaccines.length})
                </a>
                <a
                  href="#members-directory"
                  className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  RMC Member Directory ({overview.membersDirectory.length})
                </a>
              </div>
            </div>

            {/* Right 5 Cols: Live Transfusion & Cold-Chain Command Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      RMCH Room 81 Live Telemetry
                    </div>
                    <div className="text-base font-extrabold text-white mt-0.5">
                      Blood Refrigerator &amp; Vaccine Vault
                    </div>
                  </div>
                  <a
                    href={`tel:${overview.settings.helplinePrimary}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono-tabular font-bold text-xs"
                  >
                    Call {overview.settings.helplinePrimary}
                  </a>
                </div>

                {/* Mini Blood Group Fridge Matrix */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Screened Bags Currently in Fridge (2°C–6°C)</span>
                    <span className="font-mono-tabular font-bold text-emerald-400">
                      {overview.stats.fridgeBagsTotal} Total Bags
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {overview.board.map((b) => (
                      <div
                        key={b.group}
                        className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-center"
                      >
                        <div className="text-xs font-mono-tabular font-extrabold text-[#F87171]">
                          {b.group}
                        </div>
                        <div className="text-lg font-mono-tabular font-extrabold text-white mt-0.5">
                          {b.bags}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {b.readyDonors} ready
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live KPIs Row */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400">Ready Eligible Donors</div>
                    <div className="text-xl font-mono-tabular font-extrabold text-emerald-400 mt-1">
                      {overview.donors.filter((d) => d.eligibleNow).length} Ready
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Passed {cooldownDays}-day interval
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-xs text-slate-400">Vaccine Cold-Chain Stock</div>
                    <div className="text-xl font-mono-tabular font-extrabold text-amber-400 mt-1">
                      {overview.stats.vaccineStockTotal} Doses
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Hep-B, TT, Typhoid &amp; HPV
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 46-YEAR HUMANITARIAN IMPACT RIBBON */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border-l-4 border-[#C8102E] pl-4">
            <div className="text-2xl sm:text-3xl font-mono-tabular font-extrabold text-[#1A202C]">
              {overview.stats.bloodUnits.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1">
              Screened Whole Blood Units Supplied
            </div>
          </div>
          <div className="border-l-4 border-emerald-600 pl-4">
            <div className="text-2xl sm:text-3xl font-mono-tabular font-extrabold text-[#1A202C]">
              {overview.stats.fridgeBagsTotal} Bags
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1">
              Active Blood Bags in RMCH Fridge
            </div>
          </div>
          <div className="border-l-4 border-amber-500 pl-4">
            <div className="text-2xl sm:text-3xl font-mono-tabular font-extrabold text-[#1A202C]">
              {overview.stats.vaccineStockTotal} Doses
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1">
              Vaccines in 2°C–8°C Cold-Chain Stock
            </div>
          </div>
          <div className="border-l-4 border-slate-800 pl-4">
            <div className="text-2xl sm:text-3xl font-mono-tabular font-extrabold text-[#1A202C]">
              {overview.stats.corneas.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-1">
              Posthumous Corneal Pledges &amp; Grafts
            </div>
          </div>
        </div>
      </section>

      {/* 3. EMERGENCY BLOOD REQUISITIONS WALL WITH SLIP PHOTOS & APPROVAL STATUS */}
      <section id="requisition-wall" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
              Live RMCH Ward Requisitions · Verified with Prescription / Slip Photos
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A202C] mt-1">
              Emergency Blood Requisition Board
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenModal('EMERGENCY_REQUEST')}
            className="px-5 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#A60D26] text-white text-xs font-bold transition-colors shrink-0"
          >
            + Post Blood Requisition with Slip Photo
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {overview.emergencyRequests.map((req) => {
            const isFulfilled = req.status === 'FULFILLED';
            const isApproved = req.status === 'APPROVED' || req.status === 'OPEN';
            return (
              <div
                key={req.id}
                className={`rounded-2xl bg-white border p-5 flex flex-col justify-between gap-4 transition-shadow hover:shadow-md ${
                  isFulfilled ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-[#C8102E] text-white font-mono-tabular font-extrabold text-base">
                        {req.bloodGroup}
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-[#1A202C]">{req.patient}</h3>
                        <p className="text-xs text-slate-500">{req.hospital}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 ${
                        isFulfilled
                          ? 'bg-emerald-100 text-emerald-800'
                          : isApproved
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isFulfilled
                        ? 'Fulfilled'
                        : isApproved
                        ? 'Approved'
                        : 'Pending Approval'}
                    </span>
                  </div>

                  {/* Requisition Slip Photo Thumbnail */}
                  {req.requisitionPhotoUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-32 group">
                      <img
                        src={req.requisitionPhotoUrl}
                        alt={`Requisition slip for ${req.patient}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewSlip({
                            patient: req.patient,
                            bloodGroup: req.bloodGroup,
                            hospital: req.hospital,
                            url: req.requisitionPhotoUrl!,
                          })
                        }
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-slate-900/85 hover:bg-slate-900 text-white text-[11px] font-semibold"
                      >
                        View Requisition Slip
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      <span className="font-semibold text-slate-800">Clinical Indication:</span>{' '}
                      {req.indication}
                    </div>
                    <div className="flex items-center justify-between font-mono-tabular">
                      <span>
                        Required: <strong>{req.units} Bag(s)</strong>
                      </span>
                      <span className="text-[#C8102E] font-bold">{req.urgency}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono-tabular font-semibold text-slate-700">
                    Attendant: {req.phone}
                  </span>
                  {isFulfilled ? (
                    <span className="text-xs font-bold text-emerald-700">
                      Blood Unit Dispatched
                    </span>
                  ) : (
                    <a
                      href={`tel:${req.phone}`}
                      className="px-3 py-1.5 rounded-lg bg-[#1A202C] hover:bg-slate-800 text-white text-xs font-semibold"
                    >
                      Call Attendant
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. SANDHANI VACCINATION & IMMUNIZATION WING (STOCK, DOSES & ADMIN-UPDATABLE PRICES) */}
      <section id="vaccination-wing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-3xl p-6 sm:p-10 text-white border border-slate-800 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800 pb-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Sandhani Immunization &amp; Hepatitis-B Prevention Wing · Room 81 Cold-Chain Vault
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Official Vaccination Schedule, Cold-Chain Stock &amp; Pricing
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl">
                Quality-assured vaccines maintained in 2°C–8°C medical refrigerators at Sandhani
                RMC Unit. Prices and stock counts are updated in real time by the Super Admin.
              </p>
            </div>
            {onNavigateProfile && (
              <button
                type="button"
                onClick={onNavigateProfile}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0"
              >
                Open My Vaccination &amp; Blood Profile →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {overview.vaccines.map((v) => (
              <div
                key={v.id}
                className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono-tabular text-xs font-bold">
                      {v.stockCount} Doses in Stock
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-400">
                      {v.totalDoses} {v.totalDoses === 1 ? 'Dose' : 'Doses'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white leading-snug">{v.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{v.targetDisease}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-xs">
                    <div className="text-slate-400">Dose Schedule:</div>
                    <div className="font-semibold text-slate-200">{v.scheduleText}</div>
                    <div className="text-[11px] text-slate-400 pt-1">
                      Storage: {v.storageTemp} · {v.manufacturer}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Official Price / Dose</div>
                    <div className="text-xl font-mono-tabular font-extrabold text-amber-400">
                      ৳ {v.priceBdt} BDT
                    </div>
                  </div>
                  {onNavigateProfile && (
                    <button
                      type="button"
                      onClick={onNavigateProfile}
                      className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                    >
                      Book / Log Dose
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. BLOOD FRIDGE INVENTORY & PUBLIC DONOR REGISTRY */}
      <section id="blood-bank" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
              Live Refrigerator Stock &amp; {cooldownDays}-Day Medical Eligibility Engine
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A202C] mt-1">
              Blood Fridge Availability &amp; Public Donor Registry
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Personal donor phone numbers are strictly redacted on the public site. Authorized
            Sandhani staff can access unmasked contact numbers and serial-numbered fridge bags inside{' '}
            <span className="font-mono-tabular font-semibold text-slate-700">/portal/members</span>.
          </p>
        </div>

        {/* 8-Group Blood Fridge & Donor Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {overview.board.map((item) => {
            const isSelected = selectedGroup === item.group;
            return (
              <button
                key={item.group}
                type="button"
                onClick={() => setSelectedGroup(isSelected ? 'ALL' : item.group)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-[#1A202C] text-white border-[#1A202C]'
                    : 'bg-white text-[#1A202C] border-slate-200 hover:border-[#C8102E]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xl font-mono-tabular font-extrabold ${
                      isSelected ? 'text-amber-300' : 'text-[#C8102E]'
                    }`}
                  >
                    {item.group}
                  </span>
                  <span
                    className={`text-[11px] font-mono-tabular font-semibold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.bags} in fridge
                  </span>
                </div>
                <div className="mt-3 text-xs font-mono-tabular font-semibold">
                  {item.readyDonors} Eligible Donors
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {item.bnStatus}
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedGroup === 'ALL'
                  ? 'bg-[#C8102E] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Groups
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedGroup(selectedGroup === 'RARE_NEGATIVE' ? 'ALL' : 'RARE_NEGATIVE')
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedGroup === 'RARE_NEGATIVE'
                  ? 'bg-[#C8102E] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Rare Rh Negative (A-, B-, O-, AB-)
            </button>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyEligible}
                onChange={(e) => setOnlyEligible(e.target.checked)}
                className="rounded border-slate-300 text-[#C8102E] focus:ring-[#C8102E]"
              />
              <span>Show Only Eligible Now (≥{cooldownDays} Days)</span>
            </label>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              aria-label="Search donors by name or medical college unit"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donor or medical college..."
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#C8102E]"
            />
          </div>
        </div>

        {/* Public Donor Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDonors.slice(0, 6).map((donor) => (
            <div
              key={donor.id}
              className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-red-50 border border-red-200 text-[#C8102E] font-mono-tabular font-extrabold text-base flex items-center justify-center shrink-0">
                    {donor.bloodGroup}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1A202C]">{donor.name}</h3>
                    <p className="text-xs text-slate-500">{donor.unit}</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 ${
                    donor.badgeColor === 'GREEN'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {donor.badgeText}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Last Donated</span>
                  <span className="font-mono-tabular font-semibold text-slate-700">
                    {donor.lastDonationDate || 'First-Time Ready'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Contact Privacy</span>
                  <span className="font-mono-tabular text-slate-600">{donor.maskedPhone}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. SANDHANI EXECUTIVE & VOLUNTEER MEMBER DIRECTORY (ADDED BY ADMIN WITH PHOTOS) */}
      <section id="members-directory" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
              Executive Committee &amp; Duty Roster · Rajshahi Medical College Unit
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A202C] mt-1">
              Sandhani Medical Student Volunteers &amp; Advisors
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Directly contact our unit committee members for emergency blood cross-matching, fridge
            dispatch, or vaccination inquiries. Managed via the Super Admin Panel.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {overview.membersDirectory.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <img
                src={member.photoUrl}
                alt={member.name}
                className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shrink-0 bg-slate-900"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#C8102E] truncate">
                    {member.designation}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-50 text-[#C8102E] font-mono-tabular font-extrabold text-xs shrink-0">
                    {member.bloodGroup}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#1A202C] truncate">{member.name}</h3>
                <p className="text-xs text-slate-500 truncate">{member.batch}</p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs font-mono-tabular font-bold text-slate-700">
                    {member.phone}
                  </span>
                  <a
                    href={`tel:${member.phone}`}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold"
                  >
                    Call Member
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. OFFICIAL CAMPUS & BLOOD DRIVE PHOTO ARCHIVE */}
      <section id="photo-archive" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
              Official Institutional Documentation · RMCH &amp; Kazi Nurunnobi Hostel
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A202C] mt-1">
              Campus Blood Drives &amp; Humanitarian Photo Archive
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#1A202C] hover:bg-slate-800 text-white text-xs font-bold transition-colors shrink-0"
          >
            Add Official Camp Photo
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {overview.photos.map((photo) => (
            <article
              key={photo.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow"
            >
              <div>
                <div className="aspect-16/10 w-full bg-slate-900 overflow-hidden border-b border-slate-100">
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-xs font-semibold text-[#C8102E]">
                    {photo.category} ·{' '}
                    <span className="text-slate-400 font-mono-tabular">
                      {photo.createdAt.split('T')[0]}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#1A202C] leading-snug">
                    {photo.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{photo.caption}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 8. POSTHUMOUS EYE DONATION SECTION */}
      <section id="eye-donation" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1A202C] text-white rounded-2xl p-8 lg:p-12 border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Sandhani National Eye Donation Society · মরণোত্তর চক্ষুদান
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Let Your Eyes Behold the World Even After You Pass Away.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-[60ch]">
              “অন্ধজনে দেহ আলো, মৃত জনে দেহ প্রাণ” — আপনার একটি মরণোত্তর চক্ষুদান অঙ্গীকার দুজন
              কর্নিয়াজনিত অন্ধ মানুষের জীবনে আলো ফিরিয়ে দিতে পারে।
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenModal('EYE_PLEDGE')}
                className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
              >
                Sign Posthumous Eye Donation Pledge
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900/90 rounded-xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-amber-300">Recorded Corneal Pledges</span>
              <span className="text-xs font-mono-tabular text-slate-400">
                {overview.eyePledges.length} Recent
              </span>
            </div>
            <div className="space-y-2.5">
              {overview.eyePledges.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span>{p.name}</span>
                    <span className="font-mono-tabular text-amber-300">{p.ageBg}</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    Next of Kin: {p.kin} · Registry: {p.nid}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REQUISITION SLIP PHOTO PREVIEW MODAL */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold text-[#C8102E]">
                  Verified Hospital Requisition Slip ({previewSlip.bloodGroup})
                </p>
                <h3 className="text-base font-extrabold text-[#1A202C]">
                  {previewSlip.patient} — {previewSlip.hospital}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSlip(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
              <img
                src={previewSlip.url}
                alt={`Requisition slip for ${previewSlip.patient}`}
                className="w-full max-h-96 object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD OFFICIAL CAMP PHOTO */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-semibold text-[#C8102E]">
                  Sandhani RMC Unit Official Photo Archive
                </p>
                <h3 className="text-lg font-extrabold text-[#1A202C]">
                  Upload Blood Drive or Campus Photo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleUploadPhoto} className="space-y-3.5">
              <div>
                <label
                  htmlFor="pub-photo-title"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Photo Title
                </label>
                <input
                  id="pub-photo-title"
                  type="text"
                  required
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="e.g. RMCH Voluntary Blood Grouping Camp 2026"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="pub-photo-cat"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Archive Category
                </label>
                <select
                  id="pub-photo-cat"
                  value={photoCategory}
                  onChange={(e) => setPhotoCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="Blood Drive Camp">Blood Drive Camp</option>
                  <option value="Clinical Outreach">Clinical Outreach</option>
                  <option value="Institutional Heritage">Institutional Heritage</option>
                  <option value="Eye Donation Registry">Eye Donation Registry</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="pub-photo-file"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Upload Image File
                  </label>
                  <input
                    id="pub-photo-file"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pub-photo-url"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Or Paste Image URL
                  </label>
                  <input
                    id="pub-photo-url"
                    type="url"
                    value={photoDataUrl.startsWith('data:') ? '' : photoDataUrl}
                    onChange={(e) => setPhotoDataUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {photoDataUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-900">
                  <img
                    src={photoDataUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="pub-photo-cap"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Caption / Clinical Description
                </label>
                <textarea
                  id="pub-photo-cap"
                  rows={2}
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Describe the camp location, date, and medical team..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="px-5 py-2 rounded-lg bg-[#C8102E] text-white text-xs font-bold"
                >
                  {uploadingPhoto ? 'Publishing...' : 'Publish Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
