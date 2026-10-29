import fs from 'fs';
import path from 'path';
import { GenerateRequest } from '../shared/schema';
import { SAMPLE_COMPANIES, SAMPLE_INDUSTRIES, SAMPLE_PERIODS, SAMPLE_THEMES } from '../shared/constants';

const DEFAULT_GENERATE_PROMPT = `You are an expert curriculum designer and administrative business analyst who designs realistic Excel case studies for administrative roles in Indonesia.
Your job is to generate a comprehensive, realistic Excel practice case study tailored to the given specifications.

Parameters:
- Level: {{level}} (Options: easy, middle, advance, portfolio)
- Administrative Role: {{role}} (e.g., Admin Penjualan, Admin Gudang/Inventory, Admin HRD/Absensi, Admin Keuangan/Kasir, Admin Pengadaan/Purchasing, Sekretaris/Admin Surat)
- Excel Version: {{excelVersion}} (Options: "2016/2019" or "Microsoft 365")
- Industry/Company context: {{companyName}} (Industry: {{industry}}, Theme: {{theme}}, Target Period: {{period}})
- Task Count: {{taskCount}}
- Language: Indonesian
- Random Seed: {{seed}}

### Level Guidelines:
1. **easy**:
   - Formulas: SUM, AVERAGE, COUNT, MIN, MAX, IF, basic number and date formatting, sort, filter.
   - Forbidden: VLOOKUP, XLOOKUP, INDEX, MATCH, Pivot Table, Macro/VBA.
2. **middle**:
   - Formulas: VLOOKUP (or XLOOKUP if Microsoft 365), SUMIF, SUMIFS, COUNTIF, COUNTIFS, IFERROR, TEXT, LEFT, RIGHT, MID, Data Validation.
   - Excel Version 2016/2019: strictly forbid XLOOKUP, FILTER, UNIQUE, LET, LAMBDA.
   - Data traps: insert intentional traps like text dates, trailing spaces in codes, empty cells, numbers stored as text.
3. **advance**:
   - Formulas: INDEX-MATCH, SUMPRODUCT, Pivot Table, Conditional Formatting with formulas, Named Ranges, nested IF/IFS, dynamic arrays (if M365).
4. **portfolio**:
   - Comprehensive multi-faceted challenge. Includes all skills up to Advance + executive dashboard (pivot tables + charts + slicers), structured multi-sheet planning, and complete client deliverables.
   - Must include rubric and portfolioBrief with client brief, deliverables, and a complete markdown README template.

### CRITICAL RULES:
- Output MUST be valid JSON only matching the schema below.
- Do NOT make fake download links! The dataset schema will be used by our code generator to create the real XLSX/CSV file.
- Provide a clear, realistic Indonesian administrative scenario.
- In answerKey, each formula MUST NOT use any formulas listed under forbidden.
- Use Indonesian Excel regional notation in every formula example, hint, and answer key: use semicolons (\`;\`) between function arguments and commas (\`,\`) for decimal values. Keep English function names. For example: \`=IF(A1>0; 1,5; 0)\` and \`=SUMIFS(C:C; A:A; "Jakarta")\`. Do not change commas inside quoted text.
- dataTraps should be an array of strings (e.g. ["Spasi berlebih pada kode barang", "Tanggal tersimpan sebagai teks"]).
- Each task in tasks must have:
  - no: number (1, 2, ...)
  - instruction: clear administrative assignment
  - hint: clue on which columns/logic to use
  - targetResult: benchmark/target figure or validation outcome that the user can verify without peeking at the answer key.
- dataset must have:
  - sheetName: string
  - rows: number (100 to 300)
  - columns: array of { "name": string, "type": "date"|"text"|"number"|"int"|"currency"|"enum", "values"?: string[], "range"?: [number, number] or [string, string] }

Schema:
\`\`\`json
{
  "title": "string",
  "level": "{{level}}",
  "role": "{{role}}",
  "scenario": "string",
  "tasks": [
    {
      "no": 1,
      "instruction": "string",
      "hint": "string",
      "targetResult": "string"
    }
  ],
  "dataTraps": ["string"],
  "formulas": {
    "recommended": ["string"],
    "allowed": ["string"],
    "forbidden": ["string"]
  },
  "dataset": {
    "sheetName": "string",
    "rows": 150,
    "columns": [
      { "name": "string", "type": "date|text|number|int|currency|enum", "values": ["..."], "range": [1, 100] }
    ]
  },
  "answerKey": [
    { "task": 1, "formula": "=FORMULA(...)", "explanation": "string" }
  ],
  "rubric": ["string"],
  "portfolioBrief": {
    "clientBrief": "string",
    "deliverables": ["string"],
    "readmeTemplate": "string"
  }
}
\`\`\`
Return ONLY JSON without any markdown code fences or conversational text.`;

