import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRideStore } from '../../src/store/rideStore';
import { InteractiveMap } from '../../src/components/InteractiveMap';
import { RadarSearch } from '../../src/components/RadarSearch';
import { useNotificationStore } from '../../src/store/notificationStore';
import { getApiUrl } from '../../src/config/env';

const API_URL = getApiUrl();

interface DirectionsInfo {
  duration: string;
  distance: string;
}

export default function RideTrackingScreen() {
  const router = useRouter();
  const { activeRide, fetchActiveRide, fetchRideDetails, updateRideStatus } = useRideStore();
  const showNotification = useNotificationStore((s) => s.show);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [directionsInfo, setDirectionsInfo] = useState<DirectionsInfo | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const lastDirectionsFetch = useRef(0);

  useEffect(() => {
    // If activeRide is already in the store, we don't need to fetch it again.
    // This prevents a race condition where this fetch overwrites a WebSocket update.
    if (!activeRide) {
      loadRide();
    } else {
      setLoading(false);
    }
  }, []);

  // Connect WebSocket for real-time driver location
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Fetch ETA when driver location or ride status changes, throttled to 30 seconds
  useEffect(() => {
    if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'picked_up')) {
      const now = Date.now();
      const statusChanged = prevStatusRef.current !== activeRide.status;

      // Fetch immediately on status change, then throttle to every 30s
      if (statusChanged || now - lastDirectionsFetch.current > 30000) {
        fetchDirectionsInfo();
        lastDirectionsFetch.current = now;
      }
    } else {
      setDirectionsInfo(null);
      lastDirectionsFetch.current = 0; // Reset timer when ride is not active
    }
  }, [driverLocation, activeRide?.status]);

  // Handle ride status changes + trigger notifications
  useEffect(() => {
    if (activeRide) {
      setLoading(false);

      // Trigger notification on status change
      if (prevStatusRef.current && prevStatusRef.current !== activeRide.status) {
        switch (activeRide.status) {
          case 'accepted':
            showNotification({
              title: 'Driver Found!',
              message: `${activeRide.driver_name || 'A driver'} is on the way to pick you up`,
              type: 'success',
              icon: 'car',
            });
            break;
          case 'picked_up':
            showNotification({
              title: 'Ride Started',
              message: 'You\'re on your way to your destination',
              type: 'info',
              icon: 'navigate',
            });
            break;
          case 'completed':
            showNotification({
              title: 'Ride Completed',
              message: 'You\'ve arrived! Time to pay and rate your driver',
              type: 'success',
              icon: 'checkmark-circle',
            });
            break;
          case 'cancelled':
            showNotification({
              title: 'Ride Cancelled',
              message: 'Your ride has been cancelled',
              type: 'warning',
              icon: 'alert-circle',
            });
            break;
        }
      }
      prevStatusRef.current = activeRide.status;

      if (activeRide.status === 'completed') {
        router.replace('/rider/payment');
      } else if (activeRide.status === 'cancelled') {
        Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
        router.replace('/rider');
      }
    }
  }, [activeRide]);

  const fetchDirectionsInfo = async () => {
    if (!activeRide) return;

    try {
      // Determine origin and destination based on ride status
      let originLat, originLng, destLat, destLng;
      
      if (activeRide.status === 'accepted' && driverLocation) {
        // Driver is coming to pickup - show ETA from driver to pickup
        originLat = driverLocation.latitude;
        originLng = driverLocation.longitude;
        destLat = activeRide.pickup_latitude;
        destLng = activeRide.pickup_longitude;
      } else if (activeRide.status === 'picked_up') {
        // In transit - show ETA from pickup to dropoff (or driver location to dropoff if available)
        if (driverLocation) {
          originLat = driverLocation.latitude;
          originLng = driverLocation.longitude;
        } else {
          originLat = activeRide.pickup_latitude;
          originLng = activeRide.pickup_longitude;
        }
        destLat = activeRide.dropoff_latitude;
        destLng = activeRide.dropoff_longitude;
      } else {
        return;
      }

      const response = await fetch(
        `${API_URL}/api/directions?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}`
      );
      const data = await response.json();

      if (data.status === 'OK') {
        setDirectionsInfo({
          duration: data.duration,
          distance: data.distance,
        });
      }
    } catch (error) {
      console.error('Fetch directions error:', error);
    }
  };

  const connectWebSocket = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}/api/ws/${userId}`);

      ws.onopen = () => {
        // Sync ride state on connect to prevent missing an update
        // that happened during the connection phase.
        fetchActiveRide();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'driver_location') {
            setDriverLocation({
              latitude: data.latitude,
              longitude: data.longitude,
            });
          } else if (data.type === 'ride_update') {
            // Ride status changed via WebSocket, update store directly
            if (data.ride) {
              useRideStore.setState({ activeRide: data.ride });
            } else {
              fetchActiveRide(); // Fallback if ride data is missing
            }
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };

      ws.onerror = () => {
        // Fallback to polling (already running)
      };

      ws.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket();
          }
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const loadRide = async () => {
    await fetchActiveRide();
    setLoading(false);
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateRideStatus(activeRide!.ride_id, 'cancelled');
              router.replace('/rider');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel ride.');
            }
          },
        },
      ]
    );
  };

  const getStatusText = () => {
    switch (activeRide?.status) {
      case 'pending':
        return 'Looking for a driver...';
      case 'accepted':
        return directionsInfo ? `Driver arriving in ${directionsInfo.duration}` : 'Driver is on the way!';
      case 'picked_up':
        return directionsInfo ? `Arriving in ${directionsInfo.duration}` : 'On your way to destination';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = (): any => {
    switch (activeRide?.status) {
      case 'pending':
        return 'search';
      case 'accepted':
        return 'car';
      case 'picked_up':
        return 'navigate';
      default:
        return 'hourglass';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading ride...</Text>
      </View>
    );
  }

  if (!activeRide) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No active ride found</Text>
        <TouchableOpacity
          style={styles.backHomeButton}
          onPress={() => router.replace('/rider')}
          data-testid="go-back-home-btn"
        >
          <Text style={styles.backHomeText}>Go Back Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build markers for the map
  const mapMarkers = [
    {
      latitude: activeRide.pickup_latitude,
      longitude: activeRide.pickup_longitude,
      color: 'green' as const,
      label: 'P',
      title: 'Pickup',
    },
    {
      latitude: activeRide.dropoff_latitude,
      longitude: activeRide.dropoff_longitude,
      color: 'red' as const,
      label: 'D',
      title: 'Dropoff',
    },
  ];

  // Add driver marker if we have their location
  if (driverLocation && (activeRide.status === 'accepted' || activeRide.status === 'picked_up')) {
    mapMarkers.push({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      color: 'blue' as const,
      label: 'C',
      title: 'Driver',
    });
  }

  return (
    <View style={styles.container}>
      {activeRide.status === 'pending' ? (
        <RadarSearch message="Looking for a driver..." />
      ) : (
        <InteractiveMap
          style={styles.map}
          latitude={
            activeRide.status === 'accepted'
              ? activeRide.pickup_latitude
              : driverLocation?.latitude || (activeRide.pickup_latitude + activeRide.dropoff_latitude) / 2
          }
          longitude={
            activeRide.status === 'accepted'
              ? activeRide.pickup_longitude
              : driverLocation?.longitude ||
                (activeRide.pickup_longitude + activeRide.dropoff_longitude) / 2
          }
          markers={mapMarkers}
          showRoute
          routeOrigin={{ latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude }}
          routeDestination={{ latitude: activeRide.dropoff_latitude, longitude: activeRide.dropoff_longitude }}
          zoom={13}
        />
      )}

      {/* Status Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.statusBadge} data-testid="ride-status-badge">
          <Ionicons name={getStatusIcon()} size={18} color="#FFFFFF" />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </SafeAreaView>

      {/* Bottom Info Card */}
      <View style={styles.bottomCard}>
        {/* ETA Info Banner */}
        {directionsInfo && activeRide.status !== 'pending' && (
          <View style={styles.etaBanner}>
            <View style={styles.etaItem}>
              <Ionicons name="time" size={20} color="#1E40AF" />
              <Text style={styles.etaValue}>{directionsInfo.duration}</Text>
              <Text style={styles.etaLabel}>
                {activeRide.status === 'accepted' ? 'Driver ETA' : 'Arrival'}
              </Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Ionicons name="navigate" size={20} color="#1E40AF" />
              <Text style={styles.etaValue}>{directionsInfo.distance}</Text>
              <Text style={styles.etaLabel}>Distance</Text>
            </View>
          </View>
        )}

        {/* Driver Info (when accepted) */}
        {activeRide.status !== 'pending' && activeRide.driver_id && (
          <View style={styles.driverInfo} data-testid="driver-info-card">
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{activeRide.driver_name || 'Your Driver'}</Text>
              <Text style={styles.driverStatus}>
                {activeRide.driver_vehicle
                  ? `${activeRide.driver_vehicle.vehicle_color} ${activeRide.driver_vehicle.vehicle_make} ${activeRide.driver_vehicle.vehicle_model}`
                  : activeRide.status === 'accepted' ? 'Arriving at pickup' : 'Heading to destination'}
              </Text>
              {activeRide.driver_vehicle?.license_plate && (
                <Text style={styles.licensePlate}>{activeRide.driver_vehicle.license_plate}</Text>
              )}
            </View>
            {driverLocation && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
        )}

        {/* Route Info */}
        <View style={styles.routeInfo}>
          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <View>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationText}>{activeRide.pickup_address || 'Pickup location'}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View>
              <Text style={styles.locationLabel}>DROPOFF</Text>
              <Text style={styles.locationText}>{activeRide.dropoff_address || 'Dropoff location'}</Text>
            </View>
          </View>
        </View>

        {/* Fare */}
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Estimated Fare</Text>
          <Text style={styles.fareAmount}>${activeRide.fare?.toFixed(2) || '0.00'}</Text>
        </View>

        {/* Cancel Button (only for pending/accepted) */}
        {(activeRide.status === 'pending' || activeRide.status === 'accepted') && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRide}
            data-testid="cancel-ride-btn"
          >
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  backHomeButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
  },
  backHomeText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  etaBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaDivider: {
    width: 1,
    backgroundColor: '#BFDBFE',
  },
  etaValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  driverStatus: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  licensePlate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  routeInfo: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 4,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  fareLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E40AF',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#EF4444',
  },
});
