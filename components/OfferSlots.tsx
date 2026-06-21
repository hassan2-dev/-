import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { BorderRadius, Spacing, Shadow } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  offers: string[];
}

export default function OfferSlots({ offers }: Props) {
  const [topCurrent, setTopCurrent] = useState(0);
  const [bottomCurrent, setBottomCurrent] = useState(1);
  const [topNext, setTopNext] = useState(() => offers.length > 2 ? 2 : 0);
  const [bottomNext, setBottomNext] = useState(() => offers.length > 3 ? 3 : Math.min(1, offers.length - 1));

  const topCurrentSlide = useRef(new Animated.Value(0)).current;
  const topNextSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const bottomCurrentSlide = useRef(new Animated.Value(0)).current;
  const bottomNextSlide = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  const animating = useRef(false);

  const getNextIndex = useCallback((current: number, step: number) => {
    return (current + step) % offers.length;
  }, [offers.length]);

  useEffect(() => {
    if (offers.length <= 2) return;

    const timer = setInterval(() => {
      if (animating.current) return;
      animating.current = true;

      // Top: current slides LEFT, next slides in from RIGHT
      // Bottom: current slides RIGHT, next slides in from LEFT
      topNextSlide.setValue(SCREEN_WIDTH);
      bottomNextSlide.setValue(-SCREEN_WIDTH);

      Animated.parallel([
        Animated.timing(topCurrentSlide, {
          toValue: -SCREEN_WIDTH,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(topNextSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(bottomCurrentSlide, {
          toValue: SCREEN_WIDTH,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(bottomNextSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Swap: next becomes current
        setTopCurrent(prev => getNextIndex(prev, 2));
        setBottomCurrent(prev => getNextIndex(prev, 2));
        setTopNext(prev => getNextIndex(prev, 2));
        setBottomNext(prev => getNextIndex(prev, 2));

        // Reset positions instantly
        topCurrentSlide.setValue(0);
        bottomCurrentSlide.setValue(0);
        topNextSlide.setValue(SCREEN_WIDTH);
        bottomNextSlide.setValue(-SCREEN_WIDTH);

        animating.current = false;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [offers.length, getNextIndex]);

  if (offers.length === 0) return null;

  const topImg = offers[topCurrent] || offers[0];
  const bottomImg = offers[bottomCurrent] || offers[Math.min(1, offers.length - 1)];
  const topNextImg = offers[topNext] || offers[0];
  const bottomNextImg = offers[bottomNext] || offers[Math.min(1, offers.length - 1)];

  return (
    <View style={styles.container}>
      <View style={styles.slot}>
        <Animated.View style={[styles.absolute, { transform: [{ translateX: topCurrentSlide }] }]}>
          <Image source={{ uri: topImg }} style={styles.slotImage} resizeMode="cover" />
        </Animated.View>
        <Animated.View style={[styles.absolute, { transform: [{ translateX: topNextSlide }] }]}>
          <Image source={{ uri: topNextImg }} style={styles.slotImage} resizeMode="cover" />
        </Animated.View>
      </View>
      <View style={styles.slot}>
        <Animated.View style={[styles.absolute, { transform: [{ translateX: bottomCurrentSlide }] }]}>
          <Image source={{ uri: bottomImg }} style={styles.slotImage} resizeMode="cover" />
        </Animated.View>
        <Animated.View style={[styles.absolute, { transform: [{ translateX: bottomNextSlide }] }]}>
          <Image source={{ uri: bottomNextImg }} style={styles.slotImage} resizeMode="cover" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: Spacing.xl,
  },
  slot: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
});