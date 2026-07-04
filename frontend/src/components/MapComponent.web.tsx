import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapComponentProps {
  style?: any;
  latitude?: number;
  longitude?: number;
  children?: React.ReactNode;
}

export const MapComponent: React.FC<MapComponentProps> = ({ style, latitude, longitude }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>Interactive map available on mobile devices</Text>
        {latitude && longitude && (
          <Text style={styles.coords}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        )}
      </View>
    </View>
  );
};

export const MapMarker: React.FC<any> = () => null;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  coords: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
