import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, Layout } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import GlassBackground from '../components/GlassBackground';
import ScreenHeader from '../components/ScreenHeader';
import BannerSlider from '../components/BannerSlider';
import CategoryGrid, { CategoryGridPlaceholder } from '../components/CategoryGrid';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { resolveUserDisplayName } from '../lib/authConfig';
import { getParentCategories, getSubCategories } from '../lib/categories';
import {
  buildHomeFeaturedProducts,
  HOME_FEATURED_LIMIT,
} from '../lib/homeProducts';
import { SectionHeader } from '../components/layout';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { categories, products, banners, dataLoading, refreshData, userEmail, userDisplayName } =
    useApp();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const parentCategories = useMemo(() => getParentCategories(categories), [categories]);
  const homeFeaturedProducts = useMemo(
    () => buildHomeFeaturedProducts(products, HOME_FEATURED_LIMIT),
    [products]
  );

  const handleCategoryPress = (cat: { id: string; name: string }) => {
    const subs = getSubCategories(categories, cat.id);
    if (subs.length > 0) {
      navigation.navigate('SubCategories', { parentId: cat.id, parentName: cat.name });
    } else {
      navigation.navigate('CategoryProducts', { categoryName: cat.name });
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const displayName = resolveUserDisplayName(userDisplayName, userEmail) ?? undefined;
  const isSearchOpen = search.trim().length > 0;

  return (
    <GlassBackground>
      <ScreenHeader
        mode="home"
        displayName={displayName}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="ابحث عن منتج..."
        searchProducts={products}
        onSelectSearchProduct={(productId) =>
          navigation.navigate('ProductDetail', { productId })
        }
      />

      {dataLoading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المتجر...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!isSearchOpen}
          pointerEvents={isSearchOpen ? 'none' : 'auto'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          <>
            {banners.length > 0 ? (
              <View style={styles.block}>
                <BannerSlider banners={banners} />
              </View>
            ) : null}

            <View style={styles.block}>
              <SectionHeader title="تسوق حسب القسم" count={parentCategories.length} />
              {parentCategories.length > 0 ? (
                <CategoryGrid
                  categories={parentCategories}
                  onPress={handleCategoryPress}
                />
              ) : (
                <CategoryGridPlaceholder />
              )}
            </View>

            <View style={styles.block}>
              <SectionHeader
                title="خصومات وعروض"
                count={homeFeaturedProducts.length}
                actionLabel="الكل"
                onAction={() => navigation.navigate('MainTabs', { screen: 'OffersTab' })}
              />
              <PaginatedProductGrid
                products={homeFeaturedProducts}
                onProductPress={(id) => navigation.navigate('ProductDetail', { productId: id })}
                pageSize={HOME_FEATURED_LIMIT}
                emptyText="لا توجد منتجات حالياً"
                showMeta={false}
              />
            </View>
          </>
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  loadingText: { color: Colors.textGray, fontSize: FontSize.md },
  block: { marginBottom: Spacing.lg },
});
