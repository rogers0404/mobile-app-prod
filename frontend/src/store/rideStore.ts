import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/env';

export interface Ride {
  ride_id: string;
  rider_id: string;
  rider_name?: string;
  driver_id?: string;
  driver_name?: string;
  driver_vehicle?: {
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string;
    vehicle_color: string;
    license_plate: string;
  };
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  dropoff_latitude: number;
  dropoff_longitude: number;
  dropoff_address: string;
  distance_miles: number;
  fare: number;
  status: 'pending' | 'accepted' | 'picked_up' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid';
  driver_location?: {
    latitude: number;
    longitude: number;
  };
  created_at: string;
  accepted_at?: string;
  picked_up_at?: string;
  completed_at?: string;
}

export interface NearbyDriver {
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number;
  vehicle?: {
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: string;
    vehicle_color: string;
    license_plate: string;
  };
}

export interface RideHistoryFilters {
  search?: string;
  status?: 'all' | 'completed' | 'cancelled' | 'pending';
  dateFrom?: string;
  dateTo?: string;
}

interface RideState {
  activeRide: Ride | null;
  pendingRides: Ride[];
  rideHistory: Ride[];
  nearbyDrivers: NearbyDriver[];
  isLoading: boolean;
  historyFilters: RideHistoryFilters;
  setActiveRide: (ride: Ride | null) => void;
  fetchActiveRide: () => Promise<void>;
  fetchPendingRides: () => Promise<void>;
  fetchRideHistory: (filters?: RideHistoryFilters) => Promise<void>;
  setHistoryFilters: (filters: RideHistoryFilters) => void;
  fetchNearbyDrivers: (lat: number, lng: number) => Promise<void>;
  requestRide: (data: {
    pickup_latitude: number;
    pickup_longitude: number;
    pickup_address: string;
    dropoff_latitude: number;
    dropoff_longitude: number;
    dropoff_address: string;
  }) => Promise<Ride | null>;
  acceptRide: (rideId: string) => Promise<Ride | null>;
  updateRideStatus: (rideId: string, status: string) => Promise<Ride | null>;
  fetchRideDetails: (rideId: string) => Promise<Ride | null>;
}

const getUserId = async () => {
  return await AsyncStorage.getItem('user_id');
};

export const useRideStore = create<RideState>((set, get) => ({
  activeRide: null,
  pendingRides: [],
  rideHistory: [],
  nearbyDrivers: [],
  isLoading: false,
  historyFilters: {},

  setActiveRide: (ride) => set({ activeRide: ride }),
  
  setHistoryFilters: (filters) => set({ historyFilters: filters }),

  fetchActiveRide: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;
      
      const response = await fetch(`${getApiUrl()}/api/rides/${userId}/active`);

      if (response.ok) {
        const ride = await response.json();
        set({ activeRide: ride });
      } else {
        set({ activeRide: null });
      }
    } catch (error) {
      console.error('Fetch active ride error:', error);
    }
  },

  fetchPendingRides: async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;
      
      const response = await fetch(`${getApiUrl()}/api/driver/${userId}/pending-rides`);

      if (response.ok) {
        const rides = await response.json();
        set({ pendingRides: rides });
      }
    } catch (error) {
      console.error('Fetch pending rides error:', error);
    }
  },

  fetchRideHistory: async (filters?: RideHistoryFilters) => {
    try {
      set({ isLoading: true });
      const userId = await getUserId();
      if (!userId) return;
      
      // Build query string from filters
      const params = new URLSearchParams();
      const appliedFilters = filters || get().historyFilters;
      
      if (appliedFilters.search) params.append('search', appliedFilters.search);
      if (appliedFilters.status && appliedFilters.status !== 'all') params.append('status', appliedFilters.status);
      if (appliedFilters.dateFrom) params.append('date_from', appliedFilters.dateFrom);
      if (appliedFilters.dateTo) params.append('date_to', appliedFilters.dateTo);
      
      const queryString = params.toString();
      const url = `${getApiUrl()}/api/rides/${userId}/history${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);

      if (response.ok) {
        const rides = await response.json();
        set({ rideHistory: rides });
        if (filters) {
          set({ historyFilters: filters });
        }
      }
    } catch (error) {
      console.error('Fetch ride history error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchNearbyDrivers: async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `${getApiUrl()}/api/rider/nearby-drivers?latitude=${lat}&longitude=${lng}`
      );

      if (response.ok) {
        const drivers = await response.json();
        set({ nearbyDrivers: drivers });
      }
    } catch (error) {
      console.error('Fetch nearby drivers error:', error);
    }
  },

  requestRide: async (data) => {
    try {
      set({ isLoading: true });
      const userId = await getUserId();
      if (!userId) throw new Error('User not found');
      
      const response = await fetch(`${getApiUrl()}/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, user_id: userId }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to request ride';
        try {
          const error = await response.json();
          errorMessage = error.detail || errorMessage;
        } catch {
          const text = await response.text();
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      let ride: Ride | null = null;
      try {
        ride = await response.json();
      } catch {
        ride = {
          ride_id: 'local',
          rider_id: userId,
          pickup_latitude: data.pickup_latitude,
          pickup_longitude: data.pickup_longitude,
          pickup_address: data.pickup_address,
          dropoff_latitude: data.dropoff_latitude,
          dropoff_longitude: data.dropoff_longitude,
          dropoff_address: data.dropoff_address,
          distance_miles: 0,
          fare: 0,
          status: 'pending',
          payment_status: 'unpaid',
          created_at: new Date().toISOString(),
        };
      }
      set({ activeRide: ride });
      return ride;
    } catch (error) {
      console.error('Request ride error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  acceptRide: async (rideId: string) => {
    try {
      set({ isLoading: true });
      const userId = await getUserId();
      if (!userId) throw new Error('User not found');
      
      const response = await fetch(`${getApiUrl()}/api/rides/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: rideId, user_id: userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to accept ride');
      }

      const ride = await response.json();
      set({ activeRide: ride });
      return ride;
    } catch (error) {
      console.error('Accept ride error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateRideStatus: async (rideId: string, status: string) => {
    try {
      set({ isLoading: true });
      const userId = await getUserId();
      if (!userId) throw new Error('User not found');
      
      const response = await fetch(`${getApiUrl()}/api/rides/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: rideId, status, user_id: userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update ride status');
      }

      const ride = await response.json();
      if (status === 'completed' || status === 'cancelled') {
        set({ activeRide: null });
      } else {
        set({ activeRide: ride });
      }
      return ride;
    } catch (error) {
      console.error('Update ride status error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRideDetails: async (rideId: string) => {
    try {
      const userId = await getUserId();
      if (!userId) return null;
      
      const response = await fetch(`${getApiUrl()}/api/rides/details/${rideId}?user_id=${userId}`);

      if (response.ok) {
        const ride = await response.json();
        set({ activeRide: ride });
        return ride;
      }
      return null;
    } catch (error) {
      console.error('Fetch ride details error:', error);
      return null;
    }
  },
}));
