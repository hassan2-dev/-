import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';
import { forwardIconName } from '../lib/rtl';

interface Props {
  addressCode?: string;
  summary?: string;
  onPress: () => void;
  /** داخل FormSection — بدون إطار مكرر */
  embedded?: boolean;
}

export default function SavedAddressCard({ addressCode, summary, onPress, embedded }: Props) {
  const hasAddress = !!addressCode;

  return (
    <TouchableOpacity
      style={[styles.card, embedded && styles.cardEmbedded]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="location" size={20} color={Colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>عنوان الشقة</Text>
        {hasAddress ? (
          <>
            <Text style={styles.code}>{addressCode}</Text>
            {summary ? (
              <Text style={styles.summary} numberOfLines={2}>
                {summary}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.empty}>لم يُحدد بعد — اضغط لاختيار موقع الشقة</Text>
        )}
      </View>
      <View style={styles.action}>
        <Text style={styles.actionText}>{hasAddress ? 'تعديل' : 'إضافة'}</Text>
        <Ionicons name={forwardIconName} size={16} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardEmbedded: {
    backgroundColor: Colors.surfaceMuted,
    shadowColor: 'transparent',
    elevation: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textGray,
    textAlign: 'right',
  },
  code: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primaryDark,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 2,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    textAlign: 'right',
  },
  action: {
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
  },
});
