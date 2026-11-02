import React from 'react';
import { ActivePortalView, OrganizationSettings, UserProfile } from '../types';
import { Role } from '../utils/medicalRules';

interface NavbarProps {
  activeView: ActivePortalView;
  setActiveView: (view: ActivePortalView) => void;
  user: UserProfile | null;
  settings: OrganizationSettings;
  onOpenModal: (modal: 'LOGIN' | 'REGISTER' | 'EMERGENCY_REQUEST') => void;
  onLogout: () => void;
  onQuickRoleSwitch: (role: Role) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  user,
  settings,
  onOpenModal,
  onLogout,
  onQuickRoleSwitch,
}) => {
  return (
    <>
      {/* Top Emergency Broadcast Bar */}
      <div className="bg-[#8E0000] text-white text-xs border-b border-[#450A0A] px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-100 font-medium">
            <span className="font-semibold text-white">Est. Jan 3, 1980</span>
            <span aria-hidden="true">·</span>
            <span className="font-bn hidden md:inline">“স্বেচ্ছায় রক্তদান, মরণোত্তর চক্ষুদান এবং সমাজসেবা”</span>
            <span aria-hidden="true" className="hidden md:inline">·</span>
            <span className="truncate max-w-md">{settings.emergencyBroadcast}</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <a
              href={`tel:${settings.helplinePrimary}`}
              className="font-mono-tabular font-semibold text-amber-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              24/7 Hotline: {settings.helplinePrimary}
            </a>
          </div>
        </div>
      </div>

      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('PUBLIC');
            }}
            className="text-lg font-extrabold tracking-tight text-[#1A202C] hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0"
          >
            SANDHANI RMC UNIT
          </a>

          {/* Zone 2: 4–5 Single-line Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#public-home"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('PUBLIC');
              }}
              className={`hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'PUBLIC' ? 'text-[#C8102E] font-semibold underline underline-offset-8' : ''
              }`}
            >
              Public Home
            </a>
            <a
              href="#blood-bank"
              onClick={() => setActiveView('PUBLIC')}
              className="hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0"
            >
              Blood Bank
            </a>
            <a
              href="#eye-donation"
              onClick={() => setActiveView('PUBLIC')}
              className="hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0"
            >
              Eye Donation
            </a>
            <a
              href="#dashboard-donor"
              onClick={(e) => {
                e.preventDefault();
                if (user) {
                  setActiveView('DONOR');
                } else {
                  onOpenModal('LOGIN');
                }
              }}
              className={`hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'DONOR' ? 'text-[#C8102E] font-semibold underline underline-offset-8' : ''
              }`}
            >
              Donor Dashboard
            </a>
            {(user?.role === 'SANDHANI_MEMBER' || user?.role === 'SUPER_ADMIN') && (
              <a
                href="#portal-members"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('STAFF');
                }}
                className={`hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'STAFF' ? 'text-[#C8102E] font-semibold underline underline-offset-8' : ''
                }`}
              >
                Staff Portal
              </a>
            )}
            {user?.role === 'SUPER_ADMIN' && (
              <a
                href="#portal-admin"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('ADMIN');
                }}
                className={`hover:text-[#C8102E] transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'ADMIN' ? 'text-[#C8102E] font-semibold underline underline-offset-8' : ''
                }`}
              >
                Admin Settings
              </a>
            )}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1A202C] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out ({user.name.split(' ')[0]})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenModal('LOGIN')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#C8102E] rounded-lg hover:bg-[#A60D26] transition-colors whitespace-nowrap shrink-0"
              >
                Portal Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* RBAC Workspace & Role Switcher Toolbar Below Header */}
      <div className="bg-[#1A202C] text-slate-200 border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Active RBAC Session:</span>
            {user ? (
              <span className="font-semibold text-white">
                {user.name} · {user.bloodGroup} · Role: {user.role}
              </span>
            ) : (
              <span className="text-slate-300">Public Visitor (Phone Numbers Redacted)</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 hidden sm:inline">Instant Role Demo:</span>
            <button
              type="button"
              onClick={() => onQuickRoleSwitch('DONOR')}
              className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                user?.role === 'DONOR'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Donor View (/dashboard/donor)
            </button>
            <button
              type="button"
              onClick={() => onQuickRoleSwitch('SANDHANI_MEMBER')}
              className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                user?.role === 'SANDHANI_MEMBER'
                  ? 'bg-[#C8102E] text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Staff Member (/portal/members)
            </button>
            <button
              type="button"
              onClick={() => onQuickRoleSwitch('SUPER_ADMIN')}
              className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                user?.role === 'SUPER_ADMIN'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Super Admin (/portal/admin)
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
