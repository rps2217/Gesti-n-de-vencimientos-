export const SAMPLE_HEADERS = [
  "SKU",
  "DESCRIPCION",
  "LOTE",
  "FECHA_VENCIMIENTO",
  "CANTIDAD",
  "PRECIO_COSTO",
  "PROVEEDOR",
  "TIPO_EVENTO",
  "OBSERVACION"
];

export const SAMPLE_ITEMS = [
  {
    _rowIndex: 2,
    SKU: "SKU-1001",
    DESCRIPCION: "Leche Entera UHT 1L",
    LOTE: "L-8821",
    FECHA_VENCIMIENTO: "2026-09-05",
    CANTIDAD: "320",
    PRECIO_COSTO: "1.25",
    PROVEEDOR: "Lácteos del Sur S.A.",
    TIPO_EVENTO: "VENCIMIENTO",
    OBSERVACION: "Próximo a retiro comercial por política de 15 días"
  },
  {
    _rowIndex: 3,
    SKU: "SKU-1002",
    DESCRIPCION: "Yogurt Batido Fresa 125g",
    LOTE: "L-9012",
    FECHA_VENCIMIENTO: "2026-08-22",
    CANTIDAD: "85",
    PRECIO_COSTO: "0.60",
    PROVEEDOR: "Lácteos del Sur S.A.",
    TIPO_EVENTO: "VENCIMIENTO",
    OBSERVACION: "Alerta crítica: Retiro inmediato o liquidación PM"
  },
  {
    _rowIndex: 4,
    SKU: "SKU-2045",
    DESCRIPCION: "Atún en Aceite Lata 140g",
    LOTE: "L-3310",
    FECHA_VENCIMIENTO: "2027-03-15",
    CANTIDAD: "1250",
    PRECIO_COSTO: "2.10",
    PROVEEDOR: "Pesquera Mar Azul",
    TIPO_EVENTO: "TRANSPORTE",
    OBSERVACION: "Llegó con 3 latas abolladas por manipulación de transporte"
  },
  {
    _rowIndex: 5,
    SKU: "SKU-3091",
    DESCRIPCION: "Detergente Líquido 3L",
    LOTE: "L-5541",
    FECHA_VENCIMIENTO: "2028-01-10",
    CANTIDAD: "410",
    PRECIO_COSTO: "5.80",
    PROVEEDOR: "Kimberly Clean",
    TIPO_EVENTO: "DIFERENCIAS",
    OBSERVACION: "Diferencia de inventario física vs sistema: -5 unidades"
  },
  {
    _rowIndex: 6,
    SKU: "SKU-4022",
    DESCRIPCION: "Pan de Molde Integral 500g",
    LOTE: "L-7719",
    FECHA_VENCIMIENTO: "2026-08-21",
    CANTIDAD: "45",
    PRECIO_COSTO: "1.80",
    PROVEEDOR: "Panificadora Central",
    TIPO_EVENTO: "MERMAS",
    OBSERVACION: "Merma por aplastamiento en anaquel"
  }
];

export const SAMPLE_PRODUCTS = [
  { SKU: "SKU-1001", DESCRIPCION: "Leche Entera UHT 1L", PRECIO_COSTO: "1.25", PROVEEDOR: "Lácteos del Sur S.A." },
  { SKU: "SKU-1002", DESCRIPCION: "Yogurt Batido Fresa 125g", PRECIO_COSTO: "0.60", PROVEEDOR: "Lácteos del Sur S.A." },
  { SKU: "SKU-2045", DESCRIPCION: "Atún en Aceite Lata 140g", PRECIO_COSTO: "2.10", PROVEEDOR: "Pesquera Mar Azul" },
  { SKU: "SKU-3091", DESCRIPCION: "Detergente Líquido 3L", PRECIO_COSTO: "5.80", PROVEEDOR: "Kimberly Clean" },
  { SKU: "SKU-4022", DESCRIPCION: "Pan de Molde Integral 500g", PRECIO_COSTO: "1.80", PROVEEDOR: "Panificadora Central" }
];

export const SAMPLE_POLICIES = [
  { FAMILIA: "Lácteos", DIAS_RETIRO: "15", ACCION: "Liquidación PM / Donación" },
  { FAMILIA: "Abarrotes", DIAS_RETIRO: "30", ACCION: "Devolución a Proveedor" },
  { FAMILIA: "Limpieza", DIAS_RETIRO: "60", ACCION: "Revision de Calidad" }
];
