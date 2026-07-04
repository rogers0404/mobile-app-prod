import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FadeInView } from '../../src/components/FadeInView';
import { Skeleton } from '../../src/components/Skeleton';
import { getApiUrl } from '../../src/config/env';

const API_URL = getApiUrl();

interface EarningsData {
  total_earnings: number;
  total_rides: number;
  today: { earnings: number; rides: number };
  this_week: { earnings: number; rides: number };
  this_month: { earnings: number; rides: number };
  daily_chart: { date: string; amount: number; rides: number }[];
  recent_rides: { ride_id: string; pickup_address: string; dropoff_address: string; fare: number; completed_at: string }[];
}

type Period = 'today' | 'this_week' | 'this_month';

export default function DriverEarningsScreen() {
  const router = useRouter();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('this_week');

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      const res = await fetch(`${API_URL}/api/driver/${userId}/earnings`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error('Earnings fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodData = () => {
    if (!data) return { earnings: 0, rides: 0 };
    return data[period];
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Today';
      case 'this_week': return 'This Week';
      case 'this_month': return 'This Month';
    }
  };

  const maxChartValue = data ? Math.max(...data.daily_chart.map(d => d.amount), 1) : 1;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earnings</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingSkeleton}>
          <Skeleton width="60%" height={40} borderRadius={12} />
          <Skeleton height={16} style={{ marginTop: 12 }} />
          <Skeleton height={160} borderRadius={16} style={{ marginTop: 24 }} />
          <Skeleton height={80} borderRadius={12} style={{ marginTop: 16 }} />
          <Skeleton height={80} borderRadius={12} style={{ marginTop: 8 }} />
          <Skeleton height={80} borderRadius={12} style={{ marginTop: 8 }} />
        </View>
      </SafeAreaView>
    );
  }

  const periodData = getPeriodData();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Total Earnings Card */}
        <FadeInView delay={0}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalAmount}>${data?.total_earnings.toFixed(2) || '0.00'}</Text>
            <Text style={styles.totalRides}>{data?.total_rides || 0} completed rides</Text>
          </View>
        </FadeInView>

        {/* Period Selector */}
        <FadeInView delay={100}>
          <View style={styles.periodSelector}>
            {(['today', 'this_week', 'this_month'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodTab, period === p && styles.periodTabActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                  {p === 'today' ? 'Today' : p === 'this_week' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeInView>

        {/* Period Summary */}
        <FadeInView delay={200}>
          <View style={styles.periodSummary}>
            <View style={styles.periodSummaryItem}>
              <Ionicons name="cash-outline" size={24} color="#1E40AF" />
              <Text style={styles.periodAmount}>${periodData.earnings.toFixed(2)}</Text>
              <Text style={styles.periodLabel}>{getPeriodLabel()} Earnings</Text>
            </View>
            <View style={styles.periodDivider} />
            <View style={styles.periodSummaryItem}>
              <Ionicons name="car-outline" size={24} color="#10B981" />
              <Text style={styles.periodRides}>{periodData.rides}</Text>
              <Text style={styles.periodLabel}>Rides</Text>
            </View>
          </View>
        </FadeInView>

        {/* Weekly Chart */}
        <FadeInView delay={300}>
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Last 7 Days</Text>
            <View style={styles.chart}>
              {data?.daily_chart.map((day, i) => (
                <View key={i} style={styles.chartBar}>
                  <Text style={styles.chartBarAmount}>
                    {day.amount > 0 ? `$${day.amount.toFixed(0)}` : ''}
                  </Text>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${Math.max((day.amount / maxChartValue) * 100, 4)}%`,
                          backgroundColor: day.amount > 0 ? '#1E40AF' : '#E5E7EB',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarLabel}>{day.date}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* Recent Rides */}
        <FadeInView delay={400}>
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Rides</Text>
            {data?.recent_rides.length === 0 ? (
              <View style={styles.emptyRecent}>
                <Ionicons name="car-outline" size={36} color="#D1D5DB" />
                <Text style={styles.emptyText}>No completed rides yet</Text>
              </View>
            ) : (
              data?.recent_rides.map((ride, i) => (
                <View key={ride.ride_id} style={styles.rideItem}>
                  <View style={styles.rideItemLeft}>
                    <View style={styles.rideItemIcon}>
                      <Ionicons name="navigate" size={18} color="#1E40AF" />
                    </View>
                    <View style={styles.rideItemDetails}>
                      <Text style={styles.rideItemAddress} numberOfLines={1}>
                        {ride.dropoff_address || 'Unknown'}
                      </Text>
                      <Text style={styles.rideItemDate}>
                        {new Date(ride.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rideItemFare}>+${ride.fare.toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  content: { flex: 1 },
  loadingSkeleton: { padding: 20 },
  totalCard: {
    backgroundColor: '#1E40AF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, padding: 28, alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  totalAmount: { fontSize: 44, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  totalRides: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
  periodSelector: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4,
  },
  periodTab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10,
  },
  periodTabActive: { backgroundColor: '#FFFFFF' },
  periodTabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  periodTabTextActive: { color: '#1E40AF', fontWeight: '700' },
  periodSummary: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16,
    marginTop: 16, borderRadius: 16, padding: 20,
  },
  periodSummaryItem: { flex: 1, alignItems: 'center' },
  periodDivider: { width: 1, backgroundColor: '#E5E7EB' },
  periodAmount: { fontSize: 28, fontWeight: '800', color: '#1E40AF', marginTop: 8 },
  periodRides: { fontSize: 28, fontWeight: '800', color: '#10B981', marginTop: 8 },
  periodLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  chartSection: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 20,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 },
  chartBar: { flex: 1, alignItems: 'center' },
  chartBarAmount: { fontSize: 10, color: '#6B7280', marginBottom: 4, fontWeight: '600' },
  chartBarTrack: {
    width: '80%', height: 100, backgroundColor: '#F3F4F6', borderRadius: 6,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  chartBarFill: { width: '100%', borderRadius: 6 },
  chartBarLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 6, fontWeight: '500' },
  recentSection: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 20, marginBottom: 32,
  },
  emptyRecent: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  rideItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  rideItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rideItemIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rideItemDetails: { flex: 1 },
  rideItemAddress: { fontSize: 14, fontWeight: '500', color: '#374151' },
  rideItemDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rideItemFare: { fontSize: 16, fontWeight: '700', color: '#10B981' },
});
