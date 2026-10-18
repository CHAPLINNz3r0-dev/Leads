import React, { useState } from 'react';
import { Lead, DayOfWeek, LeadStatus, WeeklyConfig } from '../types';
import {
  Copy,
  Check,
  ExternalLink,
  Instagram,
  Sparkles,
  DollarSign,
  MessageCircle,
  Clock,
  Bell,
  CheckCircle2,
  ChevronRight,
  Filter,
  Flame,
  FileText
} from 'lucide-react';
import { copyToClipboard, isFollowUpDue } from '../utils/storage';
import confetti from 'canvas-confetti';

interface TodayFocusViewProps {
  leads: Lead[];
  config: WeeklyConfig;
  onUpdateLead: (lead: Lead) => void;
  onSelectLead: (lead: Lead) => void;
  onNavigateToPipeline?: () => void;
}

const DAYS_MAP: Record<DayOfWeek, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado (Inativo)',
  pool: 'Banco de Leads',
};

export const TodayFocusView: React.FC<TodayFocusViewProps> = ({
  leads,
  config,
  onUpdateLead,
  onSelectLead,
  onNavigateToPipeline,
}) => {
  // Determina o dia atual da semana (Segunda a Sexta). Fim de semana abre focado na Segunda.
  const getTodayDayOfWeek = (): DayOfWeek => {
    const dayIndex = new Date().getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    if (dayIndex === 1) return 'segunda';
    if (dayIndex === 2) return 'terca';
    if (dayIndex === 3) return 'quarta';
    if (dayIndex === 4) return 'quinta';
    if (dayIndex === 5) return 'sexta';
    return 'segunda'; // Fim de semana (Sábado ou Domingo) prepara Segunda-feira
  };

  const [activeDay, setActiveDay] = useState<DayOfWeek>(getTodayDayOfWeek());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPackId, setCopiedPackId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const dayLeads = leads.filter((l) => l.dayOfWeek === activeDay);
  const filteredLeads = dayLeads.filter((l) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return l.status === 'nao_abordado';
    if (filterStatus === 'follow_up') return l.status === 'follow_up' || isFollowUpDue(l);
    if (filterStatus === 'done') return l.status === 'vendido';
    return l.status === filterStatus;
  });

  const handleCopyUsername = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = lead.username.replace('@', '');
    const success = await copyToClipboard(clean);
    if (success) {
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyFullPack = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    const pack = `*Nome:* ${lead.fullName || 'Empresário'}
*Instagram:* ${lead.username}
*Bio:* ${lead.bio || 'Sem bio'}
*Link:* ${lead.linkUrl || lead.linkType}
*Gancho Sugerido:* ${lead.prospectingAngle || 'Oferta de página profissional por R$ 100'}

Mensagem pronta:
Olá ${lead.fullName ? lead.fullName.split(' ')[0] : ''}! Vi seu trabalho aqui no Instagram e achei excelente. Notei que você ${
      lead.linkType === 'none'
        ? 'ainda não tem um site na bio para receber os clientes'
        : 'usa um link que pode estar limitando seus agendamentos'
    }. Estou criando páginas profissionais de alta conversão por apenas R$ 100 hoje. Posso te mostrar um modelo rápido pro seu nicho?`;

    const success = await copyToClipboard(pack);
    if (success) {
      setCopiedPackId(lead.id);
      setTimeout(() => setCopiedPackId(null), 2000);
    }
  };

  const handleQuickStatusChange = (lead: Lead, newStatus: LeadStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date().toISOString();

    let updated: Lead = {
      ...lead,
      status: newStatus,
      updatedAt: now,
    };

    if (newStatus === 'abordado') {
      updated.approachedAt = now;
      const twoDaysLater = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      updated.followUpDueAt = twoDaysLater;
      if (lead.status === 'vendido') {
        updated.closedAt = null;
        updated.saleValue = 0;
      }
    } else if (newStatus === 'vendido') {
      updated.closedAt = now;
      // ALWAYS use the configured defaultSalePrice if lead didn't have a sale before
      updated.saleValue = config.defaultSalePrice > 0 ? config.defaultSalePrice : 100;

      // Celebrate sale with confetti
      try {
        confetti({
          particleCount: 120,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#6EE7B7', '#F59E0B', '#3B82F6'],
        });
      } catch (err) {
        // ignore
      }
    } else {
      // If reverted from vendido to pending/negotiation/lost
      if (lead.status === 'vendido') {
        updated.closedAt = null;
        updated.saleValue = 0;
      }
    }

    onUpdateLead(updated);
  };

  const countPending = dayLeads.filter((l) => l.status === 'nao_abordado').length;
  const countApproached = dayLeads.filter((l) => l.status === 'abordado').length;
  const countSales = dayLeads.filter((l) => l.status === 'vendido').length;
  const dayRevenue = dayLeads
    .filter((l) => l.status === 'vendido')
    .reduce((sum, l) => sum + (l.saleValue || 100), 0);

  return (
    <div className="space-y-6">
      {/* Top Day Switcher & Target Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-emerald-400" />
              Painel de Execução: {DAYS_MAP[activeDay]}
            </h2>
            <span className="text-xs text-slate-400">
              · {dayLeads.length} leads para hoje (Meta: {config.targetPerDay})
            </span>
          </div>
        </div>

        {/* Day Selectors (Segunda a Sexta - Sem Sábado) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['segunda', 'terca', 'quarta', 'quinta', 'sexta'] as DayOfWeek[]).map((d) => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeDay === d
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Progress & Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Pendentes</span>
          <p className="text-xl font-bold text-white mt-0.5">{countPending}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Abordados</span>
          <p className="text-xl font-bold text-teal-400 mt-0.5">{countApproached}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Vendas do Dia</span>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">{countSales}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400">Faturamento Hoje</span>
          <p className="text-xl font-bold text-emerald-300 mt-0.5">R$ {dayRevenue}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'all'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Todos ({dayLeads.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'pending'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Pendentes para Abordar ({countPending})
          </button>
          <button
            onClick={() => setFilterStatus('follow_up')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'follow_up'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            Follow-up Alerta ({dayLeads.filter(isFollowUpDue).length})
          </button>
          <button
            onClick={() => setFilterStatus('done')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'done'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            Fechados ({countSales})
          </button>
        </div>

        {onNavigateToPipeline && (
          <button
            onClick={onNavigateToPipeline}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-900/60 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>Ver Leads Abordados no CRM ({countApproached})</span>
          </button>
        )}
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-sm font-semibold text-white">Nenhum lead com este filtro para {DAYS_MAP[activeDay]}</p>
          <p className="text-xs text-slate-400 mt-1">
            Planeje novos leads na aba "Semana" ou suba novos prints com o Raio-X.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredLeads.map((lead, index) => {
            const followDue = isFollowUpDue(lead);
            const cleanUser = lead.username.replace('@', '');
            const igUrl = `https://instagram.com/${cleanUser}`;

            return (
              <div
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer bg-slate-900 hover:bg-slate-850 hover:border-slate-600 ${
                  lead.status === 'vendido'
                    ? 'border-emerald-500/80 bg-emerald-950/30'
                    : followDue
                    ? 'border-amber-600 bg-amber-950/30 ring-1 ring-amber-500/40'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Lead Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-white font-mono hover:text-emerald-400 transition-colors">
                          {lead.username}
                        </span>
                        <span className="text-slate-500 font-bold">·</span>
                        <span className="text-sm font-semibold text-slate-100">
                          {lead.fullName || 'Sem nome'}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-mono font-medium">
                          {lead.linkType}
                        </span>
                        {lead.priority === 'high' && (
                          <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                            Prioridade Alta
                          </span>
                        )}
                        {followDue && (
                          <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-950 border border-amber-600 text-amber-200 font-bold flex items-center gap-1 animate-pulse">
                            <Bell className="w-3.5 h-3.5 text-amber-400" /> Follow-up (+2 dias)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & 1-Click Copy Buttons */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Copy @ */}
                    <button
                      onClick={(e) => handleCopyUsername(lead, e)}
                      className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                        copiedId === lead.id
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                      title="Copiar apenas o @ sem o arroba"
                    >
                      {copiedId === lead.id ? (
                        <>
                          <Check className="w-4 h-4" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copiar @
                        </>
                      )}
                    </button>

                    {/* Copy Full Pack */}
                    <button
                      onClick={(e) => handleCopyFullPack(lead, e)}
                      className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                        copiedPackId === lead.id
                          ? 'bg-indigo-500 text-white border-indigo-400'
                          : 'bg-indigo-950 text-indigo-200 border-indigo-700 hover:bg-indigo-900/60'
                      }`}
                      title="Copia Nome, @, Bio, Link e Script pronto de mensagem para direct"
                    >
                      {copiedPackId === lead.id ? (
                        <>
                          <Check className="w-4 h-4" /> Pack Copiado!
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" /> Pack Completo
                        </>
                      )}
                    </button>

                    {/* Open Instagram Profile */}
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3.5 py-2 rounded-xl bg-pink-950/60 border border-pink-700/80 text-pink-200 hover:bg-pink-900/50 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Instagram className="w-4 h-4 text-pink-400" />
                      <span>Abrir Perfil</span>
                      <ExternalLink className="w-3.5 h-3.5 text-pink-300" />
                    </a>
                  </div>
                </div>

                {/* Bottom Quick Status Pipeline Bar */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400 mr-1 uppercase tracking-wider">Status:</span>

                    <button
                      onClick={(e) => handleQuickStatusChange(lead, 'nao_abordado', e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        lead.status === 'nao_abordado'
                          ? 'bg-slate-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Pendente
                    </button>

                    <button
                      onClick={(e) => handleQuickStatusChange(lead, 'abordado', e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        lead.status === 'abordado'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-950 text-indigo-300 hover:text-indigo-100 border border-slate-800 hover:bg-indigo-950/50'
                      }`}
                    >
                      ✓ Abordado
                    </button>

                    <button
                      onClick={(e) => handleQuickStatusChange(lead, 'follow_up', e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        lead.status === 'follow_up'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                          : 'bg-slate-950 text-amber-300 hover:text-amber-100 border border-slate-800 hover:bg-amber-950/50'
                      }`}
                    >
                      Follow-up
                    </button>

                    <button
                      onClick={(e) => handleQuickStatusChange(lead, 'negociacao', e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        lead.status === 'negociacao'
                          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                          : 'bg-slate-950 text-teal-300 hover:text-teal-100 border border-slate-800 hover:bg-teal-950/50'
                      }`}
                    >
                      Negociação
                    </button>

                    <button
                      onClick={(e) => handleQuickStatusChange(lead, 'vendido', e)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm ${
                        lead.status === 'vendido'
                          ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400'
                          : 'bg-emerald-950/80 border border-emerald-700 text-emerald-200 hover:bg-emerald-500 hover:text-slate-950'
                      }`}
                    >
                      ★ Fechou! (R$ {lead.status === 'vendido' ? (lead.saleValue || config.defaultSalePrice || 100) : (config.defaultSalePrice || 100)})
                    </button>

                    <button
                      onClick={(e) => handleQuickStatusChange(lead, 'perdido', e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        lead.status === 'perdido'
                          ? 'bg-red-800 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:bg-red-950/40'
                      }`}
                    >
                      Perdido
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1">
                    Ver detalhes <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
