import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, Phone, User, ExternalLink, CheckCircle } from 'lucide-react';
import { findPhoneColumn } from '../../utils/columnAliases';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: any[];
  headers: string[];
  activeViewTitle?: string;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  headers,
  activeViewTitle = 'Contactos'
}) => {
  const [message, setMessage] = useState('');
  const [selectedContactIndex, setSelectedContactIndex] = useState<number>(0);

  // Find telephone column
  const phoneColumn = useMemo(() => {
    if (!headers || headers.length === 0) {
      if (selectedItems[0]) {
        const sampleHeaders = Object.keys(selectedItems[0]);
        return findPhoneColumn(sampleHeaders) || sampleHeaders.find(h => /tel|cel|phone/i.test(h));
      }
      return undefined;
    }
    return findPhoneColumn(headers) || headers.find(h => /tel|cel|phone/i.test(h));
  }, [headers, selectedItems]);

  // Find name or label column
  const nameColumn = useMemo(() => {
    const rawCols = (headers && headers.length > 0) ? headers : (selectedItems[0] ? Object.keys(selectedItems[0]) : []);
    return rawCols.find(h => /nombre|name|contacto|razon|cliente|proveedor/i.test(h)) || rawCols[0];
  }, [headers, selectedItems]);

  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      setMessage(`Hola, nos comunicamos desde el sistema de gestión (${activeViewTitle}). Tenemos información importante respecto a sus registros de inventario y vencimientos (${todayStr}). Quedamos atentos a su respuesta.`);
      setSelectedContactIndex(0);
    }
  }, [isOpen, activeViewTitle]);

  if (!isOpen) return null;

  const validContacts = selectedItems.filter(item => {
    const phone = phoneColumn ? item[phoneColumn] : null;
    return phone !== undefined && phone !== null && String(phone).trim() !== '';
  });

  const currentContact = validContacts[selectedContactIndex] || selectedItems[0];
  const currentPhone = phoneColumn && currentContact ? String(currentContact[phoneColumn] || '').replace(/[^\d+]/g, '') : '';
  const currentName = nameColumn && currentContact ? String(currentContact[nameColumn] || 'Contacto') : 'Contacto';

  const handleSendWhatsApp = (contactItem?: any) => {
    const targetItem = contactItem || currentContact;
    if (!targetItem || !phoneColumn) return;

    const rawPhone = String(targetItem[phoneColumn] || '').replace(/[^\d+]/g, '');
    if (!rawPhone) {
      alert('El contacto seleccionado no cuenta con un número de teléfono válido.');
      return;
    }

    const encodedMsg = encodeURIComponent(message);
    const url = `https://wa.me/${rawPhone}?text=${encodedMsg}`;
    window.open(url, '_blank');
  };

  const handleSendAll = () => {
    validContacts.forEach((item, idx) => {
      const rawPhone = String(item[phoneColumn || ''] || '').replace(/[^\d+]/g, '');
      if (rawPhone) {
        const url = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
        setTimeout(() => {
          window.open(url, '_blank');
        }, idx * 600); // Stagger opening tabs slightly so browser doesn't block
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Enviar Mensaje por WhatsApp Web</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {validContacts.length} contacto(s) con teléfono válido de {selectedItems.length} seleccionado(s)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          
          {!phoneColumn ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              ⚠️ No se ha detectado automáticamente una columna de tipo <strong>TELEFONO</strong> en esta tabla. Asegúrate de que exista una columna llamada 'TELEFONO', 'CELULAR' o 'PHONE'.
            </div>
          ) : null}

          {/* Contact Selector */}
          {validContacts.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Contacto Actual ({selectedContactIndex + 1} de {validContacts.length})
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={selectedContactIndex}
                onChange={(e) => setSelectedContactIndex(Number(e.target.value))}
              >
                {validContacts.map((item, idx) => (
                  <option key={idx} value={idx}>
                    {nameColumn ? String(item[nameColumn] || `Contacto ${idx + 1}`) : `Contacto ${idx + 1}`} ({phoneColumn ? item[phoneColumn] : 'Sin teléfono'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current Contact Preview Card */}
          {currentContact && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                  {currentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{currentName}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                    <Phone className="w-3 h-3 text-emerald-600" /> {currentPhone || 'Sin teléfono válido'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSendWhatsApp(currentContact)}
                disabled={!currentPhone}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" /> Enviar a este contacto
              </button>
            </div>
          )}

          {/* Predefined Message Editor */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Mensaje Predefinido para WhatsApp
              </label>
              <span className="text-[10px] text-slate-400">Puedes editar el texto libremente antes de enviar</span>
            </div>
            <textarea
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje predefinido..."
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <div className="flex items-center gap-2">
            {validContacts.length > 1 && (
              <button
                onClick={handleSendAll}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Enviar a Todos ({validContacts.length})
              </button>
            )}
            <button
              onClick={() => handleSendWhatsApp()}
              disabled={!currentPhone}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" /> Abrir WhatsApp Web
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
