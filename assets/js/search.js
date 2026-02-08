/**
 * 検索機能の管理
 * Web Workerを使用してバックグラウンドでデータを読み込み
 * Brotli圧縮されたチャンクを並行ダウンロードし、IndexedDBにキャッシュ
 */

let allDialogues = [];
let isSearching = false;
let eventNames = {};
let isLoadingData = false;
let dataLoadingPromise = null;
let searchWorker = null;

// 設定変数（initSearchで初期化）
let DATA_VERSION = '2026-02-05'; // デフォルト値
let CHUNKS_BASE_URL = 'public/data/chunks'; // デフォルト値
let TOTAL_DATA_SIZE_MB = 8.5; // デフォルト値、manifestから動的に取得

// Campaign loginId to campaign index mapping
let campaignLoginIdToIndex = null;

// Campaign loginId to title mapping
let campaignLoginIdToTitle = null;

// Event loginId to eventId mapping
let eventLoginIdToEventId = null;

// Event loginId to title mapping
let eventLoginIdToTitle = null;

// Card EP epid to cardId mapping
let cardEpIdToCardId = null;

// Card EP cardId to displayId mapping (cardId - 19)
let cardIdToDisplayId = null;

/**
 * Load campaign mapping from campaign.json
 */
async function loadCampaignMapping() {
    if (campaignLoginIdToIndex !== null && campaignLoginIdToTitle !== null) {
        return { indexMap: campaignLoginIdToIndex, titleMap: campaignLoginIdToTitle };
    }
    
    try {
        const response = await fetch('public/scenario/login/campaign.json');
        if (!response.ok) {
            console.error('Failed to load campaign.json');
            campaignLoginIdToIndex = {};
            campaignLoginIdToTitle = {};
            return { indexMap: {}, titleMap: {} };
        }
        const campaigns = await response.json();
        campaignLoginIdToIndex = {};
        campaignLoginIdToTitle = {};
        
        campaigns.forEach((campaign, index) => {
            if (campaign.script && Array.isArray(campaign.script)) {
                campaign.script.forEach(loginId => {
                    campaignLoginIdToIndex[loginId.toString()] = index;
                });
            }
        });
        
        // Load titles for all campaign scenarios
        const titlePromises = [];
        for (const campaign of campaigns) {
            if (campaign.script && Array.isArray(campaign.script)) {
                for (const loginId of campaign.script) {
                    const promise = fetch(`public/scenario/login/campaign/scenario_login_${loginId}.json`)
                        .then(response => response.ok ? response.json() : null)
                        .then(data => {
                            if (data && data.Title) {
                                campaignLoginIdToTitle[loginId.toString()] = data.Title;
                            }
                        })
                        .catch(error => {
                            console.error(`Failed to load title for loginId ${loginId}:`, error);
                        });
                    titlePromises.push(promise);
                }
            }
        }
        
        await Promise.all(titlePromises);
        
        return { indexMap: campaignLoginIdToIndex, titleMap: campaignLoginIdToTitle };
    } catch (error) {
        console.error('Error loading campaign mapping:', error);
        campaignLoginIdToIndex = {};
        campaignLoginIdToTitle = {};
        return { indexMap: {}, titleMap: {} };
    }
}

/**
 * Load event mapping from event.json
 */
async function loadEventMapping() {
    if (eventLoginIdToEventId !== null && eventLoginIdToTitle !== null) {
        return { eventIdMap: eventLoginIdToEventId, titleMap: eventLoginIdToTitle };
    }
    
    try {
        const response = await fetch('public/scenario/login/event.json');
        if (!response.ok) {
            console.error('Failed to load event.json');
            eventLoginIdToEventId = {};
            eventLoginIdToTitle = {};
            return { eventIdMap: {}, titleMap: {} };
        }
        const eventMapping = await response.json();
        eventLoginIdToEventId = {};
        eventLoginIdToTitle = {};
        
        // Reverse mapping: loginId -> eventId
        for (const [eventIdStr, eventData] of Object.entries(eventMapping)) {
            if (eventData.loginStories && Array.isArray(eventData.loginStories)) {
                eventData.loginStories.forEach(loginId => {
                    eventLoginIdToEventId[loginId.toString()] = parseInt(eventIdStr);
                });
            }
        }
        
        // Load titles for all event scenarios
        const titlePromises = [];
        for (const [eventIdStr, eventData] of Object.entries(eventMapping)) {
            if (eventData.loginStories && Array.isArray(eventData.loginStories)) {
                for (const loginId of eventData.loginStories) {
                    const promise = fetch(`public/scenario/login/event/scenario_login_${loginId}.json`)
                        .then(response => response.ok ? response.json() : null)
                        .then(data => {
                            if (data && data.Title) {
                                eventLoginIdToTitle[loginId.toString()] = data.Title;
                            }
                        })
                        .catch(error => {
                            console.error(`Failed to load title for loginId ${loginId}:`, error);
                        });
                    titlePromises.push(promise);
                }
            }
        }
        
        await Promise.all(titlePromises);
        
        return { eventIdMap: eventLoginIdToEventId, titleMap: eventLoginIdToTitle };
    } catch (error) {
        console.error('Error loading event mapping:', error);
        eventLoginIdToEventId = {};
        eventLoginIdToTitle = {};
        return { eventIdMap: {}, titleMap: {} };
    }
}

/**
 * Load total data size from manifest.json
 */
async function loadDataSizeFromManifest() {
    try {
        const manifestUrl = `${CHUNKS_BASE_URL}/manifest.json`;
        const response = await fetch(manifestUrl);
        if (!response.ok) {
            console.warn('Failed to load manifest for data size, using default');
            return;
        }
        const manifest = await response.json();
        if (manifest.totalCompressedSize) {
            TOTAL_DATA_SIZE_MB = (manifest.totalCompressedSize / 1024 / 1024).toFixed(1);
        }
    } catch (error) {
        console.warn('Error loading data size from manifest:', error);
    }
}

/**
 * Load card EP mapping from card-ep.json
 */
