import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
}

export function MetricCard({ title, value, delta, icon }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {delta && (
            <p className="text-sm text-gray-500 mt-1">{delta}</p>
          )}
        </div>
        {icon && <div className="text-4xl opacity-50">{icon}</div>}
      </div>
    </div>
  );
}


