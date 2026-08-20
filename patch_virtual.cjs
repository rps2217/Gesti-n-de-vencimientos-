const fs = require('fs');
const content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');
let lines = content.split('\n');

// 1. Add imports
const importIndex = lines.findIndex(l => l.includes("import { z } from 'zod';"));
lines.splice(importIndex + 1, 0, "import { useVirtualizer } from '@tanstack/react-virtual';");

// 2. Add ref inside InventoryDashboard
const stateIndex = lines.findIndex(l => l.includes("const [activeView, setActiveView]"));
lines.splice(stateIndex, 0, "  const tableContainerRef = useRef<HTMLDivElement>(null);");

// 3. Create virtualizer hook below useMemo for filteredItems
const filteredItemsEndIndex = lines.findIndex(l => l.includes("}, [items, searchTerm, activeQuickChip, searchableHeaders, activeView, eventFilter, pmRadarFilter, headers]);"));
lines.splice(filteredItemsEndIndex + 1, 0, `
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 64, // Approximate row height (padding 16px top/bottom + text)
    overscan: 10,
  });
  
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end 
    : 0;
`);

// 4. Update the container div to have the ref
const containerIndex = lines.findIndex(l => l.includes('<div className="flex-1 overflow-auto relative">'));
lines[containerIndex] = lines[containerIndex].replace('<div className="flex-1 overflow-auto relative">', '<div className="flex-1 overflow-auto relative" ref={tableContainerRef}>');

// 5. Replace tbody mapping
const tbodyStart = lines.findIndex(l => l.includes('<tbody className="divide-y divide-slate-100 bg-white">'));
const mapStart = lines.findIndex(l => l.includes('filteredItems.map((item, idx) => {'));

// We need to inject the padding top row, modify map to use virtualRows, and add padding bottom
lines[mapStart] = `
                      {paddingTop > 0 && (
                        <tr><td style={{ height: \`\${paddingTop}px\` }} colSpan={activeHeaders.length + 3} /></tr>
                      )}
                      {virtualRows.map((virtualRow) => {
                        const item = filteredItems[virtualRow.index];
                        const idx = virtualRow.index;
`;

const mapEnd = lines.findIndex((l, i) => i > mapStart && l.includes('})}'));
lines[mapEnd] = `                      })}
                      {paddingBottom > 0 && (
                        <tr><td style={{ height: \`\${paddingBottom}px\` }} colSpan={activeHeaders.length + 3} /></tr>
                      )}
`;

// Also, the tr needs a ref for the virtualizer to measure it dynamically
const trIndex = lines.findIndex((l, i) => i > mapStart && l.includes('<tr key={idx}'));
lines[trIndex] = lines[trIndex].replace('<tr key={idx}', '<tr key={idx} data-index={virtualRow.index} ref={rowVirtualizer.measureElement}');


fs.writeFileSync('src/components/InventoryDashboard.tsx', lines.join('\n'));
