import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import {
  getNotificationPermissionState,
  openAppNotificationSettings,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../lib/pushNotifications';

const DISMISS_KEY = 'notification_prompt_dismissed_v1';

export default function NotificationPermissionBanner() {
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isGuest, showToast, enablePushNotifications } = useApp();
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  const [loading, setLoading] = useState(false);

  const checkPermission = useCallback(async () => {
    const state = await getNotificationPermissionState();
    setPermission(state);
    return state;
  }, []);

  useEffect(() => {
    if (!isLoggedIn || isGuest) {
      setVisible(false);
      return;
    }

    let active = true;
    (async () => {
      const state = await checkPermission();
      if (!active) return;
      if (state === 'granted') {
        setVisible(false);
        return;
      }
      const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
      if (!active) return;
      setVisible(dismissed !== 'true');
    })();

    return () => {
      active = false;
    };
  }, [isLoggedIn, isGuest, checkPermission]);

  useEffect(() => {
    if (!isLoggedIn || isGuest) return;

    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      const state = await checkPermission();
      if (state === 'granted') {
        await enablePushNotifications();
        setVisible(false);
      }
    });

    return () => sub.remove();
  }, [isLoggedIn, isGuest, checkPermission, enablePushNotifications]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await requestNotificationPermission();
      const state = await checkPermission();

      if (result.granted || state === 'granted') {
        await enablePushNotifications();
        setVisible(false);
        showToast('تم تفعيل الإشعارات');
        return;
      }

      if (result.needsSettings || state === 'denied') {
        const opened = await openAppNotificationSettings();
        if (opened) {
          showToast('فعّل الإشعارات من إعدادات الجهاز ثم ارجع للتطبيق');
        } else {
          showToast('افتح إعدادات الجهاز وفعّل الإشعارات لتفاحة');
        }
        return;
      }

      showToast('لم يُمنح إذن الإشعارات');
    } finally {
      setLoading(false);
    }
  };

  const handleLater = async () => {
    await AsyncStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  const isDenied = permission === 'denied';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.overlay}>
        <Pressable style={[styles.card, { marginBottom: insets.bottom + Spacing.md }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>فعّل الإشعارات</Text>
          <Text style={styles.subtitle}>
            {isDenied
              ? 'الإشعارات معطّلة على جهازك. افتح الإعدادات وفعّلها لتصلك تحديثات طلباتك.'
              : 'نرسل لك تحديثات حالة طلبك فقط — يمكنك إيقافها لاحقاً من إعدادات الجهاز.'}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleEnable}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Ionicons name={isDenied ? 'settings-outline' : 'notifications'} size={20} color={Colors.white} />
            <Text style={styles.primaryText}>
              {loading ? 'جاري التحقق...' : isDenied ? 'فتح الإعدادات' : 'تفعيل الإشعارات'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterBtn} onPress={handleLater} activeOpacity={0.88}>
            <Text style={styles.laterText}>لاحقاً</Text>
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
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  primaryText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  laterBtn: {
    paddingVertical: Spacing.sm,
  },
  laterText: {
    color: Colors.textGray,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
