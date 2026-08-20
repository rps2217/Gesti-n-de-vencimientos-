const fs = require('fs');
let content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');

// Undo the global replacing
content = content.replace(/\) : \(\<\>\n/g, ') : (\n');
// Put the correct fragment around the mapped rows
content = content.replace('                      ) : (\n                        {paddingTop > 0 && (', '                      ) : (<>\n                        {paddingTop > 0 && (');

fs.writeFileSync('src/components/InventoryDashboard.tsx', content);
