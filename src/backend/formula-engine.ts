import { Parser } from 'hot-formula-parser';
import { DataRow } from '../shared/dataset-generator';
import { CaseStudy, Task } from '../shared/schema';
import { getFormulaFunctionNames, LEVEL_RULES } from '../shared/level-rules';
import { M365_ONLY_FORMULAS } from '../shared/constants';

type CellValue = string | number | boolean | null;
type FormulaMatrix = CellValue[][];

function flattenValues(value: unknown): CellValue[] {
  if (!Array.isArray(value)) return [value as CellValue];
  return value.flatMap((item) => flattenValues(item));
}

function numericValue(value: CellValue): number {
  if (typeof value === 'number') return value;
  return 0;
}

function matchesCriteria(value: CellValue, criteria: CellValue): boolean {
  if (typeof criteria !== 'string') return value === criteria;
  const match = /^(<=|>=|<>|=|<|>)(.*)$/.exec(criteria);
  const operator = match?.[1] ?? '=';
  const expected = match ? match[2] : criteria;
  const normalizeDate = (date: string) => /^\d{4}\/\d{2}\/\d{2}$/.test(date) ? date.replace(/\//g, '-') : date;
  const normalizedValue = typeof value === 'string' ? normalizeDate(value) : value;
  const normalizedExpected = normalizeDate(expected);
  const actualNumber = typeof normalizedValue === 'number' ? normalizedValue : Number(normalizedValue);
  const expectedNumber = Number(normalizedExpected);
  const compareAsNumbers = Number.isFinite(actualNumber) &&
    Number.isFinite(expectedNumber) &&
    expected.trim() !== '';
  const actual = compareAsNumbers ? actualNumber : String(normalizedValue ?? '');
  const target = compareAsNumbers ? expectedNumber : normalizedExpected;
  switch (operator) {
    case '=': return actual === target;
    case '<>': return actual !== target;
    case '>': return actual > target;
    case '>=': return actual >= target;
    case '<': return actual < target;
    case '<=': return actual <= target;
    default: return false;
  }
}

function asMatrix(value: unknown): FormulaMatrix {
  if (!Array.isArray(value)) return [[value as CellValue]];
  return value.map((row) => Array.isArray(row) ? row as CellValue[] : [row as CellValue]);
}

function columnIndexFromLetters(letters: string): number {
  return Array.from(letters.toUpperCase()).reduce(
    (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
    0,
  ) - 1;
}

function parseRangeReference(reference: string, caseStudy: Pick<CaseStudy, 'dataset'>, rows: DataRow[]): CellValue[] {
  const match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(reference.trim());
  if (!match) throw new Error(`Referensi rentang tidak didukung: ${reference}.`);
  const startColumn = columnIndexFromLetters(match[1]);
  const endColumn = columnIndexFromLetters(match[3]);
  const startRow = Number(match[2]);
  const endRow = Number(match[4]);
  if (startColumn !== endColumn || startRow < 2 || endRow < startRow) {
    throw new Error(`Referensi harus berupa satu kolom data: ${reference}.`);
  }
  const columnName = caseStudy.dataset.columns[startColumn]?.name;
  if (!columnName) throw new Error(`Kolom formula tidak ditemukan: ${match[1]}.`);
  return Array.from({ length: endRow - startRow + 1 }, (_, index) =>
    rows[startRow - 2 + index]?.[columnName] ?? null,
  );
}

function parseFormulaLiteral(literal: string): CellValue {
  const value = literal.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  if (/^TRUE$/i.test(value)) return true;
  if (/^FALSE$/i.test(value)) return false;
  const numeric = Number(value);
  return value !== '' && Number.isFinite(numeric) ? numeric : value;
}

function splitMultiplicationFactors(expression: string): string[] {
  const factors: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === '"') {
      if (inString && expression[index + 1] === '"') {
        index += 1;
      } else {
        inString = !inString;
      }
    } else if (!inString && character === '(') {
      depth += 1;
    } else if (!inString && character === ')') {
      depth -= 1;
    } else if (!inString && depth === 0 && character === '*') {
      factors.push(expression.slice(start, index).trim());
      start = index + 1;
    }
  }
  factors.push(expression.slice(start).trim());
  return factors;
}

