import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigationState?.key) return;
    checkUserType();
  }, [navigationState?.key]);

  const checkUserType = async () => {
    try {
      const userType = await AsyncStorage.getItem('user_type');
      if (userType === 'rider') {
        router.replace('/rider');
      } else if (userType === 'driver') {
        router.replace('/driver');
      } else {
        router.replace('/select-type');
      }
    } catch (error) {
      console.error('Error checking user type:', error);
      router.replace('/select-type');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading Trip..." />;
  }

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E40AF',
  },
});
