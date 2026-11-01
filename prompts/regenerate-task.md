You are an expert Excel curriculum designer.
Given the current Excel study case, regenerate ONLY task number {{taskNo}} with an alternative challenging task that fits the scenario, level, and rules.

Current Case:
- Title: {{title}}
- Level: {{level}}
- Role: {{role}}
- Role Responsibilities: {{roleDetails}}
- Industry: {{industry}}
- Formula policy for this level: {{levelFormulaPolicy}}
- Scenario: {{scenario}}
- Excel Version: {{excelVersion}}
- Formula Reference Style: {{formulaStyle}}
- Structured Reference @ setting: {{structuredReferenceAt}}
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
- In "answerKey", "explanation" MUST be detailed: jelaskan alasan pemilihan rumus, bedah fungsi tiap argumen, dan terangkan mengapa parameter penting digunakan (misal: kenapa harus 0/FALSE untuk exact match, kenapa ada tanda $ untuk kunci rentang).
- The formula MUST NOT use any formulas in forbidden list: {{forbiddenFormulas}}!
- The new instruction, hint, target, and answer must describe the same operation. The formula must calculate the requested measure over the exact stated criteria and only reference available columns. An unfiltered AVERAGE/SUM/COUNT does not become criteria-aware when rows are manually filtered. If conditional aggregate functions are forbidden, use an allowed single array formula such as `=AVERAGE(IF(criteria_range=criteria; average_range; ""))`; explain Ctrl+Shift+Enter for Excel 2016/2019.
- For formula-based tasks, `answerKey.formula` must contain one copyable Excel formula, not prose or multiple formula steps. Keep procedural tasks as concise step instructions.
- Use a verifiable target that does not assume fixed values in randomly generated rows.
- Use Indonesian Excel regional notation in the formula and any formula shown in the hint: use semicolons (`;`) between function arguments and commas (`,`) for decimal values. Keep English function names and do not change commas inside quoted text.
- Follow Formula Reference Style: Classic uses only cell/range references, not table column names. Modern uses structured references with the actual table/header names; follow the @ setting above for current-row versus whole-column references.

Schema:
```json
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
```
Return ONLY JSON without any markdown markdown formatting.
