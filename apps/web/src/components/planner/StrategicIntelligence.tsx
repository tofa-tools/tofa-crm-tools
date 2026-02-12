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

export function StrategicIntelligence() {
  const { user } = useAuth();
  const { data: conversionRatesData, isLoading: funnelLoading } = useConversionRates();
  const { data: timeToContactData, isLoading: timeLoading } = useTimeToContact();

  if (user?.role !== 'team_lead' && user?.role !== 'team_member') return null;

  const intelLoading = funnelLoading || timeLoading;
  const hours = timeToContactData?.average_hours;
  const hasTimeData = hours != null && Number.isFinite(hours);
  const timeColor = hasTimeData && hours > 2 ? 'text-red-400' : hasTimeData && hours > 1 ? 'text-tofa-gold' : hasTimeData ? 'text-emerald-400' : 'text-gray-500';

  return (
    <div className="mt-10 bg-gradient-to-br from-tofa-navy to-tofa-navy-900 rounded-2xl shadow-2xl p-8 border-2 border-tofa-gold/30">
      <h3 className="text-xl font-bold text-tofa-gold uppercase tracking-wider border-b border-tofa-gold/40 pb-4 mb-6">
        Executive Intelligence
      </h3>
      {intelLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
          <div className="h-40 bg-white/10 rounded-xl" />
          <div className="h-40 bg-white/10 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/5 rounded-xl p-6 border border-tofa-gold/20">
            <h4 className="text-sm font-semibold text-tofa-gold uppercase tracking-wider mb-4">Average Time to Contact</h4>
            {hasTimeData ? (
              <div className="space-y-3">
                <div className={`text-5xl font-black ${timeColor}`}>{hours.toFixed(1)}h</div>
                <p className="text-sm text-gray-400">
                  Time from preference form submission to first call
                  {hours > 2 && <span className="block mt-1 text-red-300 font-medium">⚠️ Above 2 hours — losing money on ads</span>}
                </p>
                <div className="w-full h-3 bg-gray-700/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${hours > 2 ? 'bg-red-400' : hours > 1 ? 'bg-tofa-gold' : 'bg-emerald-400'}`} style={{ width: `${Math.min((hours / 4) * 100, 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Awaiting Data</p>
            )}
          </div>
          <div className="bg-white/5 rounded-xl p-6 border border-tofa-gold/20">
            <h4 className="text-sm font-semibold text-tofa-gold uppercase tracking-wider mb-4">Conversion Funnel</h4>
            {conversionRatesData?.funnel ? (
              <div className="space-y-4">
                {FUNNEL_STEPS.map(({ key, label, sub }) => {
                  const item = conversionRatesData.funnel[key];
                  const denom = item?.denominator ?? 0;
                  const rate = item?.rate ?? 0;
                  const displayVal = formatFunnelValue(item, key);
                  const showBar = denom > 0;
                  const pct = (rate * 100).toFixed(1);
                  const barColor = rate >= 0.5 ? 'bg-emerald-400' : rate >= 0.3 ? 'bg-tofa-gold' : 'bg-red-400';
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300 font-medium">{label}</span>
                        <span className={denom === 0 ? 'text-gray-500 text-xs' : 'text-white font-bold text-lg'}>
                          {displayVal}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500">{sub}</p>
                      {showBar && (
                        <div className="w-full bg-gray-700/50 rounded-full h-3">
                          <div className={`h-3 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">Awaiting Data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
