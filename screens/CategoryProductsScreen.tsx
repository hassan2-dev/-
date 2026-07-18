import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Spacing, getBottomSafeInset } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import SearchBarWithResults from '../components/SearchBarWithResults';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import SearchResultsDropdown from '../components/SearchResultsDropdown';
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
          showDropdown={false}
          onSelectProduct={(productId) =>
            navigation.navigate('ProductDetail', { productId })
          }
          placeholder={`ابحث في ${categoryName}...`}
        />
      </View>

      {isSearchOpen ? (
        <View style={[styles.content, styles.contentInner, { paddingBottom: bottomPadding }]}>
          <SearchResultsDropdown
            query={search}
            products={categoryProducts}
            maxResults={30}
            expanded
            onSelect={(productId) => {
              setSearch('');
              navigation.navigate('ProductDetail', { productId });
            }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SectionHeader title="منتجات القسم" count={categoryProducts.length} />
          <PaginatedProductGrid
            products={categoryProducts}
            onProductPress={(productId) =>
              navigation.navigate('ProductDetail', { productId })
            }
            pageSize={16}
            emptyText="لا توجد منتجات في هذا القسم"
          />
        </ScrollView>
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginTop: -Spacing.xs,
    paddingHorizontal: Layout.screenPadding,
  },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
  },
});
