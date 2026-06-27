import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  size?: number;
};

export default function RedAppleLogo({ size = 112 }: Props) {
  const body = size * 0.82;
  const leafW = size * 0.28;
  const leafH = size * 0.16;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.stem,
          {
            width: size * 0.06,
            height: size * 0.12,
            top: size * 0.1,
          },
        ]}
      />
      <View
        style={[
          styles.leaf,
          {
            width: leafW,
            height: leafH,
            top: size * 0.06,
            right: size * 0.22,
            borderTopLeftRadius: leafH,
            borderTopRightRadius: leafH * 0.2,
            borderBottomLeftRadius: leafH * 0.15,
            borderBottomRightRadius: leafH,
          },
        ]}
      />
      <LinearGradient
        colors={['#FF6B6B', '#E53935', '#C62828']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.body,
          {
            width: body,
            height: body,
            borderRadius: body * 0.46,
            marginTop: size * 0.14,
          },
        ]}
      >
        <View
          style={[
            styles.shine,
            {
              width: body * 0.22,
              height: body * 0.34,
              borderRadius: body * 0.2,
              top: body * 0.14,
              left: body * 0.18,
            },
          ]}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stem: {
    position: 'absolute',
    backgroundColor: '#6D4C41',
    borderRadius: 4,
    zIndex: 2,
  },
  leaf: {
    position: 'absolute',
    backgroundColor: '#43A047',
    transform: [{ rotate: '28deg' }],
    zIndex: 2,
  },
  body: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    shadowColor: '#B71C1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  shine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
