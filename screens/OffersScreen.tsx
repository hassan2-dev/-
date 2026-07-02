import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Spacing, getTabBarBottomPadding } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { AppHeader, EmptyState } from '../components/layout';

export default function OffersScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabBottomPadding = getTabBarBottomPadding(insets.bottom);
  const { products } = useApp();
  const discountedProducts = products.filter((p) => p.hasDiscount);

  return (
    <GlassBackground>
      <AppHeader
        title="العروض"
        subtitle={`${discountedProducts.length} منتج مخفّض`}
        showCart
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: tabBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {discountedProducts.length === 0 ? (
          <EmptyState
            icon="pricetag-outline"
            title="لا توجد عروض حالياً"
            subtitle="تابعنا لمعرفة العروض الجديدة"
          />
        ) : (
          <PaginatedProductGrid
            products={discountedProducts}
            onProductPress={(productId) =>
              navigation.navigate('ProductDetail', { productId })
            }
            pageSize={20}
            showMeta={false}
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
