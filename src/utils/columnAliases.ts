// Column Aliases and Smart Header Detection Engine
// Allows matching sheet headers regardless of accents, case, underscores, or abbreviations

export type KnownFieldSemantic = 
  | 'id'
  | 'sku'
  | 'descripcion'
  | 'fecha_vc'
  | 'fecha_retiro'
  | 'mes'
  | 'anio'
  | 'cantidad'
  | 'lote'
  | 'politica'
  | 'tipo_evento'
  | 'precio'
  | 'observacion'
  | 'proveedor'
  | 'dias_anticipacion';

const FIELD_PATTERNS: Record<KnownFieldSemantic, RegExp[]> = {
  id: [
    /^id_vc$/i,
    /^id_evento$/i,
    /^id_incidencia$/i,
    /^id_row$/i,
    /^id$/i,
    /^key$/i,
    /^codigo_id$/i,
    /^registro_id$/i,
    /^id_registro$/i,
    /^folio$/i,
    /^nro_registro$/i
  ],
  sku: [
    /^sku$/i,
    /^cod(_|\s)?(prod|producto|art|articulo|item|mat|material)?$/i,
    /^codigo(_|\s)?(de)?(_|\s)?(producto|articulo|item|material)?$/i,
    /^item(_|\s)?(code|id|num)?$/i,
    /^product(_|\s)?(id|code)?$/i,
    /^clave(_|\s)?(prod|producto)?$/i
  ],
  descripcion: [
    /^descripci[oó]n(_|\s)?(de)?(_|\s)?(producto|articulo|item|material)?$/i,
    /^producto$/i,
    /^articulo$/i,
    /^item(_|\s)?(name)?$/i,
    /^nombre(_|\s)?(de)?(_|\s)?(producto|articulo|item)?$/i,
    /^detalle(_|\s)?(producto)?$/i,
    /^denominaci[oó]n$/i
  ],
  fecha_vc: [
    /^fecha(_|\s)?(vc|vencimiento|caducidad|exp|expiracion|expiraci[oó]n)$/i,
    /^vencimiento$/i,
    /^caducidad$/i,
    /^expiraci[oó]n$/i,
    /^f(_|\s)?(venc|vto|cad|exp)$/i,
    /^vto$/i,
    /^fecha(_|\s)?vto$/i,
    /^expiry(_|\s)?date$/i,
    /^exp(_|\s)?date$/i
  ],
  fecha_retiro: [
    /^fecha(_|\s)?(retiro|canje|limite|l[ií]mite)$/i,
    /^retiro$/i,
    /^canje$/i,
    /^f(_|\s)?(retiro|canje)$/i,
    /^fecha(_|\s)?(limite|l[ií]mite)(_|\s)?(de)?(_|\s)?(retiro|canje)?$/i,
    /^withdrawal(_|\s)?date$/i,
    /^limit(_|\s)?date$/i
  ],
  mes: [
    /^mm$/i,
    /^mes$/i,
    /^month$/i,
    /^mes(_|\s)?(vc|vencimiento|caducidad)?$/i
  ],
  anio: [
    /^yyyy$/i,
    /^yy$/i,
    /^a[ñn]o$/i,
    /^year$/i,
    /^a[ñn]o(_|\s)?(vc|vencimiento|caducidad)?$/i
  ],
  cantidad: [
    /^cantidad$/i,
    /^cant$/i,
    /^unidades$/i,
    /^unid$/i,
    /^qty$/i,
    /^quantity$/i,
    /^stock$/i,
    /^total(_|\s)?unidades$/i,
    /^piezas$/i,
    /^pzas$/i,
    /^bultos$/i,
    /^cajas$/i,
    /^cantidad(_|\s)?(afectada|reportada|recibida|faltante|sobrante|averiada)?$/i
  ],
  lote: [
    /^lote$/i,
    /^batch$/i,
    /^n[uú]mero(_|\s)?(de)?(_|\s)?lote$/i,
    /^num(_|\s)?lote$/i,
    /^nro(_|\s)?lote$/i,
    /^no(_|\s)?lote$/i,
    /^lot(_|\s)?(number|no|num)?$/i
  ],
  politica: [
    /^pol[ií]tica$/i,
    /^pol[ií]tica(_|\s)?(de)?(_|\s)?(canje|retiro|devolucion|devoluci[oó]n)?$/i,
    /^tipo(_|\s)?(de)?(_|\s)?(pol[ií]tica|canje)$/i,
    /^regla(_|\s)?(canje|retiro)?$/i,
    /^policy$/i
  ],
  dias_anticipacion: [
    /^d[ií]as(_|\s)?(de)?(_|\s)?(anticipaci[oó]n|anticipacion|canje|retiro)?$/i,
    /^dias$/i,
    /^d[ií]as$/i,
    /^anticipaci[oó]n$/i,
    /^lead(_|\s)?time$/i,
    /^days$/i
  ],
  tipo_evento: [
    /^frc(_|\s)?even(to)?$/i,
    /^frc_even$/i,
    /^even$/i,
    /^tipo(_|\s)?(de)?(_|\s)?(evento|registro|incidencia|fallo|novedad)$/i,
    /^evento$/i,
    /^incidencia$/i,
    /^categor[ií]a(_|\s)?(evento|incidencia)?$/i,
    /^tipo$/i,
    /^motivo$/i,
    /^concepto$/i,
    /^event(_|\s)?type$/i
  ],
  precio: [
    /^precio$/i,
    /^costo$/i,
    /^precio(_|\s)?(unitario|venta|lista|compra|promedio)?$/i,
    /^costo(_|\s)?(unitario|promedio)?$/i,
    /^valor$/i,
    /^importe$/i,
    /^monto$/i,
    /^total$/i,
    /^price$/i,
    /^cost$/i
  ],
  observacion: [
    /^observaci[oó]n(es)?$/i,
    /^comentario(s)?$/i,
    /^nota(s)?$/i,
    /^detalle(_|\s)?(incidencia|adicional|evento)?$/i,
    /^descripci[oó]n(_|\s)?(falla|problema|incidencia)?$/i,
    /^remarks?$/i,
    /^notes?$/i,
    /^comments?$/i
  ],
  proveedor: [
    /^proveedor$/i,
    /^fabricante$/i,
    /^laboratorio$/i,
    /^distribuidor$/i,
    /^vendor$/i,
    /^supplier$/i
  ]
};

