/**
 * キャンペーンログインストーリーの読み込みとレンダリング
 * 一般的なツールは scenario-utils.js で定義されています
 */

let currentCampaignLoadId = null;

// ========================================
// キャンペーンストーリー設定
// ========================================

// キャンペーンデータを保持するグローバルデータ
let campaignData = null;

/**
 * campaign.jsonを読み込む
 * @returns {Promise<Array>} キャンペーンデータの配列
 */
async function loadCampaignData() {
    if (campaignData !== null) {
        return campaignData;
    }

    try {
        const response = await fetch('public/scenario/login/campaign.json');
        if (!response.ok) {
            console.error('Failed to load campaign.json:', response.statusText);
            campaignData = [];
            return [];
        }
        campaignData = await response.json();
        return campaignData;
    } catch (error) {
        console.error('Error loading campaign.json:', error);
        campaignData = [];
        return [];
    }
}

/**
 * シナリオJSONを読み込み
 * @param {number} loginId - ログインストーリーID
 * @returns {Promise<Object|null>} シナリオデータまたは null
 */
async function loadCampaignScenario(loginId) {
    const path = `public/scenario/login/campaign/scenario_login_${loginId}.json`;
    return await loadScenarioData(path);
}

/**
 * ストーリーをレンダリング
 * @param {Object} scenario - シナリオデータ
 * @param {number} storyIndex - ストーリーインデックス
 * @returns {string} 生成されたHTML
 */
function renderCampaignStory(scenario, storyIndex, h3Text) {
    let html = '';

    html += `<h3>${h3Text}</h3>`;
    html += renderDialogue(scenario.Dialogue);
    return html;
}

/**
 * ストーリーインタラクションを初期化
 * @param {HTMLElement} container - コンテナ要素
 * @param {Array} dialogue - セリフ配列
 */
function initCampaignStoryInteraction(container, dialogue) {
    attachBranchListeners(dialogue, container);
}

/**
 * タイトルを分析してh2とh3のテキストを決定
 * @param {Array} scenarios - シナリオ配列
 * @param {string} defaultH2 - デフォルトのh2テキスト
 * @returns {Object} { h2Text, h3Texts }
 */
function analyzeTitles(scenarios, defaultH2) {
    const titles = scenarios.map(s => s.Title).filter(t => t && t.includes('|'));
    if (titles.length < 2) {
        // 2つ未満の場合はデフォルト
        return {
            h2Text: defaultH2,
            h3Texts: scenarios.map((s, i) => {
                if (s.Title && s.Title.includes('|')) {
                    return s.Title.split('|')[0].trim();
                } else if (s.Title) {
                    return s.Title;
                } else {
                    return `ストーリー${i + 1}`;
                }
            })
        };
    }

    const parts = titles.map(t => t.split('|').map(p => p.trim()));
    const prefixes = parts.map(p => p[0]);
    const suffixes = parts.map(p => p[1] || '');

    const allPrefixesSame = prefixes.every(p => p === prefixes[0]);
    const allSuffixesSame = suffixes.every(s => s === suffixes[0]);

    let h2Text = defaultH2;
    let h3Texts = [];

    if (allPrefixesSame && !allSuffixesSame) {
        // |前が全て同じ、|後が違う → h2 = |前, h3 = |後
        h2Text = prefixes[0];
        h3Texts = scenarios.map((s, i) => {
            if (s.Title && s.Title.includes('|')) {
                return s.Title.split('|')[1].trim() || `ストーリー${i + 1}`;
            } else {
                return s.Title || `ストーリー${i + 1}`;
            }
        });
    } else if (!allPrefixesSame && allSuffixesSame) {
        // |前が違う、|後が同じ → h2 = |後, h3 = |前
        h2Text = suffixes[0];
        h3Texts = scenarios.map((s, i) => {
            if (s.Title && s.Title.includes('|')) {
                return s.Title.split('|')[0].trim();
            } else {
                return s.Title || `ストーリー${i + 1}`;
            }
        });
    } else {
        // デフォルト
        h3Texts = scenarios.map((s, i) => {
            if (s.Title && s.Title.includes('|')) {
                return s.Title.split('|')[0].trim();
            } else if (s.Title) {
                return s.Title;
            } else {
                return `ストーリー${i + 1}`;
            }
        });
    }

    return { h2Text, h3Texts };
}

/**
 * キャンペーン全体を読み込んでレンダリング
 * @param {number} campaignIndex - キャンペーンインデックス
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 * @returns {Promise} レンダリング完了時に解決される Promise
 */
