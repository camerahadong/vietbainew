import { HistoryItem } from '../types';

const DB_NAME = 'SeoWizardDB';
const STORE_NAME = 'history';
const DB_VERSION = 1;

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Check if indexedDB is supported
    if (!('indexedDB' in window)) {
        reject(new Error("This browser doesn't support IndexedDB"));
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result as HistoryItem[];
        // Sort by timestamp descending (newest first)
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to load history from DB", e);
    return [];
  }
};

export const saveHistoryItem = async (item: HistoryItem): Promise<HistoryItem[]> => {
  try {
    const db = await openDB();
    
    // Create unique ID if not present
    const uniqueItem = {
      ...item,
      id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    await new Promise<void>((resolve, reject) => {
       const tx = db.transaction(STORE_NAME, 'readwrite');
       const store = tx.objectStore(STORE_NAME);
       const req = store.put(uniqueItem);
       
       req.onsuccess = () => resolve();
       req.onerror = () => reject(req.error);
    });

    console.log(`[Storage] Saved item: ${uniqueItem.keyword}`);
    
    // Check total count and trim if necessary (keep last 50)
    // We do this by getting all keys, sorting, and deleting old ones
    // But for now, returning the list is priority.
    
    return await getHistory();
  } catch (e) {
    console.error("Failed to save history to DB", e);
    return await getHistory();
  }
};

export const deleteHistoryItem = async (id: string): Promise<HistoryItem[]> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
       const tx = db.transaction(STORE_NAME, 'readwrite');
       const store = tx.objectStore(STORE_NAME);
       const req = store.delete(id);
       req.onsuccess = () => resolve();
       req.onerror = () => reject(req.error);
    });
    return await getHistory();
  } catch (e) {
    console.error("Failed to delete item from DB", e);
    return await getHistory();
  }
};

export const clearHistory = async (): Promise<HistoryItem[]> => {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        return [];
    } catch (e) {
        console.error("Failed to clear history", e);
        return [];
    }
};