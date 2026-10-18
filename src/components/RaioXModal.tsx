import React, { useState, useRef } from 'react';
import { X, Upload, Sparkles, Check, AlertTriangle, Image as ImageIcon, Link as LinkIcon, Instagram, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Lead, DayOfWeek, LinkType, PriorityLevel } from '../types';
import { checkDuplicateUsername } from '../utils/storage';

interface RaioXModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLead: (lead: Lead) => void;
  existingLeads: Lead[];
  defaultDay?: DayOfWeek;
}

interface ExtractedLeadDraft {
  id: string;
  imagePreview: string;
  username: string;
  fullName: string;
  bio: string;
  linkType: LinkType;
  linkUrl: string;
  category: string;
  followersApprox: string;
  prospectingAngle: string;
  suggestedPriority: PriorityLevel;
  dayOfWeek: DayOfWeek;
  isDuplicate: boolean;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
}

export const RaioXModal: React.FC<RaioXModalProps> = ({
  isOpen,
  onClose,
  onSaveLead,
  existingLeads,
  defaultDay = 'segunda',
}) => {
  const [queue, setQueue] = useState<ExtractedLeadDraft[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentItem = queue[currentIndex];

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newDrafts: ExtractedLeadDraft[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const base64 = await readFileAsBase64(file);
      const draftId = `draft-${Date.now()}-${i}`;

      newDrafts.push({
        id: draftId,
        imagePreview: base64,
        username: '',
        fullName: '',
        bio: '',
        linkType: 'none',
        linkUrl: '',
        category: '',
        followersApprox: '',
        prospectingAngle: '',
        suggestedPriority: 'high',
        dayOfWeek: defaultDay,
        isDuplicate: false,
        status: 'pending',
      });
    }

    if (newDrafts.length === 0) return;

    setQueue((prev) => [...prev, ...newDrafts]);
    setCurrentIndex(queue.length); // focus first newly added

    // Process all pending sequentially
    for (const draft of newDrafts) {
      processDraftWithAI(draft);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const processDraftWithAI = async (draft: ExtractedLeadDraft) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === draft.id ? { ...item, status: 'analyzing' } : item
      )
    );

    try {
      const response = await fetch('/api/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: draft.imagePreview,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao analisar imagem.');
      }

      const extracted = data.leadData;
      const isDuplicate = checkDuplicateUsername(existingLeads, extracted.username);

      setQueue((prev) =>
        prev.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                username: extracted.username || '@lead',
                fullName: extracted.fullName || '',
                bio: extracted.bio || '',
                linkType: (extracted.linkType as LinkType) || 'none',
                linkUrl: extracted.linkUrl || '',
                category: extracted.category || 'Geral',
                followersApprox: extracted.followersApprox || '',
                prospectingAngle: extracted.prospectingAngle || '',
                suggestedPriority: (extracted.suggestedPriority as PriorityLevel) || 'medium',
                isDuplicate,
                status: 'done',
              }
            : item
        )
      );
    } catch (err: any) {
      console.error('Falha no Raio-X:', err);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                status: 'error',
                errorMessage: err?.message || 'Falha ao processar print.',
              }
            : item
        )
      );
    }
  };

  const handleSaveCurrent = () => {
    if (!currentItem) return;

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      username: currentItem.username.trim() || '@lead',
      fullName: currentItem.fullName.trim() || currentItem.username,
      bio: currentItem.bio.trim(),
      linkType: currentItem.linkType,
      linkUrl: currentItem.linkUrl.trim(),
      category: currentItem.category.trim() || 'Geral',
      followersApprox: currentItem.followersApprox,
      prospectingAngle: currentItem.prospectingAngle,
      priority: currentItem.suggestedPriority,
      dayOfWeek: currentItem.dayOfWeek,
      status: 'nao_abordado',
      saleValue: 100,
      screenshotUrl: currentItem.imagePreview,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveLead(newLead);

    // Remove from queue or advance
    const remaining = queue.filter((_, idx) => idx !== currentIndex);
    setQueue(remaining);
    if (currentIndex >= remaining.length) {
      setCurrentIndex(Math.max(0, remaining.length - 1));
    }

    if (remaining.length === 0) {
      onClose();
    }
  };

  const handleUpdateField = (field: keyof ExtractedLeadDraft, value: any) => {
    if (!currentItem) return;
    setQueue((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? {
              ...item,
              [field]: value,
              ...(field === 'username'
                ? { isDuplicate: checkDuplicateUsername(existingLeads, value) }
                : {}),
            }
          : item
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-black overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Raio-X de Perfil por IA
                {queue.length > 0 && (
                  <span className="text-xs font-normal text-slate-400">
                    ({currentIndex + 1} de {queue.length} prints)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Suba prints do Instagram e a IA extrai @, Bio, Link e cria o gancho de prospecção.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5">
          {queue.length === 0 ? (
            /* Upload Empty State */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileSelect(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Arraste ou selecione os prints dos perfis
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Pode selecionar múltiplos prints de uma vez (1, 10, 20...). A IA analisa cada um em fila e identifica @, bio, link e nicho.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
                >
                  Selecionar Prints no Computador/Celular
                </button>
              </div>
            </div>
          ) : (
            /* Analysis & Review Screen */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Image Preview & Queue */}
              <div className="md:col-span-5 flex flex-col gap-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black max-h-[380px] flex items-center justify-center group">
                  {currentItem?.imagePreview ? (
                    <img
                      src={currentItem.imagePreview}
                      alt="Print do Perfil"
                      className="w-full h-auto max-h-[380px] object-contain"
                    />
                  ) : (
                    <div className="p-8 text-slate-500 flex flex-col items-center">
                      <ImageIcon className="w-10 h-10 mb-2" />
                      <span className="text-xs">Sem imagem</span>
                    </div>
                  )}

                  {currentItem?.status === 'analyzing' && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                      <p className="text-xs font-semibold text-emerald-300">
                        Raio-X em andamento com IA...
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Identificando @, Bio, Link e oportunidades
                      </p>
                    </div>
                  )}
                </div>

                {/* Queue selector if multiple */}
                {queue.length > 1 && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
                      Fila de Prints ({queue.length}):
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {queue.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => setCurrentIndex(idx)}
                          className={`relative w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 transition-all ${
                            idx === currentIndex
                              ? 'border-emerald-400 ring-2 ring-emerald-500/40'
                              : 'border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={item.imagePreview}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {item.status === 'analyzing' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                            </div>
                          )}
                          {item.status === 'done' && (
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 border border-slate-700 hover:border-slate-600 rounded-xl text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Adicionar mais prints
                </button>
              </div>

              {/* Right Column: Extracted Data & Form */}
              <div className="md:col-span-7 flex flex-col gap-4">
                {/* Duplicate Alert */}
                {currentItem?.isDuplicate && (
                  <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-300">
                        Atenção: Lead duplicado!
                      </p>
                      <p className="text-[11px] text-amber-200/90 mt-0.5">
                        O perfil <span className="font-bold">{currentItem.username}</span> já está cadastrado na sua base. Você pode cadastrar novamente ou descartar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error alert if analysis failed */}
                {currentItem?.status === 'error' && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center justify-between">
                    <span>{currentItem.errorMessage}</span>
                    <button
                      onClick={() => processDraftWithAI(currentItem)}
                      className="px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white text-[11px] flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Tentar novamente
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* @ Username */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Instagram className="w-3.5 h-3.5 text-pink-400" /> @ do Instagram
                    </label>
                    <input
                      type="text"
                      value={currentItem?.username || ''}
                      onChange={(e) => handleUpdateField('username', e.target.value)}
                      placeholder="@perfil.exemplo"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* Nome Completo */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">
                      Nome / Título
                    </label>
                    <input
                      type="text"
                      value={currentItem?.fullName || ''}
                      onChange={(e) => handleUpdateField('fullName', e.target.value)}
                      placeholder="Dr. João Silva"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Bio do Perfil
                  </label>
                  <textarea
                    rows={3}
                    value={currentItem?.bio || ''}
                    onChange={(e) => handleUpdateField('bio', e.target.value)}
                    placeholder="Texto completo da bio..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Link Type */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5 text-teal-400" /> Tipo de Link
                    </label>
                    <select
                      value={currentItem?.linkType || 'none'}
                      onChange={(e) => handleUpdateField('linkType', e.target.value as LinkType)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="wame">WhatsApp (wa.me)</option>
                      <option value="linktree">Linktree / Beacons</option>
                      <option value="website">Site Próprio / Loja</option>
                      <option value="none">Sem link na bio</option>
                      <option value="other">Outro link</option>
                    </select>
                  </div>

                  {/* Nicho / Categoria */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">
                      Nicho / Profissão
                    </label>
                    <input
                      type="text"
                      value={currentItem?.category || ''}
                      onChange={(e) => handleUpdateField('category', e.target.value)}
                      placeholder="Ex: Odontologia, Barbearia..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Link URL (se houver) */}
                {currentItem?.linkType !== 'none' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">
                      URL do Link
                    </label>
                    <input
                      type="text"
                      value={currentItem?.linkUrl || ''}
                      onChange={(e) => handleUpdateField('linkUrl', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                )}

                {/* Ângulo de Prospecção Sugerido pela IA */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gancho de Prospecção Recomendado:</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{currentItem?.prospectingAngle || 'Pronto para abordar com oferta de página de alta conversão por R$ 100.'}"
                  </p>
                </div>

                {/* Day selector & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">
                      Planejar para qual dia?
                    </label>
                    <select
                      value={currentItem?.dayOfWeek || 'segunda'}
                      onChange={(e) => handleUpdateField('dayOfWeek', e.target.value as DayOfWeek)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="segunda">Segunda-feira</option>
                      <option value="terca">Terça-feira</option>
                      <option value="quarta">Quarta-feira</option>
                      <option value="quinta">Quinta-feira</option>
                      <option value="sexta">Sexta-feira</option>
                      <option value="pool">Banco de Leads (Espera)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">
                      Prioridade
                    </label>
                    <select
                      value={currentItem?.suggestedPriority || 'medium'}
                      onChange={(e) => handleUpdateField('suggestedPriority', e.target.value as PriorityLevel)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="high">Alta Prioridade (Abordar logo)</option>
                      <option value="medium">Média Prioridade</option>
                      <option value="low">Baixa Prioridade</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {queue.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <button
              onClick={() => {
                const remaining = queue.filter((_, idx) => idx !== currentIndex);
                setQueue(remaining);
                if (currentIndex >= remaining.length) {
                  setCurrentIndex(Math.max(0, remaining.length - 1));
                }
                if (remaining.length === 0) onClose();
              }}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Descartar este print
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCurrent}
                disabled={currentItem?.status === 'analyzing'}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Lead &amp; Agendar</span>
                {queue.length > 1 && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
