'use client';

import { useState, useRef, FormEvent } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUploadLeads } from '@/hooks/useLeads';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ImportPreview } from '@/components/import/ImportPreview';
import { leadsAPI } from '@/lib/api';
import type { ImportPreviewResponse } from '@tofa/core';
import toast from 'react-hot-toast';

export default function ImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const uploadLeadsMutation = useUploadLeads();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'warning' | null;
    text: string;
    unknownTags?: string[];
  }>({ type: null, text: '' });

  useEffect(() => {
    if (user && user.role !== 'team_lead') {
      router.push('/command-center');
    }
  }, [user, router]);

  if (user?.role !== 'team_lead') {
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (validExtensions.includes(fileExtension)) {
        setSelectedFile(file);
        setMessage({ type: null, text: '' });
      } else {
        setMessage({
          type: 'error',
          text: 'Invalid file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) files',
        });
        setSelectedFile(null);
      }
    }
  };

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    setMessage({ type: null, text: '' });
    setIsProcessingPreview(true);

    try {
      const preview = await leadsAPI.previewLeadsUpload(selectedFile);
      setPreviewData(preview);
      setIsPreviewing(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to preview file');
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to preview file',
      });
    } finally {
      setIsProcessingPreview(false);
    }
  };

  const handleConfirmImport = async (columnMapping?: Record<string, string>) => {
    if (!selectedFile) return;

    setIsProcessingPreview(true);
    setMessage({ type: null, text: '' });

    try {
      // If there's a column mapping, we need to re-preview with mapping, then import
      // For now, we'll import directly (the backend handles the mapping)
      const result = await uploadLeadsMutation.mutateAsync(selectedFile);

      if (result.status === 'error') {
        setMessage({
          type: result.unknown_tags ? 'warning' : 'error',
          text: result.message || 'Error processing file',
          unknownTags: result.unknown_tags,
        });
        setIsPreviewing(false);
      } else if (result.status === 'success') {
        toast.success(`🎉 Successfully added ${result.leads_added || 0} leads!`);
        setMessage({
          type: 'success',
          text: `🎉 Successfully added ${result.leads_added || 0} leads!`,
        });
        setSelectedFile(null);
        setPreviewData(null);
        setIsPreviewing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload file');
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to upload file',
      });
    } finally {
      setIsProcessingPreview(false);
    }
  };

  const handleCancelPreview = () => {
    setIsPreviewing(false);
    setPreviewData(null);
  };

  return (
    <MainLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Import Leads"
          subtitle="Upload an Excel or CSV file to import leads"
        />

        <div className="p-8 space-y-6">
          <div className="bg-brand-accent/10 border border-brand-accent/30 text-brand-primary px-4 py-3 rounded-lg">
            💡 Upload an Excel (.xlsx, .xls) or CSV (.csv) file with lead data.
            Make sure the file contains the required columns.
          </div>

          {!isPreviewing ? (
            <div className="bg-white rounded-2xl shadow-xl p-6">
            <form onSubmit={handlePreview} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-bebas text-xl">
                  Choose File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-accent/10 file:text-brand-primary hover:file:bg-brand-accent/20"
                />
                {selectedFile && (
                          <p className="mt-2 text-sm text-emerald-600">
                    ✅ File loaded: {selectedFile.name}
                  </p>
                )}
              </div>

              {message.type && (
                <div
                  className={`px-4 py-3 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : message.type === 'warning'
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  <p>{message.text}</p>
                  {message.unknownTags && message.unknownTags.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold mb-2">
                        ⚠️ Please add these centers in &apos;Manage Centers&apos; tab first:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {message.unknownTags.map((tag, index) => (
                          <li key={index} className="font-mono text-sm">
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedFile || isProcessingPreview}
                className="w-full bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isProcessingPreview ? 'Previewing...' : '🔍 Preview Import'}
              </button>
            </form>
          </div>
        ) : previewData ? (
          <ImportPreview
            previewData={previewData}
            onConfirm={handleConfirmImport}
            onCancel={handleCancelPreview}
            isProcessing={uploadLeadsMutation.isPending || isProcessingPreview}
          />
        ) : null}

          <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 font-bebas text-2xl">
            Required Columns
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Your file should contain the following columns:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  player_name
                </code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">phone</code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">email</code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  player_age_category
                </code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  address_and_pincode
                </code>
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  _which_is_the_nearest_tofa_center_to_you?
                </code>{' '}
                (Must match a Meta Tag in Centers)
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">created_time</code>
              </li>
            </ul>
          </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}


