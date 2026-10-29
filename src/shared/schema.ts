import { z } from 'zod';

export const LevelEnum = z.enum(['easy', 'middle', 'advance', 'portfolio']);
export type Level = z.infer<typeof LevelEnum>;

export const ExcelVersionEnum = z.enum(['2016/2019', 'Microsoft 365']);
export type ExcelVersion = z.infer<typeof ExcelVersionEnum>;

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

export const PortfolioBriefSchema = z.object({
  clientBrief: z.string(),
  deliverables: z.array(z.string()),
  readmeTemplate: z.string(),
});
export type PortfolioBrief = z.infer<typeof PortfolioBriefSchema>;

export const CaseStudySchema = z.object({
  id: z.string().optional(),
  seed: z.string(),
  createdAt: z.string().optional(),
  title: z.string().min(3),
  level: LevelEnum,
  role: z.string().min(2),
  excelVersion: ExcelVersionEnum.default('Microsoft 365'),
  scenario: z.string().min(10),
  tasks: z.array(TaskSchema).min(1),
  dataTraps: z.array(z.string()).default([]),
  formulas: FormulasSchema,
  dataset: DatasetSchema,
  answerKey: z.array(AnswerKeyItemSchema).default([]),
  rubric: z.array(z.string()).optional(),
  portfolioBrief: PortfolioBriefSchema.optional(),
});
export type CaseStudy = z.infer<typeof CaseStudySchema>;

export const GenerateRequestSchema = z.object({
  level: LevelEnum,
  role: z.string().min(2),
  excelVersion: ExcelVersionEnum,
  taskCount: z.number().min(2).max(10).default(5),
  seed: z.string().optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const RegenerateTaskRequestSchema = z.object({
  caseStudy: CaseStudySchema,
  taskNo: z.number(),
});
export type RegenerateTaskRequest = z.infer<typeof RegenerateTaskRequestSchema>;
