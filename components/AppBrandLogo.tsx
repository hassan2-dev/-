import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../lib/theme';

interface Props {
  size?: number;
  showName?: boolean;
}

export default function AppBrandLogo({ size = 120, showName = true }: Props) {
  const iconSize = Math.round(size * 0.42);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Ionicons name="nutrition" size={iconSize} color={Colors.white} />
      </View>
      {showName ? <Text style={styles.name}>تفاحة</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  name: {
    fontSize: FontSize.title,
    fontWeight: 'bold',
    color: Colors.textDark,
    marginTop: Spacing.lg,
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
