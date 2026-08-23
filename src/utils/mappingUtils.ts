export const DICCIONARIO_SINONIMOS: Record<string, string[]> = {
  "FRC_N": ["FOLIO", "FRC_N", "N° FRC", "Folio Único", "NUMERO FRC", "FRC"],
  "FRC_SKU": ["FRC_SKU", "EVSKU_EV", "SKU", "CÓDIGO", "CODIGO", "ITEM"],
  "FRC_DESC": ["FRC_DESC", "PRODUCTO_EV", "PRODUCTO", "DESCRIPCIÓN", "DESCRIPCION", "NOMBRE"],
  "FRC_LOTE": ["FRC_LOTE", "LOTE", "N° LOTE", "LOT"],
  "FRC_VENCE": ["FRC_VENCE", "FECHAINGRESO_EV", "VENCIMIENTO", "VENCE", "FECHA_VENCE", "F. VENCE"],
  "FRC_RESOLUCION": ["Resolución (AB)", "ESTADO", "OBSERVACION", "OBSERVACIÓN", "RESOLUCION", "RESOLUCIÓN"],
  "N_TRASPASO": ["N_TRASPASO", "TRASPASO", "N° TRASPASO", "NUMERO TRASPASO"],
  "FRC_CANT": ["FRC_CANT", "UNIDADES", "CANTIDAD", "CANT", "DIFERENCIA", "Guía dice", "Dif."],
  "FRC_BOD": ["FRC_BOD", "DESTINOTRASPASO", "DESTINO", "BODEGA", "BOD"],
  "FRC_EVEN": ["FRC_EVEN", "EVENTO_TIPO", "TIPO EVENTO"],
};

export const COLUMNAS_OBJETIVO = [
  "FRC_N", "FRC_SKU", "FRC_DESC", "FRC_LOTE", "FRC_VENCE",
  "FRC_RESOLUCION", "N_TRASPASO", "FRC_CANT", "FRC_BOD", "FRC_EVEN", "ID_FRC"
];

export const limpiarTexto = (texto: string) => {
  return texto.toString().replace(/[▼▲▶◀•▪🔹]/g, "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const encontrarColumnaPorSinonimo = (columnaDestino: string, cabecerasOrigen: string[]) => {
  const aliasPermitidos = DICCIONARIO_SINONIMOS[columnaDestino] || [columnaDestino];
  const aliasLimpios = aliasPermitidos.map(limpiarTexto);
  const cabecerasLimpias = cabecerasOrigen.map(limpiarTexto);

  for (let i = 0; i < cabecerasLimpias.length; i++) {
    if (aliasLimpios.includes(cabecerasLimpias[i])) return i;
  }
  return -1;
};
