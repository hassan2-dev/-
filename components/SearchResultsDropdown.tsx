import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '../lib/theme';
import { forwardIconName } from '../lib/rtl';
import { Product } from '../lib/types';
import { filterProductsByQuery } from '../lib/search';
import { resolveProductImage } from '../lib/productImage';
import RemoteImage from './RemoteImage';

interface Props {
  query: string;
  products: Product[];
  onSelect: (productId: string) => void;
  maxResults?: number;
  style?: StyleProp<ViewStyle>;
}

export default function SearchResultsDropdown({
  query,
  products,
  onSelect,
  maxResults = 12,
  style,
}: Props) {
  const results = useMemo(
    () => filterProductsByQuery(products, query, maxResults),
    [products, query, maxResults]
  );

  const trimmed = query.trim();
  if (!trimmed) return null;

  return (
    <View style={[styles.dropdown, style]}>
      {results.length === 0 ? (
        <Text style={styles.noResults}>لا توجد نتائج لـ «{trimmed}»</Text>
      ) : (
        <ScrollView
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {results.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.resultRow}
              onPress={() => onSelect(product.id)}
            >
              <RemoteImage
                uri={resolveProductImage(product)}
                style={styles.resultImage}
                fallbackLabel={product.name}
              />
              <View style={styles.resultBody}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.resultPrice}>
                  {product.price.toLocaleString()} د.ع
                </Text>
              </View>
              <Ionicons name={forwardIconName} size={16} color={Colors.textLight} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: 280,
    overflow: 'hidden',
    ...Shadow.lg,
    ...Platform.select({
      android: { elevation: 24 },
      ios: { zIndex: 9999 },
      default: {},
    }),
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
    backgroundColor: Colors.surface,
  },
  resultImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceMuted,
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
    backgroundColor: Colors.surface,
  },
});
