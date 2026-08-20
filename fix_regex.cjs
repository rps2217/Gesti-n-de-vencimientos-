const fs = require('fs');
let content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');
content = content.replace(/\) :\s*\(\s*\{paddingTop > 0/g, ') : (<>\n                      {paddingTop > 0');
fs.writeFileSync('src/components/InventoryDashboard.tsx', content);
