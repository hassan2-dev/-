import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../lib/theme';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/** يمنع الشاشة البيضاء الصامتة ويعرض سبب الكراش. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info?.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>حدث خطأ بالتطبيق</Text>
        <Text style={styles.sub}>انسخ الرسالة وأرسلها للدعم</Text>
        <ScrollView style={styles.box} contentContainerStyle={styles.boxInner}>
          <Text style={styles.msg} selectable>
            {error.message || String(error)}
          </Text>
        </ScrollView>
        <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.88}>
          <Text style={styles.btnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  sub: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
  },
  box: {
    maxHeight: 220,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boxInner: {
    padding: Spacing.md,
  },
  msg: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  btnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: FontSize.md,
  },
});
