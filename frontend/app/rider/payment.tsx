import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRideStore } from '../../src/store/rideStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../../src/config/env';

const API_URL = getApiUrl();

export default function PaymentScreen() {
  const router = useRouter();
  const { activeRide, fetchRideHistory } = useRideStore();
  const [loading, setLoading] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [lastRide, setLastRide] = useState<any>(null);

  useEffect(() => {
    // If no active ride, get the last completed ride
    if (!activeRide) {
      loadLastRide();
    } else {
      setLastRide(activeRide);
    }
  }, [activeRide]);

  const loadLastRide = async () => {
    await fetchRideHistory();
    const rides = useRideStore.getState().rideHistory;
    const completedRide = rides.find(r => r.status === 'completed' && r.payment_status === 'unpaid');
    if (completedRide) {
      setLastRide(completedRide);
    }
  };

  const handlePayWithPayPal = async () => {
    if (!lastRide) return;

    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('user_id');
      
      // Create PayPal order
      const orderResponse = await fetch(
        `${API_URL}/api/payment/create-order?ride_id=${lastRide.ride_id}&user_id=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!orderResponse.ok) {
        throw new Error('Failed to create payment order');
      }

      const orderData = await orderResponse.json();
      
      // Find approval URL
      const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;
      
      if (approvalUrl) {
        // Open PayPal in browser
        if (Platform.OS === 'web') {
          window.open(approvalUrl, '_blank');
        } else {
          await Linking.openURL(approvalUrl);
        }

        // For demo, simulate payment completion after delay
        setTimeout(async () => {
          try {
            const captureResponse = await fetch(
              `${API_URL}/api/payment/capture-order?order_id=${orderData.id}&user_id=${userId}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }
            );

            if (captureResponse.ok) {
              setPaymentComplete(true);
            }
          } catch (error) {
            console.error('Capture error:', error);
          }
        }, 5000);
      } else {
        Alert.alert('Error', 'Could not get PayPal approval URL');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPayment = () => {
    // For demo purposes, allow skipping payment
    Alert.alert(
      'Skip Payment',
      'Are you sure? This is for demo purposes only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            setPaymentComplete(true);
          },
        },
      ]
    );
  };

  const handleGoHome = () => {
    router.replace('/rider');
  };

  if (paymentComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Ride Complete!</Text>
          <Text style={styles.successSubtitle}>Thank you for riding with Trip</Text>
          
          <View style={styles.rideReceipt}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Trip Fare</Text>
              <Text style={styles.receiptValue}>${lastRide?.fare?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Distance</Text>
              <Text style={styles.receiptValue}>{lastRide?.distance_miles?.toFixed(1) || '0'} miles</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={handleGoHome}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {/* Ride Summary */}
        <View style={styles.rideSummary}>
          <Text style={styles.sectionTitle}>Ride Summary</Text>
          
          {lastRide ? (
            <>
              <View style={styles.summaryItem}>
                <Ionicons name="location" size={20} color="#10B981" />
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryLabel}>Pickup</Text>
                  <Text style={styles.summaryText} numberOfLines={1}>
                    {lastRide.pickup_address}
                  </Text>
                </View>
              </View>
              
              <View style={styles.summaryItem}>
                <Ionicons name="flag" size={20} color="#EF4444" />
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryLabel}>Dropoff</Text>
                  <Text style={styles.summaryText} numberOfLines={1}>
                    {lastRide.dropoff_address}
                  </Text>
                </View>
              </View>

              <View style={styles.fareBreakdown}>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Base Fare</Text>
                  <Text style={styles.fareValue}>$2.00</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    Distance ({lastRide.distance_miles?.toFixed(1)} mi × $1.50)
                  </Text>
                  <Text style={styles.fareValue}>
                    ${((lastRide.distance_miles || 0) * 1.5).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.fareRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ${lastRide.fare?.toFixed(2)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.noRideText}>No ride to pay for</Text>
          )}
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <TouchableOpacity
            style={styles.paypalButton}
            onPress={handlePayWithPayPal}
            disabled={loading || !lastRide}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-paypal" size={24} color="#FFFFFF" />
                <Text style={styles.paypalButtonText}>Pay with PayPal</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipPayment}
          >
            <Text style={styles.skipButtonText}>Skip (Demo Only)</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  rideSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  fareBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareValue: {
    fontSize: 14,
    color: '#374151',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  noRideText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  paymentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  paypalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0070BA',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  paypalButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  rideReceipt: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  homeButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
