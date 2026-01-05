'use client';

import { useState } from 'react';
import type { ImportPreviewResponse, ImportPreviewRow } from '@/types';

interface ImportPreviewProps {
  previewData: ImportPreviewResponse;
  onConfirm: (columnMapping?: Record<string, string>) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function ImportPreview({ previewData, onConfirm, onCancel, isProcessing = false }: ImportPreviewProps) {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    previewData.column_mapping || {}
  );
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  // Combine valid and invalid rows, with invalid rows first
  const allPreviewRows = [
    ...(previewData.preview_data.invalid || []).map(row => ({ ...row, isValid: false })),
    ...(previewData.preview_data.valid || []).map(row => ({ ...row, isValid: true })),
  ];
  
  const displayRows = showErrorsOnly
    ? allPreviewRows.filter(row => !row.isValid)
    : allPreviewRows;

  const requiredColumns = Object.keys(previewData.required_columns || {});
  const availableColumns = previewData.available_columns || [];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Import Preview Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{previewData.total_rows}</div>
            <div className="text-sm text-gray-600 mt-1">Total Rows</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{previewData.valid_rows}</div>
            <div className="text-sm text-gray-600 mt-1">✅ Valid Rows</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-3xl font-bold text-red-600">{previewData.invalid_rows}</div>
            <div className="text-sm text-gray-600 mt-1">❌ Rows with Errors</div>
          </div>
        </div>

        {previewData.invalid_rows > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="show-errors-only"
              checked={showErrorsOnly}
              onChange={(e) => setShowErrorsOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="show-errors-only" className="text-sm text-gray-700 cursor-pointer">
              Show only rows with errors
            </label>
          </div>
        )}
      </div>

      {/* Column Mapping */}
      {availableColumns.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">🔗 Column Mapping</h2>
            <button
              onClick={() => setShowColumnMapping(!showColumnMapping)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {showColumnMapping ? 'Hide Mapping' : 'Edit Mapping'}
            </button>
          </div>
          {showColumnMapping && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Map your CSV columns to the required fields:
              </p>
              {requiredColumns.map((requiredField) => {
                const displayName = previewData.required_columns[requiredField] || requiredField;
                return (
                  <div key={requiredField} className="flex items-center gap-4">
                    <label className="w-48 text-sm font-medium text-gray-700">
                      {displayName}:
                    </label>
                    <select
                      value={columnMapping[requiredField] || ''}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          [requiredField]: e.target.value,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    >
                      <option value="">-- Select Column --</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            📋 Preview Data ({displayRows.length} rows)
          </h2>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Center
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayRows.map((row, index) => (
                <tr
                  key={index}
                  className={
                    row.errors.length > 0
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-gray-50'
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.data?.player_name || (
                      <span className="text-red-600">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.data?.phone || (
                      <span className="text-red-600">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.data?.email || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.data?.center || row.data?.center_tag || (
                      <span className="text-red-600">Missing/Invalid</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!row.isValid && row.errors && row.errors.length > 0 ? (
                      <div className="text-xs">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800">
                          ❌ {row.errors.length} error{row.errors.length > 1 ? 's' : ''}
                        </span>
                        <div className="mt-1 text-red-600 text-xs">
                          {row.errors.slice(0, 2).map((err, i) => (
                            <div key={i}>{err}</div>
                          ))}
                          {row.errors.length > 2 && (
                            <div>+{row.errors.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                        ✅ Valid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(Object.keys(columnMapping).length > 0 ? columnMapping : undefined)}
          disabled={isProcessing || previewData.valid_rows === 0}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : `Confirm Import (${previewData.valid_rows} valid rows${previewData.invalid_rows > 0 ? `, ${previewData.invalid_rows} will be skipped` : ''})`}
        </button>
      </div>
    </div>
  );
}

