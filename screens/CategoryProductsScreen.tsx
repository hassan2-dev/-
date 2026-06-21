import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Layout, Spacing } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import SearchBarWithResults from '../components/SearchBarWithResults';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { AppHeader, SectionHeader } from '../components/layout';

export default function CategoryProductsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { categoryName } = route.params;
  const { products } = useApp();
  const [search, setSearch] = useState('');

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
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
  searchWrap: { marginTop: -Spacing.xs },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.tabBarHeight + Spacing.lg,
  },
});
