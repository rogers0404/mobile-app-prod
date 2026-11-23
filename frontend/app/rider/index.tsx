import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useUserStore } from '../../src/store/userStore';
import { useRideStore } from '../../src/store/rideStore';
import { InteractiveMap } from '../../src/components/InteractiveMap';

const { width, height } = Dimensions.get('window');

export default function RiderHomeScreen() {
  const router = useRouter();
  const { user, loadUser, createUser, clearUser } = useUserStore();
  const { nearbyDrivers, activeRide, fetchNearbyDrivers, fetchActiveRide } = useRideStore();
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initUser();
        await initLocation();
        await fetchActiveRide();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    init();
  }, []);

  const initUser = async () => {
    try {
      const loadedUser = await loadUser();
      if (!loadedUser) {
        // Create user if doesn't exist
        await createUser('rider', 'Trip User');
      }
    } catch (error) {
      console.error('User initialization error:', error);
      Alert.alert('Error', 'Failed to initialize user account');
    }
  };

  useEffect(() => {
    if (location) {
      const interval = setInterval(() => {
        fetchNearbyDrivers(location.coords.latitude, location.coords.longitude);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [location]);

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
        const loc = {
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
        };
        setLocation(loc);
        await fetchNearbyDrivers(loc.coords.latitude, loc.coords.longitude);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app.');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
      
      await fetchNearbyDrivers(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRide = () => {
    router.push('/rider/request');
  };

  const handleSwitchRole = async () => {
    Alert.alert('Switch Role', 'Are you sure you want to switch to a different role?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        onPress: async () => {
          await clearUser();
          router.replace('/select-type');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Interactive Map */}
      <InteractiveMap
        style={styles.map}
        latitude={location?.coords.latitude}
        longitude={location?.coords.longitude}
        markers={nearbyDrivers.map(d => ({
          latitude: d.latitude,
          longitude: d.longitude,
          color: 'blue' as const,
          title: d.name,
          label: 'D',
        }))}
        zoom={14}
      />

      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => router.push('/rider/profile')}
          >
            <Ionicons name="person-circle" size={32} color="#1E40AF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => router.push('/rider/history')}
          >
            <Ionicons name="time" size={28} color="#1E40AF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]}!</Text>
          <Text style={styles.subText}>Where would you like to go?</Text>
        </View>

        <View style={styles.driverInfo}>
          <Ionicons name="car" size={20} color="#10B981" />
          <Text style={styles.driverCount}>
            {nearbyDrivers.length} drivers nearby
          </Text>
        </View>

        <TouchableOpacity
          style={styles.requestButton}
          onPress={handleRequestRide}
          activeOpacity={0.8}
        >
          <View style={styles.requestButtonContent}>
            <Ionicons name="search" size={24} color="#FFFFFF" />
            <Text style={styles.requestButtonText}>Where to?</Text>
          </View>
          <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/rider/history')}
          >
            <Ionicons name="time-outline" size={24} color="#6B7280" />
            <Text style={styles.quickActionText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/rider/profile')}
          >
            <Ionicons name="person-outline" size={24} color="#6B7280" />
            <Text style={styles.quickActionText}>Profile</Text>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
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
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  driverCount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  requestButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
