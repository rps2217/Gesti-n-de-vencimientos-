const fs = require('fs');
let content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');

// 1. Remove the bad paddingBottom block that was injected in the middle
const badBlock = `                      })}
                      {paddingBottom > 0 && (
                        <tr><td style={{ height: \`\${paddingBottom}px\` }} colSpan={activeHeaders.length + 3} /></tr>
                      )}</>`;
content = content.replace(badBlock, '                            })}');

// 2. Put the paddingBottom block back at the real end of the map.
// The real end of the map looks like:
//                                 </button>
//                               </div>
//                             </td>
//                           </tr>
//                         );
//                       })}
const realEndMarker = '                                </button>\n                              </div>\n                            </td>\n                          </tr>\n                        );\n                      })}';

const fixedEndMarker = realEndMarker + `
                      {paddingBottom > 0 && (
                        <tr><td style={{ height: \`\${paddingBottom}px\` }} colSpan={activeHeaders.length + 3} /></tr>
                      )}
                    </>`;

content = content.replace(realEndMarker, fixedEndMarker);

fs.writeFileSync('src/components/InventoryDashboard.tsx', content);
