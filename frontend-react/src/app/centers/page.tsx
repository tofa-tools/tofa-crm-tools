'use client';

import { useState, FormEvent, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCenters, useCreateCenter, useUpdateCenter } from '@/hooks/useCenters';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Edit } from 'lucide-react';
import type { Center } from '@/types';

export default function CentersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: centers, isLoading } = useCenters();
  const createCenterMutation = useCreateCenter();
  const updateCenterMutation = useUpdateCenter();
  const formRef = useRef<HTMLDivElement>(null);

  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [metaTag, setMetaTag] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'team_lead') {
      router.push('/command-center');
    }
  }, [user, router]);

  if (user?.role !== 'team_lead') {
    return null;
  }

  const resetForm = () => {
    setEditingCenter(null);
    setDisplayName('');
    setMetaTag('');
    setCity('');
    setLocation('');
    setError('');
  };

  const handleEdit = (center: Center) => {
    setEditingCenter(center);
    setDisplayName(center.display_name);
    setMetaTag(center.meta_tag_name);
    setCity(center.city);
    setLocation(center.location || '');
    setShowForm(true);
    setError('');
    
    // Scroll to form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName || !metaTag || !city) {
      setError('Please fill all required fields (*)');
      return;
    }

    try {
      if (editingCenter) {
        // Update existing center
        await updateCenterMutation.mutateAsync({
          centerId: editingCenter.id,
          centerData: {
            display_name: displayName,
            meta_tag_name: metaTag,
            city,
            location: location || undefined,
          },
        });
        resetForm();
        alert('✅ Center updated successfully!');
      } else {
        // Create new center
        await createCenterMutation.mutateAsync({
          display_name: displayName,
          meta_tag_name: metaTag,
          city,
          location: location || undefined,
        });
        resetForm();
        alert('✅ Center created successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${editingCenter ? 'update' : 'create'} center`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🏢 Manage Centers</h1>
          <p className="text-gray-600 mt-2">Create and manage academy centers</p>
        </div>

        {/* Create/Edit Center Form */}
        <div ref={formRef} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingCenter ? `✏️ Edit Center: ${editingCenter.display_name}` : '➕ Add New Center'}
            </h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              {showForm ? '▼ Collapse' : '▶ Expand'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  ❌ {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. TOFA Tellapur"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meta Tag *
                  </label>
                  <input
                    type="text"
                    value={metaTag}
                    onChange={(e) => setMetaTag(e.target.value)}
                    placeholder="Copy EXACTLY from Excel"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {editingCenter && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={createCenterMutation.isPending || updateCenterMutation.isPending}
                  className={`${editingCenter ? 'flex-1' : 'w-full'} bg-gradient-primary text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md`}
                >
                  {createCenterMutation.isPending || updateCenterMutation.isPending
                    ? (editingCenter ? 'Updating...' : 'Creating...')
                    : (editingCenter ? '✨ Update Center' : '✨ Create Center')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Existing Centers Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📋 Existing Centers
          </h2>
          {centers && centers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Display Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Meta Tag
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {centers.map((center) => (
                    <tr key={center.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {center.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {center.display_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {center.meta_tag_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {center.city}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {center.location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(center)}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No centers found. Create your first center above!
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}