async function loadCardEpMapping() {
    if (cardEpIdToCardId !== null && cardIdToDisplayId !== null) {
        return { epidToCardId: cardEpIdToCardId, cardIdToDisplayId: cardIdToDisplayId };
    }
    
    try {
        const response = await fetch('public/scenario/ep/card-ep.json');
        if (!response.ok) {
            console.error('Failed to load card-ep.json');
            cardEpIdToCardId = {};
            cardIdToDisplayId = {};
            return { epidToCardId: {}, cardIdToDisplayId: {} };
        }
        const mapping = await response.json();
        cardEpIdToCardId = {};
        cardIdToDisplayId = {};
        
        // Reverse mapping: epid -> cardId
        for (const [cardIdStr, epidStr] of Object.entries(mapping)) {
            const cardId = parseInt(cardIdStr);
            const epid = epidStr;
            cardEpIdToCardId[epid] = cardIdStr;
            // Display ID = cardId - 19 if cardId > 336, else cardId
            cardIdToDisplayId[cardIdStr] = (cardId > 336) ? (cardId - 19).toString() : cardIdStr;
        }
        
        return { epidToCardId: cardEpIdToCardId, cardIdToDisplayId: cardIdToDisplayId };
    } catch (error) {
        console.error('Error loading card EP mapping:', error);
        cardEpIdToCardId = {};
        cardIdToDisplayId = {};
        return { epidToCardId: {}, cardIdToDisplayId: {} };
    }
}

const characters = [
    { ja: 'オズ', en: 'Oz' },
    { ja: 'アーサー', en: 'Arthur' },
    { ja: 'カイン', en: 'Cain' },
    { ja: 'リケ', en: 'Riquet' },
    { ja: 'スノウ', en: 'Snow' },
    { ja: 'ホワイト', en: 'White' },
    { ja: 'ミスラ', en: 'Mithra' },
    { ja: 'オーエン', en: 'Owen' },
    { ja: 'ブラッドリー', en: 'Bradley' },
    { ja: 'ファウスト', en: 'Faust' },
    { ja: 'シノ', en: 'Shino' },
    { ja: 'ヒースクリフ', en: 'Heathcliff' },
    { ja: 'ネロ', en: 'Nero' },
    { ja: 'シャイロック', en: 'Shylock' },
    { ja: 'ムル', en: 'Murr' },
    { ja: 'クロエ', en: 'Chloe' },
    { ja: 'ラスティカ', en: 'Rustica' },
    { ja: 'フィガロ', en: 'Figaro' },
    { ja: 'ルチル', en: 'Rutile' },
    { ja: 'レノックス', en: 'Lennox' },
    { ja: 'ミチル', en: 'Mitile' },
];

const CHARACTER_JA_MAP = {};
characters.forEach((char, index) => {
    CHARACTER_JA_MAP[index + 1] = char.ja;
});

const charactersByCountry = {
    '中央の国': [
        { ja: 'オズ', en: 'Oz' },
        { ja: 'アーサー', en: 'Arthur' },
        { ja: 'カイン', en: 'Cain' },
        { ja: 'リケ', en: 'Riquet' }
    ],
    '北の国': [
        { ja: 'スノウ', en: 'Snow' },
        { ja: 'ホワイト', en: 'White' },
        { ja: 'ミスラ', en: 'Mithra' },
        { ja: 'オーエン', en: 'Owen' },
        { ja: 'ブラッドリー', en: 'Bradley' }
    ],
    '東の国': [
        { ja: 'ファウスト', en: 'Faust' },
        { ja: 'シノ', en: 'Shino' },
        { ja: 'ヒースクリフ', en: 'Heathcliff' },
        { ja: 'ネロ', en: 'Nero' }
    ],
    '西の国': [
        { ja: 'シャイロック', en: 'Shylock' },
        { ja: 'ムル', en: 'Murr' },
        { ja: 'クロエ', en: 'Chloe' },
        { ja: 'ラスティカ', en: 'Rustica' }
    ],
    '南の国': [
        { ja: 'フィガロ', en: 'Figaro' },
        { ja: 'ルチル', en: 'Rutile' },
        { ja: 'レノックス', en: 'Lennox' },
        { ja: 'ミチル', en: 'Mitile' },
    ],
    'その他': [
        { ja: '晶', en: 'Akira' },
        { ja: 'クックロビン', en: 'Cookrobin' },
        { ja: 'カナリア', en: 'Canaria' },
        { ja: 'ドラモンド', en: 'Drummond' },
        { ja: 'ヴィンセント', en: 'Vincent' },
        { ja: 'ニコラス', en: 'Nicolas' },
        { ja: 'ノーヴァ', en: 'Nova' },
        { ja: 'リリアーナ', en: 'Liliana' },
        { ja: 'グリゴリー', en: 'Grigory' },
        { ja: 'ジル', en: 'Gill' },
        { ja: 'ザラ', en: 'Zara' }
    ]
};

/**
 * デバイスタイプを検出
 */
function detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxDimension = Math.max(width, height);
    
    // スマートフォン判定（画面サイズが小さい、かつモバイルUA）
    const isMobile = /mobile|android|iphone|ipod/.test(userAgent) && maxDimension < 768;
    
    // タブレット判定（中サイズの画面、またはiPad/Android tablet）
    const isTablet = (/ipad|android/.test(userAgent) && !/mobile/.test(userAgent)) || 
                     (maxDimension >= 768 && maxDimension < 1024);
    
    return {
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet
    };
}

/**
 * 検索機能を初期化
 */
async function initSearch() {
    try {
        // 設定を読み込み
        const config = await loadAppConfig();
        DATA_VERSION = config.DATA_VERSION;
        CHUNKS_BASE_URL = config.CHUNKS_BASE_URL;
        
        // マニフェストからデータサイズを取得
        await loadDataSizeFromManifest();
        
        // デバイスタイプを検出
        const device = detectDeviceType();
        
        // スマートフォンの場合は検索機能を無効化
        if (device.isMobile) {
            console.log('検索機能はスマートフォンでは利用できません');
            return;
        }
        
        // Initialize Web Worker
        if (!searchWorker) {
            searchWorker = new Worker('assets/js/search-worker.js');
            setupWorkerHandlers();
        }
        
        // 自動読み込みは行わず、ユーザーの操作を待つ
    } catch (error) {
        console.error('Failed to initialize search:', error);
    }
}

/**
 * Set up Web Worker message handlers
 */
