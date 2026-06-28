import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

/** أيقونات موحّدة — Ionicons فقط (مدمجة مع Expo) */
export default function AppIcon({ name, size = 22, color = Colors.textDark }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const TabIcons = {
  home: { active: 'home' as IconName, inactive: 'home-outline' as IconName },
  shop: { active: 'cart' as IconName, inactive: 'cart-outline' as IconName },
  offers: { active: 'pricetag' as IconName, inactive: 'pricetag-outline' as IconName },
  account: { active: 'person' as IconName, inactive: 'person-outline' as IconName },
};

export const HeaderIcons = {
  back: 'chevron-forward' as IconName,
  cart: 'cart-outline' as IconName,
  bell: 'notifications-outline' as IconName,
  orders: 'receipt-outline' as IconName,
  search: 'search' as IconName,
  close: 'close' as IconName,
  add: 'add' as IconName,
  heart: 'heart-outline' as IconName,
  heartFilled: 'heart' as IconName,
  trash: 'trash-outline' as IconName,
  store: 'storefront-outline' as IconName,
};
