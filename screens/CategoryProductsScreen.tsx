import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout, Spacing, getBottomSafeInset } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import SearchBarWithResults from '../components/SearchBarWithResults';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { AppHeader, SectionHeader } from '../components/layout';

export default function CategoryProductsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const bottomPadding = getBottomSafeInset(insets.bottom) + Spacing.lg;
  const route = useRoute<any>();
  const { categoryName } = route.params;
  const { products } = useApp();
  const [search, setSearch] = useState('');
  const isSearchOpen = search.trim().length > 0;

  const categoryProducts = useMemo(
    () => products.filter((p) => p.category === categoryName),
    [products, categoryName]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categoryProducts;
    return categoryProducts.filter((p) =>
      q.split('').every((char) => p.name.toLowerCase().includes(char))
    );
  }, [categoryProducts, search]);

  const displayProducts = search.trim() ? filteredProducts : categoryProducts;

  return (
    <GlassBackground>
      <AppHeader
        title={categoryName}
        subtitle={`${categoryProducts.length} منتج`}
        showBack
        showCart
      />

      <View style={styles.searchWrap}>
        <SearchBarWithResults
          value={search}
          onChangeText={setSearch}
          products={categoryProducts}
          onSelectProduct={(productId) =>
            navigation.navigate('ProductDetail', { productId })
          }
          placeholder={`ابحث في ${categoryName}...`}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isSearchOpen}
        pointerEvents={isSearchOpen ? 'none' : 'auto'}
      >
        <SectionHeader
          title={search.trim() ? 'نتائج البحث' : 'منتجات القسم'}
          count={displayProducts.length}
        />
        <PaginatedProductGrid
          products={displayProducts}
          onProductPress={(productId) =>
            navigation.navigate('ProductDetail', { productId })
          }
          pageSize={16}
          emptyText="لا توجد منتجات في هذا القسم"
        />
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginTop: -Spacing.xs,
    paddingHorizontal: Layout.screenPadding,
    zIndex: 1000,
    ...Platform.select({
      android: { elevation: 1000 },
      default: {},
    }),
  },
  content: { flex: 1, zIndex: 0 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
  },
});
