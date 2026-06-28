import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useApp } from '../context/AppProvider';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';

export default function TabCartButton(props: BottomTabBarButtonProps) {
  const { onPress, accessibilityState } = props;
  const { getCartCount, getCartTotals } = useApp();
  const count = getCartCount();
  const { total } = getCartTotals();
  const focused = accessibilityState?.selected;
  const hasItems = count > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.wrap}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
    >
      <View
        style={[
          styles.button,
          hasItems && styles.buttonWithItems,
          focused && styles.buttonFocused,
        ]}
      >
        <View style={styles.iconRow}>
          <Ionicons name="cart" size={hasItems ? 20 : 22} color={Colors.white} />
          {hasItems ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </View>
        {hasItems ? (
          <Text style={styles.price} numberOfLines={1}>
            {total.toLocaleString()} د.ع
          </Text>
        ) : (
          <Text style={styles.label}>السلة</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    top: Platform.OS === 'ios' ? -14 : -10,
  },
  button: {
    minWidth: 64,
    height: 58,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 3,
    borderColor: Colors.surface,
    ...Shadow.lg,
  },
  buttonWithItems: {
    minWidth: 88,
    height: 62,
    backgroundColor: Colors.primaryDark,
  },
  buttonFocused: {
    borderColor: Colors.primaryLight,
  },
  iconRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    start: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  label: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: 2,
  },
  price: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
});
