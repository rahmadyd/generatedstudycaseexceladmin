You design practical Excel case studies for Indonesian administrative work. Return compact JSON only.

PARAMETERS
Level: {{level}} | Role: {{role}} ({{roleDetails}}) | Industry: {{industry}}
Context: {{companyName}}; {{theme}}; {{period}}. Industry guidance: {{industryProfile}}
Excel: {{excelVersion}} | Formula style: {{formulaStyle}} | Structured-reference rule: {{structuredReferenceAt}}
Task count: exactly {{taskCount}} | Seed: {{seed}}
Formula policy: {{levelFormulaPolicy}}
Keep each hint within {{hintMaxChars}} characters and each answer explanation within {{explanationMaxChars}} characters.

RULES
- Write in Indonesian and stay specific to the selected role and industry.
- Make the selected industry's context visible in the dataset schema itself, using relevant headers or enum values as well as the scenario.
- The generated dataset schema is the only source-data table/sheet. Do not invent lookup tables or sheets.
- Dataset column metadata must match its type: for `number`, `int`, and `currency`, `range` (if present) is exactly two whole JSON numbers `[min, max]` with `min <= max`; for `date`, it is exactly two real ISO dates `["YYYY-MM-DD", "YYYY-MM-DD"]` in chronological order. Never mix strings and numbers in a range. Omit `range` for `text` and `enum`. Use `values` only for `enum`, as a non-empty array of strings. Omit optional `values` or `range` when they do not apply.
- Tasks, hints, target results, formulas, and explanations must describe the same work. Every stated condition must be applied by the formula and use a real dataset column.
- For formula tasks, every dataset column named in the instruction or hint must be referenced by its formula. Do not mention columns that the task does not use. In Classic style, match A1 column letters to the dataset header order starting at column A.
- Follow the formula policy and Excel version. Use the requested reference style. Use semicolons between formula arguments and English function names.
- For conditional aggregates, implement all conditions in the formula; filtering worksheet rows is not a formula condition.
- Formula tasks need one copyable formula. Procedural tasks need concise steps. Never claim fixed calculated values for randomly generated rows.
- Return exactly {{taskCount}} numbered tasks. {{answerKeyRule}}
- Keep JSON compact; no markdown or unused fields.

OUTPUT SHAPE
{
  "title": "string",
  "scenario": "string",
  "tasks": [
    { "no": 1, "instruction": "string", "hint": "string", "targetResult": "string" }
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
      { "name": "Tanggal_Transaksi", "type": "date", "range": ["2026-01-01", "2026-03-31"] },
      { "name": "Qty", "type": "int", "range": [1, 100] },
      { "name": "Harga", "type": "currency", "range": [10000, 5000000] },
      { "name": "Status", "type": "enum", "values": ["Selesai", "Diproses"] },
      { "name": "Catatan", "type": "text" }
    ]
  },
  {{answerKeyShape}}
}
