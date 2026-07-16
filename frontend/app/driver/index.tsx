import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '../../src/store/userStore';
import { useDriverStore } from '../../src/store/driverStore';
import { useRideStore, Ride } from '../../src/store/rideStore';
import { InteractiveMap } from '../../src/components/InteractiveMap';
import { useNotificationStore } from '../../src/store/notificationStore';
import { getApiUrl } from '../../src/config/env';

const API_URL = getApiUrl();
const { width } = Dimensions.get('window');

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user, loadUser, clearUser } = useUserStore();
  const { isOnline, isVerified, fetchStatus, updateStatus, updateLocation } = useDriverStore();
  const { pendingRides, activeRide, fetchPendingRides, fetchActiveRide, acceptRide } = useRideStore();
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);
  const showNotification = useNotificationStore((s) => s.show);

  useEffect(() => {
    initDriver();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOnline && isVerified) {
      const interval = setInterval(() => {
        fetchActiveRide(); // Still poll for active ride in case of missed WS message
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOnline, isVerified]);

  // Periodically fetch and update driver's location when online
  useEffect(() => {
    if (isOnline) {
      const locationInterval = setInterval(async () => {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation(currentLocation);

          const { latitude, longitude } = currentLocation.coords;

          // Update location via API
          await updateLocation(latitude, longitude);

          // Also send via WebSocket for real-time rider tracking
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'location_update',
              latitude,
              longitude,
            }));
          }
        } catch (error) {
          console.error('Periodic location update error:', error);
        }
      }, 10000); // Update every 10 seconds

      return () => clearInterval(locationInterval);
    }
  }, [isOnline]);

  // Connect WebSocket when driver goes online
  useEffect(() => {
    if (isOnline) {
      connectWebSocket();
      // Fetch any rides that are already pending when we come online
      fetchPendingRides();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  }, [isOnline]);

  const connectWebSocket = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}/api/ws/${userId}`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_ride_request') {
            showNotification({
              title: 'New Ride Request',
              message: 'A rider nearby needs a ride!',
              type: 'info',
              icon: 'car',
            });
            fetchPendingRides();
          } else if (data.type === 'pending_ride_removed') {
            // A ride was accepted by another driver or cancelled by the rider
            fetchPendingRides();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (isOnline && wsRef.current === ws) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WS connect error:', error);
    }
  };

  const initDriver = async () => {
    try {
      await loadUser();
      await fetchStatus();
      await fetchActiveRide();
      await initLocation();
    } catch (error) {
      console.error('Init driver error:', error);
    } finally {
      setLoading(false);
    }
  };

  const initLocation = async () => {
    try {
      // On web, use browser geolocation directly for better reliability
      if (Platform.OS === 'web' && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          });
        });
        setLocation({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude || 0,
            accuracy: pos.coords.accuracy,
            altitudeAccuracy: pos.coords.altitudeAccuracy || 0,
            heading: pos.coords.heading || 0,
            speed: pos.coords.speed || 0,
          },
          timestamp: pos.timestamp,
        });
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    if (!isVerified) {
      Alert.alert(
        'Verification Required',
        'Please upload your documents to start accepting rides.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upload Documents', onPress: () => router.push('/driver/documents') },
        ]
      );
      return;
    }

    try {
      await updateStatus(value);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status.');
    }
  };

  const handleAcceptRide = async (ride: Ride) => {
    if (accepting) return;
    
    setAccepting(true);
    try {
      await acceptRide(ride.ride_id);
      router.push('/driver/ride');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept ride.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchRole = async () => {
    Alert.alert('Switch Role', 'Are you sure you want to switch to a different role?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        onPress: async () => {
          if (isOnline) {
            await updateStatus(false);
          }
          await clearUser();
          router.replace('/select-type');
        },
      },
    ]);
  };

  const renderPendingRide = ({ item }: { item: Ride }) => (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <View style={styles.riderInfo}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={24} color="#6B7280" />
          </View>
          <Text style={styles.riderName}>{item.rider_name || 'Rider'}</Text>
        </View>
        <Text style={styles.fareAmount}>${item.fare?.toFixed(2)}</Text>
      </View>

      <View style={styles.rideLocations}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#10B981' }]} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Pickup</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>
              {item.pickup_address}
            </Text>
          </View>
        </View>
        <View style={styles.locationDivider} />
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#EF4444' }]} />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Dropoff</Text>
            <Text style={styles.locationAddress} numberOfLines={1}>
              {item.dropoff_address}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.rideFooter}>
        <View style={styles.rideStats}>
          <Ionicons name="navigate" size={16} color="#6B7280" />
          <Text style={styles.rideStatText}>{item.distance_miles?.toFixed(1)} mi</Text>
        </View>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRide(item)}
          disabled={accepting}
        >
          <Text style={styles.acceptButtonText}>
            {accepting ? 'Accepting...' : 'Accept'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Interactive Map */}
      <InteractiveMap
        style={styles.map}
        latitude={location?.coords.latitude}
        longitude={location?.coords.longitude}
        zoom={15}
      />

      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => router.push('/driver/profile')}
          >
            <Ionicons name="person-circle" size={32} color="#1E40AF" />
          </TouchableOpacity>
          <View style={styles.onlineToggle}>
            <Text style={[styles.onlineText, isOnline && { color: '#10B981' }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={isOnline ? '#10B981' : '#9CA3AF'}
            />
          </View>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => router.push('/driver/history')}
          >
            <Ionicons name="time" size={28} color="#1E40AF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {!isVerified ? (
          <View style={styles.verificationCard}>
            <Ionicons name="warning" size={48} color="#F59E0B" />
            <Text style={styles.verificationTitle}>Documents Required</Text>
            <Text style={styles.verificationText}>
              Please upload your license and insurance to start accepting rides.
            </Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => router.push('/driver/documents')}
            >
              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Upload Documents</Text>
            </TouchableOpacity>
          </View>
        ) : !isOnline ? (
          <View style={styles.offlineCard}>
            <Ionicons name="car" size={48} color="#6B7280" />
            <Text style={styles.offlineTitle}>You're Offline</Text>
            <Text style={styles.offlineText}>
              Go online to start accepting ride requests
            </Text>
          </View>
        ) : pendingRides.length === 0 ? (
          <View style={styles.waitingCard}>
            <Ionicons name="hourglass" size={48} color="#1E40AF" />
            <Text style={styles.waitingTitle}>Waiting for Rides</Text>
            <Text style={styles.waitingText}>
              We'll notify you when there's a ride request nearby
            </Text>
          </View>
        ) : (
          <FlatList
            data={pendingRides}
            keyExtractor={(item) => item.ride_id}
            renderItem={renderPendingRide}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ridesListContent}
            snapToInterval={width - 48}
            decelerationRate="fast"
          />
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/driver/earnings')}
          >
            <Ionicons name="wallet-outline" size={24} color="#6B7280" />
            <Text style={styles.quickActionText}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/driver/history')}
          >
            <Ionicons name="time-outline" size={24} color="#6B7280" />
            <Text style={styles.quickActionText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/driver/documents')}
          >
            <Ionicons name="document-text-outline" size={24} color="#6B7280" />
            <Text style={styles.quickActionText}>Documents</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={handleSwitchRole}
          >
            <Ionicons name="swap-horizontal-outline" size={24} color="#6B7280" />
            <Text style={styles.quickActionText}>Switch</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  onlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  verificationCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
  },
  verificationText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  offlineCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
  },
  offlineText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  waitingCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
  },
  waitingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  ridesListContent: {
    paddingHorizontal: 24,
  },
  rideCard: {
    width: width - 72,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  riderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  rideLocations: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  locationAddress: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  locationDivider: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 4,
    marginVertical: 4,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideStatText: {
    fontSize: 14,
    color: '#6B7280',
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
