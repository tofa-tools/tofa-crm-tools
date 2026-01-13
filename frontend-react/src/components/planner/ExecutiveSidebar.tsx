'use client';

import { useConversionRates, useTimeToContact } from '@/hooks/useAnalytics';
import { useAuth } from '@/context/AuthContext';

export function ExecutiveSidebar() {
  const { user } = useAuth();
  const { data: conversionRatesData } = useConversionRates();
  const { data: timeToContactData } = useTimeToContact();

  // Restrict access to team_lead only
  if (user?.role !== 'team_lead') {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-lg shadow-xl p-6 space-y-6">
      <h3 className="text-lg font-bold text-white uppercase tracking-wide border-b border-yellow-600/30 pb-3">
        📊 Executive Intelligence
      </h3>

      {/* Time to Contact */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-600/20">
        <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
          ⏱️ Average Time to Contact
        </h4>
        {timeToContactData?.average_hours !== null && timeToContactData?.average_hours !== undefined ? (
          <div>
            <div className={`text-4xl font-bold mb-2 ${
              timeToContactData.average_hours > 2 
                ? 'text-red-400' 
                : timeToContactData.average_hours > 1 
                ? 'text-yellow-400' 
                : 'text-emerald-400'
            }`}>
              {timeToContactData.average_hours.toFixed(1)}h
            </div>
            <p className="text-xs text-gray-300">
              Time from lead creation to first contact
              {timeToContactData.average_hours > 2 && (
                <span className="block mt-1 text-red-300 font-medium">
                  ⚠️ Above 2 hours - losing money on ads
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No data available yet</p>
        )}
      </div>

      {/* Conversion Rates */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-600/20">
        <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide mb-3">
          📈 Key Conversion Rates
        </h4>
        {conversionRatesData?.conversion_rates && Object.keys(conversionRatesData.conversion_rates).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(conversionRatesData.conversion_rates)
              .filter(([transition]) => 
                transition.includes('New->') || 
                transition.includes('Called->') || 
                transition.includes('Trial Scheduled->')
              )
              .slice(0, 3)
              .map(([transition, rate]) => {
                const [from, to] = transition.split('->');
                const percentage = (rate * 100).toFixed(1);
                return (
                  <div key={transition} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 font-medium">
                        {from} → {to}
                      </span>
                      <span className="text-white font-bold">
                        {percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          rate >= 0.5 ? 'bg-emerald-400' : rate >= 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No conversion data available yet</p>
        )}
      </div>
    </div>
  );
}

