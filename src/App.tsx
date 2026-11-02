/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ActivePortalView, PublicOverviewData, UserProfile } from './types';
import { Role } from './utils/medicalRules';
import { Navbar } from './components/Navbar';
import { PublicPortal } from './components/PublicPortal';
import { DonorPortal } from './components/DonorPortal';
import { StaffPortal } from './components/StaffPortal';
import { AdminPortal } from './components/AdminPortal';
import { AuthAndPublicModals } from './components/Modals';

const DEFAULT_OVERVIEW: PublicOverviewData = {
  settings: {
    helplinePrimary: '01721-773080',
    helplineSecondary: '025888-57150',
    emergencyBroadcast:
      '24/7 Duty Roster Open • Urgent O- and B- whole blood screening active at RMCH Transfusion Desk',
    cooldownDays: 90,
    googleSheetId: '',
    unitsList: ['Rajshahi Medical College (RMC Unit)', 'Dhaka Medical College (DMC Unit)'],
  },
  stats: {
    bloodUnits: 148525,
    donors: 42864,
    corneas: 3642,
    camps: 1925,
    fridgeBagsTotal: 14,
    vaccineStockTotal: 495,
  },
  board: [],
  donors: [],
  emergencyRequests: [],
  eyePledges: [],
  photos: [],
  membersDirectory: [],
  vaccines: [],
  fridgeSummary: {
    totalInFridge: 14,
    totalVolumeMl: 6300,
    byBloodGroup: {
      'A+': 2,
      'A-': 1,
      'B+': 3,
      'B-': 1,
      'AB+': 2,
      'AB-': 1,
      'O+': 3,
      'O-': 1,
    },
    expiringSoonCount: 1,
  },
};

export default function App() {
  const [activeView, setActiveViewState] = useState<ActivePortalView>(() => {
    const p = window.location.pathname;
    if (p === '/dashboard/donor') return 'DONOR';
    if (p === '/portal/members') return 'STAFF';
    if (p === '/portal/admin') return 'ADMIN';
    return 'PUBLIC';
  });

  const setActiveView = useCallback((view: ActivePortalView) => {
    setActiveViewState(view);
    const pathMap: Record<ActivePortalView, string> = {
      PUBLIC: '/',
      DONOR: '/dashboard/donor',
      STAFF: '/portal/members',
      ADMIN: '/portal/admin',
    };
    if (window.location.pathname !== pathMap[view]) {
      window.history.pushState({}, '', pathMap[view]);
    }
  }, []);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('sandhani_jwt_token')
  );
  const [overview, setOverview] = useState<PublicOverviewData>(DEFAULT_OVERVIEW);
  const [activeModal, setActiveModal] = useState<
    'LOGIN' | 'REGISTER' | 'EMERGENCY_REQUEST' | 'EYE_PLEDGE' | null
  >(null);
  const [bannerNotice, setBannerNotice] = useState<{ text: string; isError: boolean } | null>(
    null
  );

  const notify = useCallback((text: string, isError = false) => {
    setBannerNotice({ text, isError });
    setTimeout(() => {
      setBannerNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const fetchPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch {
      // Keep default fallback if offline
    }
  }, []);

  const fetchCurrentSession = useCallback(async (currentToken: string | null) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchPublicOverview();
    fetchCurrentSession(token);
  }, [fetchPublicOverview, fetchCurrentSession, token]);

  const handleLoginSuccess = (newToken: string, loggedInUser: UserProfile) => {
    localStorage.setItem('sandhani_jwt_token', newToken);
    setToken(newToken);
    setUser(loggedInUser);
    notify(`Signed in as ${loggedInUser.name} (${loggedInUser.role})`);
    if (loggedInUser.role === 'SUPER_ADMIN') {
      setActiveView('ADMIN');
    } else if (loggedInUser.role === 'SANDHANI_MEMBER') {
      setActiveView('STAFF');
    } else {
      setActiveView('DONOR');
    }
  };

  const handleQuickRoleSwitch = async (role: Role) => {
    try {
      const res = await fetch('/api/auth/demo-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not switch role');
      handleLoginSuccess(data.token, data.user);
    } catch (err: any) {
      notify(err.message || 'Failed to switch demo role', true);
    }
  };

  const handleNavigateProfile = () => {
    if (user) {
      setActiveView('DONOR');
    } else {
      handleQuickRoleSwitch('DONOR');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('sandhani_jwt_token');
    setToken(null);
    setUser(null);
    setActiveView('PUBLIC');
    notify('Signed out of Sandhani portal.');
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#1A202C]">
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        settings={overview.settings}
        onOpenModal={(m) => setActiveModal(m)}
        onLogout={handleLogout}
        onQuickRoleSwitch={handleQuickRoleSwitch}
      />

      {/* Notification Banner */}
      {bannerNotice && (
        <div
          role="status"
          className={`px-4 py-2.5 text-xs font-semibold text-center border-b ${
            bannerNotice.isError
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}
        >
          {bannerNotice.text}
        </div>
      )}

      {/* Main Portal Viewport */}
      <main className="flex-1">
        {activeView === 'PUBLIC' && (
          <PublicPortal
            overview={overview}
            onOpenModal={(m) => setActiveModal(m)}
            onNavigateProfile={handleNavigateProfile}
            onRefreshPublic={fetchPublicOverview}
            onNotify={notify}
          />
        )}

        {activeView === 'DONOR' && (
          <DonorPortal
            token={token}
            onProfileUpdated={() => {
              fetchPublicOverview();
              fetchCurrentSession(token);
            }}
            onNotify={notify}
          />
        )}

        {activeView === 'STAFF' && (
          <StaffPortal
            token={token}
            unitsList={overview.settings.unitsList}
            cooldownDays={overview.settings.cooldownDays || 90}
            onDataChanged={fetchPublicOverview}
            onNotify={notify}
          />
        )}

        {activeView === 'ADMIN' && (
          <AdminPortal
            token={token}
            currentUserId={user?.id || ''}
            onSettingsChanged={() => {
              fetchPublicOverview();
              fetchCurrentSession(token);
            }}
            onNotify={notify}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-[#1A202C] text-slate-400 border-t border-slate-800 py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div>
            <div className="font-bold text-white">
              SANDHANI · RAJSHAHI MEDICAL COLLEGE UNIT (EST. JAN 3, 1980)
            </div>
            <div className="mt-1">
              Room 81 Heritage, Shahid Muktijoddha Kazi Nurunnobi Hostel · RMCH Premises, Laxmipur,
              Rajshahi-6000
            </div>
          </div>
          <div className="font-mono-tabular text-slate-300">
            24/7 Duty Desk: {overview.settings.helplinePrimary} ·{' '}
            {overview.settings.helplineSecondary}
          </div>
        </div>
      </footer>

      {/* Auth & Public Modals */}
      <AuthAndPublicModals
        activeModal={activeModal}
        unitsList={overview.settings.unitsList}
        onClose={() => setActiveModal(null)}
        onLoginSuccess={handleLoginSuccess}
        onQuickRoleSwitch={handleQuickRoleSwitch}
        onRefreshPublic={fetchPublicOverview}
        onNotify={notify}
      />
    </div>
  );
}
