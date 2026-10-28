/**
 * Reseller Application & KYC Submission Modal
 */

import React, { useState } from 'react';
import { api } from '../lib/api.ts';
import { CheckCircle, AlertCircle, X, Store } from 'lucide-react';

interface ResellerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResellerApplicationModal: React.FC<ResellerApplicationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [requestedSubdomain, setRequestedSubdomain] = useState('');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !requestedSubdomain || !nationalIdNumber || !contactPhone || !address) {
      setError('Please fill in all mandatory application fields.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.submitResellerApplication({
        businessName: businessName.trim(),
        requestedSubdomain: requestedSubdomain.trim().toLowerCase(),
        nationalIdNumber: nationalIdNumber.trim(),
        tradeLicenseNumber: tradeLicenseNumber.trim() || undefined,
        contactPhone: contactPhone.trim(),
        emergencyContact: emergencyContact.trim() || undefined,
        address: address.trim(),
        kycDocuments: [
          {
            documentType: 'nid_front',
            fileName: 'nid_card_front.jpg',
            fileDataUrl: 'data:image/jpeg;base64,...',
          },
        ],
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Application submission failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">Apply for Reseller Partnership</h3>
            <p className="text-xs text-slate-500">Launch your own branded digital marketplace</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Application Submitted!</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Your requested subdomain{' '}
              <span className="font-mono font-bold text-indigo-600">
                {requestedSubdomain.toLowerCase()}.ssdigitalbd.shop
              </span>{' '}
              and KYC documentation have been submitted for administrator review. You will be notified upon activation.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Store / Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Apex Tech Software Store"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Requested Subdomain <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  required
                  value={requestedSubdomain}
                  onChange={(e) => setRequestedSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="apextech"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-l-lg font-mono text-sm"
                />
                <span className="bg-slate-100 border border-l-0 border-slate-300 px-3 py-2 text-slate-500 rounded-r-lg font-mono text-xs">
                  .ssdigitalbd.shop
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Lowercase letters, numbers, hyphens (e.g. rahim, tanvir-store).
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  National ID (NID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nationalIdNumber}
                  onChange={(e) => setNationalIdNumber(e.target.value)}
                  placeholder="NID Number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trade License (Optional)</label>
                <input
                  type="text"
                  value={tradeLicenseNumber}
                  onChange={(e) => setTradeLicenseNumber(e.target.value)}
                  placeholder="License No"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Phone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Emergency Phone</label>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Office / Business Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address in Bangladesh..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Store className="w-3.5 h-3.5" /> {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
