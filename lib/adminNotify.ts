import Constants from 'expo-constants';

type NotifyPayload = {
  title: string;
  body: string;
  orderId?: string;
};

export async function notifyAdminNewOrder(payload: NotifyPayload): Promise<void> {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const url = extra?.adminNotifyUrl?.trim();
  const secret = extra?.adminNotifySecret?.trim();

  if (!url || !secret) {
    if (__DEV__) {
      console.warn('[AdminNotify] missing adminNotifyUrl or adminNotifySecret in app.json extra');
    }
    return;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notify-secret': secret,
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        data: {
          type: 'new_order',
          orderId: payload.orderId || '',
        },
      }),
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[AdminNotify] failed', error);
    }
  }
}
