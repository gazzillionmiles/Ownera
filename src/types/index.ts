export type ID = string;
export type Timestamp = string;

export interface Message {
  sender: 'USER' | 'OTHER';
  text: string;
  timestamp?: string;
}

export * from './auth';
export * from './saas';
export * from './ownera';
