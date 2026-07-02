import React, { useMemo, useState } from 'react';
import { StyleSheet, ScrollView, View, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Spacing, getTabBarBottomPadding } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import SearchBarWithResults from '../components/SearchBarWithResults';
import ScreenHeader from '../components/ScreenHeader';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { SectionHeader } from '../components/layout';

export default function CatalogScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabBottomPadding = getTabBarBottomPadding(insets.bottom, Spacing.xl);
  const { products } = useApp();
  const [search, setSearch] = useState('');
  const isSearchOpen = search.trim().length > 0;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      q.split('').every((char) => p.name.toLowerCase().includes(char))
    );
  }, [products, search]);

  return (
    <GlassBackground>
      <ScreenHeader
        mode="page"
        title="تسوق"
        subtitle={`${products.length} منتج متوفر`}
      />

      <View style={styles.searchWrap}>
        <SearchBarWithResults
          value={search}
          onChangeText={setSearch}
          products={products}
          onSelectProduct={(productId) => navigation.navigate('ProductDetail', { productId })}
          placeholder="ابحث في كل المنتجات..."
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: tabBottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isSearchOpen}
        pointerEvents={isSearchOpen ? 'none' : 'auto'}
      >
        <SectionHeader
          title={search.trim() ? 'نتائج البحث' : 'كل المنتجات'}
          count={filteredProducts.length}
        />
        <PaginatedProductGrid
          products={filteredProducts}
          onProductPress={(productId) => navigation.navigate('ProductDetail', { productId })}
          pageSize={20}
          showMeta={false}
        />
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    zIndex: 1000,
    ...Platform.select({
      android: { elevation: 1000 },
      default: {},
    }),
  },
  content: { flex: 1, zIndex: 0 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.sm,
  },
});
