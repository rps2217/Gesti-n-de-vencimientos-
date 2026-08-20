const fs = require('fs');
const content = fs.readFileSync('src/components/InventoryDashboard.tsx', 'utf-8');
const lines = content.split('\n');

const newFunc = `  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!activeSheet) return errors;

    const currentSchema = sheetConfig.schema?.[activeSheet.title] || {};
    
    // Dynamic Zod Schema generation based on our internal types
    const zSchemaShape: Record<string, z.ZodTypeAny> = {};

    headers.forEach(header => {
      const colSchema = currentSchema[header];
      const effectiveType = colSchema?.type || (/fecha|vencimiento|retiro/i.test(header) ? 'date' : 'text');
      const isAutoCalculated = colSchema?.behavior === 'auto_id' || 
                               colSchema?.behavior === 'calc_fecha_vc' || 
                               colSchema?.behavior === 'calc_retiro' || 
                               effectiveType === 'calculated' || 
                               /^ID_VC$/i.test(header.trim());

      // If auto calculated, we don't strictly validate user input (it's read-only)
      if (isAutoCalculated) {
        zSchemaShape[header] = z.any();
        return;
      }

      // Base string schema
      let fieldSchema: z.ZodTypeAny = z.string({ required_error: 'Este campo es obligatorio.', invalid_type_error: 'Tipo inválido.' }).trim();

      // Required logic: Sku, dates, and amounts are usually required, others optional.
      const isRequired = colSchema?.isKey || /sku|código|codigo|cantidad|fecha|lote|estado/i.test(header);

      if (!isRequired) {
        fieldSchema = z.string().trim().optional().or(z.literal(''));
      } else {
        fieldSchema = z.string().trim().min(1, 'Este campo es obligatorio.');
      }

      // Type specific validation
      if (effectiveType === 'number' || /^cant|unidades|stock|dias|precio/i.test(header)) {
        fieldSchema = fieldSchema.refine((val) => {
          if (!isRequired && (!val || val === '')) return true;
          return !isNaN(Number(val));
        }, 'Debe ser un número válido.');
      } else if (effectiveType === 'date' || /fecha/i.test(header)) {
        fieldSchema = fieldSchema.refine((val) => {
          if (!isRequired && (!val || val === '')) return true;
          return !isNaN(new Date(val).getTime());
        }, 'Formato de fecha inválido.');
      }

      // Custom validations for Vencimiento
      if (selectedEventCategory === 'VENCIMIENTO') {
        if (/^MM$/i.test(header.trim())) {
          fieldSchema = fieldSchema.refine((val) => {
            if (!val && !isRequired) return true;
            const num = parseInt(val, 10);
            return !isNaN(num) && num >= 1 && num <= 12;
          }, 'El mes debe estar entre 1 y 12.');
        } else if (/^YYYY$/i.test(header.trim())) {
          fieldSchema = fieldSchema.refine((val) => {
            if (!val && !isRequired) return true;
            const num = parseInt(val, 10);
            return !isNaN(num) && num >= 2000 && num <= 2100;
          }, 'El año debe ser válido (ej. 2026).');
        }
      }

      zSchemaShape[header] = fieldSchema;
    });

    const formSchema = z.object(zSchemaShape).superRefine((data, ctx) => {
      // Cross-field validation: Expiration vs Withdrawal Date
      if (selectedEventCategory === 'VENCIMIENTO') {
        const fechaVcHeader = headers.find(h => /^FECHA_VC$/i.test(h.trim()) || sheetConfig.schema?.[activeSheet.title]?.[h]?.behavior === 'calc_fecha_vc');
        const withdrawalHeader = headers.find(h => /retiro/i.test(h) || sheetConfig.schema?.[activeSheet.title]?.[h]?.behavior === 'calc_retiro');
        
        if (fechaVcHeader && withdrawalHeader) {
          const vcVal = data[fechaVcHeader];
          const retVal = data[withdrawalHeader];
          
          if (vcVal && retVal) {
            const vcDate = new Date(vcVal as string);
            const retDate = new Date(retVal as string);
            
            if (!isNaN(vcDate.getTime()) && !isNaN(retDate.getTime()) && retDate > vcDate) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha de retiro no puede ser posterior al vencimiento.',
                path: [withdrawalHeader]
              });
            }
          }
        }
      }
    });

    // Normalize formData so undefined values become empty strings for z.string().trim()
    const normalizedFormData: Record<string, any> = {};
    headers.forEach(h => {
      normalizedFormData[h] = formData[h] !== undefined ? formData[h] : '';
    });

    const parseResult = formSchema.safeParse(normalizedFormData);
    
    if (!parseResult.success) {
      parseResult.error.issues.forEach(issue => {
        const key = issue.path[0] as string;
        if (!errors[key]) {
          errors[key] = issue.message;
        }
      });
    }

    return errors;
  };`;

const startIndex = lines.findIndex(l => l.includes('const validateForm = (): Record<string, string> => {'));
let endIndex = startIndex;
let braceCount = 0;
let foundStart = false;

for (let i = startIndex; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('{')) {
    braceCount += (line.match(/\{/g) || []).length;
    foundStart = true;
  }
  if (line.includes('}')) {
    braceCount -= (line.match(/\}/g) || []).length;
  }
  
  if (foundStart && braceCount === 0) {
    endIndex = i;
    break;
  }
}

lines.splice(startIndex, endIndex - startIndex + 1, ...newFunc.split('\n'));
fs.writeFileSync('src/components/InventoryDashboard.tsx', lines.join('\n'));
