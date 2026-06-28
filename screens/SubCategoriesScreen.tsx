import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout, Spacing, FontSize } from '../lib/theme';
import { useApp } from '../context/AppProvider';
import { getSubCategories } from '../lib/categories';
import GlassBackground from '../components/GlassBackground';
import CategoryGrid from '../components/CategoryGrid';
import PaginatedProductGrid from '../components/PaginatedProductGrid';
import { AppHeader, SectionHeader } from '../components/layout';

export default function SubCategoriesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { parentId, parentName } = route.params;
  const { categories, products } = useApp();

  const subCategories = useMemo(
    () => getSubCategories(categories, parentId),
    [categories, parentId]
  );

  const parentProducts = useMemo(
    () => products.filter((p) => p.category === parentName),
    [products, parentName]
  );

  return (
    <GlassBackground>
      <AppHeader
        title={parentName}
        subtitle={`${subCategories.length} قسم فرعي`}
        showBack
        showCart
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {subCategories.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="الأقسام الفرعية" count={subCategories.length} />
            <CategoryGrid
              categories={subCategories}
              onPress={(cat) =>
                navigation.navigate('CategoryProducts', { categoryName: cat.name })
              }
            />
          </View>
        ) : null}

        {parentProducts.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title={`منتجات ${parentName}`} count={parentProducts.length} />
            <PaginatedProductGrid
              products={parentProducts}
              onProductPress={(productId) =>
                navigation.navigate('ProductDetail', { productId })
              }
              pageSize={16}
            />
          </View>
        ) : subCategories.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>لا توجد منتجات في هذا القسم</Text>
          </View>
        ) : null}
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.tabBarHeight + Spacing.lg,
  },
  block: { marginBottom: Spacing.lg },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: FontSize.md,
  },
});
