/**
 * エピソード (Ep) ストーリーの読み込みとレンダリング
 * スポット (Spot) とキャラ (Chara) シナリオをサポート
 * 通用ツール は scenario-utils.js で定義されています
 */

let currentEpLoadId = null;

/**
 * スポットバンドルを読み込み
 * @param {number} spotId - スポットID
 * @returns {Promise<Array|null>} シナリオデータの配列または null
 */
async function loadEpSpotBundle(spotId) {
    const path = API_PATHS.bundles.epSpot(spotId);
    return await loadScenarioData(path);
}

/**
 * キャラクターバンドルを読み込み
 * @param {number} charaId - キャラクターID
 * @returns {Promise<Array|null>} シナリオデータの配列または null
 */
async function loadEpCharaBundle(charaId) {
    const path = API_PATHS.bundles.epChara(charaId);
    return await loadScenarioData(path);
}

/**
 * スペシャルバンドルを読み込み
 * @param {string} dir - ディレクトリ名 ('1st' or '2nd')
 * @returns {Promise<Array|null>} シナリオデータの配列または null
 */
async function loadEpSpecialBundle(dir) {
    const path = API_PATHS.bundles.epSpecial(dir);
    return await loadScenarioData(path);
}

/**
 * 単一のストーリーをレンダリング
 * @param {Object} scenario - シナリオデータ
 * @param {number} episodeIndex - エピソードインデックス
 * @param {number} seq - シーケンス番号（スポット用、06-30の場合は|前を使用）
 * @param {boolean} isCharacterEp - キャラEPの場合は常に|前を使用
 * @returns {string} 生成されたHTML
 */
function renderEpStory(scenario, episodeIndex, seq, isCharacterEp = false) {
    let html = '';

    // キャラEPの場合はh2を生成しない（既に大標題がある）
    if (!isCharacterEp && episodeIndex === 0) {
        let title = scenario.Title;
        if (title.includes('|')) {
            title = extractTitlePart(title, 0);
        }
        html += `<h2 class="no-toc-title">${title}</h2>`;
    }

    let h3Text = scenario.Title;
    // キャラEPの場合、または非00-05のスポットEP（seq >= 6）の場合、|前を使用
    if (isCharacterEp || (seq !== undefined && seq >= 6 && h3Text.includes('|'))) {
        if (h3Text.includes('|')) {
            h3Text = extractTitlePart(h3Text, 0);
        }
    } else if (h3Text.includes('|')) {
        // スポットEP 00-05の場合、|を全角スペースに置き換えて完全なタイトルを表示
        h3Text = h3Text.replace('|', '　');
    }
    html += `<h3>${h3Text}</h3>`;

    html += renderDialogue(scenario.Dialogue);
    return html;
}

