import React, { useState } from 'react';
import { Lead, DayOfWeek, WeeklyConfig, WeekInfo } from '../types';
import {
  Sparkles,
  ArrowRight,
  Instagram,
  Link as LinkIcon,
  Bell,
  Plus,
  CheckCircle2,
  DollarSign,
  Clock,
  GripVertical,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Users,
  Filter,
  Check
} from 'lucide-react';
import { isFollowUpDue, getAvailableWeeks, getWeekInfo, getTodayContext } from '../utils/storage';

interface WeeklyBoardProps {
  leads: Lead[];
  config: WeeklyConfig;
  onUpdateLead: (lead: Lead) => void;
  onSelectLead: (lead: Lead) => void;
  onOpenRaioXForDay: (day: DayOfWeek) => void;
  onAutoBalanceWeek: () => void;
  activeWeekId: string;
  onSelectWeek: (weekId: string, offset: number) => void;
  onAdvanceWeek: () => void;
  onNavigateToPipeline?: () => void;
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'segunda', label: 'Segunda-feira', short: 'SEG' },
  { key: 'terca', label: 'Terça-feira', short: 'TER' },
  { key: 'quarta', label: 'Quarta-feira', short: 'QUA' },
  { key: 'quinta', label: 'Quinta-feira', short: 'QUI' },
  { key: 'sexta', label: 'Sexta-feira', short: 'SEX' },
];

