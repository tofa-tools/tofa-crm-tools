'use client';

import { useConversionRates, useTimeToContact } from '@/hooks/useAnalytics';
import { useAuth } from '@/context/AuthContext';

const FUNNEL_STEPS = [
  { key: 'engagement', label: 'Parents Responded', sub: 'Leads who filled the preference form' },
  { key: 'commitment', label: 'Trials Booked', sub: 'Leads scheduled for a session' },
  { key: 'success', label: 'Conversion to Student', sub: 'Students who joined after attending a trial' },
] as const;

function formatFunnelValue(item: { numerator?: number; denominator?: number; rate?: number } | undefined, key: string) {
  const denom = item?.denominator ?? 0;
  const num = item?.numerator ?? 0;
  const rate = item?.rate ?? 0;
  if (denom === 0) {
    return key === 'success' ? '-- (No trials yet)' : 'Awaiting Data';
  }
  const pct = (rate * 100).toFixed(1);
  return `${pct}% (${num} of ${denom})`;
}

export function ExecutiveSidebar() {
  const { user } = useAuth();
  const { data: conversionRatesData, isLoading: funnelLoading } = useConversionRates();
  const { data: timeToContactData, isLoading: timeLoading } = useTimeToContact();

  if (user?.role !== 'team_lead') return null;

  const intelLoading = funnelLoading || timeLoading;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-lg shadow-xl p-6 space-y-6">
      <h3 className="text-lg font-bold text-white uppercase tracking-wide border-b border-yellow-600/30 pb-3">
        📊 Executive Intelligence
      </h3>

      {intelLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-white/10 rounded-lg" />
          <div className="h-32 bg-white/10 rounded-lg" />
        </div>
      ) : (
        <>
          {/* Time to Contact */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-600/20">
            <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
              ⏱️ Average Time to Contact
            </h4>
            {timeToContactData?.average_hours != null && Number.isFinite(timeToContactData.average_hours) ? (
              <div>
                <div className={`text-4xl font-bold mb-2 ${
                  timeToContactData.average_hours > 2 ? 'text-red-400' :
                  timeToContactData.average_hours > 1 ? 'text-yellow-400' : 'text-emerald-400'
                }`}>
                  {timeToContactData.average_hours.toFixed(1)}h
                </div>
                <p className="text-xs text-gray-300">
                  Time from preference form submission to first call
                  {timeToContactData.average_hours > 2 && (
                    <span className="block mt-1 text-red-300 font-medium">⚠️ Above 2 hours — losing money on ads</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Awaiting Data</p>
            )}
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-600/20">
            <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
              📈 Conversion Funnel
            </h4>
            {conversionRatesData?.funnel ? (
              <div className="space-y-3">
                {FUNNEL_STEPS.map(({ key, label, sub }) => {
                  const item = conversionRatesData.funnel[key];
                  const denom = item?.denominator ?? 0;
                  const rate = item?.rate ?? 0;
                  const displayVal = formatFunnelValue(item, key);
                  const showBar = denom > 0 && (key !== 'success' || denom > 0);
                  const pct = (rate * 100).toFixed(1);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-medium">{label}</span>
                        <span className={denom === 0 ? 'text-gray-500 text-[10px]' : 'text-white font-bold'}>
                          {displayVal}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500">{sub}</p>
                      {showBar && (
                        <div className="w-full bg-gray-700/50 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              rate >= 0.5 ? 'bg-emerald-400' : rate >= 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(Number(pct), 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Awaiting Data</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

