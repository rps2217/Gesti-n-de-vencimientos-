const fs = require('fs');
let content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');
content = content.replace('            ) : (<>\n              <div className="w-full max-w-3xl py-3" /> /* Spacer */\n            )}', '            ) : (\n              <div className="w-full max-w-3xl py-3" /> /* Spacer */\n            )}');
fs.writeFileSync('src/components/InventoryDashboard.tsx', content);
