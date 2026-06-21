import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow, Layout } from '../lib/theme';
import { Product } from '../lib/types';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  products: Product[];
  onSelectProduct: (productId: string) => void;
  placeholder?: string;
  maxResults?: number;
}

function matchesQuery(name: string, query: string): boolean {
  const normalizedName = name.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return false;
  return normalizedQuery.split('').every((char) => normalizedName.includes(char));
}

export default function SearchBarWithResults({
  value,
  onChangeText,
  products,
  onSelectProduct,
  placeholder = 'ابحث عن منتج...',
  maxResults = 12,
}: Props) {
  const results = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return products.filter((p) => matchesQuery(p.name, q)).slice(0, maxResults);
  }, [products, value, maxResults]);

  const showDropdown = value.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        <View style={styles.searchIcon}>
          <Ionicons name="search" size={18} color={Colors.primary} />
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          textAlign="right"
          autoCorrect={false}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {results.length === 0 ? (
            <Text style={styles.noResults}>لا توجد نتائج لـ «{value}»</Text>
          ) : (
            <ScrollView
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {results.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.resultRow}
                  onPress={() => {
                    onSelectProduct(product.id);
                    onChangeText('');
                  }}
                >
                  {product.image ? (
                    <Image source={{ uri: product.image }} style={styles.resultImage} />
                  ) : (
                    <View style={[styles.resultImage, styles.resultPlaceholder]}>
                      <Ionicons name="image-outline" size={18} color={Colors.textLight} />
                    </View>
                  )}
                  <View style={styles.resultBody}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.resultPrice}>
                      {product.price.toLocaleString()} د.ع
                    </Text>
                  </View>
                  <Ionicons name="chevron-back" size={16} color={Colors.textLight} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    zIndex: 30,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  searchIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textDark,
    paddingVertical: Spacing.sm,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: 280,
    overflow: 'hidden',
    ...Shadow.md,
  },
  resultsList: {
    maxHeight: 280,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  resultImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceMuted,
  },
  resultPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBody: {
    flex: 1,
  },
  resultName: {
    fontSize: FontSize.sm,
    color: Colors.textDark,
    textAlign: 'right',
    fontWeight: '700',
  },
  resultPrice: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'right',
    marginTop: 2,
    fontWeight: '700',
  },
  noResults: {
    padding: Spacing.lg,
    textAlign: 'center',
    color: Colors.textGray,
    fontSize: FontSize.sm,
  },
});