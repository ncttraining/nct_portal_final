import { useState, useRef, useEffect } from 'react';
import { X, Save, Upload, User, Lock, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Notification from './Notification';

interface EditProfileProps {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  onClose: () => void;
  onUpdate: () => void;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

export default function EditProfile({ profile, onClose, onUpdate }: EditProfileProps) {
  const [notification, setNotification] = useState<NotificationState>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [trainerData, setTrainerData] = useState<{ id: string; receive_booking_notifications: boolean } | null>(null);
  const [loadingTrainer, setLoadingTrainer] = useState(true);

  useEffect(() => {
    loadTrainerData();
  }, [profile.id]);

  async function loadTrainerData() {
    try {
      const { data, error } = await supabase
        .from('trainers')
        .select('id, receive_booking_notifications')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (!error && data) {
        setTrainerData(data);
      }
    } catch (error) {
      console.error('Error loading trainer data:', error);
    } finally {
      setLoadingTrainer(false);
    }
  }

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    profile.avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}` : null
  );

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotification({ type: 'error', message: 'Please select an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotification({ type: 'error', message: 'Image size must be less than 2MB' });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/avatar.${fileExt}`;

      if (profile.avatar_url) {
        await supabase.storage.from('avatars').remove([profile.avatar_url]);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: fileName })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
      setPreviewUrl(publicUrl);
      setNotification({ type: 'success', message: 'Avatar updated successfully' });
      onUpdate();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setNotification({ type: 'error', message: 'Failed to upload avatar' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveProfile() {
    if (!formData.full_name.trim()) {
      setNotification({ type: 'error', message: 'Full name is required' });
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: formData.full_name })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      if (trainerData) {
        const { error: trainerError } = await supabase
          .from('trainers')
          .update({ receive_booking_notifications: trainerData.receive_booking_notifications })
          .eq('id', trainerData.id);

        if (trainerError) throw trainerError;
      }

      if (formData.new_password) {
        if (formData.new_password !== formData.confirm_password) {
          setNotification({ type: 'error', message: 'New passwords do not match' });
          setSaving(false);
          return;
        }

        if (formData.new_password.length < 6) {
          setNotification({ type: 'error', message: 'Password must be at least 6 characters' });
          setSaving(false);
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.new_password,
        });

        if (passwordError) throw passwordError;
      }

      setNotification({ type: 'success', message: 'Profile updated successfully' });
      onUpdate();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-800">
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}

        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full object-cover border-4 border-slate-700"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-4 border-slate-700">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <p className="text-sm text-slate-400">Click the upload button to change your avatar</p>
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
          </div>

          {!loadingTrainer && trainerData && (
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </h3>
              <label className="flex items-start gap-3 cursor-pointer hover:bg-slate-800/50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={trainerData.receive_booking_notifications}
                  onChange={(e) => setTrainerData({ ...trainerData, receive_booking_notifications: e.target.checked })}
                  className="mt-1 w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Receive Booking Notifications</div>
                  <div className="text-xs text-slate-400 mt-1">
                    When enabled, you will receive email notifications when new bookings are assigned to you, when bookings are moved to you from other trainers, when your bookings are cancelled, or when booking details are updated.
                  </div>
                </div>
              </label>
            </div>
          )}

          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={formData.new_password}
                  onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-800 px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