function setupWorkerHandlers() {
    searchWorker.onmessage = (event) => {
        const { type, message, current, total, dialogues, eventNames: names, error } = event.data;
        
        if (type === 'log') {
            console.log('[Worker]', message);
            const statusText = document.querySelector('.loading-status-text');
            if (statusText) {
                statusText.textContent = message;
            }
        } else if (type === 'progress') {
            updateProgressBar(current, total);
            const loadingText = document.querySelector('.loading-text');
            const statusText = document.querySelector('.loading-status-text');
            const progressPercent = document.querySelector('.progress-percent');
            
            if (loadingText) {
                loadingText.textContent = message;
            }
            if (statusText) {
                statusText.textContent = `チャンク ${current} / ${total} をダウンロード中...`;
            }
            if (progressPercent) {
                const percentage = Math.round((current / total) * 100);
                progressPercent.textContent = `${percentage}%`;
            }
        } else if (type === 'complete') {
            allDialogues = dialogues;
            eventNames = names || {};
            
            // Store event names in sessionStorage as backup
            Object.entries(eventNames).forEach(([eventId, eventName]) => {
                sessionStorage.setItem(`eventName_${eventId}`, eventName);
            });
            
            updateLoadingStatus();
            
            if (dataLoadingResolve) {
                dataLoadingResolve();
                dataLoadingResolve = null;
            }
        } else if (type === 'error') {
            console.error('[Worker Error]', error);
            showLoadingError(error);
            
            if (dataLoadingReject) {
                dataLoadingReject(new Error(error));
                dataLoadingReject = null;
            }
        }
    };
    
    searchWorker.onerror = (error) => {
        console.error('[Worker Error]', error);
        showLoadingError('Worker error: ' + error.message);
        
        if (dataLoadingReject) {
            dataLoadingReject(error);
            dataLoadingReject = null;
        }
    };
}

let dataLoadingResolve = null;
let dataLoadingReject = null;

/**
 * バックグラウンドでデータ読み込みを開始
 */
function startBackgroundDataLoading() {
    if (isLoadingData || dataLoadingPromise) {
        return;
    }

    isLoadingData = true;
    dataLoadingPromise = new Promise((resolve, reject) => {
        dataLoadingResolve = resolve;
        dataLoadingReject = reject;
        
        // Send load request to worker
        searchWorker.postMessage({
            action: 'loadData',
            data: {
                version: DATA_VERSION,
                baseUrl: CHUNKS_BASE_URL
            }
        });
    }).finally(() => {
        isLoadingData = false;
    });
}

/**
 * Update progress bar during data loading
 * @param {number} current - Current item count
 * @param {number} total - Total item count
 */
function updateProgressBar(current, total) {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    
    if (progressFill && total > 0) {
        const percentage = Math.round((current / total) * 100);
        progressFill.style.width = percentage + '%';
        progressFill.style.animation = 'none';
    }
    
    if (progressPercent && total > 0) {
        const percentage = Math.round((current / total) * 100);
        progressPercent.textContent = `${percentage}%`;
    }
}

/**
 * 読み込み状態の表示を更新
 */
function updateLoadingStatus() {
    // データ読み込みが完了したら検索フォームを表示
    showSearchForm();
}

/**
 * 検索UIを初期化（検索ページ用）
 */
async function initSearchUI() {
    const searchPageContent = document.querySelector('[data-page="search"]');
    if (!searchPageContent) return;

    // デバイスタイプを検出
    const device = detectDeviceType();
    
    // Preload mappings for better performance
    await Promise.all([
        loadCampaignMapping(),
        loadCardEpMapping(),
        loadEventMapping()
    ]);
    
    // Clear existing content
    searchPageContent.innerHTML = '';

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    
    // スマートフォンの場合は検索機能を無効化
    if (device.isMobile) {
        searchContainer.innerHTML = `
            <div class="search-disabled-notice">
                <h3>📱 検索機能について</h3>
                <p>検索機能はデータ量が大きいため、スマートフォンではご利用いただけません。</p>
                <p>タブレットまたはPCでアクセスしてください。</p>
            </div>
        `;
        searchPageContent.appendChild(searchContainer);
        return;
    }
    
    // データが既に読み込まれている場合は検索フォームを表示
    if (allDialogues.length > 0) {
        showSearchForm();
        return;
    }
    
    // データ読み込み中の場合
    if (isLoadingData) {
        showLoadingUI();
        return;
    }
    
    // キャッシュの状態を確認
    const hasCachedData = await checkCachedData();
    
    if (hasCachedData) {
        // キャッシュがある場合は自動的に読み込む
        showLoadingUI();
        startBackgroundDataLoading();
    } else {
        // キャッシュがない場合は警告を表示
        searchContainer.innerHTML = `
            <div class="search-warning">
                <div class="warning-title"><strong>⚠️ データ読み込みについて</strong></div>
                <div class="warning-content">
                    <p>検索機能を使用するには、約<strong>${TOTAL_DATA_SIZE_MB}MB</strong>のデータをダウンロードする必要があります。</p>
                    <ul>
                        <li>初回読み込み時のみダウンロードが発生します</li>
                        <li>2回目以降はキャッシュから即座に読み込まれます</li>
                        <li>データはブラウザのIndexedDBに保存されます</li>
                        <li>モバイルデータ通信をご利用の場合はご注意ください</li>
                    </ul>
                    <div class="warning-actions">
                        <button id="start-loading-btn" class="btn-primary">データを読み込む</button>
                        <button id="cancel-loading-btn" class="btn-secondary">キャンセル</button>
                    </div>
                </div>
            </div>
        `;
        
        searchPageContent.appendChild(searchContainer);
        
        // イベントリスナーを設定
        document.getElementById('start-loading-btn').addEventListener('click', () => {
            startBackgroundDataLoading();
            showLoadingUI();
        });
        
        document.getElementById('cancel-loading-btn').addEventListener('click', () => {
            // 何もせず警告を残す
        });
    }
}

/**
 * キャッシュデータの存在を確認
 */
async function checkCachedData() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open('searchDataCache', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('chunks')) {
                    db.createObjectStore('chunks');
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('chunks')) {
                    db.close();
                    resolve(false);
                    return;
                }
                
                const transaction = db.transaction(['chunks'], 'readonly');
                const store = transaction.objectStore('chunks');
                const getRequest = store.get('metadata');
                
                getRequest.onsuccess = () => {
                    const metadata = getRequest.result;
                    db.close();
                    
                    if (!metadata) {
                        resolve(false);
                        return;
                    }
                    
                    if (metadata.version === DATA_VERSION) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };
                
                getRequest.onerror = () => {
                    db.close();
                    resolve(false);
                };
            };
            
            request.onerror = () => {
                resolve(false);
            };
        } catch (error) {
            resolve(false);
        }
    });
}

/**
 * 読み込みエラーを表示
 */
