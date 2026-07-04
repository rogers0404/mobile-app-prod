import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../src/store/userStore';
import { FadeInView } from '../src/components/FadeInView';

export default function SelectTypeScreen() {
  const router = useRouter();
  const { createUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectType = async (type: 'rider' | 'driver') => {
    setIsLoading(true);
    try {
      const user = await createUser(type);
      if (user) {
        if (type === 'rider') {
          router.replace('/rider');
        } else {
          router.replace('/driver');
        }
      } else {
        Alert.alert('Error', 'Failed to create user. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set user type. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FadeInView delay={0}>
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="car-sport" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>Trip</Text>
            <Text style={styles.title}>How will you use Trip?</Text>
            <Text style={styles.subtitle}>Choose your role to get started</Text>
          </View>
        </FadeInView>

        <View style={styles.optionsContainer}>
          {/* Rider Option */}
          <FadeInView delay={200}>
          <TouchableOpacity
            style={[styles.optionCard, isLoading && styles.optionCardDisabled]}
            onPress={() => handleSelectType('rider')}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Setting up your account...</Text>
              </View>
            ) : (
              <>
                <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="person" size={48} color="#1E40AF" />
                </View>
                <Text style={styles.optionTitle}>Rider</Text>
                <Text style={styles.optionDescription}>
                  Request rides and travel anywhere in the city
                </Text>
                <View style={styles.optionFeatures}>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>Request rides instantly</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>Track your driver live</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>Pay with PayPal</Text>
                  </View>
                </View>
              </>
            )}
          </TouchableOpacity>
          </FadeInView>

          {/* Driver Option */}
          <FadeInView delay={350}>
          <TouchableOpacity
            style={[styles.optionCard, isLoading && styles.optionCardDisabled]}
            onPress={() => handleSelectType('driver')}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D97706" />
                <Text style={styles.loadingText}>Setting up your account...</Text>
              </View>
            ) : (
              <>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="car-sport" size={48} color="#D97706" />
                </View>
                <Text style={styles.optionTitle}>Driver</Text>
                <Text style={styles.optionDescription}>
                  Earn money by giving rides in your car
                </Text>
                <View style={styles.optionFeatures}>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>Set your own hours</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>Accept rides in your area</Text>
                  </View>
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.featureText}>Get paid weekly</Text>
                  </View>
                </View>
              </>
            )}
          </TouchableOpacity>
          </FadeInView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  optionFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
});
