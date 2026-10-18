import React from 'react';
import { Target, Sparkles, MessageSquare, Plus, Bell, DollarSign, Calendar, Sliders, ArrowUpRight, Users } from 'lucide-react';
import { Lead, WeeklyConfig, FinancialStats } from '../types';
import { isFollowUpDue } from '../utils/storage';

interface HeaderProps {
  leads: Lead[];
  config: WeeklyConfig;
  onOpenRaioX: () => void;
  onOpenCopilot: () => void;
  onOpenConfig: () => void;
  onNavigateToToday?: () => void;
  stats: FinancialStats;
}

export const Header: React.FC<HeaderProps> = ({
  leads,
  config,
  onOpenRaioX,
  onOpenCopilot,
  onOpenConfig,
  onNavigateToToday,
  stats,
}) => {
  const followUpLeads = leads.filter(isFollowUpDue);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-sans">
                  LeadRadar <span className="text-emerald-400">AI</span>
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-400/90 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  PROSPECÇÃO
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics (Desktop only) */}
          <div className="hidden lg:flex items-center gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="font-medium">Semana:</span>
              <span className="font-bold text-white">R$ {stats.weekSales.toLocaleString('pt-BR')}</span>
              <span className="text-slate-400">({stats.weekCount} vendas)</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200">
              <Target className="w-4 h-4 text-teal-400" />
              <span className="font-medium">Meta diária:</span>
              <span className="font-bold text-white">{config.targetPerDay}/dia</span>
            </div>

            {followUpLeads.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-600/80 text-amber-200 font-semibold animate-pulse text-xs">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>{followUpLeads.length} follow-up</span>
              </div>
            )}
          </div>

          {/* Action Buttons (Clean & Compact) */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenConfig}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700/80 transition-all"
              title="Configurações &amp; Backup"
              aria-label="Configurações"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenCopilot}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/50 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Abrir Copilot IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Copilot IA</span>
            </button>

            <button
              onClick={onOpenRaioX}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              title="Analisar print do Instagram"
            >
              <Plus className="w-4 h-4" />
              <span>Subir Print</span>
            </button>
          </div>
        </div>

        {/* Mobile follow-up warning strip */}
        {followUpLeads.length > 0 && (
          <div className="lg:hidden mt-2.5 flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-800/70 text-amber-300 text-xs">
            <span className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              {followUpLeads.length} {followUpLeads.length === 1 ? 'lead precisa de follow-up (+2 dias)' : 'leads precisam de follow-up (+2 dias)'}
            </span>
            {onNavigateToToday && (
              <button
                onClick={onNavigateToToday}
                className="font-bold underline text-amber-200"
              >
                Ver
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