function showLoadingError(errorMessage) {
    const searchPageContent = document.querySelector('[data-page="search"]');
    if (!searchPageContent) return;
    
    searchPageContent.innerHTML = '';
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
        <div class="search-error-screen">
            <div class="error-title"><strong>❌ データ読み込みエラー</strong></div>
            <div class="error-content">
                <p>データの読み込み中にエラーが発生しました。</p>
                <details>
                    <summary>エラー詳細</summary>
                    <pre>${escapeHtml(errorMessage)}</pre>
                </details>
                <div class="error-actions">
                    <button id="retry-loading-btn" class="btn-primary">再試行</button>
                    <button id="clear-cache-btn" class="btn-secondary">キャッシュをクリアして再試行</button>
                </div>
                <p class="error-note">
                    問題が解決しない場合は、ブラウザのキャッシュをクリアしてページを再読み込みしてください。
                </p>
            </div>
        </div>
    `;
    
    searchPageContent.appendChild(searchContainer);
    
    // イベントリスナーを設定
    document.getElementById('retry-loading-btn').addEventListener('click', () => {
        showLoadingUI();
        startBackgroundDataLoading();
    });
    
    document.getElementById('clear-cache-btn').addEventListener('click', async () => {
        try {
            await clearSearchCache();
            showLoadingUI();
            startBackgroundDataLoading();
        } catch (error) {
            alert('キャッシュのクリアに失敗しました: ' + error.message);
        }
    });
}

/**
 * 検索キャッシュをクリア
 */
async function clearSearchCache() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.deleteDatabase('searchDataCache');
            request.onsuccess = () => {
                console.log('Search cache cleared');
                resolve();
            };
            request.onerror = () => {
                reject(new Error('Failed to clear cache'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 読み込み中のUIを表示
 */
function showLoadingUI() {
    const searchPageContent = document.querySelector('[data-page="search"]');
    if (!searchPageContent) return;
    
    searchPageContent.innerHTML = '';
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
        <div class="search-loading-screen">
            <h3>📦 データを読み込み中...</h3>
            <div class="loading-details">
                <p class="loading-text">準備中...</p>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%; animation: none;"></div>
                    </div>
                    <div class="progress-info">
                        <span class="progress-percent">0%</span>
                        <span class="loading-status-text">初期化中...</span>
                    </div>
                </div>
                <p class="loading-note">初回読み込みには数秒かかる場合があります。</p>
            </div>
        </div>
    `;
    
    searchPageContent.appendChild(searchContainer);
}

/**
 * 検索フォームテンプレート（キャッシュ）
 */
let searchFormTemplateCache = null;

/**
 * 検索フォームテンプレートを取得
 */
async function getSearchFormTemplate() {
    if (searchFormTemplateCache) {
        return searchFormTemplateCache;
    }
    
    const response = await fetch('assets/templates/search-form.html');
    searchFormTemplateCache = await response.text();
    return searchFormTemplateCache;
}

/**
 * 話者選択エリアのHTMLを生成
 */
function generateSpeakersHTML() {
    return Object.entries(charactersByCountry).map(([country, countryChars]) => `
        <div class="country-section">
            <div class="country-title">${country}</div>
            <div class="country-characters">
                ${countryChars.map((char) => `
                    <label class="checkbox-label">
                        <input 
                            type="checkbox" 
                            class="speaker-checkbox" 
                            value="${char.ja}"
                        >
                        <span>${char.ja}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

/**
 * 検索フォームを表示
 */
async function showSearchForm() {
    const searchPageContent = document.querySelector('[data-page="search"]');
    if (!searchPageContent) return;
    
    searchPageContent.innerHTML = '';
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    
    // テンプレートHTMLを読み込んで動的コンテンツを挿入
    let templateHTML = await getSearchFormTemplate();
    
    // {{speakers}} プレースホルダーを置換
    templateHTML = templateHTML.replace('{{speakers}}', generateSpeakersHTML());
    
    searchContainer.innerHTML = templateHTML;
    searchPageContent.appendChild(searchContainer);

    searchContainer.querySelector('#search-btn').addEventListener('click', performSearch);
    searchContainer.querySelector('#clear-btn').addEventListener('click', clearSearch);
    searchContainer.querySelector('#clear-cache-btn').addEventListener('click', handleClearCache);
    searchContainer.querySelector('#select-all-btn').addEventListener('click', selectAllSpeakers);
    searchContainer.querySelector('#deselect-all-btn').addEventListener('click', deselectAllSpeakers);
    searchContainer.querySelector('#select-all-types-btn').addEventListener('click', selectAllScenarioTypes);
    searchContainer.querySelector('#deselect-all-types-btn').addEventListener('click', deselectAllScenarioTypes);
    searchContainer.querySelector('#content-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // 非同期でキャッシュサイズを計算
    calculateCacheSize(searchContainer);
}

/**
 * キャッシュサイズを計算して表示
 */
async function calculateCacheSize(container) {
    const sizeDisplay = container.querySelector('#cache-size-display');
    if (!sizeDisplay) return;
    
    try {
        const size = await getIndexedDBSize();
        if (size > 0) {
            sizeDisplay.textContent = formatBytes(size);
        } else {
            sizeDisplay.textContent = 'キャッシュなし';
            const clearBtn = container.querySelector('#clear-cache-btn');
            if (clearBtn) clearBtn.disabled = true;
        }
    } catch (error) {
        sizeDisplay.textContent = '不明';
    }
}

/**
 * IndexedDBのサイズを取得
 */
async function getIndexedDBSize() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open('searchDataCache', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('chunks')) {
                    db.close();
                    resolve(0);
                    return;
                }
                
                const transaction = db.transaction(['chunks'], 'readonly');
                const store = transaction.objectStore('chunks');
                const getAllRequest = store.getAllKeys();
                
                getAllRequest.onsuccess = async () => {
                    const keys = getAllRequest.result;
                    let totalSize = 0;
                    
                    // 各キーのデータサイズを計算
                    for (const key of keys) {
                        const getRequest = store.get(key);
                        await new Promise((resolveItem) => {
                            getRequest.onsuccess = () => {
                                const data = getRequest.result;
                                if (data) {
                                    // オブジェクトのJSON文字列化サイズで推定
                                    const jsonStr = JSON.stringify(data);
                                    totalSize += jsonStr.length;
                                }
                                resolveItem();
                            };
                            getRequest.onerror = () => resolveItem();
                        });
                    }
                    
                    db.close();
                    resolve(totalSize);
                };
                
                getAllRequest.onerror = () => {
                    db.close();
                    resolve(0);
                };
            };
            
            request.onerror = () => {
                resolve(0);
            };
        } catch (error) {
            resolve(0);
        }
    });
}

/**
 * バイト数を読みやすい形式にフォーマット
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * キャッシュクリア処理
 */
