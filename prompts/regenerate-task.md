You are an expert Excel curriculum designer.
Given the current Excel study case, regenerate ONLY task number {{taskNo}} with an alternative challenging task that fits the scenario, level, and rules.

Current Case:
- Title: {{title}}
- Level: {{level}}
- Role: {{role}}
- Industry: {{industry}}
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
- The formula MUST NOT use any formulas in forbidden list: {{forbiddenFormulas}}!
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
