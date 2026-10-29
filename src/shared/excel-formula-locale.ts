export function normalizeExcelFormulaLocale(formula: string): string {
  let hasIndonesianArgumentSeparator = false;
  let scanQuoteOpen = false;

  for (let index = 0; index < formula.length; index++) {
    const character = formula[index];
    if (character === '"') {
      if (scanQuoteOpen && formula[index + 1] === '"') {
        index++;
        continue;
      }
      scanQuoteOpen = !scanQuoteOpen;
    } else if (!scanQuoteOpen && character === ';') {
      hasIndonesianArgumentSeparator = true;
      break;
    }
  }

  let normalized = '';
  let quoteOpen = false;
  let parenthesisDepth = 0;

  for (let index = 0; index < formula.length; index++) {
    const character = formula[index];

    if (character === '"') {
      normalized += character;
      if (quoteOpen && formula[index + 1] === '"') {
        normalized += formula[++index];
        continue;
      }
      quoteOpen = !quoteOpen;
      continue;
    }

    if (!quoteOpen) {
      if (character === '(') parenthesisDepth++;
      if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);

      if (
        character === ',' &&
        parenthesisDepth > 0 &&
        (!hasIndonesianArgumentSeparator ||
          !/\d/.test(formula[index - 1] ?? '') ||
          !/\d/.test(formula[index + 1] ?? ''))
      ) {
        normalized += ';';
        continue;
      }
      if (
        character === '.' &&
        /\d/.test(formula[index - 1] ?? '') &&
        /\d/.test(formula[index + 1] ?? '')
      ) {
        normalized += ',';
        continue;
      }
    }

    normalized += character;
  }

  return normalized;
}