async function handleClearCache() {
    const confirmed = confirm(
        'キャッシュをクリアしますか？\n\n' +
        'クリア後、次回検索時に約' + TOTAL_DATA_SIZE_MB + 'MBのデータを再ダウンロードする必要があります。'
    );
    
    if (!confirmed) return;
    
    const clearBtn = document.getElementById('clear-cache-btn');
    const sizeDisplay = document.getElementById('cache-size-display');
    
    if (clearBtn) clearBtn.disabled = true;
    if (sizeDisplay) sizeDisplay.textContent = 'クリア中...';
    
    try {
        await clearSearchCache();
        
        // データをクリア
        allDialogues = [];
        eventNames = {};
        
        // 警告ページに戻る
        initSearchUI();
        
        alert('キャッシュをクリアしました。\n再度データを読み込む場合は、「データを読み込む」ボタンをクリックしてください。');
    } catch (error) {
        if (sizeDisplay) sizeDisplay.textContent = '不明';
        alert('キャッシュのクリアに失敗しました: ' + error.message);
        if (clearBtn) clearBtn.disabled = false;
    }
}

/**
 * 検索を実行
 */
function performSearch() {
    // Wait for data loading to complete if still loading
    if (isLoadingData && dataLoadingPromise) {
        dataLoadingPromise.then(() => {
            performSearchInternal();
        });
    } else {
        performSearchInternal();
    }
}

/**
 * 検索を実行（内部処理）
 */
function performSearchInternal() {
    if (allDialogues.length === 0) {
        showSearchError('データを読み込み中です...');
        return;
    }

    if (isSearching) {
        return;
    }

    try {
        isSearching = true;
        const speakers = getSelectedSpeakers();
        const contentPattern = document.getElementById('content-input').value;
        const scenarioTypes = getSelectedScenarioTypes();

        let regex = null;
        if (contentPattern) {
            try {
                regex = new RegExp(contentPattern, 'i');
            } catch (error) {
                showSearchError(`正規表現エラー: ${error.message}`);
                isSearching = false;
                return;
            }
        }

        let results = allDialogues.filter(dialogue => {
            if (speakers.length > 0 && !speakers.some(speaker => dialogue.speaker.includes(speaker))) {
                return false;
            }

            if (scenarioTypes.length > 0 && !scenarioTypes.includes(dialogue.scenarioType)) {
                return false;
            }

            if (regex && !regex.test(dialogue.content)) {
                return false;
            }

            return true;
        });

        displaySearchResults(results, speakers, contentPattern, scenarioTypes);
        isSearching = false;
    } catch (error) {
        console.error('Search error:', error);
        showSearchError(`検索エラー: ${error.message}`);
        isSearching = false;
    }
}

/**
 * 選択された話者を取得
 */
function getSelectedSpeakers() {
    const checkboxes = document.querySelectorAll('.speaker-checkbox:checked');
    const speakers = Array.from(checkboxes)
        .map(checkbox => checkbox.value)
        .filter(value => value !== '');

    const customInput = document.getElementById('custom-speaker-input');
    if (customInput && customInput.value.trim()) {
        const customSpeakers = customInput.value
            .split(',')
            .map(s => s.trim())
            .filter(s => s !== '');
        speakers.push(...customSpeakers);
    }

    return speakers;
}

/**
 * すべての話者を選択
 */
