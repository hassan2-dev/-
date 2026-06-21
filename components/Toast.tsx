import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Toast() {
  const { toasts } = useApp();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="none">
      {toasts.map((toast) => (
        <View key={toast.id} style={styles.toast}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark" size={16} color={Colors.white} />
          </View>
          <Text style={styles.text}>{toast.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textDark,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadow.lg,
    marginBottom: Spacing.sm,
    width: '100%',
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontWeight: '700',
    color: Colors.white,
    fontSize: FontSize.sm,
    textAlign: 'right',
  },
});
