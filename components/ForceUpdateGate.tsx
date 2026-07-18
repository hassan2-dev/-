import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
  BackHandler,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { API_BASE_URL } from '../lib/api';

type AppVersionPolicy = {
  forceUpdate: boolean;
  minIosVersion?: string | null;
  minAndroidVersion?: string | null;
  message?: string;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
};

function parseVersion(input?: string | null): number[] {
  if (!input) return [0];
  return String(input)
    .split('.')
    .map((part) => Number.parseInt(part.replace(/\D/g, ''), 10) || 0);
}

/** Returns true when current < minimum (semver-ish). */
export function isVersionBelow(current: string, minimum?: string | null): boolean {
  if (!minimum) return false;
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left < right) return true;
    if (left > right) return false;
  }
  return false;
}

export default function ForceUpdateGate() {
  const [policy, setPolicy] = useState<AppVersionPolicy | null>(null);
  const [blocked, setBlocked] = useState(false);

  const currentVersion = Constants.expoConfig?.version || '0.0.0';

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/app-version`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = (json?.data ?? json) as AppVersionPolicy;
      setPolicy(data);
      if (!data?.forceUpdate) {
        setBlocked(false);
        return;
      }
      const min =
        Platform.OS === 'ios' ? data.minIosVersion : data.minAndroidVersion;
      setBlocked(isVersionBelow(currentVersion, min));
    } catch {
      // Don't block the app if the check fails (offline / server down).
    }
  }, [currentVersion]);

  useEffect(() => {
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [check]);

  useEffect(() => {
    if (!blocked || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocked]);

  const openStore = async () => {
    const url =
      Platform.OS === 'ios'
        ? policy?.iosStoreUrl
        : policy?.androidStoreUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  };

  if (!blocked) return null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-download-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>تحديث مطلوب</Text>
          <Text style={styles.body}>
            {policy?.message ||
              'يتوفر تحديث جديد لتطبيق تفاحة. يجب تحديث التطبيق للمتابعة.'}
          </Text>
          <Text style={styles.meta}>
            إصدارك الحالي: {currentVersion}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={openStore} activeOpacity={0.88}>
            <Ionicons name="arrow-up-circle-outline" size={22} color={Colors.white} />
            <Text style={styles.btnText}>تحديث الآن</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 24, 14, 0.72)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
  },
  btn: {
    marginTop: Spacing.sm,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  btnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
