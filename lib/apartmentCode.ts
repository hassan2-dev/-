export interface ApartmentBlockConfig {
  id: string;
  label: string;
  buildings: number;
}

/** بيانات المجمع — عدد البنايات لكل بلوك */
export const APARTMENT_BLOCKS: ApartmentBlockConfig[] = [
  { id: 'A1', label: 'A1', buildings: 12 },
  { id: 'A2', label: 'A2', buildings: 14 },
  { id: 'A3', label: 'A3', buildings: 14 },
  { id: 'A4', label: 'A4', buildings: 12 },
  { id: 'A5', label: 'A5', buildings: 12 },
  { id: 'A6', label: 'A6', buildings: 12 },
  { id: 'A7', label: 'A7', buildings: 13 },
  { id: 'A8', label: 'A8', buildings: 15 },
  { id: 'A9', label: 'A9', buildings: 15 },
  { id: 'B1', label: 'B1', buildings: 12 },
  { id: 'B2', label: 'B2', buildings: 17 },
  { id: 'B3', label: 'B3', buildings: 18 },
  { id: 'B8', label: 'B8', buildings: 12 },
];

export const APARTMENT_FLOORS: { value: string; label: string }[] = [
  { value: 'G', label: 'الأرضي' },
  { value: '01', label: 'الطابق الأول' },
  { value: '02', label: 'الطابق الثاني' },
  { value: '03', label: 'الطابق الثالث' },
  { value: '04', label: 'الطابق الرابع' },
  { value: '05', label: 'الطابق الخامس' },
  { value: '06', label: 'الطابق السادس' },
  { value: '07', label: 'الطابق السابع' },
  { value: '08', label: 'الطابق الثامن' },
  { value: '09', label: 'الطابق التاسع' },
];

export const APARTMENTS_PER_FLOOR = 12;

export interface ApartmentSelection {
  block: string;
  building: number;
  floor: string;
  apartment: number;
}

export function getBlockConfig(blockId: string): ApartmentBlockConfig | undefined {
  return APARTMENT_BLOCKS.find((b) => b.id === blockId);
}

export function getBuildingOptions(blockId: string): number[] {
  const config = getBlockConfig(blockId);
  if (!config) return [];
  return Array.from({ length: config.buildings }, (_, i) => i + 1);
}

export function getApartmentOptions(): number[] {
  return Array.from({ length: APARTMENTS_PER_FLOOR }, (_, i) => i + 1);
}

/** `${block}-${building.padStart(2,'0')}-${floor}-${apartment.padStart(2,'0')}` */
export function buildApartmentCode(selection: ApartmentSelection): string {
  const building = String(selection.building).padStart(2, '0');
  const apartment = String(selection.apartment).padStart(2, '0');
  const floor = selection.floor === 'G' ? 'G' : String(selection.floor).padStart(2, '0');
  return `${selection.block}-${building}-${floor}-${apartment}`;
}

const CODE_REGEX = /^([AB]\d)-(\d{2})-(G|\d{2})-(\d{2})$/;

export function parseApartmentCode(code: string): ApartmentSelection | null {
  const trimmed = code.trim().toUpperCase();
  const match = trimmed.match(CODE_REGEX);
  if (!match) return null;

  const [, block, buildingStr, floorRaw, apartmentStr] = match;
  const building = parseInt(buildingStr, 10);
  const apartment = parseInt(apartmentStr, 10);
  const floor = floorRaw === 'G' ? 'G' : floorRaw;

  const config = getBlockConfig(block);
  if (!config || building < 1 || building > config.buildings) return null;
  if (!APARTMENT_FLOORS.some((f) => f.value === floor)) return null;
  if (apartment < 1 || apartment > APARTMENTS_PER_FLOOR) return null;

  return { block, building, floor, apartment };
}

export function isApartmentSelectionComplete(
  selection: Partial<ApartmentSelection>
): selection is ApartmentSelection {
  return (
    !!selection.block &&
    typeof selection.building === 'number' &&
    selection.building > 0 &&
    !!selection.floor &&
    typeof selection.apartment === 'number' &&
    selection.apartment > 0
  );
}

export function getFloorLabel(floor: string): string {
  return APARTMENT_FLOORS.find((f) => f.value === floor)?.label ?? floor;
}

export function formatApartmentSummary(selection: ApartmentSelection): string {
  return `بلوك ${selection.block} · بناية ${String(selection.building).padStart(2, '0')} · ${getFloorLabel(selection.floor)} · شقة ${String(selection.apartment).padStart(2, '0')}`;
}

export const DEFAULT_APARTMENT_SELECTION: Partial<ApartmentSelection> = {};
