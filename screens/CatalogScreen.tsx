import React, { useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout, Spacing, getTabBarBottomPadding } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import SearchBarWithResults from '../components/SearchBarWithResults';
import ScreenHeader from '../components/ScreenHeader';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import SearchResultsDropdown from '../components/SearchResultsDropdown';
import { SectionHeader } from '../components/layout';

export default function CatalogScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabBottomPadding = getTabBarBottomPadding(insets.bottom, Spacing.xl);
  const { products } = useApp();
  const [search, setSearch] = useState('');
  const isSearchOpen = search.trim().length > 0;

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
          showDropdown={false}
          onSelectProduct={(productId) => navigation.navigate('ProductDetail', { productId })}
          placeholder="ابحث في كل المنتجات..."
        />
      </View>

      {isSearchOpen ? (
        <View style={[styles.content, styles.contentInner, { paddingBottom: tabBottomPadding }]}>
          <SearchResultsDropdown
            query={search}
            products={products}
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
          contentContainerStyle={[styles.contentInner, { paddingBottom: tabBottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SectionHeader title="كل المنتجات" count={products.length} />
          <PaginatedProductGrid
            products={products}
            onProductPress={(productId) => navigation.navigate('ProductDetail', { productId })}
            pageSize={20}
            showMeta={false}
          />
        </ScrollView>
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.sm,
  },
});
