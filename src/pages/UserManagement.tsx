import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, Save, X, Eye, Bell, BellOff, ChevronDown, ChevronUp, Mail, UserCheck, UserX, ExternalLink, KeyRound } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserTrainerPermissions,
  getUserTrainerTypePermissions,
  saveUserTrainerPermissions,
  saveUserTrainerTypePermissions
} from '../lib/bookings-permissions';
import { sendEmail, sendTemplateEmail } from '../lib/email';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  super_admin: boolean;
  can_manage_users: boolean;
  can_manage_bookings: boolean;
  can_manage_courses: boolean;
  can_view_bookings: boolean;
  can_manage_expenses: boolean;
  can_manage_availability: boolean;
  is_trainer: boolean;
  can_login: boolean;
  trainer_id: string | null;
  created_at: string;
}

interface Trainer {
  id: string;
  name: string;
  trainer_type_id: string | null;
}

interface TrainerType {
  id: string;
  name: string;
}

interface TrainerPermission {
  trainer_id: string;
  can_receive_notifications: boolean;
}

interface TrainerTypePermission {
  trainer_type_id: string;
  can_receive_notifications: boolean;
}

interface UserManagementProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function UserManagement({ currentPage, onNavigate }: UserManagementProps) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [managingPermissionsFor, setManagingPermissionsFor] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as 'admin' | 'user',
    super_admin: false,
    can_manage_users: false,
    can_manage_bookings: false,
    can_manage_courses: false,
    can_view_bookings: false,
    can_manage_expenses: false,
    can_manage_availability: false,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          trainer:trainer_id (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser(shouldSendEmail = false) {
    try {
      setError(null);
      setSuccess(null);

      if (!formData.email || !formData.password || !formData.full_name) {
        setError('Email, password, and full name are required');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          super_admin: formData.super_admin,
          can_manage_users: formData.role === 'admin' ? true : formData.can_manage_users,
          can_manage_bookings: formData.role === 'admin' ? true : formData.can_manage_bookings,
          can_manage_courses: formData.role === 'admin' ? true : formData.can_manage_courses,
          can_view_bookings: formData.role === 'admin' ? true : formData.can_view_bookings,
          can_manage_expenses: formData.role === 'admin' ? true : formData.can_manage_expenses,
          can_manage_availability: formData.role === 'admin' ? true : formData.can_manage_availability,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const result = await response.json();

      if (shouldSendEmail) {
        const emailSuccess = await sendLoginDetailsEmail({
          id: result.userId,
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          can_manage_users: formData.can_manage_users,
          can_manage_bookings: formData.can_manage_bookings,
          can_manage_courses: formData.can_manage_courses,
          can_view_bookings: formData.can_view_bookings,
          can_manage_expenses: formData.can_manage_expenses,
          can_manage_availability: formData.can_manage_availability,
          created_at: new Date().toISOString(),
        });

        if (emailSuccess) {
          setSuccess('User created and login details sent successfully');
        } else {
          setSuccess('User created successfully, but failed to send email');
        }
      } else {
        setSuccess('User created successfully');
      }

      setAddingUser(false);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        super_admin: false,
        can_manage_users: false,
        can_manage_bookings: false,
        can_manage_courses: false,
        can_view_bookings: false,
        can_manage_expenses: false,
        can_manage_availability: false,
      });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  }

  async function sendLoginDetailsEmail(user: User): Promise<boolean> {
    try {
      const loginUrl = window.location.origin;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">National Compliance Training Portal Access</h2>
          <p>Hello ${user.full_name || 'there'},</p>
          <p>Your account has been created for the National Compliance Training internal portal.</p>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Login URL:</strong></p>
            <p style="margin: 5px 0;"><a href="${loginUrl}" style="color: #3b82f6;">${loginUrl}</a></p>
            <p style="margin: 15px 0 5px 0;"><strong>Your Email:</strong></p>
            <p style="margin: 0;">${user.email}</p>
          </div>

          <p><strong>Important:</strong> If this is a new account, you will need to set your password using the "Forgot Password" link on the login page.</p>

          <p>If you have any questions or need assistance, please contact your administrator.</p>

          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This is an automated message from the NCT Portal system.
          </p>
        </div>
      `;

      const textBody = `
National Compliance Training Portal Access

Hello ${user.full_name || 'there'},

Your account has been created for the National Compliance Training internal portal.

Login URL: ${loginUrl}
Your Email: ${user.email}

Important: If this is a new account, you will need to set your password using the "Forgot Password" link on the login page.

If you have any questions or need assistance, please contact your administrator.

This is an automated message from the NCT Portal system.
      `;

      return await sendEmail(
        user.email,
        'NCT Portal - Login Details',
        htmlBody,
        textBody
      );
    } catch (err) {
      console.error('Failed to send login details email:', err);
      return false;
    }
  }

  async function handleUpdateUser(userId: string, updates: Partial<User>) {
    try {
      setError(null);
      setSuccess(null);

      const currentUser = users.find(u => u.id === userId);
      const emailChanged = currentUser && updates.email && updates.email !== currentUser.email;

      if (emailChanged) {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-email`;
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            newEmail: updates.email,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update email');
        }
      }

      const validUserFields = {
        email: updates.email,
        full_name: updates.full_name,
        role: updates.role,
        super_admin: updates.super_admin,
        can_manage_users: updates.role === 'admin' ? true : updates.can_manage_users,
        can_manage_bookings: updates.role === 'admin' ? true : updates.can_manage_bookings,
        can_manage_courses: updates.role === 'admin' ? true : updates.can_manage_courses,
        can_view_bookings: updates.role === 'admin' ? true : updates.can_view_bookings,
        can_manage_expenses: updates.role === 'admin' ? true : updates.can_manage_expenses,
        can_manage_availability: updates.role === 'admin' ? true : updates.can_manage_availability,
        can_login: updates.can_login,
      };

      const { error } = await supabase
        .from('users')
        .update(validUserFields)
        .eq('id', userId);

      if (error) throw error;

      setSuccess('User updated successfully');

      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  }

  async function handleDeleteUser(userId: string) {
    const userToDelete = users.find(u => u.id === userId);

    if (userToDelete?.role === 'admin' && !profile?.super_admin) {
      setError('Only super admins can delete admin users');
      return;
    }

    if (userToDelete?.super_admin && !profile?.super_admin) {
      setError('Only super admins can delete super admin users');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      setSuccess('User deleted successfully');
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  async function handleSendLoginDetails(user: User) {
    if (!confirm(`Send login details to ${user.email}?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const success = await sendLoginDetailsEmail(user);

      if (success) {
        setSuccess(`Login details sent to ${user.email}`);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login details');
    }
  }

  async function handleResetPassword(user: User) {
    // Prompt for custom password
    const customPassword = prompt(`Enter a new password for ${user.email} (or leave blank to auto-generate):`);

    if (customPassword === null) {
      // User clicked cancel
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Use custom password or generate a random one
      const newPassword = customPassword.trim() ||
        Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!@#';

      // Validate password length
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      // Call edge function to update password
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      // Send email with new password
      const emailSent = await sendTemplateEmail(
        user.email,
        'password_reset',
        {
          user_name: user.full_name || user.email,
          email: user.email,
          password: newPassword,
        }
      );

      if (emailSent) {
        setSuccess(`Password reset successfully. New password sent to ${user.email}`);
      } else {
        setSuccess(`Password reset successfully, but failed to send email. New password: ${newPassword}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  }

  if (!profile?.can_manage_users) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">You do not have permission to manage users.</p>
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />
      <div className="border-b border-slate-800 px-6 py-3 bg-slate-900/50">
        <div className="flex items-center justify-end gap-3 max-w-7xl mx-auto">
          {!addingUser && (
            <button
              onClick={() => setAddingUser(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded">
            {success}
          </div>
        )}

        {addingUser && (
          <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add New User</h3>
              <button
                onClick={() => {
                  setAddingUser(false);
                  setFormData({
                    email: '',
                    password: '',
                    full_name: '',
                    role: 'user',
                    can_manage_users: false,
                  });
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                {profile?.super_admin && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.super_admin}
                      onChange={(e) => setFormData({ ...formData, super_admin: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-yellow-400 font-semibold">Super Admin (Full System Access)</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role === 'admin' ? true : formData.can_manage_users}
                    onChange={(e) => setFormData({ ...formData, can_manage_users: e.target.checked })}
                    disabled={formData.role === 'admin'}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${formData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Can manage users {formData.role === 'admin' ? '(Auto-enabled for Admins)' : '(Admin)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role === 'admin' ? true : formData.can_manage_bookings}
                    onChange={(e) => setFormData({ ...formData, can_manage_bookings: e.target.checked })}
                    disabled={formData.role === 'admin'}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${formData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Can manage bookings {formData.role === 'admin' && '(Auto-enabled for Admins)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role === 'admin' ? true : formData.can_manage_courses}
                    onChange={(e) => setFormData({ ...formData, can_manage_courses: e.target.checked })}
                    disabled={formData.role === 'admin'}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${formData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Can manage courses {formData.role === 'admin' && '(Auto-enabled for Admins)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role === 'admin' ? true : formData.can_view_bookings}
                    onChange={(e) => setFormData({ ...formData, can_view_bookings: e.target.checked })}
                    disabled={formData.role === 'admin'}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${formData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Can view bookings {formData.role === 'admin' ? '(Auto-enabled for Admins)' : '(Booking Viewer)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role === 'admin' ? true : formData.can_manage_expenses}
                    onChange={(e) => setFormData({ ...formData, can_manage_expenses: e.target.checked })}
                    disabled={formData.role === 'admin'}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${formData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Can manage expenses {formData.role === 'admin' && '(Auto-enabled for Admins)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.role === 'admin' ? true : formData.can_manage_availability}
                    onChange={(e) => setFormData({ ...formData, can_manage_availability: e.target.checked })}
                    disabled={formData.role === 'admin'}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm ${formData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Can manage availability {formData.role === 'admin' ? '(Auto-enabled for Admins)' : '(Trainer)'}
                  </span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setAddingUser(false);
                  setFormData({
                    email: '',
                    password: '',
                    full_name: '',
                    role: 'user',
                    can_manage_users: false,
                  });
                }}
                className="px-4 py-2 border border-slate-700 hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddUser(false)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors"
              >
                <Save className="w-4 h-4" />
                Create User
              </button>
              <button
                onClick={() => handleAddUser(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded transition-colors"
              >
                <Mail className="w-4 h-4" />
                Create and Send Details
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">Name</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">Email</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">Role</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">Permissions</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-300">Created</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user as any}
                    isEditing={editingUser === user.id}
                    onEdit={() => setEditingUser(user.id)}
                    onCancelEdit={() => setEditingUser(null)}
                    onSave={handleUpdateUser}
                    onDelete={handleDeleteUser}
                    onSendLoginDetails={() => handleSendLoginDetails(user)}
                    onResetPassword={() => handleResetPassword(user)}
                    onManagePermissions={() => setManagingPermissionsFor(user.id)}
                    onNavigate={onNavigate}
                    currentUserId={profile?.id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {managingPermissionsFor && (
          <BookingPermissionsManager
            userId={managingPermissionsFor}
            onClose={() => setManagingPermissionsFor(null)}
            onSave={() => {
              setSuccess('Booking permissions updated successfully');
              loadUsers();
            }}
          />
        )}
      </main>
    </div>
  );
}

import BookingPermissionsManager from '../components/BookingPermissionsManager';

interface UserRowProps {
  user: User & { trainer?: { id: string; name: string } };
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (userId: string, updates: Partial<User>) => void;
  onDelete: (userId: string) => void;
  onSendLoginDetails: () => void;
  onResetPassword: () => void;
  onManagePermissions: () => void;
  onNavigate: (page: string) => void;
  currentUserId?: string;
}

function UserRow({ user, isEditing, onEdit, onCancelEdit, onSave, onDelete, onSendLoginDetails, onResetPassword, onManagePermissions, onNavigate, currentUserId }: UserRowProps) {
  const { profile } = useAuth();
  const [editData, setEditData] = useState({
    email: user.email,
    full_name: user.full_name || '',
    role: user.role,
    super_admin: user.super_admin,
    can_manage_users: user.can_manage_users,
    can_manage_bookings: user.can_manage_bookings,
    can_manage_courses: user.can_manage_courses,
    can_view_bookings: user.can_view_bookings,
    can_manage_expenses: user.can_manage_expenses,
    can_manage_availability: user.can_manage_availability,
    can_login: user.can_login,
  });

  const isCurrentUser = user.id === currentUserId;

  if (isEditing) {
    return (
      <tr className="border-b border-slate-800 bg-slate-800/30">
        <td className="px-6 py-4">
          <div className="space-y-2">
            <input
              type="text"
              id={`full_name_${user.id}`}
              name="full_name"
              value={editData.full_name}
              onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Full Name"
            />
          </div>
        </td>
        <td className="px-6 py-4">
          <input
            type="email"
            id={`email_${user.id}`}
            name="email"
            value={editData.email}
            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500 text-sm"
            placeholder="user@example.com"
          />
        </td>
        <td className="px-6 py-4">
          <select
            id={`role_${user.id}`}
            name="role"
            value={editData.role}
            onChange={(e) => setEditData({ ...editData, role: e.target.value as 'admin' | 'user' })}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500 text-sm"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-1">
            {profile?.super_admin && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id={`super_admin_${user.id}`}
                  name="super_admin"
                  checked={editData.super_admin}
                  onChange={(e) => setEditData({ ...editData, super_admin: e.target.checked })}
                  className="w-3 h-3"
                />
                <span className="text-yellow-400 font-semibold">Super Admin</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`can_manage_users_${user.id}`}
                name="can_manage_users"
                checked={editData.role === 'admin' ? true : editData.can_manage_users}
                onChange={(e) => setEditData({ ...editData, can_manage_users: e.target.checked })}
                disabled={editData.role === 'admin'}
                className="w-3 h-3"
              />
              <span className={editData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}>Manage Users</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`can_manage_bookings_${user.id}`}
                name="can_manage_bookings"
                checked={editData.role === 'admin' ? true : editData.can_manage_bookings}
                onChange={(e) => setEditData({ ...editData, can_manage_bookings: e.target.checked })}
                disabled={editData.role === 'admin'}
                className="w-3 h-3"
              />
              <span className={editData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}>Manage Bookings</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`can_manage_courses_${user.id}`}
                name="can_manage_courses"
                checked={editData.role === 'admin' ? true : editData.can_manage_courses}
                onChange={(e) => setEditData({ ...editData, can_manage_courses: e.target.checked })}
                disabled={editData.role === 'admin'}
                className="w-3 h-3"
              />
              <span className={editData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}>Manage Courses</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`can_view_bookings_${user.id}`}
                name="can_view_bookings"
                checked={editData.role === 'admin' ? true : editData.can_view_bookings}
                onChange={(e) => setEditData({ ...editData, can_view_bookings: e.target.checked })}
                disabled={editData.role === 'admin'}
                className="w-3 h-3"
              />
              <span className={editData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}>View Bookings</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`can_manage_expenses_${user.id}`}
                name="can_manage_expenses"
                checked={editData.role === 'admin' ? true : editData.can_manage_expenses}
                onChange={(e) => setEditData({ ...editData, can_manage_expenses: e.target.checked })}
                disabled={editData.role === 'admin'}
                className="w-3 h-3"
              />
              <span className={editData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}>Manage Expenses</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id={`can_manage_availability_${user.id}`}
                name="can_manage_availability"
                checked={editData.role === 'admin' ? true : editData.can_manage_availability}
                onChange={(e) => setEditData({ ...editData, can_manage_availability: e.target.checked })}
                disabled={editData.role === 'admin'}
                className="w-3 h-3"
              />
              <span className={editData.role === 'admin' ? 'text-slate-500' : 'text-slate-400'}>Manage Availability</span>
            </label>
            {user.is_trainer && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id={`can_login_${user.id}`}
                  name="can_login"
                  checked={editData.can_login}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      if (confirm('Enable portal login for this trainer? They will be able to access the system with their credentials.')) {
                        setEditData({ ...editData, can_login: checked });
                      }
                    } else {
                      if (confirm('Disable portal login for this trainer? They will no longer be able to access the system.')) {
                        setEditData({ ...editData, can_login: checked });
                      }
                    }
                  }}
                  className="w-3 h-3"
                />
                <span className="text-slate-400">Allow Portal Login</span>
              </label>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-slate-400">
          {new Date(user.created_at).toLocaleDateString()}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onSave(user.id, editData)}
              className="p-1.5 text-green-400 hover:text-green-300 transition-colors"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onCancelEdit();
              }}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <div className="text-sm">{user.full_name || '-'}</div>
          {user.is_trainer && user.trainer && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded">
                Trainer: {user.trainer.name}
              </span>
              <button
                onClick={() => onNavigate('trainer-management')}
                className="text-teal-400 hover:text-teal-300 transition-colors"
                title="View Trainer Profile"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-slate-400">{user.email}</td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          {user.super_admin && (
            <span className="px-2 py-1 text-xs rounded inline-block w-fit bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold">
              Super Admin
            </span>
          )}
          <span
            className={`px-2 py-1 text-xs rounded inline-block w-fit ${
              user.role === 'admin'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-700/50 text-slate-300 border border-slate-600'
            }`}
          >
            {user.role}
          </span>
          {user.is_trainer && (
            <div className="flex items-center gap-1">
              {user.can_login ? (
                <>
                  <UserCheck className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">Portal Access</span>
                </>
              ) : (
                <>
                  <UserX className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-500">No Portal Access</span>
                </>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {user.can_manage_users && (
            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded">
              Manage Users
            </span>
          )}
          {user.can_manage_bookings && (
            <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
              Manage Bookings
            </span>
          )}
          {user.can_manage_courses && (
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
              Manage Courses
            </span>
          )}
          {user.can_view_bookings && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
              View Bookings
            </span>
          )}
          {user.can_manage_expenses && (
            <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded">
              Manage Expenses
            </span>
          )}
          {user.can_manage_availability && (
            <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded">
              Manage Availability
            </span>
          )}
          {!user.can_manage_users && !user.can_manage_bookings && !user.can_manage_courses && !user.can_view_bookings && !user.can_manage_expenses && !user.can_manage_availability && (
            <span className="text-xs text-slate-500">None</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-slate-400">
        {new Date(user.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          {user.can_view_bookings && (
            <button
              onClick={onManagePermissions}
              className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
              title="Manage booking permissions"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onSendLoginDetails}
            className="p-1.5 text-green-400 hover:text-green-300 transition-colors"
            title="Send login details"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            onClick={onResetPassword}
            className="p-1.5 text-amber-400 hover:text-amber-300 transition-colors"
            title="Reset password"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {!isCurrentUser && (user.role !== 'admin' || profile?.super_admin) && (
            <button
              onClick={() => onDelete(user.id)}
              className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
              title={user.role === 'admin' && !profile?.super_admin ? "Only super admins can delete admin users" : "Delete"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
