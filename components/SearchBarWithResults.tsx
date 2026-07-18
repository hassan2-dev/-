import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Shadow } from '../lib/theme';
import { rtlInput } from '../lib/rtl';
import { Product } from '../lib/types';
import SearchResultsDropdown from './SearchResultsDropdown';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  products: Product[];
  onSelectProduct: (productId: string) => void;
  placeholder?: string;
  maxResults?: number;
  /** Floating dropdown under the bar. Prefer inline results on the page instead. */
  showDropdown?: boolean;
}

export default function SearchBarWithResults({
  value,
  onChangeText,
  products,
  onSelectProduct,
  placeholder = 'ابحث عن منتج...',
  maxResults = 12,
  showDropdown = true,
}: Props) {
  const shouldShowDropdown = showDropdown && value.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        <View style={styles.searchIcon}>
          <Ionicons name="search" size={18} color={Colors.primary} />
        </View>
        <TextInput
          style={[styles.input, rtlInput]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          autoCorrect={false}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {shouldShowDropdown ? (
        <View style={styles.dropdownAnchor} pointerEvents="box-none">
          <SearchResultsDropdown
            query={value}
            products={products}
            maxResults={maxResults}
            onSelect={(productId) => {
              onSelectProduct(productId);
              onChangeText('');
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 1000,
    ...Platform.select({
      android: { elevation: 1000 },
      default: {},
    }),
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: Spacing.sm,
    ...Shadow.md,
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
  dropdownAnchor: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: Spacing.sm,
    zIndex: 1001,
    ...Platform.select({
      android: { elevation: 1001 },
      default: {},
    }),
  },
});
