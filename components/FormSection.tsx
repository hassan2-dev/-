import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: boolean;
}

export default function FormSection({
  icon,
  title,
  subtitle,
  children,
  style,
  accent,
}: Props) {
  return (
    <View style={[styles.card, accent && styles.cardAccent, style]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, accent && styles.iconWrapAccent]}>
          <Ionicons name={icon} size={20} color={accent ? Colors.white : Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardAccent: {
    borderColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAccent: {
    backgroundColor: Colors.primary,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
