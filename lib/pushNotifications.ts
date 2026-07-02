import { Platform, Linking } from 'react-native';
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

let channelsReady = false;

export type PushPlatform = 'ios' | 'android' | 'web';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

export function getPushPlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

function getEasProjectId(): string | null {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
}

async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady) return;

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
  channelsReady = true;
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'denied';

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** يجهّز القنوات فقط — بدون طلب إذن من المستخدم */
export async function preparePushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    await setupAndroidChannels();
  } catch {
    // Expo Go قد لا يدعم كل الميزات
  }
}

/** يطلب إذن الإشعارات عند ضغط المستخدم — لا يُستدعى تلقائياً بعد الدخول */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  needsSettings: boolean;
}> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return { granted: false, needsSettings: true };
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') {
      await setupAndroidChannels();
      return { granted: true, needsSettings: false };
    }

    if (current.status === 'denied' && current.canAskAgain === false) {
      return { granted: false, needsSettings: true };
    }

    const { status, canAskAgain } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === 'granted') {
      await setupAndroidChannels();
      return { granted: true, needsSettings: false };
    }

    return {
      granted: false,
      needsSettings: status === 'denied' && canAskAgain === false,
    };
  } catch {
    return { granted: false, needsSettings: false };
  }
}

export async function openAppNotificationSettings(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
      return true;
    }
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

export async function registerExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const state = await getNotificationPermissionState();
  if (state !== 'granted') return null;

  await setupAndroidChannels();

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
  const state = await getNotificationPermissionState();
  if (state !== 'granted') return;

  try {
    await setupAndroidChannels();
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
    // تجاهل — قد تكون الإشعارات معطّلة
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
