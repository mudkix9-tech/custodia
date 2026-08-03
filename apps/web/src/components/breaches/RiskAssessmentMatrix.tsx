import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function RiskAssessmentMatrix({ breach, onAssess }: { breach: any, onAssess: () => void }) {
  const assessMutation = trpc.breaches.updateAssessment.useMutation({
    onSuccess: () => onAssess()
  });

  const [form, setForm] = useState({
    dataCategories: breach.dataCategoriesAffected || [],
    recordsAffected: breach.estimatedRecordsAffected || 0,
    identityTheftRisk: breach.riskAssessmentDetail?.includes('identityTheftRisk') || false,
    dataWasEncrypted: breach.riskAssessmentDetail?.includes('dataWasEncrypted') || false,
    confirmedAccess: breach.riskAssessmentDetail?.includes('confirmedAccess') || false,
    publiclyAccessible: breach.riskAssessmentDetail?.includes('publiclyAccessible') || false,
    maliciousIntent: breach.riskAssessmentDetail?.includes('maliciousIntent') || false,
    containedWithinHours: breach.riskAssessmentDetail?.includes('containedWithinHours') || false,
  });

  const handleToggleCategory = (cat: string) => {
    if (form.dataCategories.includes(cat)) {
      setForm({ ...form, dataCategories: form.dataCategories.filter((c: string) => c !== cat) });
    } else {
      setForm({ ...form, dataCategories: [...form.dataCategories, cat] });
    }
  };

  const handleToggleBool = (key: keyof typeof form) => {
    setForm({ ...form, [key]: !form[key] });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Risk Assessment Matrix</h3>
        <p className="text-sm text-gray-500 mt-1">
          Complete the assessment to evaluate the risk to individuals. The system uses a severity vs likelihood matrix to determine required notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Severity Factors */}
        <div className="space-y-6">
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
              Severity Factors
            </h4>
            
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Categories Affected</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {['financial', 'health', 'credentials', 'identity', 'contact'].map(cat => (
                <button
                  key={cat}
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border transition-colors ${
                    form.dataCategories.includes(cat) 
                    ? 'bg-red-500/10 border-red-500 text-red-400 dark:bg-red-900/30 dark:text-red-300' 
                    : 'bg-[#0D0F11] border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2">Estimated Records Affected</label>
            <input
              type="number"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-panel-elevated focus:border-red-500 focus:ring-red-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={form.recordsAffected}
              onChange={e => setForm({ ...form, recordsAffected: parseInt(e.target.value) || 0 })}
            />

            <div className="space-y-3 mt-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" className="rounded text-red-400 focus:ring-red-500 h-4 w-4" checked={form.identityTheftRisk} onChange={() => handleToggleBool('identityTheftRisk')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">High risk of identity theft or fraud</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" className="rounded text-red-400 focus:ring-red-500 h-4 w-4" checked={form.dataWasEncrypted} onChange={() => handleToggleBool('dataWasEncrypted')} />
                <span className="text-sm text-gray-700 dark:text-gray-300">Data was strongly encrypted (keys secure)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Likelihood Factors */}
        <div className="space-y-6">
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
              Likelihood Factors
            </h4>
            
            <div className="space-y-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" className="rounded text-red-400 focus:ring-red-500 h-4 w-4 mt-0.5" checked={form.confirmedAccess} onChange={() => handleToggleBool('confirmedAccess')} />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmed Access/Exfiltration</span>
                  <p className="text-xs text-gray-500">There is evidence that data was actually accessed or copied by an unauthorized party.</p>
                </div>
              </label>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" className="rounded text-red-400 focus:ring-red-500 h-4 w-4 mt-0.5" checked={form.publiclyAccessible} onChange={() => handleToggleBool('publiclyAccessible')} />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Data made publicly accessible</span>
                  <p className="text-xs text-gray-500">Data was exposed on the open internet without authentication.</p>
                </div>
              </label>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" className="rounded text-red-400 focus:ring-red-500 h-4 w-4 mt-0.5" checked={form.maliciousIntent} onChange={() => handleToggleBool('maliciousIntent')} />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Malicious Intent (e.g. Ransomware)</span>
                  <p className="text-xs text-gray-500">The incident was a targeted attack rather than accidental exposure.</p>
                </div>
              </label>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" className="rounded text-red-400 focus:ring-red-500 h-4 w-4 mt-0.5" checked={form.containedWithinHours} onChange={() => handleToggleBool('containedWithinHours')} />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Contained within hours</span>
                  <p className="text-xs text-gray-500">The breach was identified and contained very quickly before widespread access.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6 flex justify-between items-center">
        <div className="flex gap-4">
          {breach.riskToIndividuals && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Current Risk Level:</span>
              <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                {breach.riskToIndividuals}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => assessMutation.mutate({ id: breach.id, answers: form })}
          disabled={assessMutation.isPending}
          className="px-6 py-2 bg-gray-900 hover:bg-black dark:bg-[#0D0F11] dark:text-gray-900 dark:hover:bg-gray-100 text-white text-sm font-medium rounded-md shadow-panel-elevated"
        >
          {assessMutation.isPending ? 'Calculating...' : 'Run Risk Assessment'}
        </button>
      </div>

      {breach.riskAssessmentDetail && (
        <div className="mt-6 bg-blue-500/10 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-900 dark:text-blue-200 flex items-start">
          <span className="text-xl mr-3">ℹ️</span>
          <div>
            <span className="font-semibold block mb-1">Assessment Outcome</span>
            <p className="opacity-90 leading-relaxed">{breach.riskAssessmentDetail}</p>
          </div>
        </div>
      )}

    </div>
  );
}
