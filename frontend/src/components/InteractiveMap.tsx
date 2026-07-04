import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

// Native fallback - uses react-native-maps when available
export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  style,
  latitude = 37.7749,
  longitude = -122.4194,
  markers = [],
  zoom = 14,
}) => {
  // Try to use react-native-maps on native
  try {
    const MapView = require('react-native-maps').default;
    const { Marker } = require('react-native-maps');

    return (
      <MapView
        style={[{ flex: 1 }, style]}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01 * (20 - zoom),
          longitudeDelta: 0.01 * (20 - zoom),
        }}
        showsUserLocation
      >
        {markers.map((m, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
          />
        ))}
      </MapView>
    );
  } catch {
    // Fallback placeholder
    return (
      <View style={[styles.container, style]}>
        <Ionicons name="map-outline" size={48} color="#9CA3AF" />
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>Map available on mobile devices</Text>
        {latitude && longitude && (
          <Text style={styles.coords}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        )}
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  coords: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
