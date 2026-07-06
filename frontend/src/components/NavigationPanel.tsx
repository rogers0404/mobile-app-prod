import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../config/env';

const REROUTE_DISTANCE_METERS = 50;  // only re-fetch if moved > 50m
const REROUTE_COOLDOWN_MS = 60_000; // minimum 60s between fetches

function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface NavigationPanelProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  destinationLabel: string;
  destinationAddress: string;
  isPickup?: boolean;
  onNavigateExternal?: () => void;
}

interface DirectionsData {
  duration: string;
  distance: string;
  steps: Array<{
    instruction: string;
    distance: string;
    maneuver?: string;
  }>;
}

export default function NavigationPanel({
  origin,
  destination,
  destinationLabel,
  destinationAddress,
  isPickup = true,
  onNavigateExternal,
}: NavigationPanelProps) {
  const [directions, setDirections] = useState<DirectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const lastFetchOriginRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const destinationKey = `${destination.latitude},${destination.longitude}`;

  // Fetch on mount and whenever destination changes
  useEffect(() => {
    lastFetchOriginRef.current = null;
    lastFetchTimeRef.current = 0;
    doFetch();
  }, [destinationKey]);

  // Re-fetch when origin moves > REROUTE_DISTANCE_METERS and cooldown passed
  useEffect(() => {
    const now = Date.now();
    const cooldownPassed = now - lastFetchTimeRef.current >= REROUTE_COOLDOWN_MS;
    const last = lastFetchOriginRef.current;
    const movedFar = !last || haversineMeters(
      last.latitude, last.longitude,
      origin.latitude, origin.longitude
    ) >= REROUTE_DISTANCE_METERS;

    if (cooldownPassed && movedFar) {
      doFetch();
    }
  }, [origin.latitude, origin.longitude]);

  const doFetch = async () => {
    lastFetchOriginRef.current = { ...origin };
    lastFetchTimeRef.current = Date.now();
    await fetchDirections();
  };

  const fetchDirections = async () => {
    try {
      const response = await fetch(
        `${getApiUrl()}/api/directions?` +
        `origin_lat=${origin.latitude}&origin_lng=${origin.longitude}&` +
        `dest_lat=${destination.latitude}&dest_lng=${destination.longitude}`
      );

      const data = await response.json();

      if (data.status === 'OK') {
        setDirections({
          duration: data.duration,
          distance: data.distance,
          steps: data.steps.map((step: any) => ({
            instruction: step.instruction,
            distance: step.distance,
            maneuver: step.maneuver,
          })),
        });
        setError(null);
      } else {
        setError('Unable to get directions');
      }
    } catch (err) {
      console.error('Directions error:', err);
      setError('Failed to load directions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMaps = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${destination.latitude},${destination.longitude}`,
      android: `geo:0,0?q=${destination.latitude},${destination.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`,
    });
    Linking.openURL(url);
    onNavigateExternal?.();
  };

  const getManeuverIcon = (maneuver?: string): string => {
    switch (maneuver) {
      case 'turn-left':
        return 'arrow-back';
      case 'turn-right':
        return 'arrow-forward';
      case 'turn-slight-left':
        return 'arrow-back-outline';
      case 'turn-slight-right':
        return 'arrow-forward-outline';
      case 'turn-sharp-left':
        return 'return-down-back';
      case 'turn-sharp-right':
        return 'return-down-forward';
      case 'uturn-left':
      case 'uturn-right':
        return 'refresh';
      case 'merge':
        return 'git-merge';
      case 'roundabout-left':
      case 'roundabout-right':
        return 'sync';
      case 'fork-left':
      case 'fork-right':
        return 'git-branch';
      case 'ramp-left':
      case 'ramp-right':
        return 'trending-up';
      default:
        return 'arrow-up';
    }
  };

  const nextStep = useMemo(() => {
    if (directions && directions.steps.length > 0) {
      return directions.steps[0];
    }
    return null;
  }, [directions]);

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, isPickup ? styles.pickupIcon : styles.dropoffIcon]}>
          <Ionicons 
            name={isPickup ? 'location' : 'flag'} 
            size={24} 
            color="#FFFFFF" 
          />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.label}>{destinationLabel}</Text>
          <Text style={styles.address} numberOfLines={1}>{destinationAddress}</Text>
        </View>
      </View>

      {/* ETA & Distance */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1E40AF" />
          <Text style={styles.loadingText}>Getting directions...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : directions ? (
        <>
          {/* ETA Banner */}
          <View style={styles.etaBanner}>
            <View style={styles.etaItem}>
              <Ionicons name="time" size={20} color="#1E40AF" />
              <Text style={styles.etaValue}>{directions.duration}</Text>
              <Text style={styles.etaLabel}>ETA</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Ionicons name="navigate" size={20} color="#1E40AF" />
              <Text style={styles.etaValue}>{directions.distance}</Text>
              <Text style={styles.etaLabel}>Distance</Text>
            </View>
          </View>

          {/* Next Turn */}
          {nextStep && (
            <TouchableOpacity 
              style={styles.nextTurn}
              onPress={() => setShowSteps(!showSteps)}
              activeOpacity={0.7}
            >
              <View style={styles.turnIconContainer}>
                <Ionicons 
                  name={getManeuverIcon(nextStep.maneuver) as any} 
                  size={28} 
                  color="#FFFFFF" 
                />
              </View>
              <View style={styles.turnInfo}>
                <Text style={styles.turnInstruction} numberOfLines={2}>
                  {nextStep.instruction}
                </Text>
                <Text style={styles.turnDistance}>{nextStep.distance}</Text>
              </View>
              <Ionicons 
                name={showSteps ? 'chevron-up' : 'chevron-down'} 
                size={24} 
                color="#6B7280" 
              />
            </TouchableOpacity>
          )}

          {/* All Steps (Expandable) */}
          {showSteps && directions.steps.length > 1 && (
            <View style={styles.stepsContainer}>
              {directions.steps.slice(1).map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepIcon}>
                    <Ionicons 
                      name={getManeuverIcon(step.maneuver) as any} 
                      size={16} 
                      color="#6B7280" 
                    />
                  </View>
                  <Text style={styles.stepInstruction} numberOfLines={2}>
                    {step.instruction}
                  </Text>
                  <Text style={styles.stepDistance}>{step.distance}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      {/* Open in Maps Button */}
      <TouchableOpacity style={styles.mapsButton} onPress={handleOpenMaps}>
        <Ionicons name="map" size={20} color="#FFFFFF" />
        <Text style={styles.mapsButtonText}>Open in Maps App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupIcon: {
    backgroundColor: '#10B981',
  },
  dropoffIcon: {
    backgroundColor: '#EF4444',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  address: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
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
  nextTurn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  turnIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  turnInfo: {
    flex: 1,
    marginLeft: 12,
  },
  turnInstruction: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  turnDistance: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  stepsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepInstruction: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  stepDistance: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  mapsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
