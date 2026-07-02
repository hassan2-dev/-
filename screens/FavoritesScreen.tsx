import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Spacing, getBottomSafeInset } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { AppHeader, EmptyState } from '../components/layout';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const bottomPadding = getBottomSafeInset(insets.bottom) + Spacing.lg;
  const { products, favorites } = useApp();
  const favProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <GlassBackground>
      <AppHeader title="المفضلة" subtitle="منتجاتك المحفوظة" showBack showCart />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {favProducts.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="المفضلة فارغة"
            subtitle="اضغط على القلب لحفظ منتجاتك المفضلة"
          />
        ) : (
          <PaginatedProductGrid
            products={favProducts}
            onProductPress={(productId) =>
              navigation.navigate('ProductDetail', { productId })
            }
            pageSize={20}
          />
        )}
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
  },
});
