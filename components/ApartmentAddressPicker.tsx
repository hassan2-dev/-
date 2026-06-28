import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../lib/theme';
import {
  APARTMENT_BLOCKS,
  APARTMENT_FLOORS,
  ApartmentSelection,
  buildApartmentCode,
  formatApartmentSummary,
  getApartmentOptions,
  getBuildingOptions,
  getFloorLabel,
  isApartmentSelectionComplete,
} from '../lib/apartmentCode';
import { persistApartmentIfComplete } from '../lib/customerProfile';

type FieldKey = 'building' | 'floor' | 'apartment';

interface Props {
  value: Partial<ApartmentSelection>;
  onChange: (value: Partial<ApartmentSelection>) => void;
  autoSave?: boolean;
  onSaved?: (code: string) => void;
  /** داخل FormSection — بدون إطار مكرر أو صندوق الكود */
  embedded?: boolean;
}

type Option = { value: string; label: string };

export default function ApartmentAddressPicker({
  value,
  onChange,
  autoSave = true,
  onSaved,
  embedded = false,
}: Props) {
  const [openField, setOpenField] = useState<FieldKey | null>(null);
  const [savedCode, setSavedCode] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const block = value.block;
  const isComplete = isApartmentSelectionComplete(value);
  const generatedCode = isComplete ? buildApartmentCode(value) : '';
  const summary = isComplete ? formatApartmentSummary(value) : '';
  const isSaved = isComplete && savedCode === generatedCode;

  const blockGroups = useMemo(() => {
    const aBlocks = APARTMENT_BLOCKS.filter((b) => b.id.startsWith('A'));
    const bBlocks = APARTMENT_BLOCKS.filter((b) => b.id.startsWith('B'));
    return [
      { title: 'البلوك A', blocks: aBlocks },
      { title: 'البلوك B', blocks: bBlocks },
    ];
  }, []);

  const modalOptions: Option[] = useMemo(() => {
    if (!block) return [];
    if (openField === 'building') {
      return getBuildingOptions(block).map((n) => ({
        value: String(n),
        label: String(n).padStart(2, '0'),
      }));
    }
    if (openField === 'floor') {
      return APARTMENT_FLOORS.map((f) => ({ value: f.value, label: f.label }));
    }
    if (openField === 'apartment') {
      return getApartmentOptions().map((n) => ({
        value: String(n),
        label: String(n).padStart(2, '0'),
      }));
    }
    return [];
  }, [openField, block]);

  const modalTitle =
    openField === 'building' ? 'اختر البناية' : openField === 'floor' ? 'اختر الطابق' : 'اختر الشقة';

  const handleBlockSelect = (blockId: string) => {
    if (block === blockId) return;
    onChange({ block: blockId });
  };

  const openPicker = (field: FieldKey) => {
    if (!block) return;
    setOpenField(field);
  };

  const handleModalSelect = (selected: string) => {
    if (!block) return;
    if (openField === 'building') {
      onChange({ ...value, block, building: parseInt(selected, 10) });
    } else if (openField === 'floor') {
      onChange({ ...value, block, floor: selected });
    } else if (openField === 'apartment') {
      onChange({ ...value, block, apartment: parseInt(selected, 10) });
    }
    setOpenField(null);
  };

  useEffect(() => {
    if (!isComplete) {
      setSavedCode('');
      return;
    }
    if (!autoSave) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const code = await persistApartmentIfComplete(value);
        if (code) {
          setSavedCode(code);
          onSaved?.(code);
        }
      } finally {
        setSaving(false);
      }
    }, 400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [value, autoSave, isComplete, onSaved]);

  const pickerCells: { key: FieldKey; label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      key: 'building',
      label: 'البناية',
      value: value.building ? String(value.building).padStart(2, '0') : '—',
      icon: 'business-outline',
    },
    {
      key: 'floor',
      label: 'الطابق',
      value: value.floor ? (value.floor === 'G' ? 'G' : value.floor) : '—',
      icon: 'layers-outline',
    },
    {
      key: 'apartment',
      label: 'الشقة',
      value: value.apartment ? String(value.apartment).padStart(2, '0') : '—',
      icon: 'home-outline',
    },
  ];

  const steps = [
    { label: 'البلوك', done: !!block },
    { label: pickerCells[0].label, done: !!value.building },
    { label: pickerCells[1].label, done: !!value.floor },
    { label: pickerCells[2].label, done: !!value.apartment },
  ];

  const content = (
    <>
      {embedded ? (
        <View style={styles.stepsRow}>
          {steps.map((step, index) => (
            <View key={step.label} style={styles.stepItem}>
              <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={12} color={Colors.white} />
                ) : (
                  <Text style={styles.stepNum}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!embedded ? (
        <View style={styles.cardHeader}>
          <View style={styles.headerIcon}>
            <Ionicons name="location" size={20} color={Colors.white} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>موقع الشقة</Text>
            <Text style={styles.cardSub}>اختر البلوك ثم البناية والطابق والشقة</Text>
          </View>
        </View>
      ) : null}

      {blockGroups.map((group) => (
        <View key={group.title} style={styles.blockSection}>
          <Text style={styles.blockSectionTitle}>{group.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {group.blocks.map((b) => {
              const active = block === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleBlockSelect(b.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.id}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}

      <View style={styles.gridRow}>
        {pickerCells.map((cell) => (
          <TouchableOpacity
            key={cell.key}
            style={[styles.gridCell, !block && styles.gridCellDisabled]}
            onPress={() => openPicker(cell.key)}
            activeOpacity={0.88}
            disabled={!block}
          >
            <Ionicons name={cell.icon} size={18} color={Colors.primary} />
            <Text style={styles.gridLabel}>{cell.label}</Text>
            <Text style={styles.gridValue}>{cell.value}</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textLight} />
          </TouchableOpacity>
        ))}
      </View>

      {!embedded ? (
        <View style={[styles.codeCard, isSaved && styles.codeCardReady]}>
          <View style={styles.codeTop}>
            <Text style={styles.codeLabel}>كود التوصيل</Text>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : isSaved ? (
              <View style={styles.savedPill}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primaryDark} />
                <Text style={styles.savedText}>محفوظ</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.codeValue, !isComplete && styles.codePlaceholder]}>
            {generatedCode || '— — — —'}
          </Text>
          {isComplete ? (
            <Text style={styles.summaryText} numberOfLines={2}>
              {summary}
            </Text>
          ) : (
            <Text style={styles.hintText}>
              {block ? 'اختر البناية والطابق والشقة' : 'اختر البلوك أولاً'}
            </Text>
          )}
        </View>
      ) : null}

      <Modal
        visible={!!openField}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenField(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOpenField(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setOpenField(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textGray} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>بلوك {block}</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                openField === 'floor' ? styles.floorList : styles.numGrid
              }
            >
              {modalOptions.map((item) => {
                const selected =
                  openField === 'building'
                    ? item.value === String(value.building ?? '')
                    : openField === 'floor'
                      ? item.value === value.floor
                      : item.value === String(value.apartment ?? '');

                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      openField === 'floor' ? styles.floorOption : styles.numOption,
                      selected && styles.optionSelected,
                    ]}
                    onPress={() => handleModalSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  return embedded ? <View style={styles.embedded}>{content}</View> : <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  embedded: {
    gap: Spacing.lg,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepNum: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textGray,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textLight,
    textAlign: 'center',
  },
  stepLabelDone: {
    color: Colors.primaryDark,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
  },
  cardSub: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 2,
  },
  blockSection: { gap: Spacing.sm },
  blockSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textGray,
    textAlign: 'right',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    minWidth: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.textGray,
  },
  chipTextActive: {
    color: Colors.primaryDark,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gridCell: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  gridCellDisabled: {
    opacity: 0.45,
  },
  gridLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textGray,
  },
  gridValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textDark,
  },
  codeCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  codeCardReady: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  codeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textGray,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  savedText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  codeValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primaryDark,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  codePlaceholder: {
    color: Colors.textLight,
    opacity: 0.5,
  },
  summaryText: {
    fontSize: FontSize.xs,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 18,
  },
  hintText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '65%',
    paddingBottom: Spacing.xxl,
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'right',
    flex: 1,
  },
  modalSub: {
    fontSize: FontSize.sm,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  numGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  floorList: {
    paddingBottom: Spacing.lg,
  },
  numOption: {
    width: '22%',
    minWidth: 72,
    aspectRatio: 1.15,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  optionSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDark,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
});
