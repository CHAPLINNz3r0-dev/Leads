export type DayOfWeek = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'pool';

export type LeadStatus =
  | 'nao_abordado'
  | 'abordado'
  | 'follow_up'
  | 'negociacao'
  | 'vendido'
  | 'perdido';

export type LinkType = 'linktree' | 'wame' | 'website' | 'none' | 'other';

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface Lead {
  id: string;
  username: string; // e.g. @studiobeleza
  fullName: string;
  bio: string;
  linkType: LinkType;
  linkUrl: string;
  category: string;
  followersApprox?: string;
  prospectingAngle?: string;
  priority: PriorityLevel;
  dayOfWeek: DayOfWeek;
  status: LeadStatus;
  approachedAt?: string | null;
  followUpDueAt?: string | null;
  closedAt?: string | null;
  saleValue: number; // in R$ (BRL)
  notes?: string;
  screenshotUrl?: string | null;
  weekId?: string; // e.g. '2026-W42' to support multiple living weeks
  createdAt: string;
  updatedAt: string;
}

export interface WeekInfo {
  id: string; // e.g. '2026-W42'
  label: string; // e.g. '13 Out - 18 Out'
  fullLabel: string; // e.g. 'Semana 13 a 18 de Outubro'
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  offsetWeeks: number;
}

export interface WeeklyConfig {
  targetPerDay: number; // default 10
  defaultSalePrice: number; // default 100
  activeWeekId: string; // currently selected week ID
  activeWeekOffset: number; // 0 = current week, -1 = last week
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachedLeadIds?: string[];
  executedAction?: {
    actionType: string;
    description?: string;
    updatedLeads?: Partial<Lead>[];
    configUpdate?: Partial<WeeklyConfig>;
  };
}

export interface FinancialStats {
  todaySales: number;
  todayCount: number;
  weekSales: number;
  weekCount: number;
  monthSales: number;
  monthCount: number;
  totalSales: number;
  totalCount: number;
  approachedCount: number;
  followUpCount: number;
  negotiatingCount: number;
  lostCount: number;
  conversionRate: number; // percentage
}
