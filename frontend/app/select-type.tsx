import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '../src/store/userStore';
import { FadeInView } from '../src/components/FadeInView';
import { getApiUrl } from '../src/config/env';

interface ExistingUser {
  user_id: string;
  name: string;
  user_type: 'rider' | 'driver';
  created_at?: string;
}

export default function SelectTypeScreen() {
  const router = useRouter();
  const { createUser, setUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [userTypeModal, setUserTypeModal] = useState<'rider' | 'driver' | null>(null);
  const [modalMode, setModalMode] = useState<'select' | 'create' | null>(null);
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchExistingUsers = async (type: 'rider' | 'driver') => {
    setFetchingUsers(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/users/type/${type}`);
      if (response.ok) {
        const users = await response.json();
        setExistingUsers(Array.isArray(users) ? users : []);
      } else {
        Alert.alert('Error', 'Failed to fetch users');
        setExistingUsers([]);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      Alert.alert('Error', 'Failed to load users');
      setExistingUsers([]);
    } finally {
      setFetchingUsers(false);
    }
  };

  const handleUserTypeSelect = async (type: 'rider' | 'driver') => {
    setUserTypeModal(type);
    setModalMode('select');
    await fetchExistingUsers(type);
  };

  const handleSelectExistingUser = async (user: ExistingUser) => {
    setIsLoading(true);
    try {
      // Store user info
      await AsyncStorage.setItem('user_id', user.user_id);
      await AsyncStorage.setItem('user_type', user.user_type);
      
      setUserTypeModal(null);
      setModalMode(null);
      
      if (user.user_type === 'rider') {
        router.replace('/rider');
      } else {
        router.replace('/driver');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewUser = async () => {
    if (!newUserName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    if (!userTypeModal) return;

    setCreatingUser(true);
    try {
      await createUser(userTypeModal, newUserName);
      setUserTypeModal(null);
      setModalMode(null);
      setNewUserName('');
      
      if (userTypeModal === 'rider') {
        router.replace('/rider');
      } else {
        router.replace('/driver');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create user. Please try again.'
      );
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSelectType = async (type: 'rider' | 'driver') => {
    handleUserTypeSelect(type);
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

      {/* User Selection/Creation Modal */}
      <Modal
        visible={userTypeModal !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setUserTypeModal(null);
          setModalMode(null);
          setNewUserName('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setUserTypeModal(null);
                setModalMode(null);
                setNewUserName('');
              }}
            >
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {userTypeModal === 'rider' ? 'Rider' : 'Driver'} Account
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Select Mode */}
          {modalMode === 'select' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modeButtonsContainer}>
                <TouchableOpacity
                  style={styles.modeButton}
                  onPress={() => setModalMode('select')}
                  disabled={true}
                >
                  <Ionicons
                    name="people"
                    size={24}
                    color="#1E40AF"
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                      styles.modeButtonTextActive,
                    ]}
                  >
                    Select Existing
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modeButton}
                  onPress={() => setModalMode('create')}
                  disabled={false}
                >
                  <Ionicons
                    name="person-add"
                    size={24}
                    color="#6B7280"
                  />
                  <Text
                    style={[
                      styles.modeButtonText,
                    ]}
                  >
                    Create New
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Existing Users List */}
              {fetchingUsers ? (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="large" color="#1E40AF" />
                  <Text style={styles.loadingLabel}>Loading users...</Text>
                </View>
              ) : existingUsers.length === 0 ? (
                <View style={styles.centerContent}>
                  <Ionicons name="person-remove" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyLabel}>No users found</Text>
                  <Text style={styles.emptySubLabel}>
                    Create a new account to get started
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={existingUsers}
                  keyExtractor={(item) => item.user_id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.userCard}
                      onPress={() => handleSelectExistingUser(item)}
                      disabled={isLoading}
                    >
                      <View style={styles.userCardContent}>
                        <View
                          style={[
                            styles.userAvatar,
                            {
                              backgroundColor:
                                item.user_type === 'rider' ? '#DBEAFE' : '#FEF3C7',
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              item.user_type === 'rider' ? 'person' : 'car-sport'
                            }
                            size={24}
                            color={
                              item.user_type === 'rider' ? '#1E40AF' : '#D97706'
                            }
                          />
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{item.name}</Text>
                          <Text style={styles.userId}>ID: {item.user_id}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="#D1D5DB" />
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.usersList}
                />
              )}
            </KeyboardAvoidingView>
          )}

          {/* Create New User Form */}
          {modalMode === 'create' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <ScrollView contentContainerStyle={styles.createFormContent}>
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Enter Your Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., John Doe"
                    value={newUserName}
                    onChangeText={setNewUserName}
                    placeholderTextColor="#9CA3AF"
                    editable={!creatingUser}
                  />
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color="#3B82F6" />
                  <Text style={styles.infoText}>
                    A new {userTypeModal} account will be created with your name
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.createButton,
                    (!newUserName.trim() || creatingUser) &&
                      styles.createButtonDisabled,
                  ]}
                  onPress={handleCreateNewUser}
                  disabled={!newUserName.trim() || creatingUser}
                >
                  {creatingUser ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={20} color="#FFFFFF" />
                      <Text style={styles.createButtonText}>
                        Create {userTypeModal === 'rider' ? 'Rider' : 'Driver'}{' '}
                        Account
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>
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
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
  },
  
  modeButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: '#1E40AF',
  },
  
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingLabel: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyLabel: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  
  usersList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  userId: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  
  createFormContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  
  createButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
