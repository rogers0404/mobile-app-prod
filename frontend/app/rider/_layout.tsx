import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useRideStore } from '../../src/store/rideStore';

export default function RiderLayout() {
  const { activeRide } = useRideStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inTrackingScreen = segments.includes('tracking');

    // Redirect to the tracking screen if there's an active ride and we're not already on it
    if (activeRide && !inTrackingScreen) {
      router.replace('/rider/tracking');
    }
  }, [activeRide, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="request" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
