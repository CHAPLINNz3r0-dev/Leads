import React, { useState, useRef, useEffect } from 'react';
import { Lead, ChatMessage, WeeklyConfig, DayOfWeek } from '../types';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Copy,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  HelpCircle,
  Zap,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { copyToClipboard } from '../utils/storage';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  config: WeeklyConfig;
  onExecuteAction: (action: any) => void;
  onSelectLead?: (lead: Lead) => void;
  onNavigateToDay?: (day: DayOfWeek) => void;
}

const QUICK_PROMPTS = [
  'Remova as vendas e volte o status para pendente',
  'Me dá os leads de hoje prontos para colar',
  'Copia o @ do próximo lead pendente',
  'Quem devo abordar primeiro com maior prioridade?',
  'Distribui os leads de segunda a sexta',
  'Quais leads precisam de follow-up (+2 dias)?',
];

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  leads,
  config,
  onExecuteAction,
  onSelectLead,
  onNavigateToDay,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou seu **Copilot de Prospecção e Operação**. 🚀
Estou conectado à sua base com **${leads.length} leads**.

Diga o que você quer fazer e eu aplico na tela em tempo real:
- **"Remova as vendas e mude os status para pendente"** (eu altero os status e zero as vendas agora mesmo)
- **"Me dá os leads de terça"** (ou qualquer dia, prontos para você copiar)
- **"Copia o @ do próximo lead"** (pronto para Ctrl+V no Instagram)
- **"Distribui os leads da semana"** (balanceando até a meta de ${config.targetPerDay} leads/dia)
- **"Quem abordar primeiro?"** (priorizando wa.me e perfis sem site)

O que você deseja executar agora?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          leads,
          targetPerDay: config.targetPerDay,
          defaultSalePrice: config.defaultSalePrice || 100,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro na resposta do Copilot.');
      }

      // If action was generated, apply it to the app state immediately!
      if (data.executedAction) {
        onExecuteAction(data.executedAction);
      }

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        executedAction: data.executedAction,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: `Tive uma oscilação na conexão: ${err.message}. Mas seus leads continuam seguros! Como posso te ajudar?`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = async (msgId: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md sm:max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-slideLeft">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Copilot de Prospecção
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-xs text-slate-300">
              Agente com controle real sobre {leads.length} leads
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              {msg.role === 'user' ? (
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  Você <User className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="text-xs text-indigo-400 font-bold flex items-center gap-1">
                  <Bot className="w-4 h-4" /> Copilot IA
                </span>
              )}
            </div>

            <div
              className={`p-4 rounded-2xl text-sm leading-relaxed max-w-[94%] relative group shadow-sm ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white font-medium rounded-tr-xs'
                  : 'bg-slate-950 border border-slate-800 text-slate-100 rounded-tl-xs'
              }`}
            >
              {/* Message text with clear formatting */}
              <div className="whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed">
                {msg.content}
              </div>

              {/* Action confirmation badge if action was executed */}
              {msg.executedAction && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    Ação aplicada na base:{' '}
                    <strong>{msg.executedAction.description || 'Status e leads atualizados com sucesso!'}</strong>
                  </span>
                </div>
              )}

              {/* Copy button for bot response */}
              {msg.role === 'assistant' && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs sm:text-sm">
                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors font-semibold"
                  >
                    {copiedMessageId === msg.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Texto copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar texto</span>
                      </>
                    )}
                  </button>

                  <span className="text-xs text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-sm font-semibold text-indigo-300 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Executando na sua operação de leads...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/70">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm">
          <span className="text-slate-400 flex items-center gap-1 flex-shrink-0 font-bold">
            <Zap className="w-4 h-4 text-amber-400" /> Ações:
          </span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium whitespace-nowrap transition-colors flex-shrink-0 border border-slate-700 active:scale-95 shadow-sm"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Field */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: 'Remova as vendas', 'Muda o status do @drbruno para abordado'..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all flex items-center justify-center active:scale-95 shadow-lg shadow-indigo-600/30"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
