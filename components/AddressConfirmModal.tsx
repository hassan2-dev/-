import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';

interface Props {
  visible: boolean;
  addressCode: string;
  addressSummary?: string;
  deliveryNote?: string;
  onConfirm: () => void;
  onEditAddress: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

export default function AddressConfirmModal({
  visible,
  addressCode,
  addressSummary,
  deliveryNote,
  onConfirm,
  onEditAddress,
  onCancel,
  confirming,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="location" size={28} color={Colors.primary} />
          </View>

          <Text style={styles.title}>تأكيد عنوان التوصيل</Text>
          <Text style={styles.subtitle}>تأكد من صحة موقع شقتك قبل إرسال الطلب</Text>

          <View style={styles.addressBox}>
            <Text style={styles.codeLabel}>كود التوصيل</Text>
            <Text style={styles.codeValue}>{addressCode}</Text>
            {addressSummary ? (
              <Text style={styles.summary}>{addressSummary}</Text>
            ) : null}
          </View>

          {deliveryNote ? (
            <View style={styles.noteRow}>
              <Ionicons name="time-outline" size={16} color={Colors.textGray} />
              <Text style={styles.noteText}>{deliveryNote}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.confirmBtn, confirming && styles.btnDisabled]}
            onPress={onConfirm}
            disabled={confirming}
            activeOpacity={0.88}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
            <Text style={styles.confirmText}>
              {confirming ? 'جاري الإرسال...' : 'تأكيد العنوان وإرسال الطلب'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.editBtn} onPress={onEditAddress} activeOpacity={0.88}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.editText}>تعديل العنوان</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.88}>
            <Text style={styles.cancelText}>رجوع</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadow.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  addressBox: {
    width: '100%',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  codeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textGray,
  },
  codeValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 1.5,
  },
  summary: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    paddingHorizontal: Spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'right',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  confirmText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  editText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  cancelBtn: {
    paddingVertical: Spacing.xs,
  },
  cancelText: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    fontWeight: '600',
  },
  btnDisabled: { opacity: 0.6 },
});
