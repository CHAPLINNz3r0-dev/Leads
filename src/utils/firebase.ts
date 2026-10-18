import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Lead, WeeklyConfig } from '../types';

// Inicializa o app Firebase com as credenciais oficiais provisionadas
const app = initializeApp(firebaseConfig);

// CRÍTICO: Utiliza o firestoreDatabaseId correto do projeto conforme instrução do skill
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Teste de conexão com o Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'settings', 'connection_test'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline ou bloqueado pela rede.');
      return false;
    }
    // Documento inexistente ou permissão é esperado no teste
    return true;
  }
}

// Operações de Leads no Firestore
const LEADS_COLLECTION = 'leads';
const SETTINGS_COLLECTION = 'settings';
const CONFIG_DOC_ID = 'weeklyConfig';

export async function getLeadsFromFirestore(): Promise<Lead[]> {
  try {
    const colRef = collection(db, LEADS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: Lead[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as Lead);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, LEADS_COLLECTION);
  }
}

export async function saveLeadToFirestore(lead: Lead): Promise<void> {
  const path = `${LEADS_COLLECTION}/${lead.id}`;
  try {
    await setDoc(doc(db, LEADS_COLLECTION, lead.id), lead);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  const path = `${LEADS_COLLECTION}/${leadId}`;
  try {
    await deleteDoc(doc(db, LEADS_COLLECTION, leadId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function batchSaveLeadsToFirestore(leads: Lead[]): Promise<void> {
  try {
    // Firestore suporta lotes de até 500 operações
    const BATCH_SIZE = 400;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const chunk = leads.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((lead) => {
        const docRef = doc(db, LEADS_COLLECTION, lead.id);
        batch.set(docRef, lead);
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, LEADS_COLLECTION);
  }
}

export async function getConfigFromFirestore(): Promise<WeeklyConfig | null> {
  const path = `${SETTINGS_COLLECTION}/${CONFIG_DOC_ID}`;
  try {
    const dRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID);
    const snap = await getDoc(dRef);
    if (snap.exists()) {
      return snap.data() as WeeklyConfig;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveConfigToFirestore(config: WeeklyConfig): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${CONFIG_DOC_ID}`;
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID), {
      ...config,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
