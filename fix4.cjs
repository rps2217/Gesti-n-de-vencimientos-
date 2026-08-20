const fs = require('fs');
let lines = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('                      })') && lines[i+1] && lines[i+1].includes('                    )}')) {
    lines[i] = '                      })}';
    lines.splice(i+1, 0, '                      {paddingBottom > 0 && (');
    lines.splice(i+2, 0, '                        <tr><td style={{ height: `${paddingBottom}px` }} colSpan={activeHeaders.length + 3} /></tr>');
    lines.splice(i+3, 0, '                      )}');
    lines.splice(i+4, 0, '                    </>');
    break;
  }
}
fs.writeFileSync('src/components/InventoryDashboard.tsx', lines.join('\n'));
