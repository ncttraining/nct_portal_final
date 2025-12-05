import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        console.log('Auth state changed:', _event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    console.log('Loading profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('Profile query result:', { data, error });

      if (error) {
        console.error('Error loading user profile:', error);
        setProfile(null);
      } else if (data) {
        console.log('Profile loaded successfully:', data);
        setProfile(data as UserProfile);
      } else {
        console.warn('No profile found for user:', userId);
        setProfile(null);
      }
    } catch (err) {
      console.error('Exception loading user profile:', err);
      setProfile(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('can_login, is_trainer, trainer_id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking user permissions:', profileError);
      }

      if (userProfile && !userProfile.can_login) {
        await supabase.auth.signOut();
        throw new Error('Portal access has not been enabled for your account. Please contact an administrator.');
      }

      if (userProfile && userProfile.is_trainer && userProfile.trainer_id) {
        const { data: trainerData, error: trainerError } = await supabase
          .from('trainers')
          .select('suspended')
          .eq('id', userProfile.trainer_id)
          .maybeSingle();

        if (trainerError) {
          console.error('Error checking trainer status:', trainerError);
        }

        if (trainerData && trainerData.suspended) {
          await supabase.auth.signOut();
          throw new Error('Your trainer account has been suspended. Please contact an administrator.');
        }
      }
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (err) {
      console.error('Sign out exception:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      localStorage.clear();
      sessionStorage.clear();
    }
  }

  async function reloadProfile() {
    if (user) {
      await loadUserProfile(user.id);
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    reloadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