// Normalize text removing diacritics and special spaces for fuzzy comparisons
export function normalizeHeaderString(str: string): string {
  return str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_]+/g, '_')
    .toLowerCase();
}

/**
 * Finds the first column in the provided headers array that matches a semantic field
 */
export function findColumnBySemantic(headers: string[], semantic: KnownFieldSemantic): string | undefined {
  if (!headers || headers.length === 0) return undefined;
  
  const patterns = FIELD_PATTERNS[semantic];
  if (!patterns) return undefined;

  // 1. Direct regex match
  for (const header of headers) {
    const cleanHeader = header.trim();
    for (const pattern of patterns) {
      if (pattern.test(cleanHeader)) {
        return header;
      }
    }
  }

  // 2. Normalized fallback check
  for (const header of headers) {
    const norm = normalizeHeaderString(header);
    for (const pattern of patterns) {
      if (pattern.test(norm)) {
        return header;
      }
    }
  }

  return undefined;
}

/**
 * Extract a map of all detected semantic fields from headers
 */
export function detectAllColumnSemantics(headers: string[]): Partial<Record<KnownFieldSemantic, string>> {
  const map: Partial<Record<KnownFieldSemantic, string>> = {};
  const semantics: KnownFieldSemantic[] = [
    'id', 'sku', 'descripcion', 'fecha_vc', 'fecha_retiro', 'mes', 'anio', 
    'cantidad', 'lote', 'politica', 'dias_anticipacion', 'tipo_evento', 
    'precio', 'observacion', 'proveedor'
  ];

  semantics.forEach(semantic => {
    const matched = findColumnBySemantic(headers, semantic);
    if (matched) {
      map[semantic] = matched;
    }
  });

  return map;
}
