import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/env';


interface DriverDocuments {
  license_data?: string;
  insurance_data?: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  license_plate: string;
  verified: boolean;
}

interface DriverState {
  isOnline: boolean;
  isVerified: boolean;
  documents: DriverDocuments | null;
  isLoading: boolean;
  setOnline: (online: boolean) => void;
  fetchStatus: () => Promise<void>;
  updateStatus: (online: boolean) => Promise<void>;
  fetchDocuments: () => Promise<void>;
  uploadDocuments: (data: {
    license_data?: string;
    insurance_data?: string;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string;
    vehicle_color: string;
    license_plate: string;
  }) => Promise<void>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
}

const getUserId = async () => {
  return await AsyncStorage.getItem('user_id');
};

export const useDriverStore = create<DriverState>((set, get) => ({
  isOnline: false,
  isVerified: false,
  documents: null,
  isLoading: false,

  setOnline: (online) => set({ isOnline: online }),

  fetchStatus: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;
      
      const response = await fetch(`${getApiUrl()}/api/driver/${userId}/status`);

      if (response.ok) {
        const status = await response.json();
        set({
          isOnline: status.is_online,
          isVerified: status.is_verified,
        });
      }
    } catch (error) {
      console.error('Fetch driver status error:', error);
    }
  },

  updateStatus: async (online: boolean) => {
    try {
      set({ isLoading: true });
      const userId = await getUserId();
      if (!userId) throw new Error('User not found');
      
      const response = await fetch(`${getApiUrl()}/api/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_online: online, user_id: userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update status');
      }

      set({ isOnline: online });
    } catch (error) {
      console.error('Update driver status error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDocuments: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;
      
      const response = await fetch(`${getApiUrl()}/api/driver/${userId}/documents`);

      if (response.ok) {
        const documents = await response.json();
        set({ documents });
      }
    } catch (error) {
      console.error('Fetch documents error:', error);
    }
  },

  uploadDocuments: async (data) => {
    try {
      set({ isLoading: true });
      const userId = await getUserId();
      if (!userId) throw new Error('User not found');
      
      const response = await fetch(`${getApiUrl()}/api/driver/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, user_id: userId }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to upload documents';
        try {
          const error = await response.json();
          errorMessage = error.detail || errorMessage;
        } catch {
          const text = await response.text();
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      let result: { verified?: boolean } = {};
      try {
        result = await response.json();
      } catch {
        result = { verified: true };
      }

      set({ isVerified: result.verified ?? true });
      await get().fetchDocuments();
    } catch (error) {
      console.error('Upload documents error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateLocation: async (latitude: number, longitude: number) => {
    try {
      const userId = await getUserId();
      if (!userId) return;
      
      await fetch(`${getApiUrl()}/api/driver/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, user_id: userId }),
      });
    } catch (error) {
      console.error('Update location error:', error);
    }
  },
}));
