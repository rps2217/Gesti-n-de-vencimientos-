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

export interface UserVirtualColumn {
  id: string;
  label: string;
  operation: 'concatenate' | 'sum' | 'diff_days';
  sourceColumns: string[];
}

export interface TableBulkActionSetting {
  enabled?: string[];
  disabled?: string[];
}

export interface SheetConfig {
  main?: string;
  events?: string;
  products?: string;
  policies?: string;
  schema?: Record<string, Record<string, ColumnSchema>>;
  activeVirtualColumns?: string[];
  userVirtualColumns?: UserVirtualColumn[];
  customAliases?: Record<string, string[]>;
  tableBulkActions?: Record<string, TableBulkActionSetting>;
  slices?: TableSlice[];
}

export type ColumnType = 'text' | 'longtext' | 'number' | 'date' | 'datetime' | 'enum' | 'enumlist' | 'ref' | 'calculated' | 'virtual';

export interface VirtualColumn {
  id: string;
  label: string;
  supportedViews?: Array<'main' | 'events' | 'products' | 'policies'>;
  calculate: (item: any, headers: any, allData?: any) => any;
}
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

export type ResolutionStatus = 'PENDIENTE' | 'REALIZADO';

export interface EventResolutionStatus {
  isResolved: boolean;
  status: ResolutionStatus;
  label: string;
  traspasoNumber: string;
  traspasoColumn?: string;
}

export interface InventoryItem {
  _rowIndex: number; // Row number in the sheet for update/delete operations
  _entityKey?: string; // Stable business primary key or composite identity
  _entityKeyCol?: string; // Column name that holds the primary key
  _isSyntheticKey?: boolean; // Whether the key was auto-generated or derived from business fields
  [key: string]: any; // Dynamic columns based on the sheet's headers
}


export interface TicketColumnConfig {
  show: boolean;
  size: number;
  bold: boolean;
}
export type ViewTicketConfig = Record<string, TicketColumnConfig>;
export type GlobalTicketConfig = Record<string, ViewTicketConfig>;

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  column: string | null;
  direction: SortDirection;
}

export type SliceColor = 'blue' | 'rose' | 'amber' | 'emerald' | 'purple' | 'indigo' | 'slate';

export interface DynamicMonthRange {
  startOffset: number; // Offset respecto al mes actual (0 = mes en curso, +1 = próximo mes, +2 = en 2 meses...)
  endOffset: number;   // Offset final inclusive (ej. +4 = hasta 4 meses adelante)
}

export interface SliceFilterConfig {
  searchTerm?: string;
  quickChip?: string | null;
  eventFilter?: string[];
  pmRadarFilter?: string[];
  eventResolutionFilter?: ('pending' | 'completed')[];
  frcBodFilter?: string[];
  columnFilters?: Record<string, string[]>;
  dynamicMonthFilter?: number[];
  dynamicMonthRange?: DynamicMonthRange;
}

export interface TableSlice {
  id: string;
  name: string;
  description?: string;
  tableKey: string; // 'main' | 'events' | 'products' | 'policies' or custom sheet title
  icon?: string; // Lucide icon identifier
  color?: SliceColor;
  isBuiltIn?: boolean;
  filterConfig: SliceFilterConfig;
  sortConfig?: SortConfig;
  groupByColumn?: string;
  visibleColumns?: string[];
}
