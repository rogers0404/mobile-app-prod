import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Only import MapView on native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

interface MapWrapperProps {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  mapRef?: React.RefObject<any>;
}

// Web fallback component
const WebMapFallback: React.FC<MapWrapperProps> = ({ style, initialRegion }) => {
  return (
    <View style={[styles.webMapContainer, style]}>
      <View style={styles.webMapContent}>
        <Text style={styles.webMapIcon}>🗺️</Text>
        <Text style={styles.webMapTitle}>Map View</Text>
        <Text style={styles.webMapSubtitle}>
          Map is available on mobile devices
        </Text>
        {initialRegion && (
          <Text style={styles.webMapCoords}>
            Location: {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
          </Text>
        )}
      </View>
    </View>
  );
};

export const MapWrapper: React.FC<MapWrapperProps> = (props) => {
  const { mapRef, ...mapProps } = props;

  if (Platform.OS === 'web') {
    return <WebMapFallback {...props} />;
  }

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      {...mapProps}
    />
  );
};

interface MarkerWrapperProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export const MarkerWrapper: React.FC<MarkerWrapperProps> = (props) => {
  if (Platform.OS === 'web' || !Marker) {
    return null;
  }

  return <Marker {...props} />;
};

const styles = StyleSheet.create({
  webMapContainer: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapContent: {
    alignItems: 'center',
    padding: 32,
  },
  webMapIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  webMapSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  webMapCoords: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});

export { PROVIDER_GOOGLE };
