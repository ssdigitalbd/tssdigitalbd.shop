import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut, ExternalLink } from 'lucide-react';

interface RoleAccessDeniedProps {
  requiredRoleName: string;
  currentUser: any;
  onLogout: () => void;
  onNavigateHome: () => void;
  onNavigateDesignatedPortal: () => void;
  designatedPortalName: string;
}

export const RoleAccessDenied: React.FC<RoleAccessDeniedProps> = ({
  requiredRoleName,
  currentUser,
  onLogout,
  onNavigateHome,
  onNavigateDesignatedPortal,
  designatedPortalName,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {requiredRoleName} Access Restricted
        </h2>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          You are currently signed in as <strong className="text-slate-900">{currentUser?.fullName || currentUser?.email}</strong> with role{' '}
          <span className="font-mono uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
            {currentUser?.role}
          </span>
          . This portal is strictly restricted to verified {requiredRoleName.toLowerCase()} accounts.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onNavigateDesignatedPortal}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>Go to {designatedPortalName}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onLogout}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch Account</span>
          </button>

          <button
            onClick={onNavigateHome}
            className="w-full sm:w-auto px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Main Store</span>
          </button>
        </div>
      </div>
    </div>
  );
};
