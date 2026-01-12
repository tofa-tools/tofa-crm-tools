'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUsers, useCreateUser, useUpdateUser } from '@/hooks/useUsers';
import { useCenters } from '@/hooks/useCenters';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Edit } from 'lucide-react';
import type { User } from '@/types';

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: centers, isLoading: centersLoading } = useCenters();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const formRef = useRef<HTMLDivElement>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('regular_user');
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
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
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('regular_user');
    setSelectedCenters([]);
    setError('');
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEmail(user.email);
    setPassword('');
    setFullName(user.full_name);
    setRole(user.role);
    // Note: We need to get user's centers from the backend response
    // For now, we'll set empty and let the user re-select
    setSelectedCenters(user.center_ids || []);
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

    if (!fullName) {
      setError('Please fill all required fields (*)');
      return;
    }

    // Validate: Coaches must be assigned to at least one center
    if (role === 'coach' && selectedCenters.length === 0) {
      setError('Coaches must be assigned to at least one center');
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          full_name: fullName,
          role,
          center_ids: selectedCenters,
        };
        
        // Only include password if provided
        if (password.trim()) {
          updateData.password = password;
        }
        
        await updateUserMutation.mutateAsync({
          userId: editingUser.id,
          userData: updateData,
        });
        resetForm();
        alert('✅ User updated successfully!');
      } else {
        // Create new user
        if (!email || !password) {
          setError('Please fill all required fields (*)');
          return;
        }
        
        await createUserMutation.mutateAsync({
          email,
          password,
          full_name: fullName,
          role,
          center_ids: selectedCenters,
        });
        resetForm();
        alert('✅ User created successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${editingUser ? 'update' : 'create'} user`);
    }
  };

  if (usersLoading || centersLoading) {
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
          <h1 className="text-3xl font-bold text-gray-900">
            👤 Manage Team Members
          </h1>
          <p className="text-gray-600 mt-2">Create and manage user accounts</p>
        </div>

        {/* Create/Edit User Form */}
        <div ref={formRef} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingUser ? `✏️ Edit User: ${editingUser.full_name}` : '➕ Create New User'}
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
                    📧 Email {editingUser ? '' : '*'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={!editingUser}
                    disabled={!!editingUser}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔒 Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editingUser}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎭 Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    <option value="team_lead">Team Lead</option>
                    <option value="regular_user">Regular User</option>
                    <option value="observer">Observer</option>
                    <option value="coach">Coach</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏢 Assign Centers {role === 'coach' && <span className="text-red-500">*</span>}
                </label>
                {role === 'coach' && selectedCenters.length === 0 && (
                  <p className="text-sm text-red-600 mb-2">Coaches must be assigned to at least one center</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {centers?.map((center) => (
                    <label
                      key={center.id}
                      className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCenters.includes(center.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCenters([...selectedCenters, center.id]);
                          } else {
                            setSelectedCenters(
                              selectedCenters.filter((id) => id !== center.id)
                            );
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm">{center.display_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                {editingUser && (
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
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  className={`${editingUser ? 'flex-1' : 'w-full'} bg-gradient-primary text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md`}
                >
                  {createUserMutation.isPending || updateUserMutation.isPending
                    ? (editingUser ? 'Updating...' : 'Creating...')
                    : (editingUser ? '✨ Update User' : '✨ Create User')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Existing Users Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📋 Existing Users
          </h2>
          {users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {user.role.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(user)}
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
              No users found.
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}


