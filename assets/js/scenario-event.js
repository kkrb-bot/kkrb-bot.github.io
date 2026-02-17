/**
 * イベントストーリーの読み込みとレンダリング
 * 通用工具は scenario-utils.js で定義されています
 */

let currentEventLoadId = null;

// イベントストーリー設定
let eventStoryConfig = null;

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
        if (!response.ok) {
            console.error('Failed to load info.json:', response.statusText);
            // フォールバックとしてデフォルト値を使用
            eventStoryConfig = {
                eventsByYear: {
                    2019: { start: 1, end: 2 },
                    2020: { start: 3, end: 26 },
                    2021: { start: 27, end: 49 },
                    2022: { start: 50, end: 70 },
                    2023: { start: 71, end: 89 },
                    2024: { start: 90, end: 112 },
                    2025: { start: 113, end: 136 },
                    2026: { start: 137, end: 139 }
                },
                get maxEventId() {
                    return Math.max(...Object.values(this.eventsByYear).map(range => range.end));
                }
            };
            return eventStoryConfig;
        }
        const data = await response.json();
        const eventMax = data['event-max'];
        eventStoryConfig = {
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
        return eventStoryConfig;
    } catch (error) {
        console.error('Error loading info.json:', error);
        // フォールバック
        eventStoryConfig = {
            eventsByYear: {
                2019: { start: 1, end: 2 },
                2020: { start: 3, end: 26 },
                2021: { start: 27, end: 49 },
                2022: { start: 50, end: 70 },
                2023: { start: 71, end: 89 },
                2024: { start: 90, end: 112 },
                2025: { start: 113, end: 136 },
                2026: { start: 137, end: 139 }
            },
            get maxEventId() {
                return Math.max(...Object.values(this.eventsByYear).map(range => range.end));
            }
        };
        return eventStoryConfig;
    }
}

// イベントのログインストーリーID一覧を保持するグローバルデータ
let eventLoginStoryData = null;

/**
 * event.jsonを読み込む
 * @returns {Promise<Object>} イベントログインストーリーデータ
 */
async function loadEventLoginStoryData() {
    if (eventLoginStoryData !== null) {
        return eventLoginStoryData;
    }

    try {
        const response = await fetch('public/scenario/login/event.json');
        if (!response.ok) {
            console.error('Failed to load event.json:', response.statusText);
            eventLoginStoryData = {};
            return {};
        }
        eventLoginStoryData = await response.json();
        return eventLoginStoryData;
    } catch (error) {
        console.error('Error loading event.json:', error);
        eventLoginStoryData = {};
        return {};
    }
}

/**
 * シナリオJSONを読み込み
 * @param {number} eventId - イベントID
 * @param {number} episodeNum - エピソード番号
 * @returns {Promise<Object|null>} シナリオデータまたは null
 */
async function loadEventScenario(eventId, episodeNum) {
    let path;

    if (CAULIS_EVENT_IDS.includes(eventId)) {
        path = API_PATHS.caulisScenario(eventId, episodeNum);
    } else {
        path = API_PATHS.eventScenario(eventId, episodeNum);
    }

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
    return eventData ? eventData.loginStories : [];
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

    const episodeList = await getEventEpisodeList(eventId);
    const episodesToLoad = episodeList || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    for (const ep of episodesToLoad) {
        if (currentEventLoadId !== loadId) return;

        const scenario = await loadEventScenario(eventId, ep);
        if (scenario) {
            scenarios.push({ episode: ep, scenario });
            const htmlPart = await renderEventStory(scenario, eventId, scenarios.length - 1);
            html += `<section class="event-episode" data-episode="${ep}">`;
            html += htmlPart;
            html += '</section>';
        }
    }

    if (currentEventLoadId !== loadId) return;

    // ログインストーリーを追加
    const loginStoryIds = await getLoginStoryIds(eventId);
    for (const loginStoryId of loginStoryIds) {
        if (currentEventLoadId !== loadId) return;

        const loginScenario = await loadScenarioData(`public/scenario/login/event/scenario_login_${loginStoryId}.json`);
        if (loginScenario) {
            const sectionIndex = scenarios.length;
            scenarios.push({ type: 'login', sectionIndex, scenario: loginScenario });
            html += `<section class="event-episode" data-section-index="${sectionIndex}">`;
            html += renderLoginStory(loginScenario);
            html += '</section>';
        }
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
