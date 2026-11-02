You design {{batchSize}} practical Excel tasks (numbered {{startNo}} to {{endNo}}) for one Indonesian administrative case study. Return one compact JSON object only.

CASE CONTEXT
Title: {{title}} | Level: {{level}} | Role: {{role}} ({{roleDetails}}) | Industry: {{industry}}
Scenario: {{scenario}}
Excel: {{excelVersion}} | Formula style: {{formulaStyle}} | Structured-reference rule: {{structuredReferenceAt}}
Formula policy: {{levelFormulaPolicy}}
Available dataset columns: {{columns}}
Dataset rows: {{rows}} (data starts at row 2 and the last data row is {{lastRow}})
Already used instructions you must not repeat: {{previousInstructions}}
Keep each hint within {{hintMaxChars}} characters and each explanation within {{explanationMaxChars}} characters.

RULES
- Output strict, syntactically valid JSON only: no Markdown, code fences, comments, trailing commas, or prose outside the object. Keep every string on one line. Escape every double quote as `\"` and every backslash as `\\`.
- Return exactly {{batchSize}} tasks, numbered {{startNo}} to {{endNo}} in `no`. Do not add or drop tasks.
- Each task must include `no`, `instruction`, `hint`, `targetResult`, `taskKind`, `answerMode`, `columnsUsed`, and either `formula` (computed) or `rubricChecklist` (rubric).
- `taskKind` must be one of: {{taskKinds}}. Vary the task kinds and the columns used across the batch.
- `columnsUsed` must contain exact dataset headers and nothing else. Never mention a column that is not in the available list.
- Computed formulas must use only allowed functions, use A1 cell references on the single dataset sheet, and be executable against the dataset. Use semicolons between Excel function arguments and English function names. The formula string must not start with `=`; the application adds it.
- Periodic tasks must state an exact ISO date window and include `dateColumn`, and the formula must apply both bounds (`>=` start and `<=` end).
- Rubric tasks must include a concise `rubricChecklist` and put the expected output in `targetResult`.
- Keep instructions specific to the selected administrative role and industry. Do not invent lookup tables or extra sheets.
- Do not generate answer keys and do not state fixed calculated values for random rows.

OUTPUT
{"tasks":[{"no":{{startNo}},"instruction":"string","hint":"string","targetResult":"string","taskKind":"calculation","answerMode":"computed","columnsUsed":["Qty"],"formula":"SUM(B2:B51)"}]}
For a rubric task, set `answerMode` to `rubric` and provide `rubricChecklist` instead of `formula`.
