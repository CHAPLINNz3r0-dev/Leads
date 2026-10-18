import React, { useState } from 'react';
import { Lead, DayOfWeek, LeadStatus, LinkType, PriorityLevel, WeeklyConfig } from '../types';
import {
  X,
  Instagram,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  DollarSign,
  Calendar,
  Trash2,
  Image as ImageIcon,
  Clock,
  Bell,
  CheckCircle2,
  Loader2,
  FileText
} from 'lucide-react';
import { copyToClipboard, isFollowUpDue } from '../utils/storage';
import confetti from 'canvas-confetti';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  config: WeeklyConfig;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateLead,
  onDeleteLead,
  config,
}) => {
  if (!isOpen || !lead) return null;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pitches, setPitches] = useState<string[]>([]);
  const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);

  const cleanUser = lead.username.replace('@', '');
  const igUrl = `https://instagram.com/${cleanUser}`;
  const followDue = isFollowUpDue(lead);

  const handleCopy = async (field: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleUpdate = (field: keyof Lead, value: any) => {
    const now = new Date().toISOString();
    let updated: Lead = {
      ...lead,
      [field]: value,
      updatedAt: now,
    };

    if (field === 'status') {
      if (value === 'abordado') {
        updated.approachedAt = now;
        const twoDaysLater = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        updated.followUpDueAt = twoDaysLater;
        if (lead.status === 'vendido') {
          updated.closedAt = null;
          updated.saleValue = 0;
        }
      } else if (value === 'vendido') {
        updated.closedAt = now;
        updated.saleValue = config.defaultSalePrice > 0 ? config.defaultSalePrice : 100;
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      } else {
        if (lead.status === 'vendido') {
          updated.closedAt = null;
          updated.saleValue = 0;
        }
      }
    }

    onUpdateLead(updated);
  };

  const generatePitchesWithAI = async () => {
    setIsGeneratingPitches(true);
    try {
      const response = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead }),
      });
      const data = await response.json();
      if (data.success && data.pitches) {
        setPitches(data.pitches);
      }
    } catch (e) {
      console.error('Erro ao gerar scripts:', e);
    } finally {
      setIsGeneratingPitches(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500/20 to-indigo-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono">
                  {lead.username}
                </h2>
                <a
                  href={igUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-pink-400 hover:text-pink-300 hover:bg-pink-950/50 transition-colors"
                  title="Abrir no Instagram"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-xs text-slate-400">{lead.fullName || 'Lead Instagram'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm(`Excluir o lead ${lead.username}?`)) {
                  onDeleteLead(lead.id);
                  onClose();
                }
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              title="Excluir Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Follow-up Alert if > 2 days */}
          {followDue && (
            <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>
                  <strong>Atenção:</strong> Abordado há mais de 2 dias sem resposta. Envie uma mensagem de follow-up agora!
                </span>
              </div>
              <button
                onClick={() => handleUpdate('status', 'follow_up')}
                className="px-2.5 py-1 rounded bg-amber-800 hover:bg-amber-700 text-white font-semibold text-[11px]"
              >
                Mudar para Follow-up
              </button>
            </div>
          )}

          {/* Status Pipeline Selection Bar */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">
              Etapa do Funil (Status)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(
                [
                  { key: 'nao_abordado', label: 'Pendente', color: 'bg-slate-800 text-slate-300' },
                  { key: 'abordado', label: 'Abordado', color: 'bg-indigo-600 text-white' },
                  { key: 'follow_up', label: 'Follow-up', color: 'bg-amber-600 text-white' },
                  { key: 'negociacao', label: 'Em Negociação', color: 'bg-teal-600 text-white' },
                  { key: 'vendido', label: '★ Vendido', color: 'bg-emerald-500 text-slate-950 font-bold' },
                  { key: 'perdido', label: 'Perdido', color: 'bg-red-800 text-white' },
                ] as const
              ).map((st) => (
                <button
                  key={st.key}
                  onClick={() => handleUpdate('status', st.key)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold text-center transition-all ${
                    lead.status === st.key
                      ? `${st.color} shadow-md ring-2 ring-white/20`
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Copy Action Bar */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Copiar Rápido:</span>
            <button
              onClick={() => handleCopy('username', cleanUser)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 transition-colors"
            >
              {copiedField === 'username' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>@{cleanUser}</span>
            </button>
            <button
              onClick={() =>
                handleCopy(
                  'fullpack',
                  `Nome: ${lead.fullName}\n@: ${lead.username}\nBio: ${lead.bio}\nLink: ${lead.linkUrl || lead.linkType}`
                )
              }
              className="px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/80 hover:bg-indigo-900/50 text-indigo-300 text-xs flex items-center gap-1 transition-colors"
            >
              {copiedField === 'fullpack' ? <Check className="w-3 h-3 text-indigo-400" /> : <FileText className="w-3 h-3" />}
              <span>Pack Completo</span>
            </button>
          </div>

          {/* Editable Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Nome Completo / Perfil
              </label>
              <input
                type="text"
                value={lead.fullName}
                onChange={(e) => handleUpdate('fullName', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Nicho / Categoria
              </label>
              <input
                type="text"
                value={lead.category}
                onChange={(e) => handleUpdate('category', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">
              Bio do Instagram
            </label>
            <textarea
              rows={3}
              value={lead.bio}
              onChange={(e) => handleUpdate('bio', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-sans"
            />
          </div>

          {/* Link Type & URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Tipo de Link
              </label>
              <select
                value={lead.linkType}
                onChange={(e) => handleUpdate('linkType', e.target.value as LinkType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="wame">WhatsApp (wa.me)</option>
                <option value="linktree">Linktree / Beacons</option>
                <option value="website">Site Próprio</option>
                <option value="none">Sem link na bio</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                URL do Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lead.linkUrl}
                  onChange={(e) => handleUpdate('linkUrl', e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                {lead.linkUrl && (
                  <a
                    href={lead.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 flex items-center justify-center"
                    title="Testar Link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Day of Week & Value of Sale */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Dia de Prospecção
              </label>
              <select
                value={lead.dayOfWeek}
                onChange={(e) => handleUpdate('dayOfWeek', e.target.value as DayOfWeek)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="segunda">Segunda-feira</option>
                <option value="terca">Terça-feira</option>
                <option value="quarta">Quarta-feira</option>
                <option value="quinta">Quinta-feira</option>
                <option value="sexta">Sexta-feira</option>
                <option value="pool">Banco de Espera</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Prioridade
              </label>
              <select
                value={lead.priority}
                onChange={(e) => handleUpdate('priority', e.target.value as PriorityLevel)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="high">Alta Prioridade</option>
                <option value="medium">Média Prioridade</option>
                <option value="low">Baixa Prioridade</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Valor da Venda (R$)
              </label>
              <input
                type="number"
                value={lead.saleValue || 100}
                onChange={(e) => handleUpdate('saleValue', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* AI Prospecting Hook & Script Generator */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Scripts de Direct com IA (R$ 100)
              </span>
              <button
                onClick={generatePitchesWithAI}
                disabled={isGeneratingPitches}
                className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                {isGeneratingPitches ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" /> Gerar 3 Abordagens
                  </>
                )}
              </button>
            </div>

            {pitches.length > 0 ? (
              <div className="space-y-2 mt-3">
                {pitches.map((pitch, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 relative group flex items-start justify-between gap-3"
                  >
                    <p className="leading-relaxed flex-1">"{pitch}"</p>
                    <button
                      onClick={() => handleCopy(`pitch-${idx}`, pitch)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                      title="Copiar mensagem"
                    >
                      {copiedField === `pitch-${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic mt-1">
                {lead.prospectingAngle ||
                  'Clique no botão acima para a IA criar 3 opções de mensagens persuasivas para direct.'}
              </p>
            )}
          </div>

          {/* Original Screenshot preview */}
          {lead.screenshotUrl && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                  Print Original do Perfil
                </span>
                <button
                  onClick={() => setShowImageZoom(!showImageZoom)}
                  className="text-xs text-teal-400 hover:underline"
                >
                  {showImageZoom ? 'Ocultar zoom' : 'Expandir print'}
                </button>
              </div>

              <div
                className={`rounded-xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center ${
                  showImageZoom ? 'max-h-[600px]' : 'max-h-[220px]'
                }`}
              >
                <img
                  src={lead.screenshotUrl}
                  alt="Print do Perfil"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Cadastrado em {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/20 active:scale-95"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
