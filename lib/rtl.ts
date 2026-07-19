import { I18nManager, TextStyle, ViewStyle } from 'react-native';

/**
 * يُستدعى من index.ts قبل تحميل التطبيق.
 * لا نستدعي forceRTL هنا — يسبب شاشة بيضاء بصمت على iOS release
 * إلى أن يُقتل التطبيق بالكامل. الاعتماد على supportsRTL في app.json
 * + أنماط RTL في الواجهة.
 */
export function initRTL(): void {
  try {
    I18nManager.allowRTL(true);
  } catch {
    // ignore
  }
}

/** نص عربي */
export const rtlText: TextStyle = {
  textAlign: 'right',
  writingDirection: 'rtl',
};

/** حقول إدخال عربية */
export const rtlInput: TextStyle = {
  ...rtlText,
};

/** padding لقوائم التمرير الأفقي — يتبع اتجاه RTL تلقائياً */
export function horizontalListPadding(screenPadding: number, gap = 8): ViewStyle {
  return {
    paddingStart: screenPadding,
    paddingEnd: gap,
  };
}

/** رجوع على يمين الشاشة */
export const backIconName = 'chevron-forward' as const;

/** سهم القوائم */
export const forwardIconName = 'chevron-back' as const;
