import { z } from 'zod';

export const Uuid = z.string().uuid();

export const TransactionType = z.enum(['income', 'expense', 'transfer']);
export const SourceType = z.enum(['manual', 'receipt_image', 'card_capture', 'bank_capture', 'pdf', 'csv', 'excel']);
export const CategoryType = z.enum(['income', 'expense', 'common']);
export const PaymentMethodType = z.enum(['card', 'bank', 'cash', 'pay', 'other']);
export const DuplicateStatus = z.enum(['none', 'suspected', 'duplicate']);
export const CandidateAction = z.enum(['pending', 'approved', 'rejected', 'edited']);

export const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const CreateCategoryInput = z.object({
  name: z.string().min(1).max(40),
  type: CategoryType,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(40).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

export const UpdateCategoryInput = CreateCategoryInput.partial();
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInput>;

export const CreatePaymentMethodInput = z.object({
  name: z.string().min(1).max(40),
  type: PaymentMethodType,
  issuer_name: z.string().max(40).optional(),
  // 클라이언트는 마지막 4자리만 입력
  last4: z.string().regex(/^\d{4}$/).optional(),
});
export type CreatePaymentMethodInput = z.infer<typeof CreatePaymentMethodInput>;

export const UpdatePaymentMethodInput = CreatePaymentMethodInput.partial();
export type UpdatePaymentMethodInput = z.infer<typeof UpdatePaymentMethodInput>;

export const CreateTransactionInput = z.object({
  transaction_date: ISODate,
  type: TransactionType,
  amount: z.number().int(),
  merchant_name: z.string().max(120).optional().nullable(),
  description: z.string().max(500).optional().default(''),
  category_id: Uuid.nullable().optional(),
  payment_method_id: Uuid.nullable().optional(),
  memo: z.string().max(500).optional().nullable(),
  household_id: Uuid.nullable().optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionInput>;

export const UpdateTransactionInput = CreateTransactionInput.partial();
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInput>;

export const TransactionListQuery = z.object({
  from: ISODate.optional(),
  to: ISODate.optional(),
  type: TransactionType.optional(),
  category_id: Uuid.optional(),
  payment_method_id: Uuid.optional(),
  q: z.string().max(100).optional(),
  scope: z.enum(['all', 'personal', 'household']).optional(),
  household_id: Uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type TransactionListQuery = z.infer<typeof TransactionListQuery>;
