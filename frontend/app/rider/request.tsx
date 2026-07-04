import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRideStore } from '../../src/store/rideStore';
import { InteractiveMap } from '../../src/components/InteractiveMap';
import { getApiUrl } from '../../src/config/env';

const API_URL = getApiUrl();

interface LocationResult {
  description: string;
  place_id: string;
}

export default function RequestRideScreen() {
  const router = useRouter();
  const { requestRide, isLoading } = useRideStore();
  
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff' | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    initCurrentLocation();
  }, []);

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      const distance = calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        dropoffLocation.lat,
        dropoffLocation.lng
      );
      setEstimatedDistance(distance);
      setEstimatedFare(2 + distance * 1.5);
    }
  }, [pickupLocation, dropoffLocation]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const initCurrentLocation = async () => {
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
        setPickupLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });

        // Reverse geocode using Google Maps Geocoding
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.coords.latitude},${pos.coords.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`
          );
          const data = await res.json();
          if (data.results?.[0]) {
            setPickupAddress(data.results[0].formatted_address);
          }
        } catch {
          setPickupAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync();
      setPickupLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address[0]) {
        const addr = address[0];
        setPickupAddress(
          `${addr.streetNumber || ''} ${addr.street || ''}, ${addr.city || ''}`.trim()
        );
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const searchPlaces = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({ query });
      if (pickupLocation) {
        params.append('latitude', String(pickupLocation.lat));
        params.append('longitude', String(pickupLocation.lng));
      }
      const response = await fetch(`${API_URL}/api/places/search?${params}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = async (place: LocationResult, field: 'pickup' | 'dropoff') => {
    try {
      const response = await fetch(`${API_URL}/api/places/details?place_id=${place.place_id}`);
      const data = await response.json();

      if (data.lat && data.lng) {
        if (field === 'pickup') {
          setPickupLocation({ lat: data.lat, lng: data.lng });
          setPickupAddress(place.description);
        } else {
          setDropoffLocation({ lat: data.lat, lng: data.lng });
          setDropoffAddress(place.description);
        }
      }
    } catch (error) {
      console.error('Place details error:', error);
    }

    setSearchResults([]);
    setActiveField(null);
  };

  const handleConfirmRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Error', 'Please select both pickup and dropoff locations.');
      return;
    }

    try {
      const ride = await requestRide({
        pickup_latitude: pickupLocation.lat,
        pickup_longitude: pickupLocation.lng,
        pickup_address: pickupAddress,
        dropoff_latitude: dropoffLocation.lat,
        dropoff_longitude: dropoffLocation.lng,
        dropoff_address: dropoffAddress,
      });

      if (ride) {
        router.replace('/rider/tracking');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request ride.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Interactive Map */}
      <InteractiveMap
        style={styles.map}
        latitude={dropoffLocation?.lat || pickupLocation?.lat}
        longitude={dropoffLocation?.lng || pickupLocation?.lng}
        markers={[
          ...(pickupLocation ? [{
            latitude: pickupLocation.lat,
            longitude: pickupLocation.lng,
            color: 'green' as const,
            label: 'P',
            title: 'Pickup',
          }] : []),
          ...(dropoffLocation ? [{
            latitude: dropoffLocation.lat,
            longitude: dropoffLocation.lng,
            color: 'red' as const,
            label: 'D',
            title: 'Dropoff',
          }] : []),
        ]}
        showRoute={!!(pickupLocation && dropoffLocation)}
        routeOrigin={pickupLocation ? { latitude: pickupLocation.lat, longitude: pickupLocation.lng } : undefined}
        routeDestination={dropoffLocation ? { latitude: dropoffLocation.lat, longitude: dropoffLocation.lng } : undefined}
        zoom={13}
      />

      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Use canGoBack check to avoid router state errors
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/rider');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Ride</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      {/* Input Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputCard}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="location" size={20} color="#10B981" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Pickup location"
              value={pickupAddress}
              onChangeText={(text) => {
                setPickupAddress(text);
                setActiveField('pickup');
                searchPlaces(text);
              }}
              onFocus={() => setActiveField('pickup')}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="flag" size={20} color="#EF4444" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Where to?"
              value={dropoffAddress}
              onChangeText={(text) => {
                setDropoffAddress(text);
                setActiveField('dropoff');
                searchPlaces(text);
              }}
              onFocus={() => setActiveField('dropoff')}
            />
          </View>
        </View>

        {searchResults.length > 0 && (
          <ScrollView style={styles.searchResults}>
            {searchResults.map((result) => (
              <TouchableOpacity
                key={result.place_id}
                style={styles.searchResultItem}
                onPress={() => selectPlace(result, activeField || 'dropoff')}
              >
                <Ionicons name="location-outline" size={20} color="#6B7280" />
                <Text style={styles.searchResultText} numberOfLines={2}>
                  {result.description}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {estimatedFare && estimatedDistance && (
          <View style={styles.fareContainer}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Distance</Text>
              <Text style={styles.fareValue}>{estimatedDistance.toFixed(1)} miles</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Estimated Fare</Text>
              <Text style={styles.fareAmount}>${estimatedFare.toFixed(2)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!pickupLocation || !dropoffLocation) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmRide}
          disabled={!pickupLocation || !dropoffLocation || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>Confirm Ride</Text>
              {estimatedFare && (
                <Text style={styles.confirmButtonPrice}>${estimatedFare.toFixed(2)}</Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  inputCard: {
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
    maxHeight: '60%',
  },
  inputContainer: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchResults: {
    maxHeight: 200,
    marginTop: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  fareContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmButtonPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