/**
 * スポットシリーズ全体を読み込んでレンダリング
 * @param {number} spotId - スポットID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderEpSpotSeries(spotId, onLoadComplete) {
    const loadId = Symbol('epSpotLoad');
    currentEpLoadId = loadId;

    const container = document.querySelector('#ep-content');
    if (!container) return;

    if (currentEpLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    let html = `<div class="ep-spot-series" data-spot-id="${spotId}">`;
    const scenarios = [];

    // Load bundle
    let loadedScenarios = await loadEpSpotBundle(spotId);

    if (!loadedScenarios) {
        console.error(`[EpSpot] Bundle not found for spot ${spotId}`);
        container.innerHTML = '<div class="error">データが見つかりませんでした。</div>';
        return;
    }

    loadedScenarios.forEach((scenario, index) => {
        const seq = EP_SPOT_CONFIG.minSeq + index;
        scenarios.push({ seq, scenario });
        html += `<section class="ep-spot-episode" data-seq="${seq}">`;
        html += renderEpStory(scenario, index, seq);
        html += '</section>';
    });

    if (currentEpLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#ep" class="back-link">← エピソードのトップへ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    container.innerHTML = html;

    scenarios.forEach(({ seq, scenario }) => {
        const episodeContainer = container.querySelector(`[data-seq="${seq}"]`);
        if (episodeContainer) {
            initStoryInteraction(episodeContainer, scenario.Dialogue);
        }
    });

    if (typeof toc !== 'undefined' && toc) {
        toc.destroy();
        toc.init();
    }

    if (onLoadComplete && typeof onLoadComplete === 'function') {
        onLoadComplete();
    }
}

/**
 * キャラクターシリーズ全体を読み込んでレンダリング
 * @param {number} charaId - キャラクターID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderEpCharaSeries(charaId, onLoadComplete) {
    const loadId = Symbol('epCharaLoad');
    currentEpLoadId = loadId;

    const container = document.querySelector('#ep-content');
    if (!container) return;

    if (currentEpLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    
    // キャラクター名を取得
    const characterName = CHARACTER_MAP[charaId];
    const katakanaName = CHARACTER_KATAKANA_MAP[characterName] || characterName;
    
    let html = `<div class="ep-chara-series" data-chara-id="${charaId}">`;
    html += `<h2 class="no-toc-title">${katakanaName}のキャラエピ</h2>`;
    const scenarios = [];

    // Load bundle
    let loadedScenarios = await loadEpCharaBundle(charaId);

    if (!loadedScenarios) {
        console.error(`[EpChara] Bundle not found for character ${charaId}`);
        container.innerHTML = '<div class="error">データが見つかりませんでした。</div>';
        return;
    }

    loadedScenarios.forEach((scenario, index) => {
        const ep = 13 + index; // Chara ep starts from 13
        scenarios.push({ episode: ep, scenario });
        html += `<section class="ep-chara-episode" data-episode="${ep}">`;
        html += renderEpStory(scenario, index, undefined, true);
        html += '</section>';
    });

    if (currentEpLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#ep" class="back-link">← エピソードのトップへ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    container.innerHTML = html;

    scenarios.forEach(({ episode, scenario }) => {
        const episodeContainer = container.querySelector(`[data-episode="${episode}"]`);
        if (episodeContainer) {
            initStoryInteraction(episodeContainer, scenario.Dialogue);
        }
    });

    if (typeof toc !== 'undefined' && toc) {
        toc.destroy();
        toc.init();
    }

    if (onLoadComplete && typeof onLoadComplete === 'function') {
        onLoadComplete();
    }
}

/**
 * epページを初期化 (spot)
 * @param {number} spotId - スポットID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initEpSpotScenario(spotId, onLoadComplete) {
    loadAndRenderEpSpotSeries(spotId, onLoadComplete);
}

/**
 * epページを初期化 (chara)
 * @param {number} charaId - キャラクターID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initEpCharaScenario(charaId, onLoadComplete) {
    loadAndRenderEpCharaSeries(charaId, onLoadComplete);
}

/**
 * スペシャルシリーズ全体を読み込んでレンダリング
 * @param {string} dir - ディレクトリ名 ('1st' or '2nd')
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderEpSpecialSeries(dir, onLoadComplete) {
    const loadId = Symbol('epSpecialLoad');
    currentEpLoadId = loadId;

    const container = document.querySelector('#ep-content');
    if (!container) return;

    if (currentEpLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    
    // ディレクトリ情報を取得
    const dirConfig = EP_SPECIAL_CONFIG.directories.find(d => d.id === dir);
    if (!dirConfig) return;
    
    let html = `<div class="ep-special-series" data-dir="${dir}">`;
    html += `<h2 class="no-toc-title">${dirConfig.displayName}</h2>`;
    const scenarios = [];

    // Load bundle
    let loadedScenarios = await loadEpSpecialBundle(dir);

    if (!loadedScenarios) {
        console.error(`[EpSpecial] Bundle not found for dir ${dir}`);
        container.innerHTML = '<div class="error">データが見つかりませんでした。</div>';
        return;
    }

    loadedScenarios.forEach((scenario, index) => {
        const id = dirConfig.minId + index;
        scenarios.push({ id, scenario });
        html += `<section class="ep-special-episode" data-id="${id}">`;

        let h3Text = scenario.Title;
        if (h3Text.includes('|')) {
            const parts = h3Text.split('|');
            if (parts[0].trim() && parts[1].trim()) {
                h3Text = h3Text.replace('|', '　');
            } else if (parts[0].trim()) {
                h3Text = parts[0].trim();
            }
        }
        html += `<h3>${h3Text}</h3>`;
        html += renderDialogue(scenario.Dialogue);
        html += '</section>';
    });

    if (currentEpLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#ep" class="back-link">← エピソードのトップへ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    container.innerHTML = html;

    scenarios.forEach(({ id, scenario }) => {
        const episodeContainer = container.querySelector(`[data-id="${id}"]`);
        if (episodeContainer) {
            initStoryInteraction(episodeContainer, scenario.Dialogue);
        }
    });

    if (typeof toc !== 'undefined' && toc) {
        toc.destroy();
        toc.init();
    }

    if (onLoadComplete && typeof onLoadComplete === 'function') {
        onLoadComplete();
    }
}

/**
 * epページを初期化 (special)
 * @param {string} dir - ディレクトリ名 ('1st' or '2nd')
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initEpSpecialScenario(dir, onLoadComplete) {
    loadAndRenderEpSpecialSeries(dir, onLoadComplete);
}

/**
 * 全EPカードバンドルを読み込み
 * @returns {Promise<Object|null>} バンドルデータまたは null
 */
