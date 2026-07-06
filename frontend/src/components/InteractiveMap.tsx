import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../config/env';

const REROUTE_METERS = 50;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export interface MapMarker {
  latitude: number;
  longitude: number;
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'purple';
  label?: string;
  title?: string;
}

export interface InteractiveMapProps {
  style?: any;
  latitude?: number;
  longitude?: number;
  markers?: MapMarker[];
  zoom?: number;
  showRoute?: boolean;
  routeOrigin?: { latitude: number; longitude: number };
  routeDestination?: { latitude: number; longitude: number };
}

const PIN_COLORS: Record<string, string> = {
  red: '#EF4444',
  green: '#10B981',
  blue: '#3B82F6',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  style,
  latitude = 37.7749,
  longitude = -122.4194,
  markers = [],
  zoom = 14,
  showRoute = false,
  routeOrigin,
  routeDestination,
}) => {
  const mapRef = useRef<any>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const lastRouteOriginRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const destKey = routeDestination ? `${routeDestination.latitude},${routeDestination.longitude}` : '';
  const markersKey = markers.map(m => `${m.latitude},${m.longitude},${m.color}`).join('|');

  // Re-fetch route only when destination changes OR driver moved > REROUTE_METERS
  useEffect(() => {
    if (!showRoute || !routeOrigin || !routeDestination) {
      setRouteCoords([]);
      return;
    }
    const last = lastRouteOriginRef.current;
    const movedFar = !last || haversineMeters(last.latitude, last.longitude, routeOrigin.latitude, routeOrigin.longitude) >= REROUTE_METERS;
    if (movedFar) {
      lastRouteOriginRef.current = { ...routeOrigin };
      fetchRoute(routeOrigin, routeDestination);
    }
  }, [showRoute, routeOrigin?.latitude, routeOrigin?.longitude, destKey]);

  // Fit map to all markers whenever they change
  useEffect(() => {
    if (!mapRef.current || markers.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        markers.map(m => ({ latitude: m.latitude, longitude: m.longitude })),
        { edgePadding: { top: 80, right: 60, bottom: 200, left: 60 }, animated: true }
      );
    }, 400);
  }, [markersKey]);

  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    try {
      const res = await fetch(
        `${getApiUrl()}/api/directions?origin_lat=${origin.latitude}&origin_lng=${origin.longitude}&dest_lat=${destination.latitude}&dest_lng=${destination.longitude}`
      );
      const data = await res.json();
      if (data.overview_polyline) {
        setRouteCoords(decodePolyline(data.overview_polyline));
      }
    } catch (e) {
      console.error('Route fetch error:', e);
    }
  };

  try {
    const MapView = require('react-native-maps').default;
    const { Marker, Polyline } = require('react-native-maps');

    return (
      <MapView
        ref={mapRef}
        style={[{ flex: 1 }, style]}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01 * (20 - zoom),
          longitudeDelta: 0.01 * (20 - zoom),
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {markers.map((m, i) => (
          <Marker
            key={`${m.latitude}-${m.longitude}-${m.color}-${i}`}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            pinColor={PIN_COLORS[m.color || 'red']}
          />
        ))}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#1E40AF"
            strokeWidth={4}
            lineDashPattern={undefined}
          />
        )}
      </MapView>
    );
  } catch {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name="map-outline" size={48} color="#9CA3AF" />
        <Text style={styles.fallbackTitle}>Map View</Text>
        <Text style={styles.fallbackSub}>Map available on mobile devices</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  fallbackSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});
