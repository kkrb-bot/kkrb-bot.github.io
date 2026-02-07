/**
 * 親愛ストーリーの読み込みとレンダリング
 * 一般的なツールは scenario-utils.js で定義されています
 */

let currentLoveLoadId = null;

/**
 * シナリオJSONを読み込み
 * @param {number} characterId - キャラクターID
 * @param {number} episodeNum - エピソード番号
 * @returns {Promise<Object|null>} シナリオデータまたは null
 */
async function loadLoveScenario(characterId, episodeNum) {
    const path = API_PATHS.loveScenario(characterId, episodeNum);
    return await loadScenarioData(path);
}

/**
 * 単一のストーリーをレンダリング
 * @param {Object} scenario - シナリオデータ
 * @param {number} episodeIndex - エピソードインデックス
 * @returns {string} 生成されたHTML
 */
function renderLoveStory(scenario, episodeIndex) {
    let html = '';

    if (episodeIndex === 0) {
        let title = scenario.Title;
        if (title.includes('|')) {
            title = extractTitlePart(title, 0);
        }
        html += `<h2 class="no-toc-title">${title}</h2>`;
    }

    let h3Text = scenario.Title;
    if (h3Text.includes('|')) {
        h3Text = extractTitlePart(h3Text, 1);
    }
    html += `<h3>${h3Text}</h3>`;

    html += renderDialogue(scenario.Dialogue);
    return html;
}

/**
 * ストーリーインタラクションを初期化
 * @param {HTMLElement} container - コンテナ要素
 * @param {Array} dialogue - セリフ配列
 */
function initStoryInteraction(container, dialogue) {
    attachBranchListeners(dialogue, container);
}

/**
 * シリーズ全体を読み込んでレンダリング
 * @param {number} characterId - キャラクターID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderLoveSeries(characterId, onLoadComplete) {
    const loadId = Symbol('loveLoad');
    currentLoveLoadId = loadId;

    const container = document.querySelector('#love-content');
    if (!container) return;

    const characterName = getCharacterName(characterId);
    if (!characterName) {
        if (currentLoveLoadId !== loadId) return;
        container.innerHTML = '<div class="error">キャラクターが存在しません</div>';
        return;
    }

    if (currentLoveLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    let html = `<div class="love-series" data-character="${characterName}">`;
    const scenarios = [];

    for (let ep = 1; ep <= LOVE_EPISODES_PER_CHARACTER; ep++) {
        if (currentLoveLoadId !== loadId) return;

        const scenario = await loadLoveScenario(characterId, ep);
        if (scenario) {
            scenarios.push({ episode: ep, scenario });
            html += `<section class="love-episode" data-episode="${ep}">`;
            html += renderLoveStory(scenario, ep - 1);
            html += '</section>';
        }
    }

    if (currentLoveLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#love" class="back-link">← 親愛ストーリーのトップへ戻る</a>
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
 * loveページを初期化
 * @param {number} characterId - キャラクターID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initLoveScenario(characterId, onLoadComplete) {
    loadAndRenderLoveSeries(characterId, onLoadComplete);
}
