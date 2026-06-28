import { I18nManager, TextStyle, ViewStyle } from 'react-native';

/** يُستدعى من index.ts قبل تحميل التطبيق — RTL كامل من اليمين لليسار */
export function initRTL(): void {
  I18nManager.allowRTL(true);
  if (!I18nManager.isRTL) {
    I18nManager.forceRTL(true);
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
