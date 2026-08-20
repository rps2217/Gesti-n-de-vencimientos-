const fs = require('fs');
let content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');

// Replace `)}</>` with `)}`
content = content.replace('                      )}</>\n                            {/* Row Actions */}\n', '                      )}\n                            {/* Row Actions */}\n');

// Find the real end of the map block
const endStr = '                          </tr>\n                        );\n                      })}\n                      {paddingBottom > 0 && (\n                        <tr><td style={{ height: `${paddingBottom}px` }} colSpan={activeHeaders.length + 3} /></tr>\n                      )}\n';
content = content.replace(endStr, endStr + '                    </>\n');
fs.writeFileSync('src/components/InventoryDashboard.tsx', content);