function selectAllSpeakers() {
    document.querySelectorAll('.speaker-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
}

/**
 * すべての話者を選択解除
 */
function deselectAllSpeakers() {
    document.querySelectorAll('.speaker-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
}

/**
 * 選択されたシナリオタイプを取得
 */
function getSelectedScenarioTypes() {
    const checkboxes = document.querySelectorAll('.scenario-type-checkbox:checked');
    return Array.from(checkboxes)
        .map(checkbox => checkbox.value)
        .filter(value => value !== '');
}

/**
 * すべてのシナリオタイプを選択
 */
function selectAllScenarioTypes() {
    document.querySelectorAll('.scenario-type-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
}

/**
 * すべてのシナリオタイプを選択解除
 */
function deselectAllScenarioTypes() {
    document.querySelectorAll('.scenario-type-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
}

/**
 * 検索結果を表示
 */
function displaySearchResults(dialogues, speakers, contentPattern, scenarioType) {
    const resultsContainer = document.getElementById('search-results');
    const errorContainer = document.getElementById('search-error');

    errorContainer.style.display = 'none';

    if (dialogues.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">検索結果がありません</p>';
        resultsContainer.style.display = 'block';
        return;
    }

    const grouped = {};
    dialogues.forEach(d => {
        const key = `${d.scenarioType}_${d.scenarioId}`;
        if (!grouped[key]) {
            grouped[key] = {
                type: d.scenarioType,
                id: d.scenarioId,
                dialogues: []
            };
        }
        grouped[key].dialogues.push(d);
    });

    let html = `<div class="results-summary">
        <p>合計 <strong>${dialogues.length}</strong> 件のセリフが見つかりました</p>
    </div>`;

    html += '<div class="results-list">';

    Object.entries(grouped).forEach(([key, group]) => {
        const typeLabel = {
            main: 'メインストーリー',
            card: 'カードストーリー',
            event: 'イベントストーリー',
            caulis: 'イベントストーリー',
            love: '親愛ストーリー'
        }[group.type] || group.type;

        const scenarioLink = generateScenarioLink(group.type, group.id);

        let displayTitle;
        if (group.type === 'main') {
            displayTitle = `メインストーリー｜${generateDisplayTitle(group.type, group.id)}`;
        } else if (group.type === 'event') {
            displayTitle = `イベントストーリー｜${generateDisplayTitle(group.type, group.id)}`;
        } else if (group.type === 'love') {
            displayTitle = `親愛ストーリー｜${generateDisplayTitle(group.type, group.id)}`;
        } else if (group.type === 'card') {
            displayTitle = `カードストーリー｜${generateCardStoryTitle(group.id)}`;
        } else if (group.type.startsWith('ep-')) {
            const epTitle = group.dialogues[0].title;
            displayTitle = generateDisplayTitle(group.type, group.id, epTitle);
        } else if (group.type === 'campaign') {
            displayTitle = `ログインストーリー｜${generateDisplayTitle(group.type, group.id)}`;
        } else if (group.type === 'login-event') {
            displayTitle = `イベントストーリー｜${generateDisplayTitle(group.type, group.id)}`;
        } else {
            displayTitle = `${typeLabel}｜${group.id}`;
        }

        html += `<div class="result-scenario" data-type="${group.type}" data-id="${group.id}">
            <div class="scenario-title"><a href="${scenarioLink}" target="_blank" rel="noopener noreferrer" class="scenario-link">
                ${displayTitle}
            </a></div>
            <ul class="dialogue-list">`;

        group.dialogues.forEach((d, idx) => {
            const highlightedContent = highlightContent(d.content, contentPattern);
            html += `<li>
                <strong>${escapeHtml(d.speaker)}:</strong>
                <span class="dialogue-text">${highlightedContent}</span>
            </li>`;
        });

        html += '</ul></div>';
    });

    html += '</div>';

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';

    // Asynchronously load caulis titles (if any) and update displayed titles
    (async () => {
        const resultNodes = resultsContainer.querySelectorAll('.result-scenario[data-type="caulis"]');
        for (const node of resultNodes) {
            try {
                const type = node.getAttribute('data-type');
                const id = node.getAttribute('data-id');
                // id format is like "84-6"
                const [eventIdStr, episodeStr] = id.split('-');
                const eventId = eventIdStr;
                const episode = episodeStr;
                const cacheKey = `caulisTitle_${eventId}_${episode}`;

                // Try session cache first
                let titleText = sessionStorage.getItem(cacheKey);
                if (!titleText) {
                    const url = `public/scenario/caulis/caulis_story_${eventId}-${episode}.json`;
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data && data.Title) {
                            const parts = data.Title.split('|').map(s => s.trim());
                            if (parts.length === 2) {
                                titleText = `${parts[0]}　${parts[1]}`;
                            } else {
                                titleText = parts[0] || data.Title;
                            }
                            sessionStorage.setItem(cacheKey, titleText);
                        }
                    }
                }

                if (titleText) {
                    const anchor = node.querySelector('.scenario-link');
                    if (anchor) {
                        anchor.textContent = `${typeLabelForDisplay(type)}｜${titleText}`;
                    }
                }
            } catch (e) {
                // ignore per-entry errors
            }
        }
    })();
}

function typeLabelForDisplay(type) {
    return {
        main: 'メインストーリー',
        card: 'カードストーリー',
        event: 'イベントストーリー',
        caulis: 'イベントストーリー',
        love: '親愛ストーリー'
    }[type] || type;
}

/**
 * 検索結果の表示タイトルを生成
 */
function generateDisplayTitle(type, scenarioId, title = '') {
    if (type === 'main') {
        return generateMainStoryTitle(scenarioId);
    } else if (type === 'event' || type === 'caulis') {
        return generateEventStoryTitle(scenarioId);
    } else if (type === 'love') {
        return generateLoveStoryTitle(scenarioId);
    } else if (type.startsWith('ep-')) {
        return generateEpStoryTitle(type, scenarioId, title);
    } else if (type === 'campaign') {
        return generateCampaignStoryTitle(scenarioId);
    } else if (type === 'login-event') {
        return generateLoginEventStoryTitle(scenarioId);
    }
    return scenarioId;
}

/**
 * メインストーリーの表示タイトルを生成
 */
function generateMainStoryTitle(scenarioId) {

    const [chapterStr, episodeStr] = scenarioId.split('-');
    const chapter = parseInt(chapterStr);
    const episode = parseInt(episodeStr);

    const japaneseNumerals = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９', '１０',
        '１１', '１２', '１３', '１４', '１５', '１６', '１７', '１８', '１９', '２０',
        '２１', '２２', '２３', '２４', '２５', '２６', '２７', '２８', '２９', '３０',
        '３１', '３２', '３３', '３４', '３５', '３６', '３７', '３８', '３９', '４０',
        '４１', '４２', '４３', '４４', '４５', '４６', '４７'];

    const part1_5ChapterNames = ['', 'プロローグ', '前篇', '中篇', '後篇'];

    let partName, displayChapter;

    if (chapter >= 1 && chapter <= 21) {
        partName = '１部';
        displayChapter = chapter;
    } else if (chapter >= 22 && chapter <= 25) {
        partName = '１.５部';
        displayChapter = chapter - 21;
    } else if (chapter >= 26 && chapter <= 47) {
        partName = '２部';
        displayChapter = chapter - 25;
    } else {
        return scenarioId;
    }

    let chapterDisplay;
    if (partName === '１.５部') {
        chapterDisplay = part1_5ChapterNames[displayChapter] || displayChapter;
    } else {
        chapterDisplay = japaneseNumerals[displayChapter] || displayChapter;
    }

    const unitName = partName === '１.５部' ? '' : '章';

    return `${partName}　${chapterDisplay}${unitName}　${japaneseNumerals[episode] || episode}話`;
}

/**
 * イベントストーリーの表示タイトルを生成
 */
function generateEventStoryTitle(scenarioId) {
    const [eventIdStr, episodeStr] = scenarioId.split('-');
    const eventId = parseInt(eventIdStr);
    const episode = parseInt(episodeStr);

    const japaneseNumerals = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９', '１０',
        '１１', '１２', '１３', '１４', '１５', '１６', '１７', '１８', '１９', '２０',
        '２１', '２２', '２３', '２４', '２５', '２６', '２７', '２８', '２９', '３０',
        '３１', '３２', '３３', '３４', '３５', '３６', '３７', '３８', '３９', '４０'];

    let eventName = eventNames[eventId];
    
    // eventNamesが空の場合、JSON から直接タイトルを取得する
    if (!eventName) {
        const filename = `scenario_event_${eventIdStr}-1.json`;
        const cacheKey = `eventName_${eventId}`;
        
        // キャッシュから取得を試みる
        if (sessionStorage.getItem(cacheKey)) {
            eventName = sessionStorage.getItem(cacheKey);
        } else {
            // キャッシュにない場合はデフォルト値を使用
            eventName = `イベント${eventId}`;
        }
    }
    
    const japaneseEpisode = japaneseNumerals[episode] || episode;

    return `${eventName}　${japaneseEpisode}話`;
}

/**
 * 親愛ストーリーの表示タイトルを生成
 */
