const fs = require('fs');
let lines = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('                    ) : (') && lines[i+1] && lines[i+1].includes('{paddingTop > 0 && (')) {
    lines[i] = lines[i].replace(') : (', ') : (<>');
  }
}
fs.writeFileSync('src/components/InventoryDashboard.tsx', lines.join('\n'));