function getCriteriaFactor(
  factor: string,
  caseStudy: Pick<CaseStudy, 'dataset'>,
  rows: DataRow[],
): Array<boolean | number> {
  const expression = factor.trim().replace(/^\((.*)\)$/s, '$1').trim();
  const criteriaMatch = /^(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*(<>|>=|<=|=|>|<)\s*(.+)$/i.exec(expression);
  if (criteriaMatch) {
    const values = parseRangeReference(criteriaMatch[1], caseStudy, rows);
    const criterion = parseFormulaLiteral(criteriaMatch[3]);
    return values.map((value) =>
      matchesCriteria(value, `${criteriaMatch[2]}${String(criterion)}`),
    );
  }
  return parseRangeReference(expression, caseStudy, rows).map(numericValue);
}

function evaluateMultiCriteriaFormula(
  formula: string,
  caseStudy: Pick<CaseStudy, 'dataset'>,
  rows: DataRow[],
): CellValue | undefined {
  const normalized = toParserFormula(formula);
  const indexMatch = /^\s*INDEX\(\s*(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*MATCH\(\s*1\s*,\s*(.+)\s*,\s*0\s*\)\s*\)\s*$/i.exec(normalized);
  if (indexMatch) {
    const returnValues = parseRangeReference(indexMatch[1], caseStudy, rows);
    const factors = splitMultiplicationFactors(indexMatch[2]).map((factor) =>
      getCriteriaFactor(factor, caseStudy, rows),
    );
    const matchIndex = returnValues.findIndex((_, rowIndex) =>
      factors.every((factor) => Boolean(factor[rowIndex])),
    );
    if (matchIndex < 0) throw new Error('INDEX-MATCH tidak menemukan baris yang memenuhi seluruh kriteria.');
    return returnValues[matchIndex];
  }

  const sumproductMatch = /^\s*SUMPRODUCT\((.*)\)\s*$/i.exec(normalized);
  if (!sumproductMatch) return undefined;
  if (!/[=<>*]/.test(sumproductMatch[1])) return undefined;
  const factors = splitMultiplicationFactors(sumproductMatch[1]).map((factor) =>
    getCriteriaFactor(factor, caseStudy, rows),
  );
  const rowCount = Math.max(...factors.map((factor) => factor.length));
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    factors.reduce<number>((product, factor) => product * Number(factor[rowIndex] ?? 0), 1),
  ).reduce((total, value) => total + value, 0);
}

function registerFormulaFunctions(parser: Parser): void {
  parser.setFunction('INDEX', (params) => {
    if (!Array.isArray(params) || params.length < 2) throw new Error('Argumen INDEX tidak lengkap.');
    const matrix = asMatrix(params[0]);
    const rowIndex = Number(params[1]) - 1;
    const columnIndex = Number(params[2] ?? 1) - 1;
    if (rowIndex < 0 || columnIndex < 0 || !matrix[rowIndex] || matrix[rowIndex][columnIndex] === undefined) {
      throw new Error('INDEX menggunakan nomor baris atau kolom di luar rentang.');
    }
    return matrix[rowIndex][columnIndex];
  });

  parser.setFunction('MATCH', (params) => {
    if (!Array.isArray(params) || params.length < 2) throw new Error('Argumen MATCH tidak lengkap.');
    const [lookupValue, range, rawMatchType = 1] = params;
    const values = flattenValues(range);
    const matchType = Number(rawMatchType);
    const exactIndex = values.findIndex((value) => matchesCriteria(value, lookupValue as CellValue));
    if (matchType === 0) {
      if (exactIndex < 0) throw new Error('MATCH tidak menemukan nilai yang dicari.');
      return exactIndex + 1;
    }
    if (matchType === 1) {
      const index = values.reduce<number>((bestIndex, value, currentIndex) =>
        numericValue(value) <= numericValue(lookupValue as CellValue) ? currentIndex : bestIndex,
      -1);
      if (index < 0) throw new Error('MATCH tidak menemukan nilai yang sesuai.');
      return index + 1;
    }
    if (matchType === -1) {
      const index = values.findIndex((value) =>
        numericValue(value) >= numericValue(lookupValue as CellValue),
      );
      if (index < 0) throw new Error('MATCH tidak menemukan nilai yang sesuai.');
      return index + 1;
    }
    throw new Error('Jenis pencocokan MATCH harus -1, 0, atau 1.');
  });

  parser.setFunction('IFS', (params) => {
    if (!Array.isArray(params) || params.length < 2 || params.length % 2 !== 0) {
      throw new Error('IFS memerlukan pasangan kondisi dan hasil.');
    }
    for (let index = 0; index < params.length; index += 2) {
      if (Boolean(params[index])) return params[index + 1] as CellValue;
    }
    throw new Error('Tidak ada kondisi IFS yang terpenuhi.');
  });

  parser.setFunction('SUMIFS', (params) => {
    if (!Array.isArray(params) || params.length < 3 || params.length % 2 !== 1) {
      throw new Error('SUMIFS memerlukan sum_range dan pasangan criteria_range/criteria.');
    }
    const [sumRange, ...criteriaArgs] = params;
    const sums = flattenValues(sumRange);
    const criteriaRanges: CellValue[][] = [];
    for (let index = 0; index < criteriaArgs.length; index += 2) {
      criteriaRanges.push(flattenValues(criteriaArgs[index]));
    }
    return sums.reduce<number>((total, value, rowIndex) => {
      const matches = criteriaRanges.every((range, criterionIndex) =>
        matchesCriteria(range[rowIndex] ?? null, criteriaArgs[criterionIndex * 2 + 1] as CellValue),
      );
      return matches ? total + (typeof value === 'number' ? value : 0) : total;
    }, 0);
  });

  parser.setFunction('COUNTIFS', (params) => {
    if (!Array.isArray(params) || params.length < 2 || params.length % 2 !== 0) {
      throw new Error('COUNTIFS memerlukan pasangan criteria_range/criteria.');
    }
    const criteriaRanges: CellValue[][] = [];
    for (let index = 0; index < params.length; index += 2) {
      criteriaRanges.push(flattenValues(params[index]));
    }
    const rowCount = criteriaRanges[0]?.length ?? 0;
    return Array.from({ length: rowCount }, (_, rowIndex) =>
      criteriaRanges.every((range, criterionIndex) =>
        matchesCriteria(range[rowIndex] ?? null, params[criterionIndex * 2 + 1] as CellValue),
      ),
    ).filter(Boolean).length;
  });

  parser.setFunction('VLOOKUP', (params) => {
    if (!Array.isArray(params) || params.length < 3) throw new Error('Argumen VLOOKUP tidak lengkap.');
    const [lookupValue, rawTable, rawIndex, exactMatch] = params;
    const table = asMatrix(rawTable);
    const returnIndex = Number(rawIndex) - 1;
    const match = table.find((row) => matchesCriteria(row[0] ?? null, lookupValue as CellValue));
    if (returnIndex < 0 || !match || returnIndex >= match.length) {
      throw new Error('VLOOKUP tidak menemukan nilai yang dicari pada kolom lookup.');
    }
    if (exactMatch === false && !match) throw new Error('VLOOKUP approximate lookup gagal.');
    return match[returnIndex];
  });

  parser.setFunction('XLOOKUP', (params) => {
    if (!Array.isArray(params) || params.length < 3) throw new Error('Argumen XLOOKUP tidak lengkap.');
    const [lookupValue, lookupRange, returnRange, ifNotFound] = params;
    const lookupValues = flattenValues(lookupRange);
    const returnValues = flattenValues(returnRange);
    const matchIndex = lookupValues.findIndex((value) =>
      matchesCriteria(value, lookupValue as CellValue),
    );
    if (matchIndex < 0) {
      if (ifNotFound !== undefined) return ifNotFound;
      throw new Error('XLOOKUP tidak menemukan nilai yang dicari.');
    }
    return returnValues[matchIndex] ?? null;
  });

  parser.setFunction('SUMPRODUCT', (params) => {
    if (!Array.isArray(params) || params.length === 0) return 0;
    const ranges = params.map(flattenValues);
    const rowCount = Math.max(...ranges.map((range) => range.length));
    return Array.from({ length: rowCount }, (_, rowIndex) =>
      ranges.reduce((product, range) => product * numericValue(range[rowIndex] ?? null), 1),
    ).reduce((sum, product) => sum + product, 0);
  });
}

function toParserFormula(formula: string): string {
  let converted = '';
  let insideString = false;
  for (let index = 0; index < formula.length; index += 1) {
    const character = formula[index];
    if (character === '"') {
      converted += character;
      if (insideString && formula[index + 1] === '"') {
        converted += formula[++index];
        continue;
      }
      insideString = !insideString;
    } else {
      converted += !insideString && character === ';' ? ',' : character;
    }
  }
  return converted.startsWith('=') ? converted.slice(1) : converted;
}

export function evaluateExcelFormula(
  formula: string,
  caseStudy: Pick<CaseStudy, 'dataset'>,
  rows: DataRow[],
): CellValue {
  if (!formula.trim()) throw new Error('Formula kosong.');
  if (formula.includes('!') || formula.includes('[') || formula.includes(']')) {
    throw new Error('Formula engine hanya menerima referensi sel A1 pada satu sheet dataset.');
  }
  const specializedResult = evaluateMultiCriteriaFormula(formula, caseStudy, rows);
  if (specializedResult !== undefined) return specializedResult;

  const parser = new Parser();
  registerFormulaFunctions(parser);
  parser.on('callCellValue', (coordinate, done) => {
    const rowIndex = coordinate.row.index - 1;
    const columnName = caseStudy.dataset.columns[coordinate.column.index]?.name;
    done(rowIndex < 0 || !columnName ? null : rows[rowIndex]?.[columnName] ?? null);
  });
  parser.on('callRangeValue', (start, end, done) => {
    const matrix: FormulaMatrix = [];
    for (let rowIndex = start.row.index; rowIndex <= end.row.index; rowIndex += 1) {
      const currentRow: CellValue[] = [];
      for (let columnIndex = start.column.index; columnIndex <= end.column.index; columnIndex += 1) {
        const columnName = caseStudy.dataset.columns[columnIndex]?.name;
        currentRow.push(
          rowIndex < 1 || !columnName ? null : rows[rowIndex - 1]?.[columnName] ?? null,
        );
      }
      matrix.push(currentRow);
    }
    done(matrix);
  });

  const result = parser.parse(toParserFormula(formula));
  if (result.error) {
    throw new Error(`Formula tidak dapat dieksekusi (${result.error}).`);
  }
  if (result.result === null) {
    throw new Error('Formula berhasil diparse tetapi tidak menghasilkan nilai.');
  }
  return result.result;
}

export function validateTaskCalculation(
  task: Task,
  formula: string,
  caseStudy: Pick<CaseStudy, 'dataset' | 'level' | 'excelVersion'>,
  rows: DataRow[],
): CellValue {
  if (!formula.trim()) throw new Error(`Tugas ${task.no}: formula kosong.`);
  // Validasi columnsUsed dan kolom yang tidak ada sudah dilakukan di validator.ts
  // Di sini hanya validasi eksekusi formula
  return evaluateExcelFormula(formula, caseStudy, rows);
}