function generateLoveStoryTitle(scenarioId) {
    const [characterIdStr, episodeStr] = scenarioId.split('-');
    const characterId = parseInt(characterIdStr);
    const episode = parseInt(episodeStr);

    const japaneseNumerals = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９', '１０',
        '１１', '１２', '１３', '１４', '１５', '１６', '１７', '１８', '１９', '２０',
        '２１', '２２', '２３', '２４', '２５', '２６', '２７', '２８', '２９', '３０'];

    const characterMap = {
        1: 'オズ', 2: 'アーサー', 3: 'カイン', 4: 'リケ',
        5: 'スノウ', 6: 'ホワイト', 7: 'ミスラ', 8: 'オーエン', 9: 'ブラッドリー',
        10: 'ファウスト', 11: 'シノ', 12: 'ヒースクリフ', 13: 'ネロ',
        14: 'シャイロック', 15: 'ムル', 16: 'クロエ', 17: 'ラスティカ',
        18: 'フィガロ', 19: 'ルチル', 20: 'レノックス', 21: 'ミチル'
    };

    const characterName = characterMap[characterId] || `キャラクター${characterId}`;
    const japaneseEpisode = japaneseNumerals[episode] || episode;

    return `${characterName}　${japaneseEpisode}話`;
}

/**
 * カードストーリーの表示タイトルを生成
 */
function generateCardStoryTitle(scenarioId) {
    const [cardIdStr, episodeStr] = scenarioId.split('-');
    
    const cardId = parseInt(cardIdStr);
    const displayId = getDisplayCardId(cardId);
    
    const japaneseNumerals = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９', '１０'];
    
    const episode = parseInt(episodeStr);
    const japaneseEpisode = japaneseNumerals[episode] || episode;
    
    return `${displayId}　${japaneseEpisode}話`;
}

/**
 * エピソードストーリーの表示タイトルを生成
 */
function generateEpStoryTitle(type, scenarioId, title = '') {
    if (type === 'ep-card') {
        // For ep-card, show displayId (cardId - 19)
        if (cardIdToDisplayId && cardEpIdToCardId) {
            const cardId = cardEpIdToCardId[scenarioId];
            if (cardId && cardIdToDisplayId[cardId]) {
                return `エピソード（カード） - ${cardIdToDisplayId[cardId]}`;
            }
        }
        return `エピソード（カード） - ${scenarioId}`;
    }
    
    if (type.startsWith('ep-special-')) {
        const dir = type.replace('ep-special-', ''); // '1st' or '2nd'
        const dirConfig = EP_SPECIAL_CONFIG.directories.find(d => d.id === dir);
        if (dirConfig) {
            let processedTitle = title;
            if (processedTitle.includes('|')) {
                const parts = processedTitle.split('|');
                if (parts[0].trim() && parts[1].trim()) {
                    // 両側に内容がある場合：全角スペースに置き換え
                    processedTitle = processedTitle.replace('|', '　');
                } else if (parts[0].trim()) {
                    // 左側だけに内容がある場合：左側のみ保持
                    processedTitle = parts[0].trim();
                }
            }
            // Remove <br> tags from both displayName and processedTitle
            const cleanDisplayName = dirConfig.displayName.replace(/<br>/gi, '');
            processedTitle = processedTitle.replace(/<br>/gi, '');
            return `エピソード（${cleanDisplayName}）｜${processedTitle}`;
        }
    }
    
    if (type === 'ep-spot') {
        // Parse spotId from scenarioId
        const id = parseInt(scenarioId);
        let spotId;
        
        if (scenarioId.startsWith('1001')) {
            // Special case for spotId 22
            spotId = 22;
        } else if (scenarioId.length >= 4) {
            // Normal case: 1{spotId-1:02d}{seq:02d}
            const spotPart = parseInt(scenarioId.substring(1, 3)) + 1;
            spotId = spotPart;
        } else {
            return `エピソード（スポット） - ${scenarioId}`;
        }
        
        const spotNames = [
            'オズの爪痕',
            'グランヴェル城',
            '栄光の街',
            '既知の遺跡',
            '氷の森',
            '氷の街',
            '死の湖',
            '夢の森',
            '時の洞窟',
            '嵐の谷',
            'シャーウッドの森',
            'ブランシェット城',
            '雨の街',
            'ベネットの酒場',
            '未開の天文台',
            '泡の街',
            '豊かの街',
            '病の沼',
            'ティコ湖',
            'レイタ山脈',
            '雲の街',
            '魔法舎中庭'
        ];
        
        const spotName = spotNames[spotId - 1] || `スポット${spotId}`;
        
        let processedTitle = title;
        if (processedTitle.includes('|')) {
            const parts = processedTitle.split('|');
            if (parts[0].trim() && parts[1].trim()) {
                // 両側に内容がある場合：全角スペースに置き換え
                processedTitle = processedTitle.replace('|', '　');
            } else if (parts[0].trim()) {
                // 左側だけに内容がある場合：左側のみ保持
                processedTitle = parts[0].trim();
            }
        }
        
        return `エピソード（スポット）｜${spotName}｜${processedTitle}`;
    }
    
    switch (type) {
        case 'ep-chara':
            const charaId = Math.floor(parseInt(scenarioId) / 100);
            const characterName = CHARACTER_JA_MAP[charaId] || `キャラクター${charaId}`;
            
            let processedTitle = title;
            if (processedTitle.includes('|')) {
                const parts = processedTitle.split('|');
                if (parts[0].trim() && parts[1].trim()) {
                    // 両側に内容がある場合：全角スペースに置き換え
                    processedTitle = processedTitle.replace('|', '　');
                } else if (parts[0].trim()) {
                    // 左側だけに内容がある場合：左側のみ保持
                    processedTitle = parts[0].trim();
                }
            }
            
            return `エピソード（キャラ）｜${characterName}｜${processedTitle}`;
        case 'ep-special':
            return `エピソード（スペシャル） - ${scenarioId}`;
        default:
            return `エピソード - ${scenarioId}`;
    }
}

/**
 * エピソードストーリーの表示タイトルを生成（タイトル付き）
 */
function generateEpDisplayTitle(type, scenarioId, title) {
    if (type === 'ep-chara' && title) {
        const charaId = Math.floor(parseInt(scenarioId) / 100);
        const characterName = CHARACTER_JA_MAP[charaId];
        const processedTitle = title.replace(/\|/g, '　').replace(/\|$/, '');
        return `${characterName}｜${processedTitle}`;
    } else {
        // For other ep types or no title, use original format
        return generateEpStoryTitle(type, scenarioId).replace('エピソード（', '').replace('） - ', '｜');
    }
}

/**
 * ログインストーリーの表示タイトルを生成
 */
function generateCampaignStoryTitle(scenarioId) {
    if (campaignLoginIdToTitle && campaignLoginIdToTitle[scenarioId]) {
        const title = campaignLoginIdToTitle[scenarioId];
        // Replace | with full-width space
        return title.replace(/\|/g, '　');
    }
    return `ログインストーリー - ${scenarioId}`;
}

/**
 * ログインイベントストーリーの表示タイトルを生成
 */
