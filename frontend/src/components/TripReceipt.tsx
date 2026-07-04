import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ride } from '../store/rideStore';

interface TripReceiptProps {
  ride: Ride;
  visible: boolean;
  onClose: () => void;
  userType: 'rider' | 'driver';
}

const BASE_FARE = 2.0;
const PER_MILE_RATE = 1.5;

export default function TripReceipt({ ride, visible, onClose, userType }: TripReceiptProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const distanceFare = ride.distance_miles ? ride.distance_miles * PER_MILE_RATE : 0;
  const totalFare = ride.fare || BASE_FARE + distanceFare;

  const generateReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trip Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            color: #111827;
          }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 32px; font-weight: bold; color: #1E40AF; margin-bottom: 5px; }
          .receipt-title { font-size: 14px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; }
          .divider { border-bottom: 1px solid #E5E7EB; margin: 20px 0; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 12px; color: #9CA3AF; text-transform: uppercase; margin-bottom: 12px; }
          .route { display: flex; }
          .route-line { width: 20px; display: flex; flex-direction: column; align-items: center; margin-right: 12px; }
          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot.pickup { background: #10B981; }
          .dot.dropoff { background: #EF4444; }
          .line { width: 2px; height: 30px; background: #E5E7EB; margin: 4px 0; }
          .route-details { flex: 1; }
          .location { margin-bottom: 16px; }
          .location-label { font-size: 12px; color: #9CA3AF; margin-bottom: 4px; }
          .location-address { font-size: 14px; color: #374151; }
          .fare-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .fare-label { color: #6B7280; }
          .fare-amount { font-weight: 500; }
          .total-row { display: flex; justify-content: space-between; padding: 16px 0; border-top: 2px solid #111827; margin-top: 8px; }
          .total-label { font-size: 18px; font-weight: 600; }
          .total-amount { font-size: 24px; font-weight: bold; color: #1E40AF; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .info-item { }
          .info-label { font-size: 12px; color: #9CA3AF; margin-bottom: 4px; }
          .info-value { font-size: 14px; color: #374151; }
          .payment-badge { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px;
            font-weight: 600;
          }
          .paid { background: #D1FAE5; color: #059669; }
          .unpaid { background: #FEF3C7; color: #D97706; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; }
          .footer-text { font-size: 12px; color: #9CA3AF; }
          .ride-id { font-family: monospace; font-size: 11px; color: #9CA3AF; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Trip</div>
          <div class="receipt-title">Trip Receipt</div>
        </div>

        <div class="section">
          <div class="section-title">Route</div>
          <div class="route">
            <div class="route-line">
              <div class="dot pickup"></div>
              <div class="line"></div>
              <div class="dot dropoff"></div>
            </div>
            <div class="route-details">
              <div class="location">
                <div class="location-label">Pickup</div>
                <div class="location-address">${ride.pickup_address || 'N/A'}</div>
              </div>
              <div class="location">
                <div class="location-label">Dropoff</div>
                <div class="location-address">${ride.dropoff_address || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">Fare Breakdown</div>
          <div class="fare-row">
            <span class="fare-label">Base Fare</span>
            <span class="fare-amount">$${BASE_FARE.toFixed(2)}</span>
          </div>
          <div class="fare-row">
            <span class="fare-label">Distance (${ride.distance_miles?.toFixed(1) || '0'} mi x $${PER_MILE_RATE.toFixed(2)})</span>
            <span class="fare-amount">$${distanceFare.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total</span>
            <span class="total-amount">$${totalFare.toFixed(2)}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">Trip Details</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${formatDate(ride.created_at)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Time</div>
              <div class="info-value">${formatTime(ride.created_at)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">${userType === 'rider' ? 'Driver' : 'Rider'}</div>
              <div class="info-value">${userType === 'rider' ? (ride.driver_name || 'N/A') : (ride.rider_name || 'N/A')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Payment Status</div>
              <span class="payment-badge ${ride.payment_status === 'paid' ? 'paid' : 'unpaid'}">
                ${ride.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
              </span>
            </div>
            ${ride.driver_vehicle ? `
            <div class="info-item">
              <div class="info-label">Vehicle</div>
              <div class="info-value">${ride.driver_vehicle.vehicle_color} ${ride.driver_vehicle.vehicle_make} ${ride.driver_vehicle.vehicle_model}</div>
            </div>
            <div class="info-item">
              <div class="info-label">License Plate</div>
              <div class="info-value">${ride.driver_vehicle.license_plate}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="footer">
          <div class="footer-text">Thank you for riding with Trip!</div>
          <div class="ride-id">Ride ID: ${ride.ride_id}</div>
        </div>
      </body>
      </html>
    `;
  };

  const handleSaveAsPDF = async () => {
    setIsGenerating(true);
    try {
      const html = generateReceiptHTML();
      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Trip Receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Success', 'Receipt saved to: ' + uri);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF receipt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAsImage = async () => {
    setIsGenerating(true);
    try {
      const html = generateReceiptHTML();
      
      // For image, we'll use Print which opens print dialog on web
      // On native, sharing as PDF is preferred but we can offer both
      if (Platform.OS === 'web') {
        // On web, open print dialog which allows saving as PDF/image
        await Print.printAsync({ html });
      } else {
        // On native, share as PDF (image export is limited in Expo)
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save Trip Receipt as Image',
          });
        }
      }
    } catch (error) {
      console.error('Image generation error:', error);
      Alert.alert('Error', 'Failed to generate receipt image');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!ride) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Receipt</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>Trip</Text>
            <Text style={styles.receiptLabel}>TRIP RECEIPT</Text>
          </View>

          {/* Route */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ROUTE</Text>
            <View style={styles.routeContainer}>
              <View style={styles.routeLine}>
                <View style={[styles.dot, styles.pickupDot]} />
                <View style={styles.line} />
                <View style={[styles.dot, styles.dropoffDot]} />
              </View>
              <View style={styles.routeDetails}>
                <View style={styles.location}>
                  <Text style={styles.locationLabel}>Pickup</Text>
                  <Text style={styles.locationAddress}>{ride.pickup_address || 'N/A'}</Text>
                </View>
                <View style={styles.location}>
                  <Text style={styles.locationLabel}>Dropoff</Text>
                  <Text style={styles.locationAddress}>{ride.dropoff_address || 'N/A'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Fare Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FARE BREAKDOWN</Text>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Base Fare</Text>
              <Text style={styles.fareAmount}>${BASE_FARE.toFixed(2)}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>
                Distance ({ride.distance_miles?.toFixed(1) || '0'} mi × ${PER_MILE_RATE.toFixed(2)})
              </Text>
              <Text style={styles.fareAmount}>${distanceFare.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${totalFare.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Trip Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TRIP DETAILS</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDate(ride.created_at)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Time</Text>
                <Text style={styles.infoValue}>{formatTime(ride.created_at)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{userType === 'rider' ? 'Driver' : 'Rider'}</Text>
                <Text style={styles.infoValue}>
                  {userType === 'rider' ? (ride.driver_name || 'N/A') : (ride.rider_name || 'N/A')}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Payment</Text>
                <View style={[
                  styles.paymentBadge,
                  ride.payment_status === 'paid' ? styles.paidBadge : styles.unpaidBadge
                ]}>
                  <Text style={[
                    styles.paymentBadgeText,
                    ride.payment_status === 'paid' ? styles.paidText : styles.unpaidText
                  ]}>
                    {ride.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
              </View>
            </View>

            {ride.driver_vehicle && (
              <View style={styles.vehicleInfo}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Vehicle</Text>
                  <Text style={styles.infoValue}>
                    {ride.driver_vehicle.vehicle_color} {ride.driver_vehicle.vehicle_make} {ride.driver_vehicle.vehicle_model}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>License Plate</Text>
                  <Text style={styles.infoValue}>{ride.driver_vehicle.license_plate}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Ride ID */}
          <Text style={styles.rideId}>Ride ID: {ride.ride_id}</Text>
        </ScrollView>

        {/* Download Buttons */}
        <View style={styles.downloadSection}>
          <TouchableOpacity
            style={[styles.downloadButton, styles.pdfButton]}
            onPress={handleSaveAsPDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="document-text" size={20} color="#FFFFFF" />
                <Text style={styles.downloadButtonText}>Save as PDF</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.downloadButton, styles.imageButton]}
            onPress={handleSaveAsImage}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#1E40AF" size="small" />
            ) : (
              <>
                <Ionicons name="image" size={20} color="#1E40AF" />
                <Text style={[styles.downloadButtonText, styles.imageButtonText]}>Print / Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
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
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  receiptLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 2,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 16,
  },
  routeContainer: {
    flexDirection: 'row',
  },
  routeLine: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pickupDot: {
    backgroundColor: '#10B981',
  },
  dropoffDot: {
    backgroundColor: '#EF4444',
  },
  line: {
    width: 2,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
  },
  location: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  fareLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  fareAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#111827',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#374151',
  },
  paymentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  paidBadge: {
    backgroundColor: '#D1FAE5',
  },
  unpaidBadge: {
    backgroundColor: '#FEF3C7',
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paidText: {
    color: '#059669',
  },
  unpaidText: {
    color: '#D97706',
  },
  vehicleInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  rideId: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  downloadSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  pdfButton: {
    backgroundColor: '#1E40AF',
  },
  imageButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E40AF',
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageButtonText: {
    color: '#1E40AF',
  },
});
