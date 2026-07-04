import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDriverStore } from '../../src/store/driverStore';

export default function DocumentsScreen() {
  const router = useRouter();
  const { documents, isVerified, fetchDocuments, uploadDocuments, isLoading } = useDriverStore();

  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [insuranceImage, setInsuranceImage] = useState<string | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    await fetchDocuments();
    if (documents) {
      setVehicleMake(documents.vehicle_make || '');
      setVehicleModel(documents.vehicle_model || '');
      setVehicleYear(documents.vehicle_year || '');
      setVehicleColor(documents.vehicle_color || '');
      setLicensePlate(documents.license_plate || '');
      if (documents.license_data) setLicenseImage(documents.license_data);
      if (documents.insurance_data) setInsuranceImage(documents.insurance_data);
    }
  };

  const pickImage = async (type: 'license' | 'insurance') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'license') {
        setLicenseImage(base64Data);
      } else {
        setInsuranceImage(base64Data);
      }
    }
  };

  const takePhoto = async (type: 'license' | 'insurance') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'license') {
        setLicenseImage(base64Data);
      } else {
        setInsuranceImage(base64Data);
      }
    }
  };

  const showImagePicker = (type: 'license' | 'insurance') => {
    Alert.alert('Upload Document', 'Choose an option', [
      { text: 'Take Photo', onPress: () => takePhoto(type) },
      { text: 'Choose from Gallery', onPress: () => pickImage(type) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !licensePlate) {
      Alert.alert('Error', 'Please fill in all vehicle information.');
      return;
    }

    if (!licenseImage || !insuranceImage) {
      Alert.alert('Error', 'Please upload both license and insurance documents.');
      return;
    }

    try {
      await uploadDocuments({
        license_data: licenseImage,
        insurance_data: insuranceImage,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: vehicleYear,
        vehicle_color: vehicleColor,
        license_plate: licensePlate,
      });

      Alert.alert(
        'Success',
        'Your documents have been uploaded and verified!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload documents.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Documents</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Verification Status */}
        {isVerified && (
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.verifiedText}>Documents Verified</Text>
          </View>
        )}

        {/* Document Uploads */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Documents</Text>

          {/* License */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Ionicons name="card" size={24} color="#1E40AF" />
              <Text style={styles.documentTitle}>Driver's License</Text>
            </View>
            {licenseImage ? (
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: licenseImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => showImagePicker('license')}
                >
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={() => showImagePicker('license')}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#9CA3AF" />
                <Text style={styles.uploadText}>Tap to upload</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Insurance */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Ionicons name="shield-checkmark" size={24} color="#1E40AF" />
              <Text style={styles.documentTitle}>Insurance Document</Text>
            </View>
            {insuranceImage ? (
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: insuranceImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => showImagePicker('insurance')}
                >
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={() => showImagePicker('insurance')}
              >
                <Ionicons name="cloud-upload-outline" size={32} color="#9CA3AF" />
                <Text style={styles.uploadText}>Tap to upload</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Make</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Toyota"
                value={vehicleMake}
                onChangeText={setVehicleMake}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Model</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Camry"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Year</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2022"
                value={vehicleYear}
                onChangeText={setVehicleYear}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Color</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Black"
                value={vehicleColor}
                onChangeText={setVehicleColor}
              />
            </View>
          </View>

          <View style={styles.inputFull}>
            <Text style={styles.inputLabel}>License Plate</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ABC-1234"
              value={licensePlate}
              onChangeText={setLicensePlate}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isVerified ? 'Update Documents' : 'Submit for Verification'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  verifiedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  uploadArea: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  imagePreview: {
    position: 'relative',
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  changeButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputFull: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
