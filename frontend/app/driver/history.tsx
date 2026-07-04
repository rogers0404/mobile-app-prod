import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRideStore, Ride, RideHistoryFilters } from '../../src/store/rideStore';
import TripReceipt from '../../src/components/TripReceipt';

type StatusFilter = 'all' | 'completed' | 'cancelled' | 'pending';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const DATE_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

export default function DriverHistoryScreen() {
  const router = useRouter();
  const { rideHistory, fetchRideHistory, isLoading } = useRideStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchRideHistory();
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      applyFilters();
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery]);

  // Apply filters when status or date changes
  useEffect(() => {
    applyFilters();
  }, [statusFilter, dateFilter]);

  const getDateRange = (filter: string): { dateFrom?: string; dateTo?: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return { dateFrom: today.toISOString() };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { dateFrom: weekStart.toISOString() };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { dateFrom: monthStart.toISOString() };
      default:
        return {};
    }
  };

  const applyFilters = useCallback(() => {
    const filters: RideHistoryFilters = {
      search: searchQuery.trim() || undefined,
      status: statusFilter,
      ...getDateRange(dateFilter),
    };
    fetchRideHistory(filters);
  }, [searchQuery, statusFilter, dateFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRideHistory();
    setRefreshing(false);
  }, []);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFilter('all');
    fetchRideHistory({});
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter !== 'all';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      case 'pending':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const handleViewReceipt = (ride: Ride) => {
    setSelectedRide(ride);
    setShowReceipt(true);
  };

  // Calculate earnings from filtered results
  const completedRides = rideHistory.filter(r => r.status === 'completed');
  const totalEarnings = completedRides.reduce((sum, r) => sum + (r.fare || 0), 0);

  const renderRideItem = ({ item }: { item: Ride }) => (
    <TouchableOpacity 
      style={styles.rideCard}
      onPress={() => handleViewReceipt(item)}
      activeOpacity={0.7}
    >
      <View style={styles.rideHeader}>
        <View style={styles.riderInfo}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={20} color="#6B7280" />
          </View>
          <Text style={styles.riderName}>{item.rider_name || 'Rider'}</Text>
        </View>
        <Text style={styles.fareAmount}>${item.fare?.toFixed(2)}</Text>
      </View>

      <View style={styles.rideDate}>
        <Ionicons name="time-outline" size={14} color="#9CA3AF" />
        <Text style={styles.rideDateText}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickup_address}
          </Text>
        </View>
        <View style={styles.locationLine} />
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoff_address}
          </Text>
        </View>
      </View>

      <View style={styles.rideFooter}>
        <View style={styles.rideDetail}>
          <Ionicons name="navigate" size={16} color="#6B7280" />
          <Text style={styles.rideDetailText}>{item.distance_miles?.toFixed(1)} mi</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* View Receipt Button */}
      <TouchableOpacity 
        style={styles.receiptButton}
        onPress={() => handleViewReceipt(item)}
      >
        <Ionicons name="receipt-outline" size={16} color="#1E40AF" />
        <Text style={styles.receiptButtonText}>View Receipt</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/driver');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsSummary}>
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>
            {hasActiveFilters ? 'Filtered Earnings' : 'Total Earnings'}
          </Text>
          <Text style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</Text>
          <Text style={styles.earningsSubtext}>{completedRides.length} completed rides</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by address or rider name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {STATUS_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterChip,
                statusFilter === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === filter.value && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
          
          <View style={styles.filterDivider} />
          
          {DATE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterChip,
                dateFilter === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setDateFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter === filter.value && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearFilters} onPress={clearFilters}>
            <Ionicons name="close" size={14} color="#EF4444" />
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {rideHistory.length} {rideHistory.length === 1 ? 'ride' : 'rides'} found
        </Text>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : rideHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            {hasActiveFilters ? 'No rides match your filters' : 'No rides yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {hasActiveFilters 
              ? 'Try adjusting your search or filters' 
              : 'Your completed rides will appear here'}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={rideHistory}
          keyExtractor={(item) => item.ride_id}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1E40AF']}
              tintColor="#1E40AF"
            />
          }
        />
      )}

      {/* Trip Receipt Modal */}
      {selectedRide && (
        <TripReceipt
          ride={selectedRide}
          visible={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setSelectedRide(null);
          }}
          userType="driver"
        />
      )}
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
  earningsSummary: {
    padding: 16,
    paddingBottom: 8,
  },
  earningsCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  earningsAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  earningsSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  filtersSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterScroll: {
    flex: 1,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1E40AF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  clearFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 16,
    gap: 4,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#EF4444',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1E40AF',
    borderRadius: 20,
  },
  clearFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  riderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  rideDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  rideDateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  rideDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideDetailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    gap: 6,
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
});
