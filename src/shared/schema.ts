import { z } from 'zod';

export const LevelEnum = z.enum(['easy', 'middle', 'advance']);
export type Level = z.infer<typeof LevelEnum>;

export const ExcelVersionEnum = z.enum(['2016/2019', 'Microsoft 365']);
export type ExcelVersion = z.infer<typeof ExcelVersionEnum>;

export const FormulaStyleEnum = z.enum(['classic', 'modern']);
export type FormulaStyle = z.infer<typeof FormulaStyleEnum>;

export const INDUSTRY_OPTIONS = [
  'Kelapa sawit',
  'Karet',
  'Kopi',
  'Pertambangan batu bara',
  'Perkebunan',
  'Perikanan',
  'Peternakan',
  'Pertanian dan pangan',
  'Kehutanan dan kayu',
  'Otomotif dan bengkel',
  'Manufaktur',
  'Konstruksi',
  'Properti dan real estate',
  'Logistik dan ekspedisi',
  'Distribusi dan perdagangan',
  'Retail dan minimarket',
  'E-commerce',
  'Perbankan',
  'Leasing',
  'Asuransi',
  'Akuntansi dan keuangan',
  'Kesehatan: rumah sakit, klinik, apotek',
  'Pendidikan: sekolah dan kampus',
  'Pemerintahan dan kantor dinas',
  'Perhotelan dan pariwisata',
  'Restoran dan kafe (F&B)',
  'Telekomunikasi',
  'Energi dan listrik',
  'Percetakan dan advertising',
  'Konsultan dan jasa profesional',
] as const;
export const IndustryEnum = z.enum(['Acak', ...INDUSTRY_OPTIONS]);
export type Industry = z.infer<typeof IndustryEnum>;

export const TaskCountModeEnum = z.enum(['auto', 'manual']);
export type TaskCountMode = z.infer<typeof TaskCountModeEnum>;

export const TaskSchema = z.object({
  no: z.number(),
  instruction: z.string().min(3),
  hint: z.string().default(''),
  targetResult: z.string().default(''),
});
export type Task = z.infer<typeof TaskSchema>;

export const DatasetColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['date', 'text', 'number', 'int', 'currency', 'enum']),
  values: z.array(z.string()).optional(),
  range: z.union([z.tuple([z.number(), z.number()]), z.tuple([z.string(), z.string()])]).optional(),
}).superRefine((column, context) => {
  if (column.values && column.type !== 'enum') {
    context.addIssue({
      code: 'custom',
      path: ['values'],
      message: 'values hanya boleh digunakan pada kolom enum.',
    });
  }
  if (column.type === 'enum' && (!column.values || column.values.length === 0)) {
    context.addIssue({
      code: 'custom',
      path: ['values'],
      message: 'Kolom enum harus memiliki minimal satu nilai teks.',
    });
  }
  if (!column.range) return;

  if (column.type === 'number' || column.type === 'int' || column.type === 'currency') {
    const [min, max] = column.range;
    if (
      typeof min !== 'number' ||
      typeof max !== 'number' ||
      !Number.isSafeInteger(min) ||
      !Number.isSafeInteger(max) ||
      min > max
    ) {
      context.addIssue({
        code: 'custom',
        path: ['range'],
        message: 'Range numeric harus dua bilangan bulat aman dengan min <= max.',
      });
    }
    return;
  }

  if (column.type === 'date') {
    const [start, end] = column.range;
    const isIsoDate = (value: string | number): value is string => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
      context.addIssue({
        code: 'custom',
        path: ['range'],
        message: 'Range tanggal harus dua tanggal ISO valid dan berurutan.',
      });
    }
    return;
  }

  context.addIssue({
    code: 'custom',
    path: ['range'],
    message: 'Range hanya boleh digunakan pada kolom tanggal atau numerik.',
  });
});
export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

export const DatasetSchema = z.object({
  sheetName: z.string().default('Data_Admin'),
  rows: z.number().min(20).max(1000).default(150),
  columns: z.array(DatasetColumnSchema).min(3),
});
export type DatasetSpec = z.infer<typeof DatasetSchema>;

export const AnswerKeyItemSchema = z.object({
  task: z.number(),
  formula: z.string().min(1),
  explanation: z.string().default(''),
});
export type AnswerKeyItem = z.infer<typeof AnswerKeyItemSchema>;

export const FormulasSchema = z.object({
  recommended: z.array(z.string()).default([]),
  allowed: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
});
export type FormulasSpec = z.infer<typeof FormulasSchema>;

export const AnswerKeyStatusEnum = z.enum(['pending', 'available']);

export const CaseStudySchema = z.object({
  id: z.string().optional(),
  seed: z.string(),
  createdAt: z.string().optional(),
  title: z.string().min(3),
  level: LevelEnum,
  role: z.string().min(2),
  excelVersion: ExcelVersionEnum.default('Microsoft 365'),
  formulaStyle: FormulaStyleEnum.optional(),
  structuredReferenceAt: z.boolean().optional(),
  industry: IndustryEnum.optional(),
  taskCountMode: TaskCountModeEnum.optional(),
  taskCount: z.number().min(2).max(25).optional(),
  scenario: z.string().min(10),
  tasks: z.array(TaskSchema).min(1),
  dataTraps: z.array(z.string()).default([]),
  formulas: FormulasSchema,
  dataset: DatasetSchema,
  answerKey: z.array(AnswerKeyItemSchema).default([]),
  answerKeyStatus: AnswerKeyStatusEnum.optional(),
});
export type CaseStudy = z.infer<typeof CaseStudySchema>;

export const GenerateRequestSchema = z.object({
  level: LevelEnum,
  role: z.string().min(2),
  excelVersion: ExcelVersionEnum,
  formulaStyle: FormulaStyleEnum.optional(),
  structuredReferenceAt: z.boolean().optional(),
  industry: IndustryEnum.optional(),
  taskCountMode: TaskCountModeEnum.default('manual'),
  taskCount: z.number().min(2).max(25).default(5),
  seed: z.string().optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const RegenerateTaskRequestSchema = z.object({
  caseStudy: CaseStudySchema,
  taskNo: z.number(),
});
export type RegenerateTaskRequest = z.infer<typeof RegenerateTaskRequestSchema>;

export const GenerateMissingCaseContentRequestSchema = z.object({
  caseStudy: CaseStudySchema,
});
