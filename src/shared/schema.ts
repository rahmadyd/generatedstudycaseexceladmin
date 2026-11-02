import { z } from 'zod';
import {
  DatasetColumnSchema,
  DatasetSchema,
  type DatasetColumn,
  type DatasetSpec,
} from '@/lib/column-types';

export { DatasetColumnSchema, DatasetSchema };
export type { DatasetColumn, DatasetSpec };

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
export const AnswerModeEnum = z.enum(['computed', 'rubric']);
export type AnswerMode = z.infer<typeof AnswerModeEnum>;
export const TaskKindEnum = z.enum([
  'calculation',
  'conditional-logic',
  'sorting',
  'filtering',
  'formatting',
  'conditional-aggregation',
  'lookup',
  'data-validation',
  'multi-criteria-analysis',
  'pivot-table',
  'conditional-formatting',
  'named-range',
  'portfolio',
]);
export type TaskKind = z.infer<typeof TaskKindEnum>;

export const TaskSchema = z.object({
  no: z.number(),
  instruction: z.string().min(3),
  hint: z.string().default(''),
  targetResult: z.string().default(''),
  columnsUsed: z.array(z.string()).default([]),
  dateColumn: z.string().optional(),
  formula: z.string().optional(),
  answerMode: AnswerModeEnum.default('computed'),
  taskKind: TaskKindEnum.default('calculation'),
  rubricChecklist: z.array(z.string()).default([]),
});
export type Task = z.infer<typeof TaskSchema>;

export const AnswerKeyItemSchema = z.object({
  task: z.number(),
  formula: z.string().min(1).optional(),
  explanation: z.string().default(''),
  expectedValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  columnsUsed: z.array(z.string()).default([]),
  mode: AnswerModeEnum.default('computed'),
  rubricChecklist: z.array(z.string()).default([]),
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
  generationTheme: z.string().optional(),
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
  recentThemes: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
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
