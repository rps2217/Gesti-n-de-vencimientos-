import React, { useState, useRef } from 'react';
import { Trash2, PlusCircle, FileText } from 'lucide-react';
import { COLUMNAS_OBJETIVO, encontrarColumnaPorSinonimo, limpiarTexto, DICCIONARIO_SINONIMOS } from '../utils/mappingUtils';

interface BulkImportFRCProps {
  onImport: (data: any[]) => void;
}

export const BulkImportFRC: React.FC<BulkImportFRCProps> = ({ onImport }) => {
  const [datosMapeados, setDatosMapeados] = useState<any[]>([]);
  const [status, setStatus] = useState<{ mensaje: string; tipo: 'success' | 'error' | 'info' } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const procesarPortapapeles = (texto: string) => {
    const lineasOriginales = texto.split(/\r\n|\n/).map(l => l.trim());
    const lineas = lineasOriginales.filter(l => l !== "" && !["▼", "▲", "▶", "◀"].includes(l));

    if (lineas.length < 2) {
      setStatus({ mensaje: "El texto pegado no contiene suficientes filas válidas.", tipo: "error" });
      return;
    }

    let cabecerasOrigen: string[] = [];
    let filasDatos: string[][] = [];

    if (lineasOriginales[0].includes('\t')) {
      cabecerasOrigen = lineasOriginales[0].split('\t').map(c => c.replace(/[▼▲▶◀]/g, "").trim());
      filasDatos = lineasOriginales.slice(1).filter(l => l.trim() !== "").map(l => l.split('\t'));
    } else {
        const todasLasCabeceras = Object.values(DICCIONARIO_SINONIMOS).flat().map(limpiarTexto);
        let indicePrimerDato = lineas.findIndex(l => !todasLasCabeceras.includes(limpiarTexto(l)));
        
        if (indicePrimerDato > 0) {
            cabecerasOrigen = lineas.slice(0, indicePrimerDato);
            const datosPuros = lineas.slice(indicePrimerDato);
            const anchoTabla = cabecerasOrigen.length;
            for (let f = 0; f < datosPuros.length; f += anchoTabla) {
                const subFila = datosPuros.slice(f, f + anchoTabla);
                if (subFila.length === anchoTabla) filasDatos.push(subFila);
            }
        }
    }

    const nuevosDatos = filasDatos.map(celdas => {
      const filaObjeto: Record<string, string> = {};
      COLUMNAS_OBJETIVO.forEach(colDestino => {
        if (colDestino === "ID_FRC") {
          filaObjeto[colDestino] = crypto.randomUUID(); 
        } else {
          const indexOrigen = encontrarColumnaPorSinonimo(colDestino, cabecerasOrigen);
          filaObjeto[colDestino] = (indexOrigen > -1 && celdas[indexOrigen]) ? celdas[indexOrigen].trim() : "";
        }
      });
      return filaObjeto;
    });

    setDatosMapeados(nuevosDatos);
    setStatus({ mensaje: `Mapeo completado: ${nuevosDatos.length} filas listas.`, tipo: "info" });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedData = e.clipboardData.getData('Text');
    if (pastedData.trim()) procesarPortapapeles(pastedData);
  };

  const eliminarFila = (index: number) => {
    setDatosMapeados(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    onImport(datosMapeados);
    setStatus({ mensaje: `Se han importado ${datosMapeados.length} registros exitosamente.`, tipo: "success" });
    setDatosMapeados([]);
    if (textAreaRef.current) textAreaRef.current.value = '';
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-md font-bold text-slate-800 mb-2 flex items-center gap-2">
        <FileText size={18} className="text-blue-600" /> Importación Inteligente FRC
      </h3>
      <p className="text-xs text-slate-600 mb-3">Haz clic en el área abajo y pega (Ctrl+V) tus datos (Looker/Excel):</p>
      <textarea 
        ref={textAreaRef} 
        onPaste={handlePaste} 
        className="w-full h-24 border border-slate-300 p-3 rounded-md text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors" 
        placeholder="Pega aquí los datos..." 
      />
      
      {status && <div className={`mt-3 p-2 text-center rounded text-xs font-semibold ${status.tipo === 'success' ? 'bg-green-50 text-green-700' : status.tipo === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{status.mensaje}</div>}
      
      <button 
        onClick={handleImport} 
        disabled={datosMapeados.length === 0} 
        className="w-full mt-3 bg-blue-600 text-white text-sm font-bold py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
      >
        <PlusCircle size={16} /> Importar al Dashboard
      </button>
      
      {datosMapeados.length > 0 && (
        <div className="mt-4 overflow-x-auto max-h-60 border border-slate-200 rounded-md">
          <table className="w-full text-[10px] border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0">
              <tr>
                <th className="p-2 border">Acción</th>
                {COLUMNAS_OBJETIVO.map(c => <th key={c} className="p-2 border">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {datosMapeados.map((fila, index) => (
                <tr key={index} className="border-b hover:bg-slate-50">
                  <td className="p-2 text-center"><button onClick={() => eliminarFila(index)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></td>
                  {COLUMNAS_OBJETIVO.map(c => <td key={c} className="p-2 border">{fila[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
