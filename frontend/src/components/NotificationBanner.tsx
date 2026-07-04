import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../store/notificationStore';

const ICON_MAP: Record<string, any> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  warning: 'alert-circle',
  error: 'close-circle',
};

const COLOR_MAP: Record<string, string> = {
  success: '#10B981',
  info: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
};

export const NotificationBanner: React.FC = () => {
  const { notification, dismiss } = useNotificationStore();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: -120, duration: 300, useNativeDriver: false }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
        ]).start(() => dismiss());
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
    }
  }, [notification?.id]);

  if (!notification) return null;

  const accentColor = COLOR_MAP[notification.type] || '#3B82F6';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          borderLeftColor: accentColor,
        },
      ]}
      data-testid="notification-banner"
    >
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
        <Ionicons
          name={notification.icon || ICON_MAP[notification.type]}
          size={22}
          color={accentColor}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{notification.message}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.closeBtn} data-testid="dismiss-notification">
        <Ionicons name="close" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
