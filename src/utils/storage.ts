import { Lead, WeeklyConfig, WeekInfo, DayOfWeek } from '../types';
import {
  getLeadsFromFirestore,
  batchSaveLeadsToFirestore,
  getConfigFromFirestore,
  saveConfigToFirestore
} from './firebase';

const LEADS_STORAGE_KEY = 'leadradar_leads_v1';
const CONFIG_STORAGE_KEY = 'leadradar_config_v1';

export function getWeekStartAndEnd(offsetWeeks = 0): {
  start: Date;
  end: Date;
  friday: Date;
  weekId: string;
  label: string;
  fullLabel: string;
} {
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = (currentDay + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // Sexta-feira
  friday.setHours(23, 59, 59, 999);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  const weekId = `${y}-W-${m}-${d}`;

  const formatShort = (dt: Date) => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const label = `${formatShort(monday)} a ${formatShort(friday)}`;
  const fullLabel =
    offsetWeeks === 0
      ? `Semana Atual (${label} · Seg a Sex)`
      : offsetWeeks === -1
      ? `Semana Passada (${label})`
      : offsetWeeks === 1
      ? `Próxima Semana (${label})`
      : `Semana de ${label}`;

  return { start: monday, end: sunday, friday, weekId, label, fullLabel };
}

export function getCurrentWeekId(offsetWeeks = 0): string {
  return getWeekStartAndEnd(offsetWeeks).weekId;
}

export const currentWeekDefaultId = getCurrentWeekId(0);

export const INITIAL_CONFIG: WeeklyConfig = {
  targetPerDay: 10,
  defaultSalePrice: 100,
  activeWeekId: currentWeekDefaultId,
  activeWeekOffset: 0,
};

export function getWeekInfo(offsetWeeks = 0): WeekInfo {
  const { start, end, weekId, label, fullLabel } = getWeekStartAndEnd(offsetWeeks);
  return {
    id: weekId,
    label,
    fullLabel,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    isCurrent: offsetWeeks === 0,
    offsetWeeks,
  };
}

// Identifica o dia atual real e fornece o contexto correto para prospecção
export function getTodayContext(): {
  dayName: string;
  isWeekend: boolean;
  activeWorkDay: DayOfWeek;
  closestUpcomingDays: DayOfWeek[];
  description: string;
} {
  const now = new Date();
  const dayIndex = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  // Semana de prospecção: SEGUNDA A SEXTA (Sábado e Domingo não são dias de prospecção de rua)
  const workDays: DayOfWeek[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

  if (dayIndex === 0 || dayIndex === 6) {
    const dayName = dayIndex === 0 ? 'Domingo' : 'Sábado';
    return {
      dayName,
      isWeekend: true,
      activeWorkDay: 'segunda',
      closestUpcomingDays: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
      description: `Hoje é ${dayName} (Fim de semana) • Prospecção organizada para a semana útil (Segunda a Sexta)`,
    };
  }

  const dayMap: Record<number, { key: DayOfWeek; name: string }> = {
    1: { key: 'segunda', name: 'Segunda-feira' },
    2: { key: 'terca', name: 'Terça-feira' },
    3: { key: 'quarta', name: 'Quarta-feira' },
    4: { key: 'quinta', name: 'Quinta-feira' },
    5: { key: 'sexta', name: 'Sexta-feira' },
  };

  const todayKey = dayMap[dayIndex].key;
  const todayName = dayMap[dayIndex].name;
  const todayIdxInWorkDays = workDays.indexOf(todayKey);

  // Começa pelo dia de hoje e avança para os dias seguintes da semana
  const ordered = [
    ...workDays.slice(todayIdxInWorkDays),
    ...workDays.slice(0, todayIdxInWorkDays),
  ];

  return {
    dayName: todayName,
    isWeekend: false,
    activeWorkDay: todayKey,
    closestUpcomingDays: ordered,
    description: `Hoje é ${todayName} • Priorizando dias mais imediatos da semana`,
  };
}

// Retorna uma lista de semanas para abas (semanas passadas, atual, futuras e qualquer semana já com leads)
export function getAvailableWeeks(leads: Lead[], currentOffset = 0): WeekInfo[] {
  const map = new Map<string, WeekInfo>();

  // Gera semanas relativas: -2, -1, 0, 1, 2
  for (let offset = -2; offset <= 2; offset++) {
    const info = getWeekInfo(offset);
    map.set(info.id, info);
  }

  // Se o offset atual for além de -2 ou +2, adiciona
  if (currentOffset < -2 || currentOffset > 2) {
    const current = getWeekInfo(currentOffset);
    map.set(current.id, current);
  }

  return Array.from(map.values()).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

// Calcula quotas por dia priorizando os dias mais próximos de forma inteligente:
// 1. O dia mais próximo recebe mais leads e os leads de maior prioridade
// 2. Os outros dias da semana útil também recebem leads (evita despejar tudo num dia só)
// 3. Respeita a meta diária (targetPerDay)
export function computeDayQuotas(totalCandidates: number, targetPerDay: number, numDays = 5): number[] {
  if (totalCandidates <= 0) return Array(numDays).fill(0);

  // Se tem leads suficientes para preencher a meta de todos os dias
  if (totalCandidates >= numDays * targetPerDay) {
    return Array(numDays).fill(targetPerDay);
  }

  // Pesos decrescentes priorizando os dias mais próximos (ex: [5, 4, 3, 2, 1])
  const weights = [5, 4, 3, 2, 1].slice(0, numDays);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // Se o total for pequeno (ex: 1 a 4 leads)
  if (totalCandidates < numDays) {
    const quotas = Array(numDays).fill(0);
    // Distribui nos dias mais próximos primeiro
    for (let i = 0; i < totalCandidates; i++) {
      quotas[i] = 1;
    }
    return quotas;
  }

  // Começa garantindo que cada dia da semana receba pelo menos 1 lead
  const quotas = Array(numDays).fill(1);
  let remaining = totalCandidates - numDays;

  // Distribui o restante proporcionalmente aos pesos dos dias mais próximos
  while (remaining > 0) {
    let allocated = false;
    for (let i = 0; i < numDays && remaining > 0; i++) {
      if (quotas[i] < targetPerDay) {
        const share = Math.min(
          targetPerDay - quotas[i],
          Math.max(1, Math.round((remaining * weights[i]) / weightSum))
        );
        const toAdd = Math.min(remaining, share);
        if (toAdd > 0) {
          quotas[i] += toAdd;
          remaining -= toAdd;
          allocated = true;
        }
      }
    }
    // Fallback caso arredondamentos deixem sobra
    if (!allocated) {
      for (let i = 0; i < numDays && remaining > 0; i++) {
        if (quotas[i] < targetPerDay) {
          quotas[i]++;
          remaining--;
          allocated = true;
          break;
        }
      }
      if (!allocated) break; // Todos atingiram o targetPerDay
    }
  }

  return quotas;
}

// Algoritmo de Organização Semanal com IA:
// Prioriza o dia mais próximo da semana útil ATÉ LOTAR a meta diária (targetPerDay),
// transbordando para os dias seguintes em ordem de proximidade.
export function autoBalanceWeekPrioritizingClosestDays(
  leads: Lead[],
  targetPerDay: number,
  targetWeekId: string
): { updatedLeads: Lead[]; movedCount: number; todayInfo: string } {
  const todayCtx = getTodayContext();

  // Se estiver organizando a semana atual, prioriza a partir de hoje
  // Se for fim de semana ou outra semana, começa por Segunda-feira
  const isTargetCurrentWeek = targetWeekId === currentWeekDefaultId;
  const orderedDays: DayOfWeek[] = isTargetCurrentWeek
    ? todayCtx.closestUpcomingDays
    : ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

  const updated = leads.map((l) => {
    // Migração: se algum lead estava no sábado, move para 'pool'
    if (l.dayOfWeek === ('sabado' as any)) {
      return { ...l, dayOfWeek: 'pool' as DayOfWeek };
    }
    return { ...l };
  });

  let movedCount = 0;

  // Pontuação de prioridade para alocação inteligente
  const getWeight = (l: Lead) => {
    let weight = 0;
    if (l.priority === 'high') weight += 30;
    if (l.priority === 'medium') weight += 15;
    if (l.linkType === 'wame') weight += 12;
    if (l.linkType === 'none') weight += 10;
    if (l.linkType === 'linktree') weight += 5;
    return weight;
  };

  // Separa leads fixos (já abordados, negociando, vendidos) dos candidatos à redistribuição
  const fixedLeads: Lead[] = [];
  const candidateLeads: Lead[] = [];

  updated.forEach((lead) => {
    const belongsToWeek = !lead.weekId || lead.weekId === targetWeekId;
    if (belongsToWeek && lead.status === 'nao_abordado') {
      candidateLeads.push(lead);
    } else {
      fixedLeads.push(lead);
    }
  });

  // Ordena os candidatos: os melhores leads vão primeiro para o dia mais próximo
  candidateLeads.sort((a, b) => getWeight(b) - getWeight(a));

  // Preenche DIA POR DIA por ordem de proximidade ATÉ LOTAR a meta diária (targetPerDay)
  let candidateIdx = 0;

  orderedDays.forEach((day) => {
    // Quantos leads fixos já existem nesse dia
    const existingFixedInDay = fixedLeads.filter(
      (l) => (!l.weekId || l.weekId === targetWeekId) && l.dayOfWeek === day
    ).length;

    // Vagas disponíveis para LOTAR este dia
    let slotsNeeded = Math.max(0, targetPerDay - existingFixedInDay);

    while (slotsNeeded > 0 && candidateIdx < candidateLeads.length) {
      const lead = candidateLeads[candidateIdx];
      if (lead.dayOfWeek !== day || lead.weekId !== targetWeekId) {
        lead.dayOfWeek = day;
        lead.weekId = targetWeekId;
        lead.updatedAt = new Date().toISOString();
        movedCount++;
      }
      slotsNeeded--;
      candidateIdx++;
    }
  });

  // Os leads que excederem a capacidade máxima da semana útil (5 dias lotados) vão para o banco de espera (pool)
  while (candidateIdx < candidateLeads.length) {
    const lead = candidateLeads[candidateIdx];
    if (lead.dayOfWeek !== 'pool') {
      lead.dayOfWeek = 'pool';
      lead.weekId = targetWeekId;
      lead.updatedAt = new Date().toISOString();
      movedCount++;
    }
    candidateIdx++;
  }

  return {
    updatedLeads: [...fixedLeads, ...candidateLeads],
    movedCount,
    todayInfo: todayCtx.description,
  };
}

// Avança para a próxima semana (Reset de Domingo):
// Transfere leads não abordados da semana anterior para a nova semana,
// mantendo os prospectados no histórico do CRM / Pipeline
export function advanceToNextWeek(
  leads: Lead[],
  currentWeekId: string,
  newWeekId: string
): { updatedLeads: Lead[]; carriedCount: number } {
  let carriedCount = 0;
  const now = new Date().toISOString();

  const updatedLeads = leads.map((lead) => {
    // Se o lead pertencia à semana finalizada e NUNCA foi abordado, carrega para a nova semana
    if ((lead.weekId === currentWeekId || !lead.weekId) && lead.status === 'nao_abordado') {
      carriedCount++;
      return {
        ...lead,
        weekId: newWeekId,
        dayOfWeek: 'pool' as DayOfWeek, // coloca no banco da nova semana para ser distribuído
        updatedAt: now,
      };
    }
    return lead;
  });

  return { updatedLeads, carriedCount };
}

export const INITIAL_SEED_LEADS: Lead[] = [
  {
    id: 'lead-1',
    username: '@drbruno.odontologia',
    fullName: 'Dr. Bruno Oliveira | Ortodontia',
    bio: 'Transformando sorrisos em SP 🦷\nInvisalign Doctor Diamond\nAgendamentos pelo WhatsApp abaixo 👇',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511999991234',
    category: 'Odontologia',
    followersApprox: '14.2k',
    prospectingAngle: 'Tem apenas wa.me na bio, sem catálogo de antes/depois ou landing page profissional. Uma página estruturada aumentaria o agendamento de consultas particulares.',
    priority: 'high',
    dayOfWeek: 'segunda',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'lead-2',
    username: '@carolinaribeiro.estetica',
    fullName: 'Carolina Ribeiro • Estética Avançada',
    bio: 'Harmonização Facial & Corporal ✨\nRealçando sua beleza natural\nClínica Jardins - SP | Clique no link:',
    linkType: 'linktree',
    linkUrl: 'https://linktr.ee/carolestetica',
    category: 'Estética',
    followersApprox: '8.9k',
    prospectingAngle: 'Linktree genérico e lento para carregar no celular. Página personalizada rápida aumentaria a conversão de pacientes.',
    priority: 'high',
    dayOfWeek: 'segunda',
    status: 'abordado',
    approachedAt: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    followUpDueAt: new Date(Date.now() - 86400000 * 0.5).toISOString(),
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2.5).toISOString(),
  },
  {
    id: 'lead-3',
    username: '@barbeariamonarca',
    fullName: 'Monarca Barber Club',
    bio: 'Cortes clássicos, barba na toalha quente e cerveja gelada 🍺✂️\nMoema - SP\nSem agendamento online? Chama no whats:',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511988887777',
    category: 'Barbearia',
    followersApprox: '5.1k',
    prospectingAngle: 'Falta cardápio de serviços e fotos do espaço estruturados. Uma página de alta conversão com botão direto para WhatsApp resolve.',
    priority: 'medium',
    dayOfWeek: 'segunda',
    status: 'negociacao',
    approachedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-4',
    username: '@nutri.marcellaleite',
    fullName: 'Marcella Leite | Nutricionista Esportiva',
    bio: 'Emagrecimento definitivo sem dietas restritivas 🥗🏋️‍♀️\n+1.000 vidas transformadas\nVagas abertas para consultoria:',
    linkType: 'linktree',
    linkUrl: 'https://linktr.ee/marcellaleite',
    category: 'Nutrição',
    followersApprox: '22.4k',
    prospectingAngle: 'Muito engajamento nos reels, mas o linktree não passa credibilidade de autoridade. Precisa de uma landing page limpa com depoimentos.',
    priority: 'high',
    dayOfWeek: 'terca',
    status: 'vendido',
    approachedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    closedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    saleValue: 100,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-5',
    username: '@studioarteemflores',
    fullName: 'Arte em Flores | Decoração e Buquês',
    bio: 'Buquês autorais & Eventos corporativos 🌸\nEntregas express em toda a capital\nFaça seu pedido:',
    linkType: 'none',
    linkUrl: '',
    category: 'Floricultura',
    followersApprox: '3.4k',
    prospectingAngle: 'NENHUM link na bio! O cliente é obrigado a mandar DM ou tentar adivinhar o WhatsApp. Perde clientes todo dia.',
    priority: 'high',
    dayOfWeek: 'terca',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'lead-6',
    username: '@gabrielpersonal.fit',
    fullName: 'Gabriel Silva | Personal Trainer',
    bio: 'Consultoria online de musculação e hipertrofia 💪\nResultados em 90 dias com treino periodizado.\nComece agora:',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511977776666',
    category: 'Personal Trainer',
    followersApprox: '11.8k',
    prospectingAngle: 'Posta muitos antes/depois nos destaques que somem. Uma página de vendas compacta dobraria as conversões da consultoria.',
    priority: 'medium',
    dayOfWeek: 'quarta',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-7',
    username: '@dra.camila.dermatologia',
    fullName: 'Dra. Camila Santos • Médica Dermatologista',
    bio: 'CRM 189234 | RQE 78912\nCuidados com a pele, cabelos e unhas 🧴\nConsultórios em Perdizes e Alphaville',
    linkType: 'website',
    linkUrl: 'https://dracamilasantos.com.br',
    category: 'Dermatologia',
    followersApprox: '31.5k',
    prospectingAngle: 'Já possui site, mas pode precisar de landing page específica para novo protocolo de rejuvenescimento.',
    priority: 'low',
    dayOfWeek: 'quarta',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'lead-8',
    username: '@pizzariabuonagusto',
    fullName: 'Buona Gusto Pizza & Pasta',
    bio: 'Autêntica pizza napolitana feita no forno a lenha 🍕🔥\nAberto de ter a dom das 18h às 23h30\nCardápio e pedidos:',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511966665555',
    category: 'Restaurante',
    followersApprox: '6.7k',
    prospectingAngle: 'Cardápio em PDF pesado no WhatsApp. Página digital interativa de carregamento instantâneo facilita pedidos.',
    priority: 'high',
    dayOfWeek: 'quinta',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-9',
    username: '@advocacia.moura',
    fullName: 'Moura & Associados Advocacia',
    bio: 'Direito Trabalhista & Previdenciário ⚖️\nDefendendo seus direitos com agilidade e ética.\nAgende seu atendimento:',
    linkType: 'linktree',
    linkUrl: 'https://linktr.ee/mouraadv',
    category: 'Advocacia',
    followersApprox: '4.2k',
    prospectingAngle: 'Linktree com botões quebrados e design desatualizado para um escritório sério. Uma landing page sóbria eleva o valor percebido.',
    priority: 'medium',
    dayOfWeek: 'quinta',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'lead-10',
    username: '@ateliedasobrancelha',
    fullName: 'Ateliê da Sobrancelha | Micropigmentação',
    bio: 'Design personalizado & NanoBlading ✨\nEspecialista em olhares naturais\nAgendamentos pelo link:',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511955554444',
    category: 'Beleza',
    followersApprox: '9.3k',
    prospectingAngle: 'Muita demanda de mensagens no WhatsApp sem triagem prévia. Landing page filtra dúvidas frequentes e já direciona pro fechamento.',
    priority: 'high',
    dayOfWeek: 'sexta',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-11',
    username: '@confeitariadalu',
    fullName: 'Luana Bolos & Doces Finos',
    bio: 'Bolos decorados para casamentos e aniversários 🎂🍓\nDoces artesanais sob encomenda\nOrçamentos:',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511944443333',
    category: 'Confeitaria',
    followersApprox: '7.8k',
    prospectingAngle: 'Fotos lindas dos bolos mas falta vitrine organizada. Catálogo em página única fecha pedidos muito mais rápido.',
    priority: 'high',
    dayOfWeek: 'sexta',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'lead-12',
    username: '@studiopilatesviverbem',
    fullName: 'Pilates Viver Bem | Saúde & Postura',
    bio: 'Aulas individuais e em dupla 🧘‍♂️\nAlívio de dores nas costas e flexibilidade\nAgende sua aula experimental gratuita:',
    linkType: 'none',
    linkUrl: '',
    category: 'Saúde & Bem-Estar',
    followersApprox: '3.9k',
    prospectingAngle: 'Sem link na bio e oferecendo aula experimental! É a oportunidade perfeita de criar uma página com formulário ou botão de WhatsApp.',
    priority: 'high',
    dayOfWeek: 'segunda',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'lead-13',
    username: '@oficinamecanica.autoexpress',
    fullName: 'AutoExpress Mecânica Especializada',
    bio: 'Revisão automotiva, freios, injeção e suspensão 🚗🔧\nAtendimento rápido com garantia\nChama no plantão:',
    linkType: 'wame',
    linkUrl: 'https://wa.me/5511933332222',
    category: 'Automotivo',
    followersApprox: '2.5k',
    prospectingAngle: 'Mecânica com boa avaliação mas sem página institucional para passar confiança e localização.',
    priority: 'medium',
    dayOfWeek: 'pool',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'lead-14',
    username: '@arquitetura.urban',
    fullName: 'Urban Arquitetura & Interiores',
    bio: 'Projetos residenciais e comerciais contemporâneos 📐🏡\nTransformando espaços em experiências\nSolicite uma proposta:',
    linkType: 'linktree',
    linkUrl: 'https://linktr.ee/urbanarq',
    category: 'Arquitetura',
    followersApprox: '16.8k',
    prospectingAngle: 'Projetos de alto padrão não combinam com linktree genérico. Portfólio em página clean agrega imenso valor.',
    priority: 'high',
    dayOfWeek: 'pool',
    status: 'nao_abordado',
    saleValue: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export function loadLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      const initialized = INITIAL_SEED_LEADS.map((l) => ({ ...l, weekId: currentWeekDefaultId }));
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(initialized));
      return initialized;
    }
    const leads: Lead[] = JSON.parse(raw);
    return leads.map((l) => {
      // Migração automática de leads legados que estavam marcados no sábado
      const sanitizedDay = l.dayOfWeek === ('sabado' as any) ? 'pool' : l.dayOfWeek;
      return {
        ...l,
        dayOfWeek: sanitizedDay,
        weekId: l.weekId || currentWeekDefaultId,
      };
    });
  } catch (e) {
    console.error('Erro ao ler leads do storage:', e);
    return INITIAL_SEED_LEADS.map((l) => ({ ...l, weekId: currentWeekDefaultId }));
  }
}

