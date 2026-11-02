import type { Level } from './schema';

export type TaskKind =
  | 'calculation'
  | 'conditional-logic'
  | 'sorting'
  | 'filtering'
  | 'formatting'
  | 'conditional-aggregation'
  | 'lookup'
  | 'data-validation'
  | 'multi-criteria-analysis'
  | 'pivot-table'
  | 'conditional-formatting'
  | 'named-range'
  | 'portfolio';

export const LEVEL_RULES: Record<Level, {
  allowedFunctions: string[];
  forbiddenFunctions: string[];
  taskKinds: TaskKind[];
}> = {
  easy: {
    allowedFunctions: ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'IF', 'SORT', 'FILTER'],
    forbiddenFunctions: [
      'VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS',
      'AVERAGEIF', 'AVERAGEIFS', 'SUBTOTAL', 'Pivot Table', 'Macro/VBA',
    ],
    taskKinds: ['calculation', 'conditional-logic', 'sorting', 'filtering', 'formatting'],
  },
  middle: {
    allowedFunctions: [
      'VLOOKUP', 'XLOOKUP', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'IFERROR',
      'TEXT', 'LEFT', 'RIGHT', 'MID', 'Data Validation',
    ],
    forbiddenFunctions: ['Pivot Table', 'Macro/VBA', 'Power Query'],
    taskKinds: ['calculation', 'conditional-aggregation', 'lookup', 'data-validation', 'formatting'],
  },
  advance: {
    allowedFunctions: ['INDEX', 'MATCH', 'SUMPRODUCT', 'IF', 'IFS', 'Pivot Table', 'Conditional Formatting', 'Named Range'],
    forbiddenFunctions: ['Macro/VBA'],
    taskKinds: [
      'calculation', 'multi-criteria-analysis', 'pivot-table', 'conditional-formatting',
      'named-range', 'portfolio',
    ],
  },
};

export function getFormulaFunctionNames(formula: string): string[] {
  return Array.from(
    formula.matchAll(/\b([A-Z][A-Z0-9._]*)\s*\(/gi),
    (match) => match[1].toUpperCase(),
  );
}
