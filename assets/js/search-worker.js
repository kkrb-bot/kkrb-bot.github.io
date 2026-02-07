/**
 * Web Worker for loading and decompressing search data chunks
 * Handles concurrent downloads and IndexedDB storage
 */

const DB_NAME = 'searchDataCache';
const DB_VERSION = 1;
const STORE_NAME = 'chunks';
const METADATA_KEY = 'metadata';

// Gzip decompression using DecompressionStream API
async function decompressGzip(compressedData) {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(compressedData);
    writer.close();
    
    const chunks = [];
    const reader = ds.readable.getReader();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    
    return result;
}

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get data from IndexedDB
async function getFromDB(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Put data to IndexedDB
async function putToDB(db, key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Delete database
async function deleteDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Download and decompress a single chunk
async function downloadChunk(chunkInfo, baseUrl) {
    const url = `${baseUrl}/${chunkInfo.filename}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Failed to download ${chunkInfo.filename}: ${response.status}`);
    }
    
    const compressedData = await response.arrayBuffer();
    const decompressed = await decompressGzip(new Uint8Array(compressedData));
    const jsonStr = new TextDecoder().decode(decompressed);
    const data = JSON.parse(jsonStr);
    
    return data;
}

// Main message handler
self.onmessage = async (event) => {
    const { action, data } = event.data;
    
    try {
        if (action === 'loadData') {
            const { version, baseUrl } = data;
            
            // Open database
            const db = await openDB();
            
            // Check cached metadata
            const cachedMetadata = await getFromDB(db, METADATA_KEY);
            
            // If version matches and all chunks exist, return cached data
            if (cachedMetadata && cachedMetadata.version === version) {
                self.postMessage({
                    type: 'log',
                    message: 'キャッシュからデータを読み込み中...'
                });
                
                // Load all chunks from cache
                const allDialogues = [];
                let loadedChunks = 0;
                for (let i = 0; i < cachedMetadata.totalChunks; i++) {
                    const chunkData = await getFromDB(db, `chunk_${i}`);
                    if (!chunkData) {
                        throw new Error(`キャッシュされたチャンク ${i} が見つかりません`);
                    }
                    allDialogues.push(...chunkData.dialogues);
                    
                    loadedChunks++;
                    self.postMessage({
                        type: 'progress',
                        current: loadedChunks,
                        total: cachedMetadata.totalChunks,
                        message: `キャッシュから読み込み中...`
                    });
                }
                
                db.close();
                
                self.postMessage({
                    type: 'complete',
                    dialogues: allDialogues,
                    eventNames: cachedMetadata.eventNames
                });
                return;
            }
            
            // Version mismatch or no cache - clear and reload
            if (cachedMetadata) {
                self.postMessage({
                    type: 'log',
                    message: 'バージョンが異なるため、キャッシュをクリア中...'
                });
                db.close();
                await deleteDB();
            } else {
                db.close();
            }
            
            // Reopen database for fresh data
            const freshDB = await openDB();
            
            // Download manifest
            self.postMessage({
                type: 'log',
                message: 'マニフェストをダウンロード中...'
            });
            
            const manifestUrl = `${baseUrl}/manifest.json`;
            const manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`マニフェストのダウンロードに失敗しました (Status: ${manifestResponse.status})`);
            }
            
            const manifest = await manifestResponse.json();
            
            self.postMessage({
                type: 'progress',
                current: 0,
                total: manifest.totalChunks,
                message: 'ダウンロード開始...'
            });
            
            // Download chunks concurrently (limit to 3 concurrent downloads)
            const allDialogues = [];
            const concurrencyLimit = 3;
            
            for (let i = 0; i < manifest.chunks.length; i += concurrencyLimit) {
                const batch = manifest.chunks.slice(i, Math.min(i + concurrencyLimit, manifest.chunks.length));
                
                const chunkPromises = batch.map(chunkInfo => downloadChunk(chunkInfo, baseUrl));
                const chunkResults = await Promise.all(chunkPromises);
                
                // Save to IndexedDB and accumulate dialogues
                for (let j = 0; j < chunkResults.length; j++) {
                    const chunkData = chunkResults[j];
                    const chunkIndex = i + j;
                    
                    await putToDB(freshDB, `chunk_${chunkIndex}`, chunkData);
                    allDialogues.push(...chunkData.dialogues);
                    
                    self.postMessage({
                        type: 'progress',
                        current: chunkIndex + 1,
                        total: manifest.totalChunks,
                        message: `チャンク ${chunkIndex + 1}/${manifest.totalChunks} をダウンロード`
                    });
                }
            }
            
            // Save metadata
            const metadata = {
                version: manifest.version,
                timestamp: manifest.timestamp,
                totalChunks: manifest.totalChunks,
                eventNames: manifest.eventNames
            };
            await putToDB(freshDB, METADATA_KEY, metadata);
            
            freshDB.close();
            
            self.postMessage({
                type: 'complete',
                dialogues: allDialogues,
                eventNames: manifest.eventNames
            });
            
        } else {
            throw new Error(`Unknown action: ${action}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message,
            stack: error.stack
        });
    }
};