export function saveLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  } catch (e: any) {
    // Se quota de 5MB do localStorage estourar por causa dos prints, salva versão sem imagens no localStorage
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try {
        const lightweight = leads.map((l) => ({ ...l, screenshotUrl: null }));
        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(lightweight));
      } catch (err) {
        console.warn('LocalStorage cheio, mantendo no servidor.');
      }
    } else {
      console.error('Erro ao salvar leads no storage:', e);
    }
  }

  // Sincroniza com Firebase Cloud Firestore e servidor local
  syncDatabaseWithServer(leads);
}

export function loadConfig(): WeeklyConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(INITIAL_CONFIG));
      return INITIAL_CONFIG;
    }
    return { ...INITIAL_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    return INITIAL_CONFIG;
  }
}

export function saveConfig(config: WeeklyConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Erro ao salvar configuração:', e);
  }

  // Sincroniza configuração com Firestore e servidor
  syncDatabaseWithServer(undefined, config);
}

// Sincronização persistente com Firebase Firestore e API local
let syncTimeout: any = null;
export function syncDatabaseWithServer(leads?: Lead[], config?: WeeklyConfig): void {
  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(async () => {
    // 1. Grava no Firebase Firestore (Nuvem permanente)
    try {
      if (leads !== undefined && leads.length > 0) {
        await batchSaveLeadsToFirestore(leads);
      }
      if (config !== undefined) {
        await saveConfigToFirestore(config);
      }
    } catch (err) {
      console.warn('Aviso: falha na sincronização com Firebase Firestore:', err);
    }

    // 2. Backup secundário no backend local (/api/database)
    fetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(leads !== undefined ? { leads } : {}),
        ...(config !== undefined ? { config } : {}),
      }),
    }).catch((err) => {
      // Ignora erro no servidor se estiver rodando em ambiente estático como Netlify
    });
  }, 300);
}

