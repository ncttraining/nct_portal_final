import { LogOut, User, ChevronDown, Sun, Moon } from 'lucide-react';
import NavigationMenu from './NavigationMenu';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useRef, useEffect } from 'react';

interface PageHeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onEditProfile?: () => void;
}

export default function PageHeader({ currentPage, onNavigate, onEditProfile }: PageHeaderProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    try {
      setShowProfileDropdown(false);
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = profile?.avatar_url
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : null;

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo_white.png"
              alt="National Compliance Training"
              className="h-12 dark:brightness-100 brightness-0"
            />
            <span className="px-3 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-full text-slate-600 dark:text-slate-300">
              INTERNAL PORTAL
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-slate-300" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-3 px-3 py-1.5 rounded transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {profile?.full_name || user?.email || 'User'}
                </span>
                {profile?.role === 'admin' && (
                  <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded">
                    Admin
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{profile?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    {onEditProfile && (
                      <button
                        onClick={() => {
                          onEditProfile();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        Edit Profile
                      </button>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <NavigationMenu currentPage={currentPage} onNavigate={onNavigate} />
        </div>
      </div>
    </header>
  );
}
