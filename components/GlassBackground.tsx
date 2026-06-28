import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../lib/theme';

export default function GlassBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
});