async function loadAndRenderCampaignSeries(campaignIndex, onLoadComplete) {
    const loadId = Symbol('campaignLoad');
    currentCampaignLoadId = loadId;

    const container = document.querySelector('#campaign-content');
    if (!container) return;

    if (currentCampaignLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    
    const allCampaigns = await loadCampaignData();
    if (campaignIndex < 0 || campaignIndex >= allCampaigns.length) {
        container.innerHTML = '<div class="error">キャンペーンが見つかりません</div>';
        return;
    }

    const campaign = allCampaigns[campaignIndex];
    let html = `<div class="campaign-series" data-campaign-index="${campaignIndex}">`;
    const scenarios = [];

    // campaign.scriptまたはscriptフィールドをサポート
    const scriptIds = campaign.script || campaign.scripts || [];
    
    // まず全てのシナリオを読み込む
    const loadedScenarios = [];
    for (const scriptId of scriptIds) {
        if (currentCampaignLoadId !== loadId) return;

        const scenario = await loadCampaignScenario(scriptId);
        if (scenario) {
            loadedScenarios.push(scenario);
        }
    }

    // タイトルを分析してh2とh3のテキストを決定
    const { h2Text, h3Texts } = analyzeTitles(loadedScenarios, campaign.name);

    // h2 を追加
    html += `<h2 class="no-toc-title">${h2Text}</h2>`;

    // キャンペーン画像がある場合は表示
    if (campaign.icon) {
        const bannerPath = `assets/images/campaign_icon/scenario_campaign_icon_${campaign.icon}.png`;
        html += `<div class="campaign-icon-container">
            <img src="${bannerPath}" class="campaign-icon-img" alt="${campaign.name}" />
        </div>`;
    }
    
    loadedScenarios.forEach((scenario, index) => {
        const sectionIndex = scenarios.length;
        scenarios.push({ scriptId: scriptIds[index], sectionIndex, scenario });
        html += `<section class="campaign-episode" data-section-index="${sectionIndex}">`;
        html += renderCampaignStory(scenario, sectionIndex, h3Texts[index]);
        html += '</section>';
    });

    if (currentCampaignLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#lgst" class="back-link">← ログインストーリーのトップへ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    container.innerHTML = html;

    scenarios.forEach(({ sectionIndex, scenario }) => {
        const sectionContainer = container.querySelector(`[data-section-index="${sectionIndex}"]`);
        if (sectionContainer) {
            initCampaignStoryInteraction(sectionContainer, scenario.Dialogue);
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
 * キャンペーントップリストを生成
 * @returns {Promise<string>} 生成されたHTML
 */
async function generateCampaignTopList() {
    const campaigns = await loadCampaignData();
    console.log('[generateCampaignTopList] Loaded campaigns:', campaigns);
    
    // キャンペーンを倒序に表示
    const reversedCampaigns = campaigns.map((campaign, index) => ({
        ...campaign,
        originalIndex: index
    })).reverse();

    // 最初のキャンペーン（Twitter記念）を分離
    const firstCampaignData = campaigns.map((campaign, index) => ({
        ...campaign,
        originalIndex: index
    }))[0];

    const othersList = firstCampaignData && !firstCampaignData.icon 
        ? [{
            name: firstCampaignData.name,
            originalIndex: 0
        }]
        : [];

    const campaignsData = reversedCampaigns
        .filter(campaign => campaign.originalIndex !== 0) // Exclude first campaign from main grid
        .map(campaign => ({
            name: campaign.name,
            iconPath: campaign.icon && campaign.icon.trim() !== '' 
                ? `assets/images/campaign_icon/scenario_campaign_icon_${campaign.icon}.png`
                : 'assets/images/event_icon/scenario_event_icon_1.png', // Use a default icon
            originalIndex: campaign.originalIndex
        }));

    const templateData = {
        campaigns: campaignsData,
        others: othersList.length > 0,
        othersList: othersList,
        showEvents: true
    };

    console.log('[generateCampaignTopList] Template data:', templateData);
    const html = await templateManager.renderTemplate('campaign-list', templateData);
    console.log('[generateCampaignTopList] Rendered HTML:', html);
    return html;
}

/**
 * キャンペーンページを初期化
 * @param {number} campaignIndex - キャンペーンインデックス
 * @param {Function} onLoadComplete - ロード完了時のコールバック
 */
function initCampaignScenario(campaignIndex, onLoadComplete) {
    loadAndRenderCampaignSeries(campaignIndex, onLoadComplete);
}
