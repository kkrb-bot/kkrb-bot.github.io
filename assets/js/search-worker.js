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
    
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

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

async function getFromDB(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function putToDB(db, key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const request = transaction.objectStore(STORE_NAME).put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function downloadChunk(chunkInfo, baseUrl) {
    const response = await fetch(`${baseUrl}/${chunkInfo.filename}`);
    if (!response.ok) throw new Error(`Failed to download ${chunkInfo.filename}`);
    
    const compressedData = await response.arrayBuffer();
    const decompressed = await decompressGzip(new Uint8Array(compressedData));
    return JSON.parse(new TextDecoder().decode(decompressed));
}

self.onmessage = async (event) => {
    const { action, data } = event.data;
    try {
        if (action === 'loadData') {
            const { version, baseUrl } = data;
            const db = await openDB();
            const cachedMetadata = await getFromDB(db, METADATA_KEY);
            
            if (cachedMetadata && cachedMetadata.version === version) {
                self.postMessage({ type: 'log', message: 'キャッシュからデータを読み込み中...' });
                const allDialogues = [];
                for (let i = 0; i < cachedMetadata.totalChunks; i++) {
                    const chunkData = await getFromDB(db, `chunk_${i}`);
                    if (!chunkData) throw new Error(`Missing chunk ${i}`);
                    allDialogues.push(...chunkData.d);
                    self.postMessage({ type: 'progress', current: i + 1, total: cachedMetadata.totalChunks, message: 'キャッシュから読み込み中...' });
                }
                db.close();
                self.postMessage({ type: 'complete', dialogues: allDialogues, scenarios: cachedMetadata.scenarios, speakers: cachedMetadata.speakers, eventNames: cachedMetadata.eventNames });
                return;
            }
            
            if (cachedMetadata) {
                self.postMessage({ type: 'log', message: 'バージョン更新のためキャッシュをクリア...' });
                db.close();
                await deleteDB();
            } else {
                db.close();
            }
            
            const freshDB = await openDB();
            const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
            if (!manifestResponse.ok) throw new Error('Manifest download failed');
            const manifest = await manifestResponse.json();
            
            const allDialogues = [];
            const concurrencyLimit = 3;
            for (let i = 0; i < manifest.chunks.length; i += concurrencyLimit) {
                const batch = manifest.chunks.slice(i, i + concurrencyLimit);
                const results = await Promise.all(batch.map(info => downloadChunk(info, baseUrl)));
                for (let j = 0; j < results.length; j++) {
                    const idx = i + j;
                    await putToDB(freshDB, `chunk_${idx}`, results[j]);
                    allDialogues.push(...results[j].d);
                    self.postMessage({ type: 'progress', current: idx + 1, total: manifest.totalChunks, message: `チャンク ${idx + 1}/${manifest.totalChunks} をダウンロード` });
                }
            }
            
            const metadata = {
                version: manifest.version,
                totalChunks: manifest.totalChunks,
                scenarios: manifest.scenarios,
                speakers: manifest.speakers,
                eventNames: manifest.eventNames
            };
            await putToDB(freshDB, METADATA_KEY, metadata);
            freshDB.close();
            self.postMessage({ type: 'complete', dialogues: allDialogues, scenarios: manifest.scenarios, speakers: manifest.speakers, eventNames: manifest.eventNames });
        }
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
};
