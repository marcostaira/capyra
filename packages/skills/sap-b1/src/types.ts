export interface SapB1Config {
  baseUrl: string; // https://servidor:50000/b1s/v1
  companyDB: string;
  username: string;
  password: string;
  verifySsl?: boolean; // false em ambientes internos
}

export interface SapSession {
  sessionId: string;
  expiresAt: Date;
}

export interface SapQueryResult {
  value: Record<string, unknown>[];
  count?: number;
}

export interface SapDocument {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName: string;
  DocDate: string;
  DocDueDate: string;
  DocTotal: number;
  DocumentStatus: string;
  Lines?: SapDocumentLine[];
}

export interface SapDocumentLine {
  ItemCode: string;
  ItemDescription: string;
  Quantity: number;
  Price: number;
  LineTotal: number;
}

export interface SapItem {
  ItemCode: string;
  ItemName: string;
  OnHand: number;
  IsCommited: number;
  OnOrder: number;
  MinLevel: number;
}

export interface SapBusinessPartner {
  CardCode: string;
  CardName: string;
  CardType: string;
  Balance: number;
  Phone1: string;
  EmailAddress: string;
}
