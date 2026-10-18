import React, { useState, useRef } from 'react';
import { WeeklyConfig, Lead } from '../types';
import {
  X,
  Sliders,
  Download,
  Upload,
  RotateCcw,
  Check,
  ShieldCheck,
  DollarSign,
  Target,
  Database,
  Smartphone,
  Laptop
} from 'lucide-react';
import { INITIAL_SEED_LEADS } from '../utils/storage';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WeeklyConfig;
  onUpdateConfig: (config: WeeklyConfig) => void;
  leads: Lead[];
  onImportLeads: (leads: Lead[]) => void;
  onResetLeads: () => void;
  onClearSales?: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  leads,
  onImportLeads,
  onResetLeads,
  onClearSales,
}) => {
  if (!isOpen) return null;

  const [targetPerDay, setTargetPerDay] = useState(config.targetPerDay);
  const [defaultPrice, setDefaultPrice] = useState(config.defaultSalePrice || 100);
  const [operatorName, setOperatorName] = useState('Marcos · Operação Principal');
  const [importSuccess, setImportSuccess] = useState(false);
  const [confirmResetSales, setConfirmResetSales] = useState(false);
  const [confirmResetSeeds, setConfirmResetSeeds] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onUpdateConfig({
      ...config,
      targetPerDay: Number(targetPerDay) || 10,
      defaultSalePrice: Number(defaultPrice) || 100,
    });
    onClose();
  };

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(
      {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        config: { targetPerDay, defaultSalePrice: defaultPrice },
        leads,
      },
      null,
      2
    );

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadradar_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.leads && Array.isArray(json.leads)) {
          onImportLeads(json.leads);
          if (json.config?.targetPerDay) {
            setTargetPerDay(json.config.targetPerDay);
          }
          if (json.config?.defaultSalePrice) {
            setDefaultPrice(json.config.defaultSalePrice);
          }
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurações &amp; Sincronização</h2>
              <p className="text-xs text-slate-300">Metas, valores de venda e backup entre dispositivos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 text-sm">
          {/* Operador / Conta */}
          <div>
            <label className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" /> Perfil de Prospecção Ativo
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Os dados ficam salvos de forma persistente e protegida no seu dispositivo.
            </p>
          </div>

          {/* Meta Diária & Preço Padrão */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-teal-400" /> Meta Diária (Leads)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={targetPerDay}
                onChange={(e) => setTargetPerDay(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400 mt-1 block">Meta de segunda a sábado</span>
            </div>

            <div>
              <label className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Preço Padrão (R$)
              </label>
              <input
                type="number"
                min={10}
                step={10}
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400 mt-1 block">Aplicado ao registrar novas vendas</span>
            </div>
          </div>

          {/* Ação rápida para zerar/limpar vendas se o usuário quiser */}
          {onClearSales && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-200 text-sm">Zerar Vendas Registradas</p>
                <p className="text-xs text-slate-300">Volta o status dos leads vendidos para pendente e zera o faturamento.</p>
              </div>
              <div className="flex items-center gap-2">
                {confirmResetSales ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClearSales();
                        setConfirmResetSales(false);
                        onClose();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all animate-pulse"
                    >
                      Confirmar Zerar Vendas
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetSales(false)}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetSales(true)}
                    className="px-3.5 py-2 rounded-xl bg-red-950/80 border border-red-800 text-red-300 hover:bg-red-900/60 font-semibold text-xs transition-colors"
                  >
                    Resetar Vendas
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sincronização entre Computador e Celular */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Sincronização &amp; Backup (Celular ↔ Computador)</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              Exporte seus leads para um arquivo leve e seguro ou importe no outro aparelho a qualquer momento com 1 clique.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                <span>Exportar Backup ({leads.length} leads)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Importar Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImportFile(e.target.files[0]);
                  }
                }}
              />
            </div>

            {importSuccess && (
              <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Backup importado com sucesso!</span>
              </div>
            )}
          </div>

          {/* Restaurar Seed Leads */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Precisa restaurar base de demonstração?</span>
            {confirmResetSeeds ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetLeads();
                    setConfirmResetSeeds(false);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  Confirmar Restaurar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetSeeds(false)}
                  className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetSeeds(true)}
                className="text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar leads de teste
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors shadow-md shadow-emerald-500/20 active:scale-95"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};
