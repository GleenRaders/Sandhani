import React, { useState } from 'react';
import { Role, VALID_BLOOD_GROUPS } from '../utils/medicalRules';

interface AuthModalsProps {
  activeModal: 'LOGIN' | 'REGISTER' | 'EMERGENCY_REQUEST' | 'EYE_PLEDGE' | null;
  unitsList: string[];
  onClose: () => void;
  onLoginSuccess: (token: string, user: any) => void;
  onQuickRoleSwitch: (role: Role) => void;
  onRefreshPublic: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const AuthAndPublicModals: React.FC<AuthModalsProps> = ({
  activeModal,
  unitsList,
  onClose,
  onLoginSuccess,
  onQuickRoleSwitch,
  onRefreshPublic,
  onNotify,
}) => {
  // Login state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBloodGroup, setRegBloodGroup] = useState('O+');
  const [regDob, setRegDob] = useState('2002-05-15');
  const [regGender, setRegGender] = useState('Male');
  const [regUnit, setRegUnit] = useState(
    unitsList[0] || 'Rajshahi Medical College (RMC Unit)'
  );
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');

  // Emergency Request state
  const [reqPatient, setReqPatient] = useState('');
  const [reqHospital, setReqHospital] = useState('RMCH Ward 24, Rajshahi');
  const [reqBg, setReqBg] = useState('O-');
  const [reqUnits, setReqUnits] = useState('2');
  const [reqUrgency, setReqUrgency] = useState('Critical (Within 2 Hrs)');
  const [reqPhone, setReqPhone] = useState('');
  const [reqIndication, setReqIndication] = useState('');
  const [reqPhotoUrl, setReqPhotoUrl] = useState('');

  // Eye Pledge state
  const [eyeName, setEyeName] = useState('');
  const [eyeAgeBg, setEyeAgeBg] = useState('24 yrs · O+');
  const [eyePhone, setEyePhone] = useState('');
  const [eyeNid, setEyeNid] = useState('');
  const [eyeKin, setEyeKin] = useState('');
  const [eyeKinPhone, setEyeKinPhone] = useState('');

  if (!activeModal) return null;

  const handleReqPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReqPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Invalid credentials');
        return;
      }
      onLoginSuccess(data.token, data.user);
      onClose();
    } catch (err: any) {
      setLoginError(err.message || 'Sign-in failed');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          bloodGroup: regBloodGroup,
          dob: regDob,
          gender: regGender,
          unit: regUnit,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || 'Registration failed');
        return;
      }
      onLoginSuccess(data.token, data.user);
      onClose();
    } catch (err: any) {
      setRegError(err.message || 'Registration error');
    }
  };

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/public/emergency-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: reqPatient,
          hospital: reqHospital,
          bloodGroup: reqBg,
          units: Number(reqUnits),
          urgency: reqUrgency,
          phone: reqPhone,
          indication: reqIndication,
          requisitionPhotoUrl: reqPhotoUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not post request');
      onNotify(data.message);
      setReqPatient('');
      setReqPhone('');
      setReqPhotoUrl('');
      onRefreshPublic();
      onClose();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleEyePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/public/eye-pledges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eyeName,
          ageBg: eyeAgeBg,
          phone: eyePhone,
          nid: eyeNid,
          kin: eyeKin,
          kinPhone: eyeKinPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record pledge');
      onNotify(data.message);
      onRefreshPublic();
      onClose();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 overflow-y-auto">
      {/* LOGIN MODAL */}
      {activeModal === 'LOGIN' && (
        <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200 space-y-5 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold text-[#C8102E]">JWT Session Authentication</p>
              <h3 className="text-lg font-extrabold text-[#1A202C]">Sandhani Portal Sign In</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-[#1A202C]">
              Instant 1-Click RBAC Demo Logins (Password: Sandhani@1980):
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onQuickRoleSwitch('DONOR');
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 text-xs font-medium flex items-center justify-between"
              >
                <span>1. Donor &amp; Vaccine Profile (Sadia Afrin Mim)</span>
                <span className="font-mono-tabular font-bold text-emerald-700">DONOR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuickRoleSwitch('SANDHANI_MEMBER');
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-xs font-medium flex items-center justify-between"
              >
                <span>2. Medical Staff (Dr. Mahmudul Hasan Nirob)</span>
                <span className="font-mono-tabular font-bold text-[#C8102E]">SANDHANI_MEMBER</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuickRoleSwitch('SUPER_ADMIN');
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 text-xs font-medium flex items-center justify-between"
              >
                <span>3. Root Admin (Prof. Dr. A.K.M. Shamsul Alam)</span>
                <span className="font-mono-tabular font-bold text-amber-800">SUPER_ADMIN</span>
              </button>
            </div>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address or Phone Number
              </label>
              <input
                id="login-id"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="donor@sandhanirmc.org or 017..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="login-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                id="login-pass"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIdentifier('member@sandhanirmc.org');
                  setLoginPassword('Sandhani@1980');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-[#C8102E]"
              >
                Autofill Staff Credentials
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white font-bold text-xs"
              >
                Sign In to Portal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REGISTER MODAL */}
      {activeModal === 'REGISTER' && (
        <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 border border-slate-200 space-y-5 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold text-[#C8102E]">
                Voluntary Blood Donor &amp; Vaccination Profile Enlistment
              </p>
              <h3 className="text-lg font-extrabold text-[#1A202C]">
                Create Unified Donor &amp; Immunization Account
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>

          {regError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
              {regError}
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Nafis Rahman"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nafis@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label htmlFor="reg-bg" className="block text-xs font-semibold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  id="reg-bg"
                  value={regBloodGroup}
                  onChange={(e) => setRegBloodGroup(e.target.value)}
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
                <label htmlFor="reg-gender" className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  id="reg-gender"
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-dob" className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  id="reg-dob"
                  type="date"
                  required
                  value={regDob}
                  onChange={(e) => setRegDob(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label htmlFor="reg-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                  Address / Medical College Unit
                </label>
                <input
                  id="reg-unit"
                  type="text"
                  required
                  value={regUnit}
                  onChange={(e) => setRegUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                Account Password
              </label>
              <input
                id="reg-pass"
                type="password"
                required
                minLength={6}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white font-bold text-xs"
              >
                Complete Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EMERGENCY BLOOD REQUEST MODAL (WITH REQUISITION SLIP PHOTO UPLOAD) */}
      {activeModal === 'EMERGENCY_REQUEST' && (
        <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 border border-slate-200 space-y-4 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold text-[#C8102E]">
                RMCH 24/7 Emergency Blood Requisition Desk
              </p>
              <h3 className="text-lg font-extrabold text-[#1A202C]">
                Submit Emergency Blood Requisition &amp; Slip Photo
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleEmergencySubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="req-patient" className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient Name &amp; Age
                </label>
                <input
                  id="req-patient"
                  type="text"
                  required
                  value={reqPatient}
                  onChange={(e) => setReqPatient(e.target.value)}
                  placeholder="e.g. Md. Rafiqul Islam (42 yrs)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="req-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Attendant Contact Phone
                </label>
                <input
                  id="req-phone"
                  type="tel"
                  required
                  value={reqPhone}
                  onChange={(e) => setReqPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label htmlFor="req-hosp" className="block text-xs font-semibold text-slate-700 mb-1">
                Hospital, Ward &amp; Bed Number
              </label>
              <input
                id="req-hosp"
                type="text"
                required
                value={reqHospital}
                onChange={(e) => setReqHospital(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="req-bg" className="block text-xs font-semibold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  id="req-bg"
                  value={reqBg}
                  onChange={(e) => setReqBg(e.target.value)}
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
                <label htmlFor="req-units" className="block text-xs font-semibold text-slate-700 mb-1">
                  Units (Bags)
                </label>
                <input
                  id="req-units"
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={reqUnits}
                  onChange={(e) => setReqUnits(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label htmlFor="req-urgency" className="block text-xs font-semibold text-slate-700 mb-1">
                  Urgency
                </label>
                <select
                  id="req-urgency"
                  value={reqUrgency}
                  onChange={(e) => setReqUrgency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  <option value="Critical (Within 2 Hrs)">Critical (2 Hrs)</option>
                  <option value="Urgent (Today)">Urgent (Today)</option>
                  <option value="Scheduled (24 Hrs)">Scheduled (24 Hrs)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="req-ind" className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Indication / Diagnosis
              </label>
              <input
                id="req-ind"
                type="text"
                value={reqIndication}
                onChange={(e) => setReqIndication(e.target.value)}
                placeholder="e.g. Thalassemia Major / Surgery / Trauma"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            {/* Hospital Requisition Photo Upload */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-[#1A202C]">
                Upload Hospital Blood Requisition Slip / Prescription Photo (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Upload requisition slip photo"
                  onChange={handleReqPhotoUpload}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#C8102E] file:text-white"
                />
                <input
                  type="url"
                  value={reqPhotoUrl.startsWith('data:') ? '' : reqPhotoUrl}
                  onChange={(e) => setReqPhotoUrl(e.target.value)}
                  placeholder="Or paste slip image URL..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              {reqPhotoUrl && (
                <div className="pt-1 flex items-center gap-3">
                  <img
                    src={reqPhotoUrl}
                    alt="Requisition slip preview"
                    className="h-16 w-28 object-cover rounded-lg border border-slate-300"
                  />
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Requisition photo attached for medical officer verification
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#C8102E] text-white text-xs font-bold"
              >
                Submit Requisition for Approval
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POSTHUMOUS EYE DONATION PLEDGE MODAL */}
      {activeModal === 'EYE_PLEDGE' && (
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 space-y-4 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold text-[#C8102E]">
                Sandhani National Eye Donation Society
              </p>
              <h3 className="text-lg font-extrabold text-[#1A202C]">
                Sign Posthumous Corneal Pledge
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleEyePledgeSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="eye-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Pledger Full Name
                </label>
                <input
                  id="eye-name"
                  type="text"
                  required
                  value={eyeName}
                  onChange={(e) => setEyeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="eye-agebg" className="block text-xs font-semibold text-slate-700 mb-1">
                  Age &amp; Blood Group
                </label>
                <input
                  id="eye-agebg"
                  type="text"
                  required
                  value={eyeAgeBg}
                  onChange={(e) => setEyeAgeBg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="eye-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Personal Phone
                </label>
                <input
                  id="eye-phone"
                  type="tel"
                  required
                  value={eyePhone}
                  onChange={(e) => setEyePhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label htmlFor="eye-nid" className="block text-xs font-semibold text-slate-700 mb-1">
                  NID / Student ID / Batch
                </label>
                <input
                  id="eye-nid"
                  type="text"
                  required
                  value={eyeNid}
                  onChange={(e) => setEyeNid(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="eye-kin" className="block text-xs font-semibold text-slate-700 mb-1">
                  Next of Kin Name &amp; Relation
                </label>
                <input
                  id="eye-kin"
                  type="text"
                  required
                  value={eyeKin}
                  onChange={(e) => setEyeKin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="eye-kinphone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Next of Kin Phone
                </label>
                <input
                  id="eye-kinphone"
                  type="tel"
                  required
                  value={eyeKinPhone}
                  onChange={(e) => setEyeKinPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#1A202C] text-white text-xs font-bold"
              >
                Record Corneal Pledge
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
