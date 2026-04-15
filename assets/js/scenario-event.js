/**
 * イベントストーリーの読み込みとレンダリング
 * 通用工具は scenario-utils.js で定義されています
 */

let currentEventLoadId = null;

// イベントストーリー設定
let eventStoryConfig = null;

function createEventStoryConfig(eventMax = 159) {
    return {
        eventsByYear: {
            2019: { start: 1, end: 2 },
            2020: { start: 3, end: 26 },
            2021: { start: 27, end: 49 },
            2022: { start: 50, end: 70 },
            2023: { start: 71, end: 89 },
            2024: { start: 90, end: 112 },
            2025: { start: 113, end: 136 },
            2026: { start: 137, end: eventMax }
        },
        get maxEventId() {
            return Math.max(...Object.values(this.eventsByYear).map(range => range.end));
        }
    };
}

/**
 * イベントストーリー設定を読み込む
 * @returns {Promise<Object>} イベントストーリー設定
 */
async function loadEventStoryConfig() {
    if (eventStoryConfig !== null) {
        return eventStoryConfig;
    }

    try {
        const response = await fetch('public/scenario/info.json');
        const data = await response.json();
        const eventMax = Number(data['event-max']);

        if (!response.ok) {
            console.error('Failed to load info.json:', response.statusText);
        }

        eventStoryConfig = createEventStoryConfig(Number.isFinite(eventMax) ? eventMax : 159);
        return eventStoryConfig;
    } catch (error) {
        console.error('Error loading info.json:', error);
        // フォールバック
        eventStoryConfig = createEventStoryConfig(159);
        return eventStoryConfig;
    }
}

// イベントのログインストーリーID一覧を保持するグローバルデータ
let eventLoginStoryData = null;

/**
 * event.jsonを読み込む
 * @param {number} eventId - イベントID
 * @returns {Promise<Object|null>} バンドルデータまたは null
 */
async function loadEventBundle(eventId) {
    const path = API_PATHS.bundles.event(eventId);
    return await loadScenarioData(path);
}

/**
 * イベントのエピソード一覧を取得
 * @param {number} eventId - イベントID
 * @returns {Promise<Array<number>|null>} エピソード番号の配列（見つからない場合は null）
 */
async function getEventEpisodeList(eventId) {
    const episodeList = await loadEventEpisodeList();
    return episodeList[eventId] || null;
}

/**
 * イベントIDから年を取得
 * @param {number} eventId - イベントID
 * @returns {Promise<number>} 年
 */
async function getEventYear(eventId) {
    const config = await loadEventStoryConfig();
    for (const [year, range] of Object.entries(config.eventsByYear)) {
        if (eventId >= range.start && eventId <= range.end) {
            return parseInt(year);
        }
    }
    return 2026;
}

/**
 * イベントトップページを生成
 * @returns {Promise<string>} 生成されたHTML
 */
async function generateEventTopList() {
    const config = await loadEventStoryConfig();
    const years = Object.keys(config.eventsByYear)
        .map(y => parseInt(y))
        .sort((a, b) => b - a);

    const yearsData = years.map(year => {
        const range = config.eventsByYear[year];
        const events = [];
        
        for (let eventId = range.end; eventId >= range.start; eventId--) {
            events.push({
                eventId,
                iconPath: `assets/images/event_icon/scenario_event_icon_${eventId}.png`
            });
        }
        
        return { year, events };
    });

    return await templateManager.renderTemplate('event-top-list', { years: yearsData });
}

/**
 * 単一のストーリーをレンダリング
 * @param {Object} scenario - シナリオデータ
 * @param {number} eventId - イベントID
 * @param {number} episodeIndex - エピソードインデックス
 * @returns {Promise<string>} 生成されたHTML
 */
