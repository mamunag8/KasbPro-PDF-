import type { StoredDocumentRecord, SyncQueueItem } from '../types/pdf';

const DB_NAME = 'KasbProVaultDB';
const DB_VERSION = 2;
const DOC_STORE = 'documents';
const SIG_STORE = 'signatures';
const QUEUE_STORE = 'sync_queue';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SIG_STORE)) {
        db.createObjectStore(SIG_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocumentToVault(doc: StoredDocumentRecord): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      tx.objectStore(DOC_STORE).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save fallback:', err);
  }
}

export async function listVaultDocuments(): Promise<StoredDocumentRecord[]> {
  try {
    const db = await openVaultDb();
    return await new Promise<StoredDocumentRecord[]>((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readonly');
      const req = tx.objectStore(DOC_STORE).getAll();
      req.onsuccess = () => {
        const list = (req.result as StoredDocumentRecord[]) || [];
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getVaultDocument(id: string): Promise<StoredDocumentRecord | null> {
  try {
    const db = await openVaultDb();
    return await new Promise<StoredDocumentRecord | null>((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readonly');
      const req = tx.objectStore(DOC_STORE).get(id);
      req.onsuccess = () => resolve((req.result as StoredDocumentRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteVaultDocument(id: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      tx.objectStore(DOC_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Delete vault doc error:', err);
  }
}

export interface SavedSignOrSealRecord {
  id: string;
  label: string;
  category: 'signature' | 'seal' | 'stamp';
  dataUrl: string;
  createdAt: string;
}

export type SavedSignatureRecord = SavedSignOrSealRecord;

export async function saveSignatureToVault(sig: SavedSignOrSealRecord): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SIG_STORE, 'readwrite');
      tx.objectStore(SIG_STORE).put(sig);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Save sign/seal error:', err);
  }
}

export async function listSavedSignatures(): Promise<SavedSignOrSealRecord[]> {
  try {
    const db = await openVaultDb();
    return await new Promise<SavedSignOrSealRecord[]>((resolve, reject) => {
      const tx = db.transaction(SIG_STORE, 'readonly');
      const req = tx.objectStore(SIG_STORE).getAll();
      req.onsuccess = () => {
        const list = (req.result as SavedSignOrSealRecord[]) || [];
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteSavedSignature(id: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SIG_STORE, 'readwrite');
      tx.objectStore(SIG_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Delete signature error:', err);
  }
}

export async function exportSavedSignsAndSealsPack(): Promise<void> {
  const items = await listSavedSignatures();
  const blob = new Blob([JSON.stringify({ version: 1, items }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KasbPro_Signatures_and_Seals_Pack.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSavedSignsAndSealsPack(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { items?: SavedSignOrSealRecord[] };
  if (!parsed.items || !Array.isArray(parsed.items)) return 0;
  for (const item of parsed.items) {
    if (item.id && item.dataUrl) {
      await saveSignatureToVault(item);
    }
  }
  return parsed.items.length;
}

export async function enqueueCloudSyncItem(item: SyncQueueItem): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      tx.objectStore(QUEUE_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Enqueue sync error:', err);
  }
}

export async function listSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const db = await openVaultDb();
    return await new Promise<SyncQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => {
        const items = (req.result as SyncQueueItem[]) || [];
        items.sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearSyncedQueueItems(): Promise<void> {
  try {
    const db = await openVaultDb();
    const items = await listSyncQueueItems();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      for (const item of items) {
        if (item.status === 'synced') {
          store.delete(item.id);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Clear queue error:', err);
  }
}
