import React, { useState, useEffect } from 'react';
import { Lead, WeeklyConfig, DayOfWeek, FinancialStats } from './types';
import {
  loadLeads,
  saveLeads,
  loadConfig,
  saveConfig,
  INITIAL_SEED_LEADS,
  isFollowUpDue,
  fetchServerDatabase,
  syncDatabaseWithServer,
  autoBalanceWeekPrioritizingClosestDays,
  advanceToNextWeek,
  getWeekInfo,
  currentWeekDefaultId,
} from './utils/storage';
import { testFirestoreConnection, deleteLeadFromFirestore } from './utils/firebase';
import { Header } from './components/Header';
import { WeeklyBoard } from './components/WeeklyBoard';
import { TodayFocusView } from './components/TodayFocusView';
import { PipelineView } from './components/PipelineView';
import { MetricsDashboard } from './components/MetricsDashboard';
import { RaioXModal } from './components/RaioXModal';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { LeadDetailModal } from './components/LeadDetailModal';
import { ConfigModal } from './components/ConfigModal';
import {
  Plus,
  Sparkles,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Bell,
  CheckCircle2,
  Users
} from 'lucide-react';

export default function App() {
  const [leads, setLeads] = useState<Lead[]>(() => loadLeads());
  const [config, setConfig] = useState<WeeklyConfig>(() => loadConfig());
  const [activeTab, setActiveTab] = useState<'hoje' | 'semana' | 'pipeline' | 'metricas'>('hoje');

  // Modals state
  const [isRaioXOpen, setIsRaioXOpen] = useState(false);
  const [raioXTargetDay, setRaioXTargetDay] = useState<DayOfWeek>('segunda');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Carrega e sincroniza com o banco de dados permanente do Firebase Firestore na inicialização
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    fetchServerDatabase().then((data) => {
      if (data.leads && Array.isArray(data.leads) && data.leads.length > 0) {
        setLeads(data.leads);
      } else {
        // Se ainda não existir no Firestore, sincroniza a base atual
        syncDatabaseWithServer(leads, config);
      }
      if (data.config) {
        setConfig((prev) => ({ ...prev, ...data.config }));
      }
    });
  }, []);

  // Sync to localStorage & Firestore cloud
  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Lead CRUD operations
  const handleSaveLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
    showToast(`Lead ${newLead.username} adicionado com sucesso!`);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
    );
    if (selectedLead?.id === updatedLead.id) {
      setSelectedLead(updatedLead);
    }
  };

  const handleDeleteLead = (leadId: string) => {
    deleteLeadFromFirestore(leadId).catch(() => {});
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    showToast('Lead removido com sucesso.');
  };

  const handleImportLeads = (imported: Lead[]) => {
    setLeads(imported);
    showToast(`${imported.length} leads importados com sucesso!`);
  };

  const handleResetLeads = () => {
    setLeads(INITIAL_SEED_LEADS);
    showToast('Base restaurada com leads de exemplo.');
  };

  // Organizar a semana com IA: Prioriza os dias mais próximos de Segunda a Sexta (sem sábado!), distribuindo de forma inteligente
  const handleAutoBalanceWeek = () => {
    const targetWeek = config.activeWeekId || currentWeekDefaultId;
    const { updatedLeads, movedCount, todayInfo } = autoBalanceWeekPrioritizingClosestDays(
      leads,
      config.targetPerDay || 10,
      targetWeek
    );

    setLeads(updatedLeads);
    saveLeads(updatedLeads);
    showToast(`Semana organizada com IA! ${movedCount} leads alocados de Segunda a Sexta. (${todayInfo})`);
  };

  // Reset de Domingo / Iniciar Nova Semana:
  // Move os leads pendentes da semana anterior para a nova e arquiva os prospectados no CRM
  const handleAdvanceWeek = () => {
    const nextOffset = (config.activeWeekOffset || 0) + 1;
    const nextWeekInfo = getWeekInfo(nextOffset);
    const currentWeek = config.activeWeekId || currentWeekDefaultId;

    const { updatedLeads, carriedCount } = advanceToNextWeek(
      leads,
      currentWeek,
      nextWeekInfo.id
    );

    const updatedConfig: WeeklyConfig = {
      ...config,
      activeWeekId: nextWeekInfo.id,
      activeWeekOffset: nextOffset,
    };

    setLeads(updatedLeads);
    setConfig(updatedConfig);
    saveLeads(updatedLeads);
    saveConfig(updatedConfig);
    showToast(`Nova semana iniciada (${nextWeekInfo.label})! ${carriedCount} leads pendentes transferidos.`);
  };

  // Troca de aba de semana
  const handleSelectWeek = (weekId: string, offset: number) => {
    setConfig((prev) => ({
      ...prev,
      activeWeekId: weekId,
      activeWeekOffset: offset,
    }));
  };

  // Copilot Action Dispatcher: executes real modifications to leads and config
  const handleExecuteActionFromCopilot = (action: any) => {
    if (!action) return;

    if (action.updatedLeads && Array.isArray(action.updatedLeads)) {
      setLeads((prev) => {
        const updateMap = new Map(action.updatedLeads.map((u: any) => [u.id, u]));
        return prev.map((lead) => {
          if (updateMap.has(lead.id)) {
            const patch: any = updateMap.get(lead.id);
            const isNoLongerSold = patch.status && patch.status !== 'vendido';
            return {
              ...lead,
              ...patch,
              saleValue: isNoLongerSold ? 0 : (patch.saleValue !== undefined ? patch.saleValue : lead.saleValue),
              closedAt: isNoLongerSold ? null : (patch.closedAt !== undefined ? patch.closedAt : lead.closedAt),
              updatedAt: new Date().toISOString(),
            };
          }
          return lead;
        });
      });
    }

    if (action.configUpdate) {
      setConfig((prev) => ({
        ...prev,
        ...action.configUpdate,
      }));
    }

    showToast(action.description || 'Operação aplicada com sucesso pelo Copilot!');
  };

  // Open Raio-X for specific day
  const handleOpenRaioXForDay = (day: DayOfWeek) => {
    setRaioXTargetDay(day);
    setIsRaioXOpen(true);
  };

  // Calculate Financial Stats (Accurate without false fallback)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)).setHours(0, 0, 0, 0); // Monday
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const soldLeads = leads.filter((l) => l.status === 'vendido');

  const todaySold = soldLeads.filter(
    (l) => l.closedAt && new Date(l.closedAt).getTime() >= startOfToday
  );
  const weekSold = soldLeads.filter(
    (l) => l.closedAt && new Date(l.closedAt).getTime() >= startOfWeek
  );
  const monthSold = soldLeads.filter(
    (l) => l.closedAt && new Date(l.closedAt).getTime() >= startOfMonth
  );

  const approachedCount = leads.filter((l) => l.status !== 'nao_abordado').length;
  const followUpCount = leads.filter((l) => l.status === 'follow_up' || isFollowUpDue(l)).length;
  const negotiatingCount = leads.filter((l) => l.status === 'negociacao').length;

  const stats: FinancialStats = {
    todaySales: todaySold.reduce((s, l) => s + (Number(l.saleValue) || 0), 0),
    todayCount: todaySold.length,
    weekSales: weekSold.reduce((s, l) => s + (Number(l.saleValue) || 0), 0),
    weekCount: weekSold.length,
    monthSales: monthSold.reduce((s, l) => s + (Number(l.saleValue) || 0), 0),
    monthCount: monthSold.length,
    totalSales: soldLeads.reduce((s, l) => s + (Number(l.saleValue) || 0), 0),
    totalCount: soldLeads.length,
    approachedCount,
    followUpCount,
    negotiatingCount,
    lostCount: leads.filter((l) => l.status === 'perdido').length,
    conversionRate: approachedCount > 0 ? Math.round((soldLeads.length / approachedCount) * 100) : 0,
  };

  // Resetar Vendas: volta o status para não abordado, zera o valor e faturamento
  const handleClearSales = () => {
    const updated = leads.map((l) =>
      l.status === 'vendido' || (Number(l.saleValue) || 0) > 0
        ? {
            ...l,
            status: 'nao_abordado' as const,
            saleValue: 0,
            closedAt: null,
            updatedAt: new Date().toISOString(),
          }
        : l
    );
    setLeads(updated);
    saveLeads(updated);
    syncDatabaseWithServer(updated);
    showToast('Vendas zeradas! Status dos leads voltaram para pendente.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 text-base">
      {/* App Header */}
      <Header
        leads={leads}
        config={config}
        onOpenRaioX={() => {
          setRaioXTargetDay('segunda');
          setIsRaioXOpen(true);
        }}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onNavigateToToday={() => setActiveTab('hoje')}
        stats={stats}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 md:pb-28">
        {activeTab === 'hoje' && (
          <TodayFocusView
            leads={leads}
            config={config}
            onUpdateLead={handleUpdateLead}
            onSelectLead={(lead) => setSelectedLead(lead)}
            onNavigateToPipeline={() => setActiveTab('pipeline')}
          />
        )}

        {activeTab === 'semana' && (
          <WeeklyBoard
            leads={leads}
            config={config}
            onUpdateLead={handleUpdateLead}
            onSelectLead={(lead) => setSelectedLead(lead)}
            onOpenRaioXForDay={handleOpenRaioXForDay}
            onAutoBalanceWeek={handleAutoBalanceWeek}
            activeWeekId={config.activeWeekId || currentWeekDefaultId}
            onSelectWeek={handleSelectWeek}
            onAdvanceWeek={handleAdvanceWeek}
            onNavigateToPipeline={() => setActiveTab('pipeline')}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineView
            leads={leads}
            config={config}
            onUpdateLead={handleUpdateLead}
            onSelectLead={(lead) => setSelectedLead(lead)}
          />
        )}

        {activeTab === 'metricas' && (
          <MetricsDashboard
            leads={leads}
            config={config}
            stats={stats}
            onClearSales={handleClearSales}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 border border-emerald-500/60 text-white text-xs sm:text-sm font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Navigation Bar (Compact Mobile + Sleek Floating Desktop Dock) */}
      <nav
        aria-label="Navegação Principal"
        className="fixed bottom-0 inset-x-0 md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border-t md:border border-slate-800 md:rounded-2xl shadow-2xl p-1.5 sm:p-2 flex items-center justify-around md:justify-center md:gap-2 max-w-lg mx-auto w-full md:w-auto"
      >
        <button
          onClick={() => setActiveTab('hoje')}
          className={`flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-3 py-1 md:py-1.5 rounded-xl transition-all ${
            activeTab === 'hoje'
              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 shrink-0" />
          <span className="text-[10px] md:text-xs">Hoje</span>
        </button>

        <button
          onClick={() => setActiveTab('semana')}
          className={`flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-3 py-1 md:py-1.5 rounded-xl transition-all ${
            activeTab === 'semana'
              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="text-[10px] md:text-xs">Semana</span>
        </button>

        {/* Central Quick Add Lead button */}
        <button
          onClick={() => {
            setRaioXTargetDay('segunda');
            setIsRaioXOpen(true);
          }}
          className="w-10 h-10 -mt-4 md:mt-0 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 font-bold active:scale-95 transition-transform shrink-0"
          title="Subir Print / Novo Lead"
          aria-label="Adicionar Lead via Print"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-3 py-1 md:py-1.5 rounded-xl transition-all ${
            activeTab === 'pipeline'
              ? 'bg-emerald-500/15 text-emerald-400 font-bold ring-1 ring-emerald-500/30'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="text-[10px] md:text-xs flex items-center gap-1">
            CRM
            {stats.approachedCount > 0 && (
              <span className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono">
                {stats.approachedCount}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('metricas')}
          className={`flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-3 py-1 md:py-1.5 rounded-xl transition-all ${
            activeTab === 'metricas'
              ? 'bg-emerald-500/15 text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <DollarSign className="w-4 h-4 shrink-0" />
          <span className="text-[10px] md:text-xs">Resultado</span>
        </button>
      </nav>

      {/* Modals & Drawers */}
      <RaioXModal
        isOpen={isRaioXOpen}
        onClose={() => setIsRaioXOpen(false)}
        onSaveLead={handleSaveLead}
        existingLeads={leads}
        defaultDay={raioXTargetDay}
      />

      <AICopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        leads={leads}
        config={config}
        onExecuteAction={handleExecuteActionFromCopilot}
        onSelectLead={(lead) => setSelectedLead(lead)}
        onNavigateToDay={(day) => {
          setActiveTab('hoje');
        }}
      />

      <LeadDetailModal
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onUpdateLead={handleUpdateLead}
        onDeleteLead={handleDeleteLead}
        config={config}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onUpdateConfig={setConfig}
        leads={leads}
        onImportLeads={handleImportLeads}
        onResetLeads={handleResetLeads}
        onClearSales={handleClearSales}
      />
    </div>
  );
}
