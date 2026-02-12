'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUsers, useCreateUser, useUpdateUser, useToggleUserStatus } from '@/hooks/useUsers';
import { useCenters } from '@/hooks/useCenters';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Edit2, UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User } from '@tofa/core';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: centers, isLoading: centersLoading } = useCenters();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const toggleUserStatusMutation = useToggleUserStatus();
  const formRef = useRef<HTMLDivElement>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('team_member');
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'team_lead') {
      router.push('/command-center');
    }
  }, [currentUser, router]);

  if (currentUser?.role !== 'team_lead') {
    return null;
  }

  const resetForm = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setRole('team_member');
    setSelectedCenters([]);
    setError('');
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEmail(user.email);
    setPassword('');
    setFullName(user.full_name);
    setPhone((user as { phone?: string | null }).phone ?? '');
    setRole(user.role || 'team_member');
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

  const handleToggleStatus = async (user: User) => {
    const isDeactivating = user.is_active;
    const action = isDeactivating ? 'deactivate' : 'restore access for';
    const confirmMessage = isDeactivating
      ? `Are you sure you want to deactivate ${user.full_name}? They will lose all access to the system immediately.`
      : `Restore access for ${user.full_name}?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await toggleUserStatusMutation.mutateAsync(user.id);
      toast.success(
        isDeactivating
          ? `✅ ${user.full_name} has been deactivated`
          : `✅ Access restored for ${user.full_name}`
      );
    } catch (err: any) {
      toast.error(err.response?.data?.detail || `Failed to ${action} user`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !phone.trim()) {
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
          phone: phone.trim() || null,
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
          phone: phone.trim(),
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

  // Helper function to get user initials
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Helper function to format role name with proper capitalization
  const formatRoleName = (role: string) => {
    switch (role) {
      case 'team_lead':
        return 'Team Lead';
      case 'team_member':
        return 'Team Member';
      case 'coach':
        return 'Coach';
      case 'observer':
        return 'Observer';
      default:
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  // Helper function to get role badge styling
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'team_lead':
        return 'bg-tofa-gold text-tofa-navy';
      case 'team_member':
        return 'bg-blue-100 text-blue-800'; // Keep blue for team_member distinction
      case 'coach':
        return 'bg-emerald-100 text-emerald-800';
      case 'observer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to get user's assigned centers
  const getUserCenters = (user: User) => {
    if (!user.center_ids || user.center_ids.length === 0 || !centers) {
      return [];
    }
    return centers.filter(center => user.center_ids?.includes(center.id));
  };

  return (
    <MainLayout>
      <PageHeader
        title="TEAM ROSTER"
        subtitle={users ? `${users.length} ${users.length === 1 ? 'Member' : 'Members'}` : undefined}
      />
      <div className="p-8 space-y-6">

        {/* Create/Edit User Form - Hidden for observers */}
        {currentUser?.role !== 'observer' && (
        <div ref={formRef} className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-tofa-gold">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 font-bebas text-2xl">
              {editingUser ? `✏️ Edit User: ${editingUser.full_name}` : '➕ Create New User'}
            </h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-tofa-navy hover:text-tofa-gold"
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
                    📞 Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder=""
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
                    <option value="team_member">Team Member</option>
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
                        className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
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
                  className={`${editingUser ? 'flex-1' : 'w-full'} bg-gradient-to-r from-yellow-500 via-amber-600 to-yellow-700 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md`}
                >
                  {createUserMutation.isPending || updateUserMutation.isPending
                    ? (editingUser ? 'Updating...' : 'Creating...')
                    : (editingUser ? '✨ Update User' : '✨ Create User')}
                </button>
              </div>
            </form>
          )}
        </div>
        )}

        {/* Staff Roster Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-tofa-navy">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Avatar
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider w-48">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider w-64">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider w-36">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider w-48">
                      Centers
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-tofa-gold uppercase tracking-wider w-48">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        editingUser?.id === user.id
                          ? 'border-l-4 border-tofa-gold bg-yellow-50/30'
                          : ''
                      }`}
                    >
                      {/* Avatar Column */}
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                          {getUserInitials(user.full_name)}
                        </div>
                      </td>
                      {/* Name Column */}
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{user.full_name}</div>
                        <div className="text-xs text-gray-500">ID: #{user.id}</div>
                      </td>
                      {/* Email Column */}
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                        {user.email}
                      </td>
                      {/* Phone Column */}
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                        {(user as { phone?: string | null }).phone ? (
                          <a href={`tel:${(user as { phone?: string }).phone}`} className="text-blue-600 hover:underline">
                            {(user as { phone?: string }).phone}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Centers Column */}
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {(() => {
                          const userCenters = getUserCenters(user);
                          if (userCenters.length === 0) {
                            return <span className="text-gray-400">—</span>;
                          }
                          if (userCenters.length <= 2) {
                            return <span>{userCenters.map(c => c.display_name).join(', ')}</span>;
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {userCenters.map((center) => (
                                <span
                                  key={center.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                                >
                                  {center.display_name}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      {/* Role Column */}
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getRoleBadgeClass(user.role)}`}>
                          {formatRoleName(user.role)}
                        </span>
                      </td>
                      {/* Status Column */}
                      <td className="px-4 py-2 whitespace-nowrap">
                        {user.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      {/* Actions Column */}
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {currentUser?.role !== 'observer' && (
                            <>
                              <button
                                onClick={() => handleEdit(user)}
                                className="p-2 rounded-lg text-brand-accent hover:bg-brand-accent/10 transition-colors"
                                title="Edit user"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              {user.is_active ? (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={toggleUserStatusMutation.isPending}
                                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                                  title="Deactivate user"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={toggleUserStatusMutation.isPending}
                                  className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                                  title="Activate user"
                                >
                                  Activate
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4 opacity-50">👻</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No staff members found</h3>
              <p className="text-sm text-gray-500">Create your first team member to get started.</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}


