import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  style,
  latitude = 0,
  longitude = 0,
  markers = [],
  zoom = 14,
  showRoute = false,
  routeOrigin,
  routeDestination,
}) => {
  const containerRef = useRef<View>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const html = useMemo(() => {
    const markerColors: Record<string, string> = {
      red: '#EF4444',
      green: '#10B981',
      blue: '#3B82F6',
      yellow: '#F59E0B',
      purple: '#8B5CF6',
    };

    const markersJS = markers.map((m, i) => {
      const color = markerColors[m.color || 'red'] || '#EF4444';
      const pinGlyph = m.label ? `'${m.label}'` : `''`;
      return `
        (function() {
          var marker = new google.maps.Marker({
            position: {lat: ${m.latitude}, lng: ${m.longitude}},
            map: map,
            title: '${m.title || ''}',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '${color}',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              scale: 10
            },
            label: ${m.label ? `{text: '${m.label}', color: '#FFFFFF', fontSize: '11px', fontWeight: 'bold'}` : 'undefined'}
          });
        })();`;
    }).join('\n');

    const routeJS = showRoute && routeOrigin && routeDestination ? `
      var directionsService = new google.maps.DirectionsService();
      var directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#1E40AF',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });
      directionsService.route({
        origin: {lat: ${routeOrigin.latitude}, lng: ${routeOrigin.longitude}},
        destination: {lat: ${routeDestination.latitude}, lng: ${routeDestination.longitude}},
        travelMode: google.maps.TravelMode.DRIVING
      }, function(response, status) {
        if (status === 'OK') {
          directionsRenderer.setDirections(response);
        }
      });
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .gm-style-cc, .gmnoprint a, .gmnoprint span, .gm-style-cc a { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: ${latitude}, lng: ${longitude}},
        zoom: ${zoom},
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
      });
      ${markersJS}
      ${routeJS}
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap" async defer></script>
</body>
</html>`;
  }, [latitude, longitude, JSON.stringify(markers), zoom, showRoute, routeOrigin?.latitude, routeOrigin?.longitude, routeDestination?.latitude, routeDestination?.longitude]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const node = containerRef.current as unknown as HTMLDivElement;
    if (!node) return;

    // Remove old iframe
    if (iframeRef.current && iframeRef.current.parentNode) {
      iframeRef.current.parentNode.removeChild(iframeRef.current);
    }

    const iframe = document.createElement('iframe');
    iframe.srcdoc = html;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.allow = 'geolocation';
    iframeRef.current = iframe;
    node.appendChild(iframe);

    return () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, [html]);

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      data-testid="interactive-map"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
});