export const WeeklyBoard: React.FC<WeeklyBoardProps> = ({
  leads,
  config,
  onUpdateLead,
  onSelectLead,
  onOpenRaioXForDay,
  onAutoBalanceWeek,
  activeWeekId,
  onSelectWeek,
  onAdvanceWeek,
  onNavigateToPipeline,
}) => {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<DayOfWeek | null>(null);
  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');
  const [confirmAdvanceWeek, setConfirmAdvanceWeek] = useState(false);

  // Semanas disponíveis para as abas
  const availableWeeks = getAvailableWeeks(leads, config.activeWeekOffset || 0);
  const currentWeekInfo = availableWeeks.find((w) => w.id === activeWeekId) || getWeekInfo(0);

  // Filtra leads pertencentes a esta semana selecionada (ou sem weekId associado para compatibilidade)
  const weekLeads = leads.filter((l) => !l.weekId || l.weekId === activeWeekId);

  const getLeadsForDay = (day: DayOfWeek) => {
    return weekLeads.filter((l) => {
      if (l.dayOfWeek !== day) return false;
      if (filterMode === 'pending') {
        // Modo padrão: apenas leads pendentes para serem prospectados neste dia
        return l.status === 'nao_abordado';
      }
      return true;
    });
  };

  const poolLeads = weekLeads.filter((l) => l.dayOfWeek === 'pool' && (filterMode === 'all' || l.status === 'nao_abordado'));

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent, day: DayOfWeek) => {
    e.preventDefault();
    setDragOverDay(day);
  };

  const handleDrop = (e: React.DragEvent, targetDay: DayOfWeek) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDragOverDay(null);
    setDraggedLeadId(null);

    if (!leadId) return;
    const targetLead = leads.find((l) => l.id === leadId);
    if (targetLead && (targetLead.dayOfWeek !== targetDay || targetLead.weekId !== activeWeekId)) {
      onUpdateLead({
        ...targetLead,
        dayOfWeek: targetDay,
        weekId: activeWeekId,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const totalWeekPendingLeads = DAYS.reduce((acc, d) => acc + weekLeads.filter(l => l.dayOfWeek === d.key && l.status === 'nao_abordado').length, 0);
  const totalWeekApproachedLeads = DAYS.reduce((acc, d) => acc + weekLeads.filter(l => l.dayOfWeek === d.key && l.status !== 'nao_abordado').length, 0);
  const totalTargetWeek = config.targetPerDay * 5; // 5 dias úteis (Segunda a Sexta)
  const todayCtx = getTodayContext();

  return (
    <div className="space-y-6">
      {/* ABAS DE SEMANAS / NAVEGAÇÃO TEMPORAL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-white">
                    {currentWeekInfo.fullLabel}
                  </h2>
                  {currentWeekInfo.isCurrent ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300">
                      Semana Atual
                    </span>
                  ) : null}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    Segunda a Sexta
                  </span>
                </div>
                <p className="text-xs text-emerald-300/90 mt-1 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{todayCtx.description}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação da Semana */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Reset de Domingo / Iniciar Nova Semana */}
            {confirmAdvanceWeek ? (
              <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-600 p-1 rounded-xl">
                <button
                  onClick={() => {
                    onAdvanceWeek();
                    setConfirmAdvanceWeek(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all animate-pulse"
                >
                  Confirmar Reset de Domingo
                </button>
                <button
                  onClick={() => setConfirmAdvanceWeek(false)}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAdvanceWeek(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title="Transfere leads pendentes da semana anterior para a nova e arquiva prospectados no CRM"
              >
                <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                <span>Reset de Domingo (Nova Semana)</span>
              </button>
            )}

            {/* Organizar com IA (Prioriza o dia mais próximo até lotar) */}
            <button
              onClick={onAutoBalanceWeek}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              title="Organiza os leads priorizando o dia mais próximo até lotar a meta diária (Segunda a Sexta)"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>Organizar com IA</span>
            </button>

            {/* Subir Prints */}
            <button
              onClick={() => onOpenRaioXForDay('pool')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Adicionar Leads</span>
            </button>
          </div>
        </div>

        {/* Abas Horizontais de Semanas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-800">
          <button
            onClick={() => {
              const currentIdx = availableWeeks.findIndex((w) => w.id === activeWeekId);
              if (currentIdx > 0) {
                const prev = availableWeeks[currentIdx - 1];
                onSelectWeek(prev.id, prev.offsetWeeks);
              }
            }}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex-shrink-0"
            title="Semana Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {availableWeeks.map((week) => {
              const isSelected = week.id === activeWeekId;
              const countInThisWeek = leads.filter((l) => l.weekId === week.id).length;

              return (
                <button
                  key={week.id}
                  onClick={() => onSelectWeek(week.id, week.offsetWeeks)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                      : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{week.label}</span>
                  {week.isCurrent && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-black uppercase ${isSelected ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                      Atual
                    </span>
                  )}
                  {countInThisWeek > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                      {countInThisWeek}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const currentIdx = availableWeeks.findIndex((w) => w.id === activeWeekId);
              if (currentIdx >= 0 && currentIdx < availableWeeks.length - 1) {
                const next = availableWeeks[currentIdx + 1];
                onSelectWeek(next.id, next.offsetWeeks);
              }
            }}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex-shrink-0"
            title="Próxima Semana"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Filtro & Informação dos Leads Prospectados */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <span className="font-semibold text-white">
              {totalWeekPendingLeads} leads prontos para prospecção
            </span>
            <span>·</span>
            <span className="text-slate-400">
              Meta: {totalTargetWeek} na semana ({config.targetPerDay}/dia)
            </span>
            {totalWeekApproachedLeads > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-400 font-bold">
                  {totalWeekApproachedLeads} abordados
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilterMode('pending')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'pending'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Apenas Pendentes
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  filterMode === 'all'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ver Todos (com Abordados)
              </button>
            </div>

            {onNavigateToPipeline && (
              <button
                onClick={onNavigateToPipeline}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-900/60 font-semibold text-xs flex items-center gap-1 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Ver CRM / Pipeline</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Quick Day Navigation Jumper */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 -mt-2 scrollbar-none">
        <span className="text-[11px] text-slate-400 font-bold shrink-0">Dia:</span>
        {DAYS.map((d) => {
          const isToday = currentWeekInfo.isCurrent && !todayCtx.isWeekend && todayCtx.activeWorkDay === d.key;
          const count = getLeadsForDay(d.key).length;
          return (
            <button
              key={d.key}
              onClick={() => {
                const el = document.getElementById(`day-col-${d.key}`);
                el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${
                isToday
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span>{d.short}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isToday ? 'bg-slate-950 text-emerald-400 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Week Grid (Segunda a Sexta - Dias um ao lado do outro) */}
      <div className="flex md:grid md:grid-cols-5 gap-3.5 overflow-x-auto snap-x snap-mandatory px-1 md:px-0 pb-3 pt-1 scrollbar-thin">
        {DAYS.map((day) => {
          const dayLeads = getLeadsForDay(day.key);
          const allDayLeads = weekLeads.filter((l) => l.dayOfWeek === day.key);
          const count = dayLeads.length;
          const target = config.targetPerDay;
          const isComplete = count >= target;
          const percent = Math.min(100, Math.round((count / target) * 100));
          const isOver = dragOverDay === day.key;
          const isTodayColumn = currentWeekInfo.isCurrent && !todayCtx.isWeekend && todayCtx.activeWorkDay === day.key;

          const approachedCount = allDayLeads.filter((l) => l.status !== 'nao_abordado').length;
          const salesCount = allDayLeads.filter((l) => l.status === 'vendido').length;

          return (
            <div
              key={day.key}
              id={`day-col-${day.key}`}
              onDragOver={(e) => handleDragOver(e, day.key)}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => handleDrop(e, day.key)}
              className={`w-[90vw] max-w-[340px] md:w-auto shrink-0 snap-center flex flex-col bg-slate-900/90 border rounded-2xl overflow-hidden transition-all duration-200 min-h-[460px] ${
                isOver
                  ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/30'
                  : isTodayColumn
                  ? 'border-emerald-500/60 ring-1 ring-emerald-500/20 hover:border-emerald-400'
                  : 'border-slate-800 hover:border-slate-700/80'
              }`}
            >
              {/* Day Column Header */}
              <div className={`p-3.5 border-b ${isTodayColumn ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-slate-950/50 border-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{day.label}</span>
                    <span className="text-[11px] font-semibold text-slate-300 font-mono">
                      {day.short}
                    </span>
                    {isTodayColumn && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
                        Hoje
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                      isComplete
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {count}/{target}
                  </span>
                </div>

                {/* Progress bar to target */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isComplete ? 'bg-emerald-400' : 'bg-teal-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Micro stats for the day */}
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <span>{approachedCount} abordados</span>
                  {salesCount > 0 && (
                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                      <DollarSign className="w-3.5 h-3.5" /> {salesCount} vendas
                    </span>
                  )}
                </div>
              </div>

              {/* Day Cards List */}
              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[520px]">
                {dayLeads.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-slate-400 border border-dashed border-slate-800 rounded-xl my-4">
                    <p className="text-xs text-slate-300 font-bold">Nenhum lead pendente</p>
                    <p className="text-xs text-slate-400 mt-0.5">Arraste ou clique abaixo</p>
                  </div>
                ) : (
                  dayLeads.map((lead) => {
                    const followDue = isFollowUpDue(lead);
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => onSelectLead(lead)}
                        className={`group relative p-3 rounded-xl border bg-slate-950 hover:bg-slate-800 cursor-pointer transition-all hover:shadow-md hover:translate-y-[-1px] ${
                          followDue
                            ? 'border-amber-600 bg-amber-950/30'
                            : lead.status === 'vendido'
                            ? 'border-emerald-500/80 bg-emerald-950/30'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Drag Handle & Top Info */}
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            <span className="text-sm font-bold text-white truncate font-mono">
                              {lead.username}
                            </span>
                          </div>
                          {lead.priority === 'high' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1 shadow-sm shadow-emerald-400/50" title="Alta prioridade" />
                          )}
                        </div>

                        <p className="text-xs text-slate-200 font-medium truncate">
                          {lead.fullName || 'Sem nome'}
                        </p>

                        {/* Badges / Micro tags */}
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                          <span className="text-slate-300 font-mono font-medium">
                            {lead.linkType === 'wame'
                              ? 'wa.me'
                              : lead.linkType === 'linktree'
                              ? 'linktree'
                              : lead.linkType === 'none'
                              ? 'sem link'
                              : lead.linkType}
                          </span>
                          <span className="text-slate-500 font-bold">·</span>
                          <span
                            className={`font-bold ${
                              lead.status === 'vendido'
                                ? 'text-emerald-400'
                                : lead.status === 'negociacao'
                                ? 'text-teal-300'
                                : lead.status === 'abordado'
                                ? 'text-indigo-300'
                                : lead.status === 'follow_up' || followDue
                                ? 'text-amber-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {lead.status === 'nao_abordado'
                              ? 'Pendente'
                              : lead.status === 'abordado'
                              ? 'Abordado'
                              : lead.status === 'follow_up' || followDue
                              ? 'Follow-up'
                              : lead.status === 'negociacao'
                              ? 'Negociação'
                              : lead.status === 'vendido'
                              ? 'Vendido'
                              : 'Perdido'}
                          </span>
                        </div>

                        {/* Follow up alert badge */}
                        {followDue && (
                          <div className="mt-2 pt-2 border-t border-amber-800/60 flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                            <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Follow-up pendente (+2 dias)</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Day Bottom Quick Add */}
              <div className="p-2 border-t border-slate-800/80 bg-slate-950/40">
                <button
                  onClick={() => onOpenRaioXForDay(day.key)}
                  className="w-full py-1.5 rounded-lg border border-dashed border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo Lead
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banco de Leads / Pool Section */}
      <div
        onDragOver={(e) => handleDragOver(e, 'pool')}
        onDragLeave={() => setDragOverDay(null)}
        onDrop={(e) => handleDrop(e, 'pool')}
        className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all ${
          dragOverDay === 'pool'
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              Banco de Leads em Espera ({poolLeads.length})
            </h3>
            <span className="text-xs text-slate-300">
              · Leads prontos para serem alocados nos dias mais próximos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAutoBalanceWeek}
              disabled={poolLeads.length === 0}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 text-xs font-bold border border-indigo-500/40 disabled:opacity-50 transition-colors shadow-sm"
              title="Organiza preenchendo os dias mais próximos primeiro"
            >
              Organizar nos Dias Mais Próximos
            </button>
            <button
              onClick={() => onOpenRaioXForDay('pool')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition-colors"
            >
              + Subir Prints no Banco
            </button>
          </div>
        </div>

        {poolLeads.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
            Nenhum lead no banco de espera desta semana. Suba novos prints com o Raio-X ou arraste leads aqui.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {poolLeads.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => handleDragStart(e, lead.id)}
                onClick={() => onSelectLead(lead)}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800/80 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white truncate font-mono">
                      {lead.username}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      {lead.linkType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 truncate font-medium">
                    {lead.fullName || 'Sem nome'}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-1 italic">
                    {lead.category || 'Geral'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 font-medium">
                  <span>Arraste para um dia</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
