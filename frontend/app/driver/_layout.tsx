import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useRideStore } from '../../src/store/rideStore';

export default function DriverLayout() {
  const { activeRide } = useRideStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inRideScreen = segments.includes('ride');

    // Redirect to the ride screen if there's an active ride and we're not already on it
    if (activeRide && !inRideScreen) {
      router.replace('/driver/ride');
    }
  }, [activeRide, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="earnings" />
    </Stack>
  );
}
