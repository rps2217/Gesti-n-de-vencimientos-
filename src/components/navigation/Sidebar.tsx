import React from 'react';
import { 
  Database, FileSpreadsheet, Package, FileText, TableProperties, List, Settings, PanelLeftClose, PanelLeftOpen, PieChart
} from 'lucide-react';

interface SidebarItemProps {
  key?: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick, collapsed }) => {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
        active 
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <div className={`${active ? 'text-white' : 'text-slate-400'} shrink-0`}>
        {icon}
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
      {active && !collapsed && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
      )}
    </button>
  );
}

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  setSelectedProduct: (prod: any) => void;
  otherSheets: string[];
  onOpenConfig: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeView,
  setActiveView,
  setSelectedProduct,
  otherSheets,
  onOpenConfig
}) => {
  return (
    <div className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 transition-all duration-300`}>
      <div className={`p-4 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isSidebarCollapsed && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Módulos</p>}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" 
          title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <SidebarItem 
            icon={<Database className="w-5 h-5" />} 
            label="Vencimientos & Radar" 
            active={activeView === 'main'} 
            onClick={() => { setActiveView('main'); setSelectedProduct(null); }}
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            icon={<FileSpreadsheet className="w-5 h-5" />} 
            label="Incidencias & FRC" 
            active={activeView === 'events'} 
            onClick={() => { setActiveView('events'); setSelectedProduct(null); }}
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            icon={<Package className="w-5 h-5" />} 
            label="Catálogo Productos" 
            active={activeView === 'products'} 
            onClick={() => { setActiveView('products'); setSelectedProduct(null); }}
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            icon={<FileText className="w-5 h-5" />} 
            label="Políticas de Canje" 
            active={activeView === 'policies'} 
            onClick={() => { setActiveView('policies'); setSelectedProduct(null); }}
            collapsed={isSidebarCollapsed}
          />
          
          <div className="my-2 border-t border-slate-100"></div>
          
          <SidebarItem 
            icon={<TableProperties className="w-5 h-5" />} 
            label="Estructura de Datos" 
            active={activeView === 'schema'} 
            onClick={() => { setActiveView('schema'); setSelectedProduct(null); }}
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            icon={<PieChart className="w-5 h-5" />} 
            label="Analítica & Dashboard" 
            active={activeView === 'analytics'} 
            onClick={() => { setActiveView('analytics'); setSelectedProduct(null); }}
            collapsed={isSidebarCollapsed}
          />
        </div>

        {otherSheets.length > 0 && (
          <div>
            {!isSidebarCollapsed ? (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3 border-t border-slate-100 pt-6">Otras Pestañas</p>
            ) : (
              <div className="border-t border-slate-100 pt-6 mb-3 mx-2"></div>
            )}
            <div className="flex flex-col gap-1">
              {otherSheets.map((title: string) => (
                <SidebarItem 
                  key={title}
                  icon={<List className="w-5 h-5" />} 
                  label={title} 
                  active={activeView === title} 
                  onClick={() => { setActiveView(title); setSelectedProduct(null); }}
                  collapsed={isSidebarCollapsed}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <button 
          onClick={onOpenConfig} 
          title={isSidebarCollapsed ? "Configuración" : undefined}
          className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all`}
        >
          <Settings className="w-5 h-5 text-slate-400" />
          {!isSidebarCollapsed && "Configuración"}
        </button>
      </div>
    </div>
  );
};
