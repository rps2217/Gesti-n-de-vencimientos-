export interface SheetProperties {
  sheetId: number;
  title: string;
  hidden?: boolean;
  gridProperties?: {
    rowCount: number;
    columnCount: number;
  };
}

export interface SheetMetadata {
  spreadsheetId?: string;
  title?: string;
  sheets: {
    sheetId?: number;
    title?: string;
    properties: SheetProperties;
  }[];
}

export type SpreadsheetMetadata = SheetMetadata;

export interface SheetConfig {
  main?: string;
  events?: string;
  products?: string;
  policies?: string;
  schema?: Record<string, Record<string, ColumnSchema>>;
}

export type ColumnType = 'text' | 'longtext' | 'number' | 'date' | 'datetime' | 'enum' | 'enumlist' | 'ref' | 'calculated';
export type ColumnBehavior = 'none' | 'auto_id' | 'calc_fecha_vc' | 'calc_retiro' | 'sku_lookup';

export type EventCategory = 
  | 'VENCIMIENTO' 
  | 'VENCIMIENTO_CERCANO' 
  | 'TRANSPORTE' 
  | 'DIFERENCIA' 
  | 'CAL_INTERNA'
  | 'CAL_EXTERNA'
  | 'AVERIA' 
  | 'DEVOLUCION' 
  | 'CANJES';

export interface EventTypeDefinition {
  id: EventCategory;
  rawCode: string;
  name: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  cardBg: string;
  iconBg: string;
  isVencimiento?: boolean;
}

export interface ColumnSchema {
  visible: boolean;
  searchable: boolean;
  type: ColumnType;
  behavior: ColumnBehavior;
  options?: string; // Comma-separated options for enum and enumlist
  formula?: string;
  isKey?: boolean; // Primary key for table relation
  isLabel?: boolean; // Main display label when referenced
  refTable?: string; // Target sheet name when type is 'ref'
  refKeyCol?: string; // Target key column
  refLabelCol?: string; // Target label column
}

export interface InventoryItem {
  _rowIndex: number; // Row number in the sheet for update/delete operations
  [key: string]: any; // Dynamic columns based on the sheet's headers
}
