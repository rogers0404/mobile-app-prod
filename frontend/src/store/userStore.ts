import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/env';


export interface User {
  user_id: string;
  name: string;
  user_type: 'rider' | 'driver';
  created_at?: string;
  driver_status?: {
    is_online: boolean;
    is_verified: boolean;
  };
  documents?: any;
  total_rides?: number;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  createUser: (userType: 'rider' | 'driver', name?: string) => Promise<User>;
  loadUser: () => Promise<User | null>;
  refreshProfile: () => Promise<void>;
  clearUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  createUser: async (userType: 'rider' | 'driver', name?: string) => {
    try {
      set({ isLoading: true });
      
      const response = await fetch(`${getApiUrl()}/api/users/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_type: userType,
          name: name || 'Trip User'
        }),
      });

      if (!response.ok) {
        let detail = '';
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const body = await response.json();
            if (typeof body.detail === 'string') {
              detail = body.detail;
            } else if (typeof body.error === 'string') {
              detail = body.error;
            } else if (typeof body.message === 'string') {
              detail = body.message;
            }
          } catch (error) {
            console.error('Failed to read create user error response:', error);
          }
        }
        throw new Error(
          `Failed to create user (HTTP ${response.status})${detail ? `: ${detail}` : ''}`
        );
      }

      const user = await response.json();
      await AsyncStorage.setItem('user_id', user.user_id);
      await AsyncStorage.setItem('user_type', userType);
      
      set({ user });
      return user;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });
      
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) {
        set({ isLoading: false });
        return null;
      }

      const response = await fetch(`${getApiUrl()}/api/users/${userId}`);
      
      if (!response.ok) {
        await AsyncStorage.removeItem('user_id');
        await AsyncStorage.removeItem('user_type');
        set({ isLoading: false });
        return null;
      }

      const user = await response.json();
      set({ user, isLoading: false });
      return user;
    } catch (error) {
      console.error('Load user error:', error);
      set({ isLoading: false });
      return null;
    }
  },

  refreshProfile: async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;
      
      const response = await fetch(`${getApiUrl()}/api/users/${userId}`);
      
      if (response.ok) {
        const user = await response.json();
        set({ user });
      }
    } catch (error) {
      console.error('Refresh profile error:', error);
    }
  },

  clearUser: async () => {
    await AsyncStorage.removeItem('user_id');
    await AsyncStorage.removeItem('user_type');
    set({ user: null });
  },
}));
