import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RadarSearchProps {
  message?: string;
}

export const RadarSearch: React.FC<RadarSearchProps> = ({
  message = 'Looking for a driver...',
}) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createRingAnimation = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ])
      );

    const dotAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    createRingAnimation(ring1, 0).start();
    createRingAnimation(ring2, 800).start();
    createRingAnimation(ring3, 1600).start();
    dotAnim.start();

    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
      dotPulse.stopAnimation();
    };
  }, []);

  const renderRing = (anim: Animated.Value) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.6, 0.3, 0],
    });

    return (
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container} data-testid="radar-search">
      <View style={styles.radarArea}>
        {renderRing(ring1)}
        {renderRing(ring2)}
        {renderRing(ring3)}

        <Animated.View
          style={[
            styles.centerDot,
            { transform: [{ scale: dotPulse }] },
          ]}
        >
          <Ionicons name="location" size={28} color="#FFFFFF" />
        </Animated.View>
      </View>

      <Text style={styles.message}>{message}</Text>
      <Text style={styles.subMessage}>This usually takes a moment</Text>
    </View>
  );
};

const RING_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 64, 175, 0.06)',
  },
  radarArea: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: '#1E40AF',
    backgroundColor: 'rgba(30, 64, 175, 0.08)',
  },
  centerDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    marginTop: 32,
    fontSize: 20,
    fontWeight: '700',
    color: '#1E40AF',
  },
  subMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
});
