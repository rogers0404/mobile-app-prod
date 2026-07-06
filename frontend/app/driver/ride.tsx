import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRideStore } from '../../src/store/rideStore';
import { useDriverStore } from '../../src/store/driverStore';
import { InteractiveMap } from '../../src/components/InteractiveMap';
import NavigationPanel from '../../src/components/NavigationPanel';
import { getApiUrl } from '../../src/config/env';

export default function ActiveRideScreen() {
  const router = useRouter();
  const { activeRide, fetchRideDetails, updateRideStatus } = useRideStore();
  const { updateLocation } = useDriverStore();
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [directionsInfo, setDirectionsInfo] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastDirectionsFetch = useRef(0);

  useEffect(() => {
    if (!activeRide) {
      router.replace('/driver');
      return;
    }

    initLocation();

    // Update driver location every 10s
    const locationInterval = setInterval(async () => {
      try {
        if (Platform.OS === 'web' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setCurrentLocation(loc);
              updateLocation(loc.latitude, loc.longitude);
            },
            (err) => console.error('Location error:', err),
            { enableHighAccuracy: true }
          );
        } else {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const loc = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          setCurrentLocation(loc);
          await updateLocation(loc.latitude, loc.longitude);
        }
      } catch (error) {
        console.error('Location update error:', error);
      }
    }, 10000);

    return () => {
      clearInterval(locationInterval);
    };
  }, [activeRide?.ride_id]);

  // WebSocket for real-time ride updates
  useEffect(() => {
    if (!activeRide?.ride_id) return;

    const connectWebSocket = async () => {
      try {
        const userId = await AsyncStorage.getItem('user_id');
        if (!userId) return;

        const API_URL = getApiUrl();
        const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
        const ws = new WebSocket(`${wsUrl}/api/ws/${userId}`);

        ws.onopen = () => {
          // Sync ride state on connect to prevent missing an update
          if (activeRide?.ride_id) {
            fetchRideDetails(activeRide.ride_id);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ride_update' && data.ride?.ride_id === activeRide?.ride_id) {
              if (data.ride) {
                useRideStore.setState({ activeRide: data.ride });
              } else {
                fetchRideDetails(activeRide!.ride_id); // Fallback
              }
            }
          } catch (e) {
            console.error('WS message parse error in driver screen:', e);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Driver WebSocket connection error:', error);
      }
    };

    connectWebSocket();

    return () => wsRef.current?.close();
  }, [activeRide?.ride_id]);

  useEffect(() => {
    if (activeRide?.status === 'completed' || activeRide?.status === 'cancelled') {
      Alert.alert(
        activeRide.status === 'completed' ? 'Ride Completed' : 'Ride Cancelled',
        activeRide.status === 'completed'
          ? `You earned $${activeRide.fare.toFixed(2)} for this ride!`
          : 'The ride has been cancelled.',
        [{ text: 'OK', onPress: () => router.replace('/driver') }]
      );
    }
  }, [activeRide?.status]);

  // Fetch directions for navigation, throttled to 15 seconds
  useEffect(() => {
    const fetchDirections = async () => {
      if (!origin || !destination) return;
      try {
        const API_URL = getApiUrl();
        const response = await fetch(
          `${API_URL}/api/directions?origin_lat=${origin.latitude}&origin_lng=${origin.longitude}&dest_lat=${destination.latitude}&dest_lng=${destination.longitude}`
        );
        const data = await response.json();
        if (data.status === 'OK') {
          setDirectionsInfo(data);
        } else {
          setDirectionsInfo(null);
        }
      } catch (error) {
        console.error('Fetch directions error:', error);
        setDirectionsInfo(null);
      }
    };

    const now = Date.now();
    if (origin && destination && (now - lastDirectionsFetch.current > 15000 || !directionsInfo)) {
      fetchDirections();
      lastDirectionsFetch.current = now;
    }
  }, [origin, destination]);

  const initLocation = async () => {
    try {
      if (Platform.OS === 'web' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => console.error('Location error:', err),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        }
      }
    } catch (error) {
      console.error('Init location error:', error);
    }
  };

  const handlePickedUp = () => {
    Alert.alert('Confirm Pickup', 'Has the rider been picked up?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Picked Up',
        onPress: async () => {
          try {
            setLoading(true);
            await updateRideStatus(activeRide!.ride_id, 'picked_up');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update status.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Has the rider been dropped off at the destination?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Complete',
        onPress: async () => {
          try {
            setLoading(true);
            await updateRideStatus(activeRide!.ride_id, 'completed');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to complete ride.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleCancelRide = () => {
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await updateRideStatus(activeRide!.ride_id, 'cancelled');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel ride.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const isPickingUp = activeRide?.status === 'accepted';

  // Destination switches based on phase
  const destination = useMemo(() => {
    if (!activeRide) return null;
    return isPickingUp
      ? { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude }
      : { latitude: activeRide.dropoff_latitude, longitude: activeRide.dropoff_longitude };
  }, [activeRide, isPickingUp]);

  // Memoize origin — only changes when GPS moves, not on every render
  const origin = useMemo(() => {
    if (currentLocation) return currentLocation;
    if (!activeRide) return null;
    return isPickingUp
      ? { latitude: activeRide.pickup_latitude - 0.01, longitude: activeRide.pickup_longitude }
      : { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude };
  }, [currentLocation, activeRide, isPickingUp]);

  // Phase-aware markers: driver (blue) + only the current destination pin
  const markers = useMemo(() => {
    if (!activeRide) return [];
    return [
      ...(currentLocation ? [{
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        color: 'blue' as const,
        label: 'D',
        title: 'You',
      }] : []),
      isPickingUp
        ? { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude, color: 'green' as const, label: 'P', title: 'Pickup' }
        : { latitude: activeRide.dropoff_latitude, longitude: activeRide.dropoff_longitude, color: 'red' as const, label: 'X', title: 'Dropoff' },
    ];
  }, [currentLocation, activeRide, isPickingUp]);

  if (!activeRide || !origin || !destination) return null;

  return (
    <View style={styles.container}>
      {/* Map — top 45% */}
      <InteractiveMap
        style={styles.map}
        latitude={origin.latitude}
        longitude={origin.longitude}
        markers={markers}
        showRoute
        routeOrigin={origin}
        routeDestination={destination}
        zoom={13}
      />

      {/* Status badge */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.statusBadge}>
          <Ionicons name={isPickingUp ? 'location' : 'navigate'} size={20} color="#FFFFFF" />
          <Text style={styles.statusText}>
            {isPickingUp ? 'Navigate to Pickup' : 'Navigate to Dropoff'}
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom card */}
      <ScrollView
        style={styles.bottomCard}
        contentContainerStyle={styles.bottomCardContent}
        showsVerticalScrollIndicator={false}
      >
        <NavigationPanel
          directions={directionsInfo}
          destinationLabel={isPickingUp ? 'Pickup Location' : 'Dropoff Location'}
          destinationAddress={isPickingUp ? activeRide.pickup_address : activeRide.dropoff_address}
          isPickup={isPickingUp}
        />

        <View style={styles.riderSection}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={32} color="#6B7280" />
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{activeRide.rider_name || 'Rider'}</Text>
            <Text style={styles.fareText}>${activeRide.fare.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {activeRide.status === 'accepted' && (
            <TouchableOpacity style={styles.pickedUpButton} onPress={handlePickedUp} disabled={loading}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{loading ? 'Updating...' : 'Rider Picked Up'}</Text>
            </TouchableOpacity>
          )}
          {activeRide.status === 'picked_up' && (
            <TouchableOpacity style={styles.completeButton} onPress={handleCompleteRide} disabled={loading}>
              <Ionicons name="flag" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{loading ? 'Completing...' : 'Complete Ride'}</Text>
            </TouchableOpacity>
          )}
          {(activeRide.status === 'accepted' || activeRide.status === 'picked_up') && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide} disabled={loading}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={styles.cancelButtonText}>Cancel Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  map: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E40AF',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  statusText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: '40%',
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  bottomCardContent: { padding: 24, paddingBottom: 40 },
  riderSection: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  riderAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  riderInfo: { flex: 1, marginLeft: 16 },
  riderName: { fontSize: 18, fontWeight: '600', color: '#111827' },
  fareText: { fontSize: 20, fontWeight: 'bold', color: '#10B981', marginTop: 4 },
  actionButtons: { gap: 12 },
  pickedUpButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, gap: 8,
  },
  completeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E40AF', paddingVertical: 16, borderRadius: 12, gap: 8,
  },
  actionButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  cancelButtonText: { fontSize: 16, fontWeight: '500', color: '#EF4444' },
});