async function loadEpCardBundle() {
    const path = API_PATHS.bundles.epCardAll;
    return await loadScenarioData(path);
}

/**
 * EPカード全体を読み込んでレンダリング
 * @param {number} cardId - カードID (from card-ep.json key)
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderEpCard(displayId, onLoadComplete) {
    const loadId = Symbol('epCardLoad');
    currentEpLoadId = loadId;

    const container = document.querySelector('#ep-content');
    if (!container) return;

    if (currentEpLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';

    try {
        // 1. Convert displayId to actualId
        const actualId = getActualCardId(displayId);
        
        // 2. Load metadata and bundle in parallel
        const [metaResponse, allEpCards] = await Promise.all([
            fetch('public/scenario/ep/card-ep.json'),
            loadEpCardBundle()
        ]);
        
        if (!metaResponse.ok) throw new Error('Failed to load card-ep.json');
        if (!allEpCards) throw new Error('Failed to load ep-card bundle');
        
        const cardEpisodeMap = await metaResponse.json();
        
        // 3. Get the epid from the mapping
        const epid = cardEpisodeMap[actualId];
        if (!epid) {
            container.innerHTML = '<div class="error">カードが見つかりません</div>';
            return;
        }

        // 4. Get the scenario from the bundle
        const scenario = allEpCards[epid.toString()];
        if (!scenario) {
            console.error(`[EpCard] Scenario for epid ${epid} not found in bundle`);
            container.innerHTML = '<div class="error">シナリオが見つかりません</div>';
            return;
        }

        if (currentEpLoadId !== loadId) return;

        let html = `<div class="ep-card" data-card-id="${actualId}" data-display-id="${displayId}" data-epid="${epid}">`;
        
        let titleText = scenario.Title || 'タイトル';
        // Remove | symbol from title
        if (titleText.includes('|')) {
            titleText = titleText.split('|')[0];
        }
        html += `<h2>${titleText}</h2>`;
        
        // Display card icon (centered, 60px width)
        html += `<div class="ep-card-icon" style="text-align: center; margin: 1rem 0;">
            <img src="assets/images/card_ep_icon/card_icon_${actualId}.png" alt="カード ${displayId}" style="max-width: 60px;" onerror="this.style.display='none'">
        </div>`;
        
        html += renderDialogue(scenario.Dialogue);
        
        // Add back links
        html += `<div class="back-links">
            <a href="#ep/card" class="back-link">← カードエピソードのトップへ戻る</a><br>
            <a href="#ep" class="back-link">← エピソードのトップへ戻る</a><br>
            <a href="#" class="back-link">← トップへ戻る</a>
        </div>`;
        
        html += '</div>';

        container.innerHTML = html;
        
        if (onLoadComplete) {
            onLoadComplete();
        }
    } catch (error) {
        console.error('Error loading EP card:', error);
        container.innerHTML = '<div class="error">エラーが発生しました</div>';
    }
}

/**
 * EPカード初期化
 * @param {number} cardId - カードID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initEpCardScenario(cardId, onLoadComplete) {
    loadAndRenderEpCard(cardId, onLoadComplete);
}