import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { useNetworkStatus } from '../lib/useNetworkStatus';

export default function OfflineOverlay() {
  const { isOffline, checking, recheckConnection } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={Colors.danger} />
          </View>
          <Text style={styles.title}>أنت خارج الاتصال بالإنترنت</Text>
          <Text style={styles.subtitle}>
            تحقق من شبكة Wi‑Fi أو بيانات الهاتف ثم اضغط إعادة المحاولة
          </Text>

          <TouchableOpacity
            style={[styles.retryBtn, checking && styles.retryBtnDisabled]}
            onPress={recheckConnection}
            disabled={checking}
            activeOpacity={0.88}
          >
            {checking ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="refresh" size={20} color={Colors.white} />
            )}
            <Text style={styles.retryText}>
              {checking ? 'جاري التحقق...' : 'إعادة المحاولة'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  retryBtnDisabled: {
    opacity: 0.7,
  },
  retryText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
