/**
 * Hybrid Sync Manager
 * Sincroniza dados entre localStorage e Supabase com resiliência offline
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SyncQueue {
  id: string;
  type: 'purchase' | 'customer' | 'payment' | 'delivery';
  data: any;
  timestamp: number;
  retries: number;
}

const SYNC_QUEUE_KEY = 'sync_queue';
const MAX_RETRIES = 3;
const SYNC_INTERVAL = 5000; // 5 segundos

/**
 * Adiciona um item à fila de sincronização
 */
export const queueSync = (type: string, data: any): SyncQueue => {
  const queue = getSyncQueue();
  const item: SyncQueue = {
    id: Math.random().toString(36).substr(2, 9),
    type: type as any,
    data,
    timestamp: Date.now(),
    retries: 0
  };
  queue.push(item);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  return item;
};

/**
 * Obtém a fila de sincronização
 */
export const getSyncQueue = (): SyncQueue[] => {
  const saved = localStorage.getItem(SYNC_QUEUE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  return [];
};

/**
 * Remove um item da fila após sincronização bem-sucedida
 */
export const removeSyncItem = (id: string): void => {
  const queue = getSyncQueue();
  const updated = queue.filter(item => item.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updated));
};

/**
 * Limpa toda a fila de sincronização
 */
export const clearSyncQueue = (): void => {
  localStorage.removeItem(SYNC_QUEUE_KEY);
};

/**
 * Sincroniza a fila com o Supabase
 */
export const syncQueueWithSupabase = async (
  supabase: SupabaseClient | null,
  onSyncSuccess?: (item: SyncQueue) => void,
  onSyncError?: (item: SyncQueue, error: any) => void
): Promise<{ synced: number; failed: number }> => {
  if (!supabase) {
    console.warn('Supabase não está configurado. Fila será sincronizada quando conectar.');
    return { synced: 0, failed: 0 };
  }

  const queue = getSyncQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await processSyncItem(supabase, item);
      removeSyncItem(item.id);
      synced++;
      onSyncSuccess?.(item);
      console.log(`✓ Sincronizado: ${item.type} (ID: ${item.id})`);
    } catch (error) {
      failed++;
      item.retries++;

      if (item.retries >= MAX_RETRIES) {
        removeSyncItem(item.id);
        console.error(`✗ Máximo de tentativas atingido para ${item.type}:`, error);
        onSyncError?.(item, error);
      } else {
        // Atualiza a fila com o novo número de tentativas
        const queue = getSyncQueue();
        const index = queue.findIndex(i => i.id === item.id);
        if (index !== -1) {
          queue[index] = item;
          localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        }
      }
    }
  }

  return { synced, failed };
};

/**
 * Processa um item individual da fila
 */
const processSyncItem = async (supabase: SupabaseClient, item: SyncQueue): Promise<void> => {
  switch (item.type) {
    case 'purchase': {
      const { cliente_id, referencia, preco, quantidade, venda_id, data_live } = item.data;

      // Garante que a venda existe
      const { data: venda, error: vError } = await supabase
        .from('live_vendas')
        .upsert({
          cliente_id,
          data_live,
          pago: false,
          status: 'pendente'
        }, { onConflict: 'cliente_id,data_live' })
        .select('id')
        .single();

      if (vError) throw vError;
      if (!venda) throw new Error('Venda não encontrada');

      // Insere o item
      const { error: iError } = await supabase
        .from('live_vendas_itens')
        .insert({
          venda_id: venda.id,
          referencia,
          preco,
          quantidade
        });

      if (iError) throw iError;
      break;
    }

    case 'customer': {
      const { id, username, nome_completo, codigo_cliente, telefone, observacoes } = item.data;

      const { error } = await supabase
        .from('live_clientes')
        .upsert({
          id,
          username,
          nome_completo,
          codigo_cliente,
          telefone,
          observacoes
        });

      if (error) throw error;
      break;
    }

    case 'payment': {
      const { venda_id } = item.data;

      const { error } = await supabase
        .from('live_vendas')
        .update({ pago: true })
        .eq('id', venda_id);

      if (error) throw error;
      break;
    }

    case 'delivery': {
      const { venda_id } = item.data;

      const { error } = await supabase
        .from('live_vendas')
        .update({ status: 'entregue' })
        .eq('id', venda_id);

      if (error) throw error;
      break;
    }

    default:
      throw new Error(`Tipo de sincronização desconhecido: ${item.type}`);
  }
};

/**
 * Monitora a conexão com a internet e sincroniza quando reconectar
 */
export const setupConnectionMonitoring = (
  supabase: SupabaseClient | null,
  onOnline?: () => void,
  onOffline?: () => void
): (() => void) => {
  let syncInterval: NodeJS.Timeout | null = null;
  let isOnline = navigator.onLine;

  const handleOnline = async () => {
    console.log('🟢 Conexão restaurada! Sincronizando dados...');
    isOnline = true;
    onOnline?.();

    // Sincroniza a fila
    const result = await syncQueueWithSupabase(supabase);
    console.log(`Sincronização: ${result.synced} sucesso, ${result.failed} falhas`);
  };

  const handleOffline = () => {
    console.log('🔴 Conexão perdida. Dados serão salvos localmente.');
    isOnline = false;
    onOffline?.();
  };

  // Event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Sincronização periódica em background
  syncInterval = setInterval(async () => {
    if (isOnline && navigator.onLine) {
      await syncQueueWithSupabase(supabase);
    }
  }, SYNC_INTERVAL);

  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (syncInterval) clearInterval(syncInterval);
  };
};

/**
 * Verifica o status de sincronização
 */
export const getSyncStatus = (): {
  pending: number;
  isOnline: boolean;
  lastSync: number | null;
} => {
  const queue = getSyncQueue();
  const lastSync = localStorage.getItem('lastSuccessfulSync');

  return {
    pending: queue.length,
    isOnline: navigator.onLine,
    lastSync: lastSync ? parseInt(lastSync) : null
  };
};

/**
 * Marca o último sincronização bem-sucedida
 */
export const markLastSync = (): void => {
  localStorage.setItem('lastSuccessfulSync', Date.now().toString());
};

/**
 * Obtém dados do localStorage com fallback para Supabase se necessário
 */
export const getDataWithFallback = async (
  key: string,
  supabaseQuery?: () => Promise<any>,
  parser?: (data: any) => any
): Promise<any> => {
  const local = localStorage.getItem(key);
  if (local) {
    try {
      const data = JSON.parse(local);
      return parser ? parser(data) : data;
    } catch (e) {
      console.error(`Erro ao parsear ${key} do localStorage:`, e);
    }
  }

  // Fallback para Supabase se localStorage estiver vazio
  if (supabaseQuery) {
    try {
      const data = await supabaseQuery();
      if (data) {
        localStorage.setItem(key, JSON.stringify(data));
        return parser ? parser(data) : data;
      }
    } catch (e) {
      console.error(`Erro ao buscar ${key} do Supabase:`, e);
    }
  }

  return null;
};
