import React, { useState } from 'react';
import { Lead, LeadStatus, WeeklyConfig } from '../types';
import {
  Users,
  Search,
  DollarSign,
  Bell,
  CheckCircle2,
  ExternalLink,
  Instagram,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { copyToClipboard, isFollowUpDue } from '../utils/storage';
import confetti from 'canvas-confetti';

interface PipelineViewProps {
  leads: Lead[];
  config: WeeklyConfig;
  onUpdateLead: (lead: Lead) => void;
  onSelectLead: (lead: Lead) => void;
}

interface StageConfig {
  key: LeadStatus;
  label: string;
  badge: string;
  accentColor: string;
  headerBorder: string;
  headerBg: string;
  glowClass: string;
}

const STAGES: StageConfig[] = [
  {
    key: 'abordado',
    label: 'Abordados',
    badge: '1ª Mensagem Enviada',
    accentColor: 'text-indigo-400',
    headerBorder: 'border-indigo-500/40',
    headerBg: 'bg-indigo-950/20',
    glowClass: 'border-indigo-500/30'
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    badge: 'Cobrar Resposta (2+ dias)',
    accentColor: 'text-amber-400',
    headerBorder: 'border-amber-500/50',
    headerBg: 'bg-amber-950/20',
    glowClass: 'border-amber-500/40'
  },
  {
    key: 'negociacao',
    label: 'Em Negociação',
    badge: 'Conversando Proposta',
    accentColor: 'text-teal-300',
    headerBorder: 'border-teal-500/50',
    headerBg: 'bg-teal-950/25',
    glowClass: 'border-teal-500/40'
  },
  {
    key: 'vendido',
    label: '★ Vendido',
    badge: 'Páginas Vendidas',
    accentColor: 'text-emerald-400',
    headerBorder: 'border-emerald-500/60',
    headerBg: 'bg-emerald-950/30',
    glowClass: 'border-emerald-500/50 ring-1 ring-emerald-500/20'
  },
  {
    key: 'perdido',
    label: 'Sem Interesse',
    badge: 'Arquivados',
    accentColor: 'text-slate-400',
    headerBorder: 'border-slate-800',
    headerBg: 'bg-slate-900/40',
    glowClass: 'border-slate-800'
  },
];

export const PipelineView: React.FC<PipelineViewProps> = ({
  leads,
  config,
  onUpdateLead,
  onSelectLead,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Consideramos no CRM todos os leads abordados ou que avançaram de fase
  const prospectados = leads.filter((l) => l.status !== 'nao_abordado');

  const filteredLeads = prospectados.filter((lead) => {
    const matchesSearch =
      lead.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const handleCopy = async (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = text.replace('@', '');
    const success = await copyToClipboard(clean);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleAdvanceStatus = (lead: Lead, newStatus: LeadStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    let updated: Lead = {
      ...lead,
      status: newStatus,
      updatedAt: now,
    };

    if (newStatus === 'vendido') {
      updated.closedAt = now;
      updated.saleValue = lead.saleValue > 0 ? lead.saleValue : config.defaultSalePrice || 100;
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#059669', '#FBBF24', '#F59E0B']
        });
      } catch (err) {}
    } else if (lead.status === 'vendido') {
      updated.closedAt = null;
      updated.saleValue = 0;
    }

    onUpdateLead(updated);
  };

  // Métricas do CRM
  const totalClosedCount = prospectados.filter((l) => l.status === 'vendido').length;
  const totalRevenue = prospectados
    .filter((l) => l.status === 'vendido')
    .reduce((sum, l) => sum + (Number(l.saleValue) || 0), 0);
  const totalNegotiatingRevenue = prospectados
    .filter((l) => l.status === 'negociacao')
    .reduce((sum, l) => sum + (Number(l.saleValue) || config.defaultSalePrice || 100), 0);
  const conversionRate = prospectados.length > 0
    ? Math.round((totalClosedCount / prospectados.length) * 100)
    : 0;
  const followUpDueCount = prospectados.filter(isFollowUpDue).length;

  const currentStageIndex = STAGES.findIndex((s) => s.key === selectedStageFilter);
  const prevStage = currentStageIndex > 0 ? STAGES[currentStageIndex - 1] : null;
  const nextStage = currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Executive Pride Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Award className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Pipeline de Fechamento &amp; CRM
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono">
                {prospectados.length} no funil
              </span>
            </div>
          </div>

          {/* Quick Search & View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por @, nome..."
                className="w-full sm:w-56 bg-slate-950/90 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'kanban' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Colunas
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-emerald-500/40 rounded-xl p-3 sm:p-3.5">
            <div className="flex items-center justify-between text-slate-300 text-xs">
              <span>Vendas Fechadas</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5 font-mono">
              R$ {totalRevenue.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">
              {totalClosedCount} {totalClosedCount === 1 ? 'página vendida' : 'páginas vendidas'}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-teal-500/30 rounded-xl p-3 sm:p-3.5">
            <div className="flex items-center justify-between text-slate-300 text-xs">
              <span>Em Negociação</span>
              <Flame className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-teal-300 mt-0.5 font-mono">
              R$ {totalNegotiatingRevenue.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">
              Potencial em conversação
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-3.5">
            <div className="flex items-center justify-between text-slate-300 text-xs">
              <span>Taxa de Conversão</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
              {conversionRate}%
            </p>
            <span className="text-[11px] text-slate-400 font-medium">
              Dos leads abordados
            </span>
          </div>

          <div className={`bg-slate-950/60 border rounded-xl p-3 sm:p-3.5 ${followUpDueCount > 0 ? 'border-amber-600/70 bg-amber-950/20' : 'border-slate-800'}`}>
            <div className="flex items-center justify-between text-slate-300 text-xs">
              <span>Follow-ups Pendentes</span>
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <p className={`text-xl sm:text-2xl font-black mt-0.5 font-mono ${followUpDueCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {followUpDueCount}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">
              {followUpDueCount > 0 ? 'Aguardando sua cobrança!' : 'Todos em dia'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Mobile Navigation Bar between Stages */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
        <button
          onClick={() => setSelectedStageFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            selectedStageFilter === 'all'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          Todas ({prospectados.length})
        </button>
        {STAGES.map((st) => {
          const count = prospectados.filter((l) => l.status === st.key).length;
          const isCurrent = selectedStageFilter === st.key;
          return (
            <button
              key={st.key}
              onClick={() => setSelectedStageFilter(st.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isCurrent
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span>{st.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isCurrent ? 'bg-slate-950 text-emerald-400 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Kanban Content */}
      {viewMode === 'kanban' ? (
        <div className={`
          ${selectedStageFilter !== 'all' ? 'flex flex-col md:grid md:grid-cols-5' : 'flex md:grid md:grid-cols-5 overflow-x-auto snap-x snap-mandatory px-1 md:px-0'}
          gap-3.5 pb-3 pt-1 scrollbar-thin
        `}>
          {STAGES.map((st) => {
            const isSelected = selectedStageFilter === st.key;
            const isFilteredOutOnMobile = selectedStageFilter !== 'all' && !isSelected;
            const stageLeads = filteredLeads.filter((l) => l.status === st.key);
            const stageRevenue = stageLeads.reduce((acc, l) => acc + (Number(l.saleValue) || (st.key === 'vendido' ? 100 : 0)), 0);

            return (
              <div
                key={st.key}
                id={`crm-stage-${st.key}`}
                className={`
                  ${isFilteredOutOnMobile ? 'hidden md:flex' : 'flex'}
                  ${selectedStageFilter !== 'all' && isSelected ? 'w-full md:w-auto ring-2 ring-emerald-500/40 shadow-xl' : 'w-[90vw] max-w-[360px] md:w-auto shrink-0 snap-center'}
                  flex-col bg-slate-900/90 border rounded-2xl overflow-hidden transition-all duration-200 min-h-[480px] ${st.headerBorder}
                `}
              >
                {/* Stage Header */}
                <div className={`p-3.5 border-b border-slate-800/80 ${st.headerBg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${st.accentColor} flex items-center gap-1.5`}>
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {st.label}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-white font-mono">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
                    <span>{st.badge}</span>
                    {st.key === 'vendido' && stageRevenue > 0 && (
                      <span className="text-emerald-400 font-bold font-mono">
                        R$ {stageRevenue}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 p-3 flex-1 overflow-y-auto max-h-[620px]">
                  {stageLeads.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl my-4">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const followDue = isFollowUpDue(lead);
                      const cleanUser = lead.username.replace('@', '');
                      const igUrl = `https://instagram.com/${cleanUser}`;

                      return (
                        <div
                          key={lead.id}
                          onClick={() => onSelectLead(lead)}
                          className={`group relative p-3 sm:p-3.5 rounded-xl border bg-slate-950 hover:bg-slate-900/90 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            st.key === 'vendido'
                              ? 'border-emerald-500/70 bg-emerald-950/20 ring-1 ring-emerald-500/30'
                              : followDue
                              ? 'border-amber-500/80 bg-amber-950/25'
                              : 'border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          {/* Card Header: Username & Instagram icon */}
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                              <span className="text-xs sm:text-sm font-bold text-white font-mono truncate">
                                @{cleanUser}
                              </span>
                            </div>

                            <a
                              href={igUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md text-slate-400 hover:text-pink-400 hover:bg-pink-950/40 transition-colors shrink-0"
                              title="Abrir perfil no Instagram"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {/* Full Name & Category */}
                          <p className="text-xs text-slate-200 font-medium truncate">
                            {lead.fullName || 'Lead Instagram'}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 font-medium">
                            <span className="truncate">{lead.category || 'Geral'}</span>
                            {lead.linkType && lead.linkType !== 'none' && (
                              <>
                                <span>·</span>
                                <span className="text-teal-400 font-mono font-semibold">{lead.linkType}</span>
                              </>
                            )}
                          </div>

                          {/* Follow-up warning if due */}
                          {followDue && (
                            <div className="mt-2 p-1.5 rounded-lg bg-amber-950/70 border border-amber-600/80 text-[11px] text-amber-300 font-bold flex items-center gap-1">
                              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Sem resposta há 2+ dias! Cobrar</span>
                            </div>
                          )}

                          {/* Closed Sale Gold Badge */}
                          {st.key === 'vendido' && (
                            <div className="mt-2 p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/80 text-xs text-emerald-300 font-bold flex items-center justify-between font-mono">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Venda Fechada
                              </span>
                              <span className="text-emerald-300 font-black">
                                R$ {lead.saleValue || config.defaultSalePrice || 100}
                              </span>
                            </div>
                          )}

                          {/* Action Bar inside Card */}
                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <button
                              onClick={(e) => handleCopy(lead.id, cleanUser, e)}
                              className="text-slate-400 hover:text-white font-medium flex items-center gap-1 transition-colors"
                              title="Copiar @ do Instagram"
                            >
                              {copiedId === lead.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-bold">Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copiar @</span>
                                </>
                              )}
                            </button>

                            {/* Progression Buttons */}
                            {st.key === 'abordado' && (
                              <button
                                onClick={(e) => handleAdvanceStatus(lead, 'negociacao', e)}
                                className="px-2 py-0.5 rounded-lg bg-teal-950/80 border border-teal-700/80 text-teal-300 hover:bg-teal-500 hover:text-slate-950 font-bold transition-all"
                              >
                                Negociar →
                              </button>
                            )}

                            {st.key === 'follow_up' && (
                              <button
                                onClick={(e) => handleAdvanceStatus(lead, 'negociacao', e)}
                                className="px-2 py-0.5 rounded-lg bg-teal-950/80 border border-teal-700/80 text-teal-300 hover:bg-teal-500 hover:text-slate-950 font-bold transition-all"
                              >
                                Respondeu! →
                              </button>
                            )}

                            {st.key === 'negociacao' && (
                              <button
                                onClick={(e) => handleAdvanceStatus(lead, 'vendido', e)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3 text-slate-950" />
                                <span>Fechou!</span>
                              </button>
                            )}

                            {st.key === 'vendido' && (
                              <button
                                onClick={(e) => handleAdvanceStatus(lead, 'negociacao', e)}
                                className="text-[11px] text-slate-400 hover:text-slate-200"
                                title="Voltar para negociação se necessário"
                              >
                                Desfazer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Mobile Stage Quick Switcher Footer when viewing a single stage */}
                {selectedStageFilter === st.key && (
                  <div className="flex md:hidden items-center justify-between p-2.5 bg-slate-950/90 border-t border-slate-800/90 text-xs">
                    {prevStage ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStageFilter(prevStage.key);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1"
                      >
                        ← {prevStage.label}
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStageFilter('all');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold"
                    >
                      Ver Todas
                    </button>

                    {nextStage ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStageFilter(nextStage.key);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-700/80 text-emerald-300 hover:text-white font-bold flex items-center gap-1"
                      >
                        {nextStage.label} →
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-300 font-bold">
                <tr>
                  <th className="py-3 px-4">Instagram</th>
                  <th className="py-3 px-4">Nome / Nicho</th>
                  <th className="py-3 px-4">Status no CRM</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum lead encontrado no CRM.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const cleanUser = lead.username.replace('@', '');
                    const igUrl = `https://instagram.com/${cleanUser}`;

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                            <span className="font-bold font-mono text-white">@{cleanUser}</span>
                            <a
                              href={igUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-pink-400"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-medium text-white block">{lead.fullName || 'Lead'}</span>
                            <span className="text-xs text-slate-400">{lead.category || 'Geral'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            lead.status === 'vendido'
                              ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                              : lead.status === 'negociacao'
                              ? 'bg-teal-950 border border-teal-700 text-teal-300'
                              : lead.status === 'follow_up'
                              ? 'bg-amber-950 border border-amber-700 text-amber-300'
                              : 'bg-indigo-950 border border-indigo-700 text-indigo-300'
                          }`}>
                            {lead.status === 'vendido'
                              ? '★ Vendido'
                              : lead.status === 'negociacao'
                              ? 'Em Negociação'
                              : lead.status === 'follow_up'
                              ? 'Follow-up'
                              : 'Abordado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {lead.status === 'vendido'
                            ? `R$ ${lead.saleValue || config.defaultSalePrice || 100}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleCopy(lead.id, cleanUser, e)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                            >
                              {copiedId === lead.id ? 'Copiado!' : 'Copiar @'}
                            </button>
                            {lead.status !== 'vendido' && (
                              <button
                                onClick={(e) => handleAdvanceStatus(lead, 'vendido', e)}
                                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                              >
                                Fechou!
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
