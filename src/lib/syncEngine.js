import { db } from './db';
import { supabase } from './supabase';

export async function syncData() {
  if (!navigator.onLine) return { success: false, message: 'Offline' };

  const queue = await db.sync_queue.orderBy('timestamp').toArray();
  
  if (queue.length === 0) return { success: true, message: 'Up to date', count: 0 };

  let syncedCount = 0;

  for (const item of queue) {
    try {
      const { table, action, data, id } = item;
      
      if (action === 'INSERT' || action === 'UPDATE') {
        const { error } = await supabase.from(table).upsert(data);
        if (error) throw error;
      } else if (action === 'DELETE') {
        const { error } = await supabase.from(table).delete().eq('id', data.id);
        if (error) throw error;
      }

      await db.sync_queue.delete(id);
      syncedCount++;
    } catch (err) {
      console.error('Sync error on item:', item, err);
      // Abort sync on first error to maintain order, or continue? 
      // Usually better to halt and try again later
      break; 
    }
  }

  return { success: true, count: syncedCount, remaining: queue.length - syncedCount };
}

export function startAutoSync(intervalMs = 30000) {
  setInterval(() => {
    if (navigator.onLine) {
      syncData();
    }
  }, intervalMs);
}
