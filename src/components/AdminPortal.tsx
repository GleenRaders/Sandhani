import React, { useEffect, useState } from 'react';
import {
  AdminUserItem,
  AuditLogItem,
  EmergencyRequestItem,
  FridgeBagItem,
  GalleryPhotoItem,
  OrganizationSettings,
  SandhaniMemberDirectoryItem,
  VaccineCatalogItem,
} from '../types';
import {
  FridgeSummaryResult,
  Role,
  VALID_BLOOD_GROUPS,
} from '../utils/medicalRules';
import {
  BackupPayloadSnapshot,
  createAndSyncBackupSpreadsheet,
  getSheetsAccessToken,
  googleSheetsLogout,
  googleSignInForSheets,
  initGoogleSheetsAuth,
  syncToExistingSpreadsheet,
} from '../utils/googleSheets';

interface AdminPortalProps {
  token: string | null;
  currentUserId: string;
  onSettingsChanged: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  token,
  currentUserId,
  onSettingsChanged,
  onNotify,
}) => {
  const [adminTab, setAdminTab] = useState<
    'REQUISITIONS_SHEETS' | 'MEMBERS_FRIDGE_VACCINES' | 'SETTINGS_RBAC'
  >('REQUISITIONS_SHEETS');

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [photos, setPhotos] = useState<GalleryPhotoItem[]>([]);
  const [requisitions, setRequisitions] = useState<EmergencyRequestItem[]>([]);
  const [membersDirectory, setMembersDirectory] = useState<SandhaniMemberDirectoryItem[]>([]);
  const [vaccines, setVaccines] = useState<VaccineCatalogItem[]>([]);
  const [fridgeBags, setFridgeBags] = useState<FridgeBagItem[]>([]);
  const [fridgeSummary, setFridgeSummary] = useState<FridgeSummaryResult | null>(null);
  const [searchUser, setSearchUser] = useState('');

  // Organization Settings State
  const [helplinePrimary, setHelplinePrimary] = useState('01721-773080');
  const [helplineSecondary, setHelplineSecondary] = useState('025888-57150');
  const [emergencyBroadcast, setEmergencyBroadcast] = useState('');
  const [cooldownDays, setCooldownDays] = useState<string>('90');
  const [googleSheetId, setGoogleSheetId] = useState<string>('');
  const [unitsText, setUnitsText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Google Sheets OAuth State (following workspace-integration skill)
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [lastSyncedSheetUrl, setLastSyncedSheetUrl] = useState<string>('');
  // Mandatory destructive/mutating operation confirmation modal for overwriting existing Google Sheet
  const [confirmOverwriteModal, setConfirmOverwriteModal] = useState(false);

  // Requisition Edit & Photo Upload Modal State
  const [editingReq, setEditingReq] = useState<EmergencyRequestItem | null>(null);
  const [editReqPatient, setEditReqPatient] = useState('');
  const [editReqHospital, setEditReqHospital] = useState('');
  const [editReqBg, setEditReqBg] = useState('O+');
  const [editReqUnits, setEditReqUnits] = useState('1');
  const [editReqUrgency, setEditReqUrgency] = useState('Urgent (Today)');
  const [editReqPhone, setEditReqPhone] = useState('');
  const [editReqIndication, setEditReqIndication] = useState('');
  const [editReqStatus, setEditReqStatus] = useState('APPROVED');
  const [editReqPhoto, setEditReqPhoto] = useState('');

  // Add Member Form State
  const [memName, setMemName] = useState('');
  const [memPhone, setMemPhone] = useState('');
  const [memDesignation, setMemDesignation] = useState('Executive Member · RMC Unit');
  const [memBatch, setMemBatch] = useState('RMC-62nd Batch (4th Year MBBS)');
  const [memBg, setMemBg] = useState('O+');
  const [memPhotoUrl, setMemPhotoUrl] = useState('');

  // Vaccine Inline Edit State
  const [vaccineEdits, setVaccineEdits] = useState<
    Record<string, { priceBdt: string; stockCount: string; totalDoses: string }>
  >({});

  // Photo Gallery Form State
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoCategory, setNewPhotoCategory] = useState('Blood Drive Camp');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  useEffect(() => {
    const unsubscribe = initGoogleSheetsAuth(
      (user, accessToken) => {
        setGoogleUserEmail(user.email || user.displayName || 'Connected Google User');
        setGoogleAccessToken(accessToken);
      },
      () => {
        setGoogleUserEmail(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchAdminOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load Super Admin console');
      const data = await res.json();
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
      setPhotos(data.photos || []);
      setRequisitions(data.requisitions || []);
      setMembersDirectory(data.membersDirectory || []);
      setVaccines(data.vaccines || []);
      setFridgeBags(data.fridgeBags || []);
      setFridgeSummary(data.fridgeSummary || null);

      const initialEdits: Record<
        string,
        { priceBdt: string; stockCount: string; totalDoses: string }
      > = {};
      for (const v of data.vaccines || []) {
        initialEdits[v.id] = {
          priceBdt: String(v.priceBdt),
          stockCount: String(v.stockCount),
          totalDoses: String(v.totalDoses),
        };
      }
      setVaccineEdits(initialEdits);

      const s: OrganizationSettings = data.settings;
      if (s) {
        setHelplinePrimary(s.helplinePrimary);
        setHelplineSecondary(s.helplineSecondary);
        setEmergencyBroadcast(s.emergencyBroadcast);
        setCooldownDays(String(s.cooldownDays || 90));
        setGoogleSheetId(s.googleSheetId || '');
        setUnitsText((s.unitsList || []).join('\n'));
      }
    } catch (err: any) {
      onNotify(err.message || 'Could not load Admin console', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminOverview();
  }, [token]);

  // ==========================================================================
  // 1. REQUISITION APPROVAL, FULFILLMENT, EDITING & PHOTO UPLOAD
  // ==========================================================================
  const handleQuickRequisitionStatus = async (
    reqItem: EmergencyRequestItem,
    nextStatus: 'APPROVED' | 'FULFILLED'
  ) => {
    try {
      const res = await fetch(`/api/admin/requisitions/${reqItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update requisition');
      onNotify(data.message);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleDeleteRequisition = async (reqId: string) => {
    try {
      const res = await fetch(`/api/admin/requisitions/${reqId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove requisition');
      onNotify(data.message);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const openEditRequisitionModal = (r: EmergencyRequestItem) => {
    setEditingReq(r);
    setEditReqPatient(r.patient);
    setEditReqHospital(r.hospital);
    setEditReqBg(r.bloodGroup);
    setEditReqUnits(String(r.units));
    setEditReqUrgency(r.urgency);
    setEditReqPhone(r.phone);
    setEditReqIndication(r.indication);
    setEditReqStatus(r.status);
    setEditReqPhoto(r.requisitionPhotoUrl || '');
  };

  const handleEditReqPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditReqPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditedRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;
    try {
      const res = await fetch(`/api/admin/requisitions/${editingReq.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          patient: editReqPatient,
          hospital: editReqHospital,
          bloodGroup: editReqBg,
          units: Number(editReqUnits),
          urgency: editReqUrgency,
          phone: editReqPhone,
          indication: editReqIndication,
          status: editReqStatus,
          requisitionPhotoUrl: editReqPhoto,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save requisition');
      onNotify(data.message);
      setEditingReq(null);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  // ==========================================================================
  // 2. GOOGLE SHEETS BACKUP & SYNC HANDLERS
  // ==========================================================================
  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignInForSheets();
      if (result) {
        setGoogleUserEmail(result.user.email || result.user.displayName || 'Connected');
        setGoogleAccessToken(result.accessToken);
        onNotify(`Connected Google Sheets as ${result.user.email}`);
      }
    } catch (err: any) {
      onNotify(err.message || 'Google Sign-In cancelled or failed', true);
    }
  };

  const fetchBackupSnapshot = async (): Promise<BackupPayloadSnapshot> => {
    const res = await fetch('/api/admin/backup-snapshot', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load database snapshot for backup');
    return res.json();
  };

  const handleCreateNewBackupSheet = async () => {
    const activeToken = googleAccessToken || getSheetsAccessToken();
    if (!activeToken) {
      onNotify('Please sign in with Google first to create a backup spreadsheet.', true);
      return;
    }
    setSyncingSheets(true);
    try {
      const snapshot = await fetchBackupSnapshot();
      const created = await createAndSyncBackupSpreadsheet(activeToken, snapshot);
      setGoogleSheetId(created.spreadsheetId);
      setLastSyncedSheetUrl(created.spreadsheetUrl);
      onNotify(`Created & synced Google Sheet "${created.title}"!`);
    } catch (err: any) {
      onNotify(err.message || 'Failed to create Google Sheet backup', true);
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleConfirmSyncExistingSheet = async () => {
    setConfirmOverwriteModal(false);
    const activeToken = googleAccessToken || getSheetsAccessToken();
    if (!activeToken) {
      onNotify('Please sign in with Google first.', true);
      return;
    }
    if (!googleSheetId.trim()) {
      onNotify('Please enter a Google Sheet ID or URL to sync.', true);
      return;
    }
    setSyncingSheets(true);
    try {
      const snapshot = await fetchBackupSnapshot();
      const result = await syncToExistingSpreadsheet(activeToken, googleSheetId, snapshot);
      setLastSyncedSheetUrl(result.spreadsheetUrl);
      onNotify(
        `Synced ${result.rowsWritten} rows to Google Sheet tab "${result.sheetTitle}"!`
      );
    } catch (err: any) {
      onNotify(err.message || 'Failed to sync to existing Google Sheet', true);
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleDownloadJsonSnapshot = async () => {
    try {
      const snapshot = await fetchBackupSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sandhani-rmc-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('Downloaded full Sandhani database backup (.json).');
    } catch (err: any) {
      onNotify(err.message || 'Failed to download backup', true);
    }
  };

  // ==========================================================================
  // 3. SANDHANI MEMBER DIRECTORY & VACCINE CATALOG HANDLERS
  // ==========================================================================
  const handleMemberPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMemPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: memName,
          phone: memPhone,
          designation: memDesignation,
          batch: memBatch,
          bloodGroup: memBg,
          photoUrl: memPhotoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add member');
      onNotify(data.message);
      setMemName('');
      setMemPhone('');
      setMemPhotoUrl('');
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove member');
      onNotify(data.message);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleSaveVaccineRow = async (vaccineId: string) => {
    const row = vaccineEdits[vaccineId];
    if (!row) return;
    try {
      const res = await fetch(`/api/admin/vaccines/${vaccineId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          priceBdt: Number(row.priceBdt),
          stockCount: Number(row.stockCount),
          totalDoses: Number(row.totalDoses),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update vaccine');
      onNotify(data.message);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  // ==========================================================================
  // 4. SETTINGS, COOLDOWN RULE & RBAC HANDLERS
  // ==========================================================================
  const handleRoleChange = async (userId: string, newRole: Role, unit: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole, unit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      onNotify(data.message);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const unitsList = unitsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedCooldown = Math.max(1, Math.min(365, parseInt(cooldownDays, 10) || 90));
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          helplinePrimary,
          helplineSecondary,
          emergencyBroadcast,
          cooldownDays: parsedCooldown,
          googleSheetId,
          unitsList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setCooldownDays(String(data.cooldownDays || parsedCooldown));
      onNotify(data.message);
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoTitle.trim() || !newPhotoUrl.trim()) return;
    try {
      const res = await fetch('/api/public/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPhotoTitle,
          category: newPhotoCategory,
          imageUrl: newPhotoUrl,
          caption: newPhotoCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add photo');
      onNotify(data.message);
      setNewPhotoTitle('');
      setNewPhotoCaption('');
      setNewPhotoUrl('');
      await fetchAdminOverview();
      onSettingsChanged();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchUser.trim()) return true;
    const q = searchUser.trim().toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Super Admin Header */}
      <div className="bg-[#1A202C] text-white rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            /portal/admin · Root Administrator Control Center · RBAC Tier 1
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
            Requisition Approval, Google Sheets Backup, Blood Fridge &amp; Vaccine Governance
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Approve, edit, or fulfill blood requisitions with slip photos, sync backups to Google
            Sheets, manage Sandhani members with photos, inspect refrigerator blood bags, and update
            vaccine prices.
          </p>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right font-mono-tabular">
            <span className="text-xs text-slate-400 block">Fridge Blood Stock</span>
            <span className="text-2xl font-extrabold text-emerald-400">
              {fridgeSummary?.totalInFridge || 0} Bags
            </span>
          </div>
          <div className="text-right font-mono-tabular">
            <span className="text-xs text-slate-400 block">Active Cooldown Rule</span>
            <span className="text-2xl font-extrabold text-amber-300">{cooldownDays} Days</span>
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/80 p-1.5 rounded-xl w-fit">
        <button
          type="button"
          data-testid="admin-tab-requisitions"
          onClick={() => setAdminTab('REQUISITIONS_SHEETS')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
            adminTab === 'REQUISITIONS_SHEETS'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          01. Requisitions Approval &amp; Google Sheets Backup ({requisitions.length})
        </button>
        <button
          type="button"
          data-testid="admin-tab-members-fridge"
          onClick={() => setAdminTab('MEMBERS_FRIDGE_VACCINES')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
            adminTab === 'MEMBERS_FRIDGE_VACCINES'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          02. Members Directory ({membersDirectory.length}), Blood Fridge &amp; Vaccine Pricing
        </button>
        <button
          type="button"
          data-testid="admin-tab-settings"
          onClick={() => setAdminTab('SETTINGS_RBAC')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
            adminTab === 'SETTINGS_RBAC'
              ? 'bg-white text-[#1A202C] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          03. Cooldown Rule ({cooldownDays}d), RBAC Matrix &amp; Photo Archive
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ADMIN TAB 1: REQUISITION MANAGEMENT & GOOGLE SHEETS BACKUP           */}
      {/* ==================================================================== */}
      {adminTab === 'REQUISITIONS_SHEETS' && (
        <div className="space-y-8">
          {/* GOOGLE SHEETS CLOUD BACKUP & SYNC PANEL */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Google Workspace Cloud Integration · Live Database Backup
                </p>
                <h2 className="text-lg font-extrabold text-[#1A202C] mt-0.5">
                  Connect Google Sheets to Sync &amp; Manage Sandhani Data Backup
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronizes Blood Fridge Inventory, Requisitions, Vaccine Stock &amp; Pricing,
                  Sandhani Member Directory, and Voluntary Donors directly to your Google Sheet.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {googleUserEmail ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-emerald-900">{googleUserEmail}</span>
                    <button
                      type="button"
                      onClick={() => googleSheetsLogout()}
                      className="ml-2 text-rose-700 font-bold hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 shadow-xs text-xs font-bold text-slate-800 transition-colors"
                  >
                    <div className="gsi-material-button-icon w-4 h-4">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">Sign in with Google</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadJsonSnapshot}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                >
                  Download Local Backup (.json)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Connected Google Sheet ID or Full Spreadsheet URL
                </label>
                <input
                  type="text"
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  placeholder="Paste Google Sheet URL or Spreadsheet ID..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                />
              </div>
              <div className="lg:col-span-3">
                <button
                  type="button"
                  disabled={syncingSheets}
                  onClick={handleCreateNewBackupSheet}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {syncingSheets ? 'Syncing...' : '+ Create New Backup Sheet'}
                </button>
              </div>
              <div className="lg:col-span-3">
                <button
                  type="button"
                  disabled={syncingSheets || !googleSheetId.trim()}
                  onClick={() => setConfirmOverwriteModal(true)}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A202C] hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
                >
                  Sync to Existing Sheet
                </button>
              </div>
            </div>

            {lastSyncedSheetUrl && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900">
                  Google Sheet backup synced successfully!
                </span>
                <a
                  href={lastSyncedSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-800 underline"
                >
                  Open Synced Google Sheet →
                </a>
              </div>
            )}
          </div>

          {/* EMERGENCY BLOOD REQUISITIONS APPROVAL, EDIT, PHOTO & FULFILLMENT TABLE */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1A202C]">
                  Emergency Blood Requisitions Governance (Approve, Fulfill, Edit &amp; Slip Photos)
                </h2>
                <p className="text-xs text-slate-500">
                  Verify hospital requisition slip photos, approve pending requests, mark fulfilled
                  when blood bags are dispatched, or edit/remove entries.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-red-50 text-[#C8102E] font-mono-tabular text-xs font-bold">
                {requisitions.length} Total Requisitions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-3 px-4 font-semibold">Slip Photo</th>
                    <th className="py-3 px-4 font-semibold">Patient &amp; Hospital Ward</th>
                    <th className="py-3 px-4 font-semibold">Group &amp; Units</th>
                    <th className="py-3 px-4 font-semibold">Contact &amp; Indication</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Admin Requisition Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requisitions.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        {r.requisitionPhotoUrl ? (
                          <img
                            src={r.requisitionPhotoUrl}
                            alt={r.patient}
                            className="h-12 w-20 object-cover rounded-lg border border-slate-200"
                          />
                        ) : (
                          <span className="text-slate-400">No photo</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1A202C]">{r.patient}</div>
                        <div className="text-slate-500">{r.hospital}</div>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular">
                        <span className="font-extrabold text-sm text-[#C8102E]">
                          {r.bloodGroup}
                        </span>{' '}
                        · {r.units} Bag(s)
                        <div className="text-[11px] text-slate-500">{r.urgency}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono-tabular font-bold text-slate-800">{r.phone}</div>
                        <div className="text-slate-500">{r.indication}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            r.status === 'FULFILLED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : r.status === 'APPROVED' || r.status === 'OPEN'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {r.status !== 'APPROVED' && r.status !== 'FULFILLED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickRequisitionStatus(r, 'APPROVED')}
                            className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold"
                          >
                            Approve
                          </button>
                        )}
                        {r.status !== 'FULFILLED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickRequisitionStatus(r, 'FULFILLED')}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            Mark Fulfilled
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditRequisitionModal(r)}
                          className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
                        >
                          Edit / Upload Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequisition(r.id)}
                          className="px-2.5 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN TAB 2: MEMBERS DIRECTORY, BLOOD FRIDGE & VACCINE PRICING       */}
      {/* ==================================================================== */}
      {adminTab === 'MEMBERS_FRIDGE_VACCINES' && (
        <div className="space-y-8">
          {/* 1. ADD & MANAGE SANDHANI MEMBERS (NAME, NUMBER, DESIGNATION & PHOTO) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
                Executive Committee &amp; Volunteer Roster
              </p>
              <h2 className="text-lg font-extrabold text-[#1A202C] mt-0.5">
                Sandhani Member Directory Manager (Add Name, Phone Number &amp; Photo)
              </h2>
            </div>

            <form
              onSubmit={handleAddMember}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Member Full Name
                </label>
                <input
                  type="text"
                  required
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  placeholder="Dr. / Student Name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={memPhone}
                  onChange={(e) => setMemPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Designation / Post
                </label>
                <input
                  type="text"
                  required
                  value={memDesignation}
                  onChange={(e) => setMemDesignation(e.target.value)}
                  placeholder="e.g. Vice President"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Batch &amp; Blood Group
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={memBatch}
                    onChange={(e) => setMemBatch(e.target.value)}
                    placeholder="RMC-62nd"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                  <select
                    value={memBg}
                    onChange={(e) => setMemBg(e.target.value)}
                    className="px-2 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular font-bold bg-white"
                  >
                    {VALID_BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Upload Member Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMemberPhotoFile}
                  className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-200 file:text-slate-800"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-xs font-bold"
                >
                  + Add Member
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {membersDirectory.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={m.photoUrl}
                      alt={m.name}
                      className="h-12 w-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-900"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#1A202C] truncate">
                        {m.name} ({m.bloodGroup})
                      </div>
                      <div className="text-[11px] text-[#C8102E] font-semibold truncate">
                        {m.designation}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-600">{m.phone}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(m.id)}
                    className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. VACCINE CATALOG PRICE (BDT), DOSES & STOCK UPDATER */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Cold-Chain Immunization Wing Governance
              </p>
              <h2 className="text-lg font-extrabold text-[#1A202C] mt-0.5">
                Vaccine Price (BDT), Dose Count &amp; Stock Inventory Editor
              </h2>
              <p className="text-xs text-slate-500">
                Update the official price per dose, required doses, or current vial stock for any
                vaccine. Changes apply immediately on the homepage and donor portal.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-3 px-4 font-semibold">Vaccine Name &amp; Schedule</th>
                    <th className="py-3 px-4 font-semibold">Price per Dose (৳ BDT)</th>
                    <th className="py-3 px-4 font-semibold">Vials / Doses in Stock</th>
                    <th className="py-3 px-4 font-semibold">Total Doses</th>
                    <th className="py-3 px-4 font-semibold text-right">Save Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vaccines.map((v) => {
                    const editRow = vaccineEdits[v.id] || {
                      priceBdt: String(v.priceBdt),
                      stockCount: String(v.stockCount),
                      totalDoses: String(v.totalDoses),
                    };
                    return (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#1A202C]">{v.name}</div>
                          <div className="text-slate-500">{v.scheduleText}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            min={0}
                            value={editRow.priceBdt}
                            onChange={(e) =>
                              setVaccineEdits((prev) => ({
                                ...prev,
                                [v.id]: { ...editRow, priceBdt: e.target.value },
                              }))
                            }
                            className="w-28 px-3 py-1.5 rounded-lg border border-slate-300 font-mono-tabular font-bold text-[#C8102E]"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            min={0}
                            value={editRow.stockCount}
                            onChange={(e) =>
                              setVaccineEdits((prev) => ({
                                ...prev,
                                [v.id]: { ...editRow, stockCount: e.target.value },
                              }))
                            }
                            className="w-28 px-3 py-1.5 rounded-lg border border-slate-300 font-mono-tabular font-bold text-emerald-800"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={editRow.totalDoses}
                            onChange={(e) =>
                              setVaccineEdits((prev) => ({
                                ...prev,
                                [v.id]: { ...editRow, totalDoses: e.target.value },
                              }))
                            }
                            className="w-20 px-3 py-1.5 rounded-lg border border-slate-300 font-mono-tabular font-bold"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveVaccineRow(v.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            Update Vaccine
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. ADMIN BLOOD FRIDGE SERIAL INVENTORY */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#1A202C]">
                  Blood Refrigerator Vault Snapshot ({fridgeSummary?.totalInFridge || 0} Bags in
                  Fridge)
                </h2>
                <p className="text-xs text-slate-500">
                  Serial-numbered whole blood bags with collection and 35-day CPDA-1 expiry dates
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">Serial Number</th>
                    <th className="py-2.5 px-3 font-semibold">Blood Group</th>
                    <th className="py-2.5 px-3 font-semibold">Collection Date</th>
                    <th className="py-2.5 px-3 font-semibold">Expiry Date</th>
                    <th className="py-2.5 px-3 font-semibold">Compartment &amp; Donor</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fridgeBags.slice(0, 12).map((bag) => (
                    <tr key={bag.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#1A202C]">
                        {bag.serialNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular font-extrabold text-[#C8102E]">
                        {bag.bloodGroup}
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular">{bag.collectionDate}</td>
                      <td className="py-2.5 px-3 font-mono-tabular">{bag.expiryDate}</td>
                      <td className="py-2.5 px-3">
                        {bag.compartment} · {bag.donorName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            bag.status === 'IN_FRIDGE'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {bag.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN TAB 3: COOLDOWN RULE, RBAC MATRIX & PHOTO ARCHIVE              */}
      {/* ==================================================================== */}
      {adminTab === 'SETTINGS_RBAC' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Role Management Table */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-[#1A202C]">
                    RBAC Role Elevation &amp; User Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Promote donors to Sandhani Member or Root Administrator
                  </p>
                </div>
                <input
                  type="text"
                  aria-label="Filter users by name, email, or role"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Filter users..."
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="py-2.5 px-3 font-semibold">User &amp; Contact</th>
                      <th className="py-2.5 px-3 font-semibold">Group</th>
                      <th className="py-2.5 px-3 font-semibold">Assign Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#1A202C]">{u.name}</div>
                          <div className="text-slate-500 font-mono-tabular">
                            {u.email} · {u.phone}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono-tabular font-extrabold text-[#C8102E]">
                          {u.bloodGroup}
                        </td>
                        <td className="py-3 px-3">
                          <select
                            aria-label={`Assign role for ${u.name}`}
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value as Role, u.unit)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-[#1A202C] bg-white"
                          >
                            <option value="DONOR">DONOR (Public / Personal)</option>
                            <option value="SANDHANI_MEMBER">SANDHANI_MEMBER (Staff)</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN (Root)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Organization & Medical Cooldown Rule Settings Editor */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-extrabold text-[#1A202C]">
                  Clinical Cooldown Rule &amp; Organization Settings
                </h2>
                <p className="text-xs text-slate-500">
                  Customize the required whole-blood donation interval (in days), helplines, and
                  live emergency broadcast banner.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="admin-cooldown-days"
                      className="text-xs font-extrabold text-[#1A202C]"
                    >
                      Minimum Donation Cooldown Interval (Days)
                    </label>
                    <span className="text-xs font-mono-tabular font-bold text-[#C8102E]">
                      Current: {cooldownDays} Days
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="admin-cooldown-days"
                      data-testid="input-cooldown-days"
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={cooldownDays}
                      onChange={(e) => setCooldownDays(e.target.value)}
                      className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular font-bold bg-white"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[60, 90, 100, 120].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCooldownDays(String(preset))}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular font-semibold border transition-colors ${
                            Number(cooldownDays) === preset
                              ? 'bg-[#C8102E] text-white border-[#C8102E]'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {preset}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary 24/7 Helpline
                    </label>
                    <input
                      type="text"
                      required
                      value={helplinePrimary}
                      onChange={(e) => setHelplinePrimary(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Secondary RMCH Desk Line
                    </label>
                    <input
                      type="text"
                      required
                      value={helplineSecondary}
                      onChange={(e) => setHelplineSecondary(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Broadcast Message (Top Homepage Alert Bar)
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyBroadcast}
                    onChange={(e) => setEmergencyBroadcast(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full py-2.5 rounded-lg bg-[#C8102E] hover:bg-[#A60D26] text-white text-xs font-bold transition-colors"
                >
                  {savingSettings ? 'Saving Settings...' : 'Publish Organization Settings'}
                </button>
              </form>
            </div>
          </div>

          {/* Official Photo Gallery Manager */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-extrabold text-[#1A202C]">
                Official Campus &amp; Blood Drive Photo Gallery Manager
              </h2>
            </div>

            <form
              onSubmit={handleAddPhoto}
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200"
            >
              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Photo Title
                </label>
                <input
                  type="text"
                  required
                  value={newPhotoTitle}
                  onChange={(e) => setNewPhotoTitle(e.target.value)}
                  placeholder="e.g. Voluntary Blood Grouping Camp"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Photo File
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileSelect}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-slate-800"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or Image URL
                </label>
                <input
                  type="url"
                  value={newPhotoUrl.startsWith('data:') ? '' : newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
              </div>
              <div className="lg:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#1A202C] hover:bg-slate-800 text-white text-xs font-bold"
                >
                  Add Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT REQUISITION & UPLOAD SLIP PHOTO */}
      {editingReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-bold text-[#C8102E]">Admin Requisition Editor</p>
                <h3 className="text-lg font-extrabold text-[#1A202C]">
                  Edit Requisition &amp; Slip Photo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingReq(null)}
                className="text-xs font-semibold text-slate-500"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveEditedRequisition} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editReqPatient}
                    onChange={(e) => setEditReqPatient(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={editReqPhone}
                    onChange={(e) => setEditReqPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital &amp; Ward
                </label>
                <input
                  type="text"
                  required
                  value={editReqHospital}
                  onChange={(e) => setEditReqHospital(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={editReqBg}
                    onChange={(e) => setEditReqBg(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular font-bold"
                  >
                    {VALID_BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units</label>
                  <input
                    type="number"
                    min={1}
                    value={editReqUnits}
                    onChange={(e) => setEditReqUnits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editReqStatus}
                    onChange={(e) => setEditReqStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                  >
                    <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="FULFILLED">FULFILLED</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Upload Replacement Requisition Slip Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditReqPhotoFile}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800"
                />
                {editReqPhoto && (
                  <img
                    src={editReqPhoto}
                    alt="Requisition preview"
                    className="h-24 w-44 object-cover rounded-lg border border-slate-300 mt-1"
                  />
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReq(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#C8102E] text-white text-xs font-bold"
                >
                  Save Requisition Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY CONFIRMATION DIALOG FOR MUTATING/OVERWRITING EXISTING GOOGLE SHEET */}
      {confirmOverwriteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-extrabold text-[#1A202C]">
              Confirm Google Sheet Data Update
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to update and overwrite the first tab of Google Sheet{' '}
              <strong className="font-mono-tabular text-slate-900">{googleSheetId}</strong> with the
              latest Sandhani backup snapshot ({requisitions.length} requisitions,{' '}
              {fridgeBags.length} blood bags, {vaccines.length} vaccines,{' '}
              {membersDirectory.length} members, and {users.length} donors). Do you want to proceed?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOverwriteModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSyncExistingSheet}
                className="px-4 py-2 rounded-lg bg-[#C8102E] text-white text-xs font-bold"
              >
                Confirm &amp; Update Google Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
