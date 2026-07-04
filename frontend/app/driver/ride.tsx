import React, { useEffect, useState } from 'react';
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
import * as Location from 'expo-location';
import { useRideStore } from '../../src/store/rideStore';
import { useDriverStore } from '../../src/store/driverStore';
import { InteractiveMap } from '../../src/components/InteractiveMap';
import NavigationPanel from '../../src/components/NavigationPanel';

export default function ActiveRideScreen() {
  const router = useRouter();
  const { activeRide, fetchRideDetails, updateRideStatus } = useRideStore();
  const { updateLocation } = useDriverStore();
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!activeRide) {
      router.replace('/driver');
      return;
    }

    // Fetch current location
    initLocation();

    const interval = setInterval(() => {
      if (activeRide?.ride_id) {
        fetchRideDetails(activeRide.ride_id);
      }
    }, 5000);

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
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const loc = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          setCurrentLocation(loc);
          await updateLocation(loc.latitude, loc.longitude);
        }
      } catch (error) {
        console.error('Location update error:', error);
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(locationInterval);
    };
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

  const initLocation = async () => {
    try {
      if (Platform.OS === 'web' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          (err) => console.error('Location error:', err),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        }
      }
    } catch (error) {
      console.error('Init location error:', error);
    }
  };

  const handlePickedUp = async () => {
    Alert.alert(
      'Confirm Pickup',
      'Has the rider been picked up?',
      [
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
      ]
    );
  };

  const handleCompleteRide = async () => {
    Alert.alert(
      'Complete Ride',
      'Has the rider been dropped off at the destination?',
      [
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
      ]
    );
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
              setLoading(true);
              await updateRideStatus(activeRide!.ride_id, 'cancelled');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel ride.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!activeRide) {
    return null;
  }

  const isPickingUp = activeRide.status === 'accepted';
  const destination = isPickingUp
    ? { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude }
    : { latitude: activeRide.dropoff_latitude, longitude: activeRide.dropoff_longitude };

  // Use current location as origin if available, otherwise use pickup/dropoff
  const origin = currentLocation || 
    (isPickingUp 
      ? { latitude: activeRide.pickup_latitude - 0.01, longitude: activeRide.pickup_longitude } 
      : { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude });

  return (
    <View style={styles.container}>
      {/* Interactive Map with Route */}
      <InteractiveMap
        style={styles.map}
        latitude={destination.latitude}
        longitude={destination.longitude}
        markers={[
          ...(currentLocation ? [{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            color: 'blue' as const,
            label: 'Y',
            title: 'Your Location',
          }] : []),
          {
            latitude: activeRide!.pickup_latitude,
            longitude: activeRide!.pickup_longitude,
            color: 'green' as const,
            label: 'P',
            title: 'Pickup',
          },
          {
            latitude: activeRide!.dropoff_latitude,
            longitude: activeRide!.dropoff_longitude,
            color: 'red' as const,
            label: 'D',
            title: 'Dropoff',
          },
        ]}
        showRoute
        routeOrigin={{ latitude: activeRide!.pickup_latitude, longitude: activeRide!.pickup_longitude }}
        routeDestination={{ latitude: activeRide!.dropoff_latitude, longitude: activeRide!.dropoff_longitude }}
        zoom={13}
      />

      {/* Status Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.statusBadge}>
          <Ionicons
            name={isPickingUp ? 'location' : 'navigate'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.statusText}>
            {isPickingUp ? 'Navigate to Pickup' : 'Navigate to Dropoff'}
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom Card with Navigation */}
      <ScrollView 
        style={styles.bottomCard}
        contentContainerStyle={styles.bottomCardContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Panel with Turn-by-Turn */}
        <NavigationPanel
          origin={origin}
          destination={destination}
          destinationLabel={isPickingUp ? 'Pickup Location' : 'Dropoff Location'}
          destinationAddress={isPickingUp ? activeRide.pickup_address : activeRide.dropoff_address}
          isPickup={isPickingUp}
        />

        {/* Rider Info */}
        <View style={styles.riderSection}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={32} color="#6B7280" />
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{activeRide.rider_name || 'Rider'}</Text>
            <Text style={styles.fareText}>${activeRide.fare.toFixed(2)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isPickingUp ? (
            <TouchableOpacity
              style={styles.pickedUpButton}
              onPress={handlePickedUp}
              disabled={loading}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {loading ? 'Updating...' : 'Rider Picked Up'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteRide}
              disabled={loading}
            >
              <Ionicons name="flag" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {loading ? 'Completing...' : 'Complete Ride'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRide}
            disabled={loading}
          >
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '40%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomCardContent: {
    padding: 24,
    paddingBottom: 40,
  },
  riderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  riderAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  fareText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 4,
  },
  actionButtons: {
    gap: 12,
  },
  pickedUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
});