// Carrega dados persistentes com prioridade no Firebase Cloud Firestore
// e migração automática de dados legados do disco local
export async function fetchServerDatabase(): Promise<{ leads: Lead[] | null; config: WeeklyConfig | null }> {
  try {
    // 1. Tenta carregar primeiro do Firebase Firestore
    const cloudLeads = await getLeadsFromFirestore().catch(() => null);
    const cloudConfig = await getConfigFromFirestore().catch(() => null);

    if (cloudLeads && Array.isArray(cloudLeads) && cloudLeads.length > 0) {
      console.log(`☁️ ${cloudLeads.length} leads carregados com sucesso do Firebase Cloud Firestore.`);
      return {
        leads: cloudLeads,
        config: cloudConfig,
      };
    }

    // 2. Se o Firestore estiver vazio (primeiro boot pós-migração), lê do servidor local / backup
    console.log('🔄 Migrando leads do banco local para o Firebase Firestore...');
    const res = await fetch('/api/database').catch(() => null);
    let initialLeads: Lead[] | null = null;
    let initialConfig: WeeklyConfig | null = null;

    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data.leads) && data.leads.length > 0) {
        initialLeads = data.leads;
      }
      if (data.config) {
        initialConfig = data.config;
      }
    }

    // Fallback para localStorage se API não responder
    if (!initialLeads || initialLeads.length === 0) {
      initialLeads = loadLeads();
      initialConfig = loadConfig();
    }

    // 3. Salva os dados migrados no Firebase Firestore
    if (initialLeads && initialLeads.length > 0) {
      await batchSaveLeadsToFirestore(initialLeads).catch((err) => {
        console.warn('Aviso ao inicializar Firestore:', err);
      });
      if (initialConfig) {
        await saveConfigToFirestore(initialConfig).catch(() => {});
      }
      console.log(`✅ Migração concluída: ${initialLeads.length} leads salvos no Firebase Cloud Firestore.`);
    }

    return {
      leads: initialLeads,
      config: initialConfig,
    };
  } catch (e) {
    console.error('Erro na carga unificada:', e);
    return { leads: null, config: null };
  }
}

// Verifica se um username já existe (duplicado)
export function checkDuplicateUsername(leads: Lead[], username: string, excludeId?: string): boolean {
  const cleanUsername = username.trim().toLowerCase().replace('@', '');
  return leads.some(
    (l) => l.id !== excludeId && l.username.trim().toLowerCase().replace('@', '') === cleanUsername
  );
}

// Alerta de follow-up: se lead foi abordado há mais de 2 dias e ainda não respondeu (status 'abordado')
export function isFollowUpDue(lead: Lead): boolean {
  if (lead.status !== 'abordado' || !lead.approachedAt) return false;
  const approachedDate = new Date(lead.approachedAt).getTime();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return Date.now() - approachedDate >= twoDaysMs;
}

// Helper para copiar texto para a área de transferência
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Falha ao copiar:', err);
    return false;
  }
}
