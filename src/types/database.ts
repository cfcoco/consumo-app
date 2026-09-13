export type OwnerType = "mine" | "shared" | "person";
export type TransactionStatus = "projected" | "confirmed";
export type TransactionSource = "manual" | "import";
export type StatementFormat = "bna_bancor" | "bbva" | "naranja";
export type ReceivableStatus = "active" | "settled";
export type ChargeStatus = "pending" | "collected";

export interface Card {
  id: string;
  user_id: string;
  name: string;
  bank: string | null;
  closing_day: number | null;
  due_day: number | null;
  color: string | null;
  statement_format: StatementFormat | null;
  created_at: string;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface InstallmentSeries {
  id: string;
  user_id: string;
  card_id: string | null;
  category_id: string | null;
  person_id: string | null;
  description: string;
  owner_type: OwnerType;
  installment_amount: number;
  total_installments: number;
  start_month: string;
  is_fixed: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  card_id: string | null;
  series_id: string | null;
  category_id: string | null;
  person_id: string | null;
  description: string;
  raw_description: string | null;
  amount: number;
  currency: string;
  transaction_date: string;
  statement_month: string;
  installment_number: number | null;
  installment_total: number | null;
  owner_type: OwnerType;
  status: TransactionStatus;
  source: TransactionSource;
  is_fixed: boolean;
  created_at: string;
}

export interface Income {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  income_date: string;
  income_type: string | null;
  person_id: string | null;
  created_at: string;
}

export interface Receivable {
  id: string;
  user_id: string;
  person_id: string;
  card_id: string | null;
  category_id: string | null;
  source_transaction_id: string | null;
  description: string;
  installment_amount: number;
  total_installments: number;
  start_month: string;
  status: ReceivableStatus;
  settled_at: string | null;
  created_at: string;
}

export interface ReceivableCharge {
  id: string;
  user_id: string;
  receivable_id: string;
  person_id: string;
  description: string;
  amount: number;
  due_month: string;
  installment_number: number;
  installment_total: number;
  status: ChargeStatus;
  collected_at: string | null;
  note: string | null;
  created_at: string;
}
