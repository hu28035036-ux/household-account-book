export type TransactionType = 'income' | 'expense' | 'transfer';
export type SourceType = 'manual' | 'receipt_image' | 'card_capture' | 'bank_capture' | 'pdf' | 'csv' | 'excel';
export type DuplicateStatus = 'none' | 'suspected' | 'duplicate';
export type CandidateAction = 'pending' | 'approved' | 'rejected' | 'edited';
export type FileStatus =
  | 'uploaded'
  | 'ocr_processing'
  | 'ocr_done'
  | 'ai_processing'
  | 'parsed'
  | 'failed'
  | 'approved'
  | 'deleted';
