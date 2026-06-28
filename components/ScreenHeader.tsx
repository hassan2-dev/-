import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ViewStyle,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, BorderRadius, Layout, Shadow } from '../lib/theme';
import { rtlInput } from '../lib/rtl';
import { Product } from '../lib/types';
import { useApp } from '../context/AppProvider';
import AppIcon, { HeaderIcons } from './AppIcon';
import SearchResultsDropdown from './SearchResultsDropdown';

interface ScreenHeaderProps {
  mode?: 'home' | 'page';
  title?: string;
  subtitle?: string;
  displayName?: string;
  showBack?: boolean;
  showCart?: boolean;
  showBell?: boolean;
  showOrders?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  searchProducts?: Product[];
  onSelectSearchProduct?: (productId: string) => void;
}

export default function ScreenHeader({
  mode = 'page',
  title,
  subtitle,
  displayName,
  showBack,
  showCart = mode === 'page',
  showBell = mode === 'home',
  showOrders = mode === 'home',
  onBack,
  rightSlot,
  style,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'ابحث عن منتج...',
  searchProducts,
  onSelectSearchProduct,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { getCartCount, unreadNotificationCount } = useApp();
  const cartCount = getCartCount();
  const isHome = mode === 'home';
  const hasSearch = isHome && onSearchChange !== undefined;
  const showSearchDropdown =
    hasSearch &&
    !!searchValue?.trim() &&
    searchProducts !== undefined &&
    !!onSelectSearchProduct;

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark]}
      style={[
        styles.wrap,
        { paddingTop: insets.top + Spacing.xs },
        hasSearch && styles.wrapWithSearch,
        isHome && styles.wrapHome,
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity
              style={styles.iconBtnLight}
              onPress={onBack || (() => navigation.goBack())}
            >
              <AppIcon name={HeaderIcons.back} size={22} color={Colors.white} />
            </TouchableOpacity>
          ) : isHome ? (
            <View style={styles.logoCircle}>
              <AppIcon name="leaf" size={20} color={Colors.white} />
            </View>
          ) : (
            <View style={styles.iconSpacer} />
          )}
        </View>

        <View style={styles.center}>
          {isHome ? (
            <>
              <Text style={styles.homeTitle}>تفاحة</Text>
              <Text style={styles.homeSub} numberOfLines={1}>
                {displayName ? `مرحباً، ${displayName}` : 'متجرك الطازج'}
              </Text>
            </>
          ) : (
            <>
              {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
              {subtitle ? (
                <Text style={styles.pageSub} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.right}>
          {rightSlot}
          {showOrders ? (
            <TouchableOpacity
              style={styles.iconBtnLight}
              onPress={() => navigation.navigate('MyOrders')}
            >
              <AppIcon name={HeaderIcons.orders} size={21} color={Colors.white} />
            </TouchableOpacity>
          ) : null}
          {showBell ? (
            <TouchableOpacity
              style={styles.iconBtnLight}
              onPress={() => navigation.navigate('Notifications')}
            >
              <AppIcon name={HeaderIcons.bell} size={21} color={Colors.white} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
          {showCart ? (
            <TouchableOpacity
              style={[styles.iconBtnLight, isHome && styles.cartBtnHome]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'CartTab' })}
            >
              <AppIcon
                name={HeaderIcons.cart}
                size={21}
                color={isHome ? Colors.primaryDark : Colors.white}
              />
              {cartCount > 0 ? (
                <View style={[styles.badge, isHome && styles.cartBadgeHome]}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : !rightSlot && !showBell ? (
            <View style={styles.iconSpacer} />
          ) : null}
        </View>
      </View>

      {hasSearch ? (
        <View style={styles.searchArea}>
          <View style={styles.searchBox}>
            <AppIcon name={HeaderIcons.search} size={18} color={Colors.textLight} />
            <TextInput
              style={[styles.searchInput, rtlInput]}
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.textLight}
              autoCorrect={false}
            />
            {searchValue && searchValue.length > 0 ? (
              <TouchableOpacity onPress={() => onSearchChange?.('')}>
                <AppIcon name={HeaderIcons.close} size={16} color={Colors.textGray} />
              </TouchableOpacity>
            ) : null}
          </View>
          {showSearchDropdown ? (
            <View style={styles.searchDropdownAnchor}>
              <SearchResultsDropdown
                query={searchValue!}
                products={searchProducts!}
                onSelect={(productId) => {
                  onSelectSearchProduct!(productId);
                  onSearchChange?.('');
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.md,
    marginBottom: Layout.headerContentGap,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    overflow: 'visible',
    zIndex: 1000,
    ...Platform.select({
      android: { elevation: 1000 },
      default: {},
    }),
    ...Shadow.md,
  },
  wrapWithSearch: {
    paddingBottom: Spacing.lg,
  },
  wrapHome: {
    marginBottom: Layout.homeHeaderContentGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  iconSpacer: {
    width: 44,
    height: 44,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnLight: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnHome: {
    backgroundColor: Colors.white,
  },
  homeTitle: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  homeSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  pageTitle: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  pageSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -3,
    start: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: Colors.primaryDark,
  },
  cartBadgeHome: {
    backgroundColor: Colors.danger,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  searchArea: {
    position: 'relative',
    marginTop: Spacing.md,
    zIndex: 200,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
  },
  searchDropdownAnchor: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: Spacing.sm,
    zIndex: 300,
    ...Platform.select({
      android: { elevation: 300 },
      default: {},
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textDark,
    padding: 0,
  },
});
