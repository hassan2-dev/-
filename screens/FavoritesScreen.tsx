import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Layout, Spacing } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { AppHeader, EmptyState } from '../components/layout';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { products, favorites } = useApp();
  const favProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <GlassBackground>
      <AppHeader title="المفضلة" subtitle="منتجاتك المحفوظة" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
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
    paddingBottom: Layout.tabBarHeight + Spacing.lg,
  },
});