async function renderEventStory(scenario, eventId, episodeIndex) {
    const year = await getEventYear(eventId);
    let html = '';

    if (episodeIndex === 0) {
        let h2Text = `イベント${eventId}（${year}年）`;

        if (scenario.Title && scenario.Title.includes('|')) {
            const mainTitle = scenario.Title.split('|')[0].trim();
            h2Text = `${mainTitle}（${year}年）`;
        }

        html += `<h2 class="no-toc-title">${h2Text}</h2>`;

        const bannerPath = `assets/images/event_banners/event_banner_${eventId}.png`;
        html += `<div class="event-banner-container">
            <img src="${bannerPath}" class="event-banner-img" />
        </div>`;
    }

    let h3Text = '';
    if (scenario.Title) {
        if (scenario.Title.includes('|')) {
            h3Text = scenario.Title.split('|')[1].trim();
        } else {
            const episodeNumber = convertToJapaneseNumeral(episodeIndex + 1);
            h3Text = `第${episodeNumber}話`;
        }
    } else {
        const episodeNumber = convertToJapaneseNumeral(episodeIndex + 1);
        h3Text = `第${episodeNumber}話`;
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
function initEventStoryInteraction(container, dialogue) {
    attachBranchListeners(dialogue, container);
}

/**
 * ログインストーリーをレンダリング
 * @param {Object} scenario - シナリオデータ
 * @returns {string} 生成されたHTML
 */
function renderLoginStory(scenario) {
    let html = '';

    let h3Text = '';
    if (scenario.Title && scenario.Title.includes('|')) {
        h3Text = scenario.Title.split('|')[0].trim();
    }

    html += `<h3>${h3Text}</h3>`;
    html += renderDialogue(scenario.Dialogue);
    return html;
}

/**
 * イベントIDのログインストーリーID一覧を取得
 * @param {number} eventId - イベントID
 * @returns {Promise<Array<number>>} ログインストーリーIDの配列
 */
async function getLoginStoryIds(eventId) {
    const data = await loadEventLoginStoryData();
    const eventData = data[eventId];
    return eventData ? eventData.lgstList : [];
}

/**
 * イベント全体を読み込んでレンダリング
 * @param {number} eventId - イベントID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderEventSeries(eventId, onLoadComplete) {
    const loadId = Symbol('eventLoad');
    currentEventLoadId = loadId;

    const container = document.querySelector('#event-content');
    if (!container) return;

    if (currentEventLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    let html = `<div class="event-series" data-event="${eventId}">`;
    const scenarios = [];

    // Load bundle
    const bundle = await loadEventBundle(eventId);

    if (!bundle) {
        console.error(`[Event] Bundle not found for event ${eventId}`);
        container.innerHTML = '<div class="error">データが見つかりませんでした。</div>';
        return;
    }

    // Render main episodes from bundle
    for (const epData of bundle.episodes) {
        const { episode: ep, scenario } = epData;
        scenarios.push({ episode: ep, scenario });
        const htmlPart = await renderEventStory(scenario, eventId, scenarios.length - 1);
        html += `<section class="event-episode" data-episode="${ep}">`;
        html += htmlPart;
        html += '</section>';
    }

    // Render login stories from bundle
    for (const loginData of bundle.login) {
        const { loginId, scenario: loginScenario } = loginData;
        const sectionIndex = scenarios.length;
        scenarios.push({ type: 'login', sectionIndex, scenario: loginScenario });
        html += `<section class="event-episode" data-section-index="${sectionIndex}">`;
        html += renderLoginStory(loginScenario);
        html += '</section>';
    }

    if (currentEventLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#event" class="back-link">← イベントストーリーのトップへ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    container.innerHTML = html;

    scenarios.forEach(({ episode, sectionIndex, scenario, type }) => {
        let sectionContainer;
        if (type === 'login') {
            sectionContainer = container.querySelector(`[data-section-index="${sectionIndex}"]`);
        } else {
            sectionContainer = container.querySelector(`[data-episode="${episode}"]`);
        }
        
        if (sectionContainer) {
            initEventStoryInteraction(sectionContainer, scenario.Dialogue);
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
 * イベントページを初期化
 * @param {number} eventId - イベントID
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initEventScenario(eventId, onLoadComplete) {
    loadAndRenderEventSeries(eventId, onLoadComplete);
}
