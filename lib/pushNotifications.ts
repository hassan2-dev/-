import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let initialized = false;

export type PushPlatform = 'ios' | 'android' | 'web';

export function getPushPlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

function getEasProjectId(): string | null {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
}

export async function initPushNotifications(): Promise<boolean> {
  if (initialized) return true;
  if (Platform.OS !== 'web' && !Device.isDevice) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'تحديثات الطلبات',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3D9B4F',
      });
      await Notifications.setNotificationChannelAsync('general', {
        name: 'إشعارات عامة',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#3D9B4F',
      });
    }

    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export async function registerExpoPushToken(): Promise<string | null> {
  if (Platform.OS !== 'web' && !Device.isDevice) return null;

  const ready = await initPushNotifications();
  if (!ready) return null;

  const projectId = getEasProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn('[Push] missing EAS projectId in app.json extra.eas');
    }
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResult.data || null;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Push] token registration failed:', error);
    }
    return null;
  }
}

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await initPushNotifications();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'orders' } : {}),
      },
      trigger: null,
    });
  } catch {
    // Expo Go قد لا يدعم كل ميزات الإشعارات
  }
}

export function addNotificationListeners(options: {
  onReceived?: () => void;
  onResponse?: (data: Record<string, unknown>) => void;
}): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener(() => {
    options.onReceived?.();
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
    options.onResponse?.(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
