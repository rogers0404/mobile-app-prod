import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../src/store/userStore';
import { useDriverStore } from '../../src/store/driverStore';
import { getApiUrl } from '../../src/config/env';

const API_URL = getApiUrl();

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, clearUser, loadUser } = useUserStore();
  const { isVerified, isOnline, updateStatus } = useDriverStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user?.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      await loadUser();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchRole = () => {
    Alert.alert('Switch Role', 'Are you sure you want to switch to a different role?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        onPress: async () => {
          if (isOnline) await updateStatus(false);
          await clearUser();
          router.replace('/select-type');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, documents, and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isOnline) await updateStatus(false);
              const res = await fetch(`${API_URL}/api/users/${user?.user_id}`, { method: 'DELETE' });
              const data = await res.json();
              if (!res.ok) {
                Alert.alert('Error', data.detail || 'Failed to delete account');
                return;
              }
              await clearUser();
              Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
              router.replace('/select-type');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} data-testid="profile-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)} data-testid="edit-profile-btn">
            <Ionicons name="create-outline" size={22} color="#D97706" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#D97706" />
          </View>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              data-testid="edit-name-input"
            />
          ) : (
            <Text style={styles.userName}>{user?.name || 'Trip Driver'}</Text>
          )}
          <View style={styles.badgeRow}>
            <View style={styles.driverBadge}>
              <Ionicons name="car" size={14} color="#D97706" />
              <Text style={styles.driverBadgeText}>Driver</Text>
            </View>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            )}
          </View>
        </View>

        {/* Edit Form */}
        {editing ? (
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Phone Number</Text>
            <TextInput
              style={styles.formInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 123-4567"
              keyboardType="phone-pad"
              data-testid="edit-phone-input"
            />
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={styles.formInput}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              data-testid="edit-email-input"
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelEditBtn}
                onPress={() => {
                  setName(user?.name || '');
                  setPhone(user?.phone || '');
                  setEmail(user?.email || '');
                  setEditing(false);
                }}
                data-testid="cancel-edit-btn"
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                data-testid="save-profile-btn"
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Contact Info */}
            {(user?.phone || user?.email) && (
              <View style={styles.infoSection}>
                {user?.phone && (
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={20} color="#6B7280" />
                    <Text style={styles.infoText}>{user.phone}</Text>
                  </View>
                )}
                {user?.email && (
                  <View style={styles.infoRow}>
                    <Ionicons name="mail-outline" size={20} color="#6B7280" />
                    <Text style={styles.infoText}>{user.email}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.total_rides || 0}</Text>
                <Text style={styles.statLabel}>Total Rides</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
                <Text style={styles.statLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>

            {/* Vehicle Info */}
            {user?.documents && (
              <View style={styles.vehicleSection}>
                <Text style={styles.sectionTitle}>Your Vehicle</Text>
                <View style={styles.vehicleCard}>
                  <View style={styles.vehicleIcon}>
                    <Ionicons name="car-sport" size={32} color="#1E40AF" />
                  </View>
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleName}>
                      {user.documents.vehicle_color} {user.documents.vehicle_make} {user.documents.vehicle_model}
                    </Text>
                    <Text style={styles.vehicleYear}>{user.documents.vehicle_year}</Text>
                    <Text style={styles.vehiclePlate}>{user.documents.license_plate}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Menu */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>Account</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/driver/documents')} data-testid="documents-btn">
                <View style={styles.menuItemLeft}>
                  <Ionicons name="document-text-outline" size={22} color="#6B7280" />
                  <Text style={styles.menuItemText}>Documents</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/driver/history')} data-testid="ride-history-btn">
                <View style={styles.menuItemLeft}>
                  <Ionicons name="time-outline" size={22} color="#6B7280" />
                  <Text style={styles.menuItemText}>Ride History</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} data-testid="earnings-btn">
                <View style={styles.menuItemLeft}>
                  <Ionicons name="wallet-outline" size={22} color="#6B7280" />
                  <Text style={styles.menuItemText}>Earnings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>Support</Text>
              <TouchableOpacity style={styles.menuItem} data-testid="help-btn">
                <View style={styles.menuItemLeft}>
                  <Ionicons name="help-circle-outline" size={22} color="#6B7280" />
                  <Text style={styles.menuItemText}>Help & Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            </View>

            {/* Switch Role */}
            <TouchableOpacity style={styles.switchButton} onPress={handleSwitchRole} data-testid="switch-role-btn">
              <Ionicons name="swap-horizontal-outline" size={22} color="#1E40AF" />
              <Text style={styles.switchText}>Switch to Rider</Text>
            </TouchableOpacity>

            {/* Delete Account */}
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} data-testid="delete-account-btn">
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Trip Driver v1.0.0</Text>
          </>
        )}
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
  editButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  profileHeader: {
    alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 24,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEF3C7',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  nameInput: {
    fontSize: 22, fontWeight: '600', color: '#111827', textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: '#D97706', paddingVertical: 4,
    marginBottom: 12, minWidth: 200,
  },
  badgeRow: { flexDirection: 'row', gap: 8 },
  driverBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6,
  },
  driverBadgeText: { fontSize: 14, fontWeight: '500', color: '#D97706' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6,
  },
  verifiedBadgeText: { fontSize: 14, fontWeight: '500', color: '#10B981' },
  infoSection: { backgroundColor: '#FFFFFF', marginTop: 12, padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 15, color: '#374151' },
  formSection: { backgroundColor: '#FFFFFF', marginTop: 12, padding: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  formInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB',
  },
  formButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelEditBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center',
  },
  cancelEditText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#D97706', alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  statsContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 20,
    marginTop: 12, justifyContent: 'center', alignItems: 'center',
  },
  statItem: { alignItems: 'center', paddingHorizontal: 40 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1E40AF' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB' },
  statusDot: { width: 28, height: 28, borderRadius: 14, marginBottom: 4 },
  vehicleSection: { backgroundColor: '#FFFFFF', marginTop: 12, padding: 16 },
  sectionTitle: {
    fontSize: 14, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12,
  },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    padding: 16, borderRadius: 12, gap: 16,
  },
  vehicleIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center',
  },
  vehicleDetails: { flex: 1 },
  vehicleName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  vehicleYear: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  vehiclePlate: { fontSize: 14, fontWeight: '600', color: '#1E40AF', marginTop: 4 },
  menuSection: { backgroundColor: '#FFFFFF', marginTop: 12, paddingTop: 8 },
  menuSectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { fontSize: 16, color: '#374151' },
  switchButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', marginTop: 12, paddingVertical: 16, gap: 8,
  },
  switchText: { fontSize: 16, fontWeight: '600', color: '#1E40AF' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', marginTop: 1, paddingVertical: 16, gap: 8,
    borderTopWidth: 1, borderTopColor: '#FEE2E2',
  },
  deleteText: { fontSize: 15, fontWeight: '500', color: '#EF4444' },
  version: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', paddingVertical: 20 },
});
