import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
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

const INITIAL_HTML = (lat: number, lng: number, zoom: number) => `<!DOCTYPE html>
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
    var map, directionsService, directionsRenderer;
    var activeMarkers = [];
    var PIN_COLORS = { red:'#EF4444', green:'#10B981', blue:'#3B82F6', yellow:'#F59E0B', purple:'#8B5CF6' };

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${lat}, lng: ${lng} },
        zoom: ${zoom},
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
      });
      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#1E40AF', strokeWeight: 4, strokeOpacity: 0.85 }
      });
      window.parent.postMessage({ type: 'map_ready' }, '*');
    }

    function setMarkers(markers) {
      activeMarkers.forEach(function(m) { m.setMap(null); });
      activeMarkers = [];
      var bounds = new google.maps.LatLngBounds();
      markers.forEach(function(m) {
        var color = PIN_COLORS[m.color] || '#EF4444';
        var marker = new google.maps.Marker({
          position: { lat: m.latitude, lng: m.longitude },
          map: map,
          title: m.title || '',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color, fillOpacity: 1,
            strokeColor: '#FFFFFF', strokeWeight: 2, scale: 12
          },
          label: m.label
            ? { text: m.label, color: '#FFFFFF', fontSize: '11px', fontWeight: 'bold' }
            : undefined
        });
        activeMarkers.push(marker);
        bounds.extend({ lat: m.latitude, lng: m.longitude });
      });
      if (markers.length >= 2) {
        map.fitBounds(bounds, { top: 80, right: 60, bottom: 220, left: 60 });
      } else if (markers.length === 1) {
        map.setCenter({ lat: markers[0].latitude, lng: markers[0].longitude });
        map.setZoom(15);
      }
    }

    function setRoute(origin, destination) {
      directionsService.route({
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode: google.maps.TravelMode.DRIVING
      }, function(response, status) {
        if (status === 'OK') {
          directionsRenderer.setDirections(response);
          map.fitBounds(response.routes[0].bounds, { top: 80, right: 60, bottom: 220, left: 60 });
        }
      });
    }

    function clearRoute() {
      directionsRenderer.setDirections({ routes: [] });
    }

    window.addEventListener('message', function(e) {
      var msg = e.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'set_markers') setMarkers(msg.markers);
      if (msg.type === 'set_route')   setRoute(msg.origin, msg.destination);
      if (msg.type === 'clear_route') clearRoute();
    });
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap" async defer></script>
</body>
</html>`;

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
  const mapReadyRef = useRef(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const lastRouteOriginRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const markersKey = markers.map(m => `${m.latitude},${m.longitude},${m.color}`).join('|');
  const destKey = routeDestination ? `${routeDestination.latitude},${routeDestination.longitude}` : '';

  const post = (msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  };

  const sendMarkers = () => post({ type: 'set_markers', markers });

  const sendRoute = () => {
    if (showRoute && routeOrigin && routeDestination) {
      post({ type: 'set_route', origin: routeOrigin, destination: routeDestination });
    } else {
      post({ type: 'clear_route' });
    }
  };

  // Create iframe once on mount
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLDivElement;
    if (!node) return;

    const iframe = document.createElement('iframe');
    iframe.srcdoc = INITIAL_HTML(latitude, longitude, zoom);
    iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0;';
    iframe.allow = 'geolocation';
    iframeRef.current = iframe;

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'map_ready') {
        mapReadyRef.current = true;
        sendMarkers();
        sendRoute();
        pendingRef.current?.();
        pendingRef.current = null;
      }
    };
    window.addEventListener('message', onMessage);
    node.appendChild(iframe);

    return () => {
      window.removeEventListener('message', onMessage);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      mapReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push marker updates live
  useEffect(() => {
    if (!mapReadyRef.current) return;
    sendMarkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  // Push route update only when destination changes OR origin moved > REROUTE_METERS
  useEffect(() => {
    if (!mapReadyRef.current) return;
    const last = lastRouteOriginRef.current;
    const movedFar =
      !last ||
      !routeOrigin ||
      haversineMeters(last.latitude, last.longitude, routeOrigin.latitude, routeOrigin.longitude) >= REROUTE_METERS;
    if (movedFar) {
      lastRouteOriginRef.current = routeOrigin ? { ...routeOrigin } : null;
      sendRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoute, routeOrigin?.latitude, routeOrigin?.longitude, destKey]);

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