const DEFAULT_REGENERATE_TASK_PROMPT = `You are an expert Excel curriculum designer.
Given the current Excel study case, regenerate ONLY task number {{taskNo}} with an alternative challenging task that fits the scenario, level, and rules.

Current Case:
- Title: {{title}}
- Level: {{level}}
- Role: {{role}}
- Scenario: {{scenario}}
- Excel Version: {{excelVersion}}
- Formulas Recommended: {{recommendedFormulas}}
- Formulas Forbidden: {{forbiddenFormulas}}
- Available Dataset Columns: {{columns}}

Task to replace:
- Task No: {{taskNo}}
- Old Instruction: {{oldInstruction}}

CRITICAL RULES:
- Return ONLY valid JSON with keys: "task" and "answerKey".
- "task": { "no": {{taskNo}}, "instruction": "...", "hint": "...", "targetResult": "..." }
- "answerKey": { "task": {{taskNo}}, "formula": "=...", "explanation": "..." }
- The formula MUST NOT use any formulas in forbidden list: {{forbiddenFormulas}}!
- Use Indonesian Excel regional notation in the formula and any formula shown in the hint: use semicolons (\`;\`) between function arguments and commas (\`,\`) for decimal values. Keep English function names and do not change commas inside quoted text.

Schema:
\`\`\`json
{
  "task": {
    "no": {{taskNo}},
    "instruction": "string",
    "hint": "string",
    "targetResult": "string"
  },
  "answerKey": {
    "task": {{taskNo}},
    "formula": "=...",
    "explanation": "string"
  }
}
\`\`\`
Return ONLY JSON without any markdown code fences.`;

function getRandomItem<T>(arr: T[], seedStr?: string): T {
  if (!seedStr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % arr.length;
  return arr[index];
}

export function loadPromptTemplate(templateName: string): string {
  try {
    const filePath = path.join(process.cwd(), 'prompts', templateName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // Filesystem lookup failed in serverless, use fallback
  }

  if (templateName === 'regenerate-task.md') {
    return DEFAULT_REGENERATE_TASK_PROMPT;
  }
  return DEFAULT_GENERATE_PROMPT;
}

export function compileGeneratePrompt(req: GenerateRequest, seed: string): string {
  const template = loadPromptTemplate('generate-case.md');

  const industry = getRandomItem(SAMPLE_INDUSTRIES, seed + '-ind');
  const companyName = getRandomItem(SAMPLE_COMPANIES, seed + '-comp');
  const theme = getRandomItem(SAMPLE_THEMES, seed + '-theme');
  const period = getRandomItem(SAMPLE_PERIODS, seed + '-per');

  const replacements: Record<string, string> = {
    '{{level}}': req.level,
    '{{role}}': req.role,
    '{{excelVersion}}': req.excelVersion,
    '{{companyName}}': companyName,
    '{{industry}}': industry,
    '{{theme}}': theme,
    '{{period}}': period,
    '{{taskCount}}': String(req.taskCount || 5),
    '{{seed}}': seed,
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}

export function compileRegenerateTaskPrompt(params: {
  title: string;
  level: string;
  role: string;
  scenario: string;
  excelVersion: string;
  recommendedFormulas: string[];
  forbiddenFormulas: string[];
  columns: string[];
  taskNo: number;
  oldInstruction: string;
}): string {
  const template = loadPromptTemplate('regenerate-task.md');

  const replacements: Record<string, string> = {
    '{{title}}': params.title,
    '{{level}}': params.level,
    '{{role}}': params.role,
    '{{scenario}}': params.scenario,
    '{{excelVersion}}': params.excelVersion,
    '{{recommendedFormulas}}': params.recommendedFormulas.join(', '),
    '{{forbiddenFormulas}}': params.forbiddenFormulas.join(', '),
    '{{columns}}': params.columns.join(', '),
    '{{taskNo}}': String(params.taskNo),
    '{{oldInstruction}}': params.oldInstruction,
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}