function generateLoginEventStoryTitle(scenarioId) {
    if (eventLoginIdToTitle && eventLoginIdToTitle[scenarioId]) {
        const title = eventLoginIdToTitle[scenarioId];
        // Replace | with full-width space
        return title.replace(/\|/g, '　');
    }
    return `ログインイベント - ${scenarioId}`;
}

/**
 * シナリオの種類とIDに基づいて正しいリンクを生成
 */
function generateScenarioLink(type, scenarioId) {

    switch (type) {
        case 'main': {
            const [chapter, episode] = scenarioId.split('-');
            const chapterNum = parseInt(chapter);

            let partNumber, displayNum;

            if (chapterNum >= 1 && chapterNum <= 21) {
                partNumber = 1;
                displayNum = chapterNum;
            } else if (chapterNum >= 22 && chapterNum <= 25) {
                partNumber = 1.5;
                displayNum = chapterNum - 21;
            } else if (chapterNum >= 26 && chapterNum <= 47) {
                partNumber = 2;
                displayNum = chapterNum - 25;
            } else {
                partNumber = 1;
                displayNum = 1;
            }

            return `#main/${partNumber}/${displayNum}`;
        }
        case 'love': {
            const [charId, episode] = scenarioId.split('-');
            return `#love/${charId}`;
        }
        case 'card': {
            const [cardIdStr, episode] = scenarioId.split('-');
            const cardId = parseInt(cardIdStr);
            const displayId = getDisplayCardId(cardId);
            return `#card/${displayId}`;
        }
        case 'event': {
            const [eventId, episode] = scenarioId.split('-');
            return `#event/${eventId}`;
        }
        case 'caulis': {
            const [eventId, episode] = scenarioId.split('-');
            return `#event/${eventId}`;
        }
        case 'ep-spot': {
            // scenarioId is like '10000' for iku_epi_10000.json
            // Need to map back to spotId and seq
            const id = parseInt(scenarioId);
            let spotId, seq;
            
            if (scenarioId.startsWith('1001')) {
                // Special case for spotId 22
                spotId = 22;
                seq = parseInt(scenarioId.substring(4)) || 0;
            } else if (scenarioId.length >= 4) {
                // Normal case: 1{spotId-1:02d}{seq:02d}
                const spotPart = parseInt(scenarioId.substring(1, 3)) + 1;
                seq = parseInt(scenarioId.substring(3)) || 0;
                spotId = spotPart;
            } else {
                return '#ep';
            }
            
            return `#ep/spot/${spotId}`;
        }
        case 'ep-chara': {
            // scenarioId is like '1013' for iku_epi_1013.json (chara 1, ep 13)
            const id = parseInt(scenarioId);
            const charaId = Math.floor(id / 100);
            const episodeNum = id % 100;
            return `#ep/chara/${charaId}`;
        }
        case 'ep-special': {
            // scenarioId is like '100000' for iku_epi_100000.json
            // Format: 1000{id:02d} for 1st, 1000{id:02d} for 2nd
            const id = parseInt(scenarioId.substring(4)); // Remove '1000' prefix
            const dir = id >= 30 ? '2nd' : '1st'; // Assuming 1st: 0-29, 2nd: 30+
            return `#ep/special/${dir}`;
        }
        case 'ep-special-1st':
        case 'ep-special-2nd': {
            const dir = type.replace('ep-special-', '');
            return `#ep/special/${dir}`;
        }
        case 'ep-card': {
            // scenarioId is epid, need to map to displayId
            if (cardEpIdToCardId === null || cardIdToDisplayId === null) {
                loadCardEpMapping().then(({ epidToCardId, cardIdToDisplayId: displayIdMap }) => {
                    const cardId = epidToCardId[scenarioId];
                    if (cardId && displayIdMap[cardId]) {
                        return `#ep/card/${displayIdMap[cardId]}`;
                    } else {
                        return '#ep/card';
                    }
                });
                return '#ep/card'; // Return default while loading
            } else {
                const cardId = cardEpIdToCardId[scenarioId];
                if (cardId && cardIdToDisplayId[cardId]) {
                    return `#ep/card/${cardIdToDisplayId[cardId]}`;
                } else {
                    return '#ep/card';
                }
            }
        }
        case 'campaign': {
            // scenarioId is like '10000' for scenario_login_10000.json
            // Need to map to campaign index
            // Load mapping if not loaded
            if (campaignLoginIdToIndex === null) {
                loadCampaignMapping().then(({ indexMap }) => {
                    const campaignIndex = indexMap[scenarioId];
                    if (campaignIndex !== undefined) {
                        return `#lgst/${campaignIndex}`;
                    } else {
                        return '#lgst';
                    }
                });
                return '#lgst'; // Return default while loading
            } else {
                const campaignIndex = campaignLoginIdToIndex[scenarioId];
                if (campaignIndex !== undefined) {
                    return `#lgst/${campaignIndex}`;
                } else {
                    return '#lgst';
                }
            }
        }
        case 'login-event': {
            // scenarioId is like '1' for scenario_login_1.json
            // Need to map to event id
            // Load mapping if not loaded
            if (eventLoginIdToEventId === null) {
                loadEventMapping().then(({ eventIdMap }) => {
                    const eventId = eventIdMap[scenarioId];
                    if (eventId !== undefined) {
                        return `#event/${eventId}`;
                    } else {
                        return '#event';
                    }
                });
                return '#event'; // Return default while loading
            } else {
                const eventId = eventLoginIdToEventId[scenarioId];
                if (eventId !== undefined) {
                    return `#event/${eventId}`;
                } else {
                    return '#event';
                }
            }
        }
        default:
            return `#${type}`;
    }
}

/**
 * 検索コンテンツをハイライト
 */
function highlightContent(content, pattern) {
    if (!pattern) return escapeHtml(content);
    try {
        const escaped = escapeHtml(content);
        return escaped.replace(
            new RegExp(`(${escapeHtml(pattern)})`, 'gi'),
            '<mark>$1</mark>'
        );
    } catch (error) {
        return escapeHtml(content);
    }
}

/**
 * 検索をクリア
 */
function clearSearch() {
    document.querySelectorAll('.speaker-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('.scenario-type-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('custom-speaker-input').value = '';
    document.getElementById('content-input').value = '';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('search-error').style.display = 'none';
}

/**
 * 検索エラーを表示
 */
function showSearchError(message) {
    const errorContainer = document.getElementById('search-error');
    if (!errorContainer) return;

    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
}

/**
 * HTMLをエスケープ
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
} else {
    initSearch();
}
