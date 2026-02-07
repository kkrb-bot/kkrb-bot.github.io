/**
 * メインストーリーの読み込みとレンダリング
 * 一般的なツールは scenario-utils.js で定義されています
 */

let currentMainLoadId = null;

/**
 * 部数と表示番号から実際の章番号に変換
 * @param {number} partNumber - 部数
 * @param {number} displayNum - 表示番号
 * @returns {number} 実際の章番号
 */
function getActualChapterNum(partNumber, displayNum) {
    if (partNumber === 1) {
        return displayNum;
    } else if (partNumber === 1.5) {
        return 21 + displayNum;
    } else if (partNumber === 2) {
        return 25 + displayNum;
    }
    return 1;
}

/**
 * 実際の章番号から部数と表示番号に変換
 * @param {number} actualChapterNum - 実際の章番号
 * @returns {Object} { partNumber, displayNum }
 */
function getDisplayChapterInfo(actualChapterNum) {
    if (actualChapterNum >= 1 && actualChapterNum <= 21) {
        return { partNumber: 1, displayNum: actualChapterNum };
    } else if (actualChapterNum >= 22 && actualChapterNum <= 25) {
        return { partNumber: 1.5, displayNum: actualChapterNum - 21 };
    } else if (actualChapterNum >= 26 && actualChapterNum <= 47) {
        return { partNumber: 2, displayNum: actualChapterNum - 25 };
    }
    return { partNumber: 1, displayNum: 1 };
}

/**
 * シナリオJSONを読み込み
 * @param {number} chapterNum - 章番号
 * @param {number} episodeNum - エピソード番号
 * @returns {Promise<Object|null>} シナリオデータまたは null
 */
async function loadMainScenario(chapterNum, episodeNum) {
    const path = API_PATHS.mainScenario(chapterNum, episodeNum);
    return await loadScenarioData(path);
}

/**
 * 章番号から部数を取得
 * @param {number} chapterNum - 章番号
 * @returns {number} 部数
 */
function getPartNumber(chapterNum) {
    if (chapterNum >= 1 && chapterNum <= 21) {
        return 1;
    } else if (chapterNum >= 22 && chapterNum <= 25) {
        return 1.5;
    } else if (chapterNum >= 26 && chapterNum <= 47) {
        return 2;
    }
    return 1;
}

/**
 * 部数を日本語で返す
 * @param {number} partNumber - 部数
 * @returns {string} 日本語部数表示
 */
function getPartDisplayText(partNumber) {
    if (partNumber === 1) {
        return '第１部';
    } else if (partNumber === 1.5) {
        return '第１．５部';
    } else if (partNumber === 2) {
        return '第２部';
    }
    return '';
}

/**
 * 特定の章がプロローグであるかを判定
 * @param {number} chapterNum - 章番号
 * @returns {boolean}
 */
function isPrologueChapter(chapterNum) {
    return chapterNum === MAIN_STORY_CONFIG.prologue;
}

function renderMainStory(scenario, chapterNum, episodeIndex, totalEpisodesInChapter) {
    let html = '';

    if (episodeIndex === 0) {
        let h2Text = '';
        let chapterTitle = '';
        const partNumber = getPartNumber(chapterNum);
        const partText = getPartDisplayText(partNumber);

        if (partNumber === 1.5 && scenario.Title) {
            const titleParts = scenario.Title.split('|');
            chapterTitle = titleParts[0].trim();

            if (titleParts.length >= 2) {
                const chapterInfo = titleParts[1].trim();
                if (chapterInfo.includes('プロローグ')) {
                    h2Text = `${partText}　プロローグ`;
                } else {
                    h2Text = `${partText}　${chapterTitle}｜${chapterInfo.split('　')[0]}`;
                }
            } else {
                h2Text = `${partText}　${chapterTitle}`;
            }
        } else if (scenario.Chapter) {
            const chapterParts = scenario.Chapter.split('|');

            if (chapterParts.length === 2) {
                chapterTitle = chapterParts[0].trim();
                const chapterInfo = chapterParts[1].trim();
                h2Text = `${partText}・${chapterInfo}　${chapterTitle}`;
            }
        } else if (scenario.Title && partNumber !== 1.5) {
            const titleParts = scenario.Title.split('|');
            chapterTitle = titleParts[0].trim();
            const chapterText = convertToJapaneseNumeral(chapterNum % 100);
            h2Text = `${partText}・第${chapterText}章　${chapterTitle}`;
        } else if (partNumber !== 1.5) {
            const chapterText = convertToJapaneseNumeral(chapterNum % 100);
            h2Text = `${partText}・第${chapterText}章`;
        }

        if (h2Text) {
            html += `<h2 class="no-toc-title">${h2Text}</h2>`;
        }
    }

    let h3Text = '';
    const partNumber = getPartNumber(chapterNum);

    if (partNumber === 1.5 && scenario.Title) {
        const titleParts = scenario.Title.split('|');
        const chapterTitle = titleParts[0].trim();

        if (titleParts.length >= 2) {
            const chapterInfo = titleParts[1].trim();
            if (chapterInfo.includes('プロローグ')) {
                const episodeMatch = chapterInfo.match(/第[０-９0-9]+話/);
                if (episodeMatch) {
                    h3Text = `${episodeMatch[0]}　${chapterTitle}`;
                }
            } else {
                const episodeMatch = chapterInfo.match(/第[０-９0-9]+話/);
                if (episodeMatch) {
                    h3Text = episodeMatch[0];
                }
            }
        }
    } else if (scenario.Title) {
        const titleParts = scenario.Title.split('|');
        let titleName = titleParts[0].trim();
        let episodeNum = '';

        if (titleParts.length >= 2) {
            const episodeFullInfo = titleParts[1].trim();
            const episodeMatch = episodeFullInfo.match(/第[０-９0-9]+話/);
            if (episodeMatch) {
                episodeNum = episodeMatch[0];
            }
        }

        if (!episodeNum) {
            const episodeNumber = convertToJapaneseNumeral(episodeIndex + 1);
            episodeNum = `第${episodeNumber}話`;
        }

        h3Text = `${episodeNum}　${titleName}`;
    } else if (scenario.Chapter) {
        const chapterParts = scenario.Chapter.split('|');
        let titleName = chapterParts[0].trim();
        let episodeNum = '';

        if (chapterParts.length >= 2) {
            const chapterInfo = chapterParts[1].trim();
            const episodeMatch = chapterInfo.match(/第[０-９0-9]+話/);
            if (episodeMatch) {
                episodeNum = episodeMatch[0];
            }
        }

        if (!episodeNum) {
            const episodeNumber = convertToJapaneseNumeral(episodeIndex + 1);
            episodeNum = `第${episodeNumber}話`;
        }

        h3Text = `${episodeNum}　${titleName}`;
    } else {
        const episodeNum = convertToJapaneseNumeral(episodeIndex + 1);
        h3Text = `第${episodeNum}話`;
    }

    if (h3Text) {
        html += `<h3>${h3Text}</h3>`;
    }

    html += renderDialogue(scenario.Dialogue);
    return html;
}

function initMainStoryInteraction(container, dialogue) {
    attachBranchListeners(dialogue, container);
}

async function loadAndRenderMainChapter(chapterNum, onLoadComplete) {
    const loadId = Symbol('mainLoad');
    currentMainLoadId = loadId;

    const container = document.querySelector('#main-content');
    if (!container) return;

    if (currentMainLoadId !== loadId) return;

    container.innerHTML = '<div class="loading">読み込み中...</div>';
    let html = `<div class="main-chapter" data-chapter="${chapterNum}">`;
    const scenarios = [];

    let maxEpisodes = 10;
    if (chapterNum >= 1 && chapterNum <= 5) {
        maxEpisodes = 5;
    } else if (chapterNum >= 6 && chapterNum <= 21) {
        maxEpisodes = 10;
    } else if (chapterNum >= 22 && chapterNum <= 25) {
        if (chapterNum === 22) maxEpisodes = 10;
        else if (chapterNum === 23) maxEpisodes = 10;
        else if (chapterNum === 24) maxEpisodes = 17;
        else if (chapterNum === 25) maxEpisodes = 26;
    } else if (chapterNum >= 26 && chapterNum <= 47) {
        maxEpisodes = 11;
    }

    let startEpisode = 1;
    if (chapterNum === 24) {
        startEpisode = 11;
    } else if (chapterNum === 25) {
        startEpisode = 18;
    }

    for (let ep = startEpisode; ep <= maxEpisodes; ep++) {
        if (currentMainLoadId !== loadId) return;

        const scenario = await loadMainScenario(chapterNum, ep);
        if (scenario) {
            scenarios.push({ episode: ep, scenario });
            html += `<section class="main-episode" data-episode="${ep}">`;
            html += renderMainStory(scenario, chapterNum, ep - startEpisode, maxEpisodes - startEpisode + 1);
            html += '</section>';
        }
    }

    if (currentMainLoadId !== loadId) return;

    html += '</div>';
    html += `<div class="back-links">
        <a href="#main" class="back-link">← メインストーリーの目次へ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    container.innerHTML = html;

    scenarios.forEach(({ episode, scenario }) => {
        const episodeContainer = container.querySelector(`[data-episode="${episode}"]`);
        if (episodeContainer) {
            initMainStoryInteraction(episodeContainer, scenario.Dialogue);
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

async function generateMainChapterList() {
    const part1Chapters = [];
    const part1_5Chapters = [];
    const part2Chapters = [];
    
    // Part 1: Chapters 1-21
    for (let i = 1; i <= 21; i++) {
        const chapterDisplay = String(i).replace(/\d/g, (d) => '０１２３４５６７８９'[d]);
        part1Chapters.push({ num: i, display: chapterDisplay });
    }
    
    // Part 1.5: Chapters 1-4
    for (let i = 1; i <= 4; i++) {
        const chapterDisplay = String(i).replace(/\d/g, (d) => '０１２３４５６７８９'[d]);
        part1_5Chapters.push({ num: i, display: chapterDisplay });
    }
    
    // Part 2: Chapters 1-22
    for (let i = 1; i <= 22; i++) {
        const chapterDisplay = String(i).replace(/\d/g, (d) => '０１２３４５６７８９'[d]);
        part2Chapters.push({ num: i, display: chapterDisplay });
    }

    return await templateManager.renderTemplate('main-chapter-list', {
        part1Chapters,
        part1_5Chapters,
        part2Chapters
    });
}

function generatePart1_5ChapterList() {
    let html = '<div class="list-container">';

    html += '<div class="list-group">';
    html += '<h3 class="list-title">第１．５部</h3>';
    html += '<div class="list-grid">';
    for (let i = 1; i <= 4; i++) {
        const chapterDisplay = String(i).replace(/\d/g, (d) => '０１２３４５６７８９'[d]);
        html += `<a href="#main/1.5/${i}" class="list-item">第${chapterDisplay}章</a>`;
    }
    html += '</div></div>';

    html += `</div>
    <div class="back-links">
        <a href="#main" class="back-link">← メインストーリーの目次へ戻る</a>
        <br>
        <a href="#" class="back-link">← トップへ戻る</a>
    </div>`;
    return html;
}

async function initMainScenario(partNumber, displayNum, onLoadComplete) {
    let isValid = false;

    if (partNumber === 1) {
        isValid = displayNum >= 1 && displayNum <= 21;
    } else if (partNumber === 1.5) {
        isValid = displayNum >= 1 && displayNum <= 4;
    } else if (partNumber === 2) {
        isValid = displayNum >= 1 && displayNum <= 22;
    }

    if (!isValid) {
        window.location.hash = '#main';
        return;
    }

    const actualChapterNum = getActualChapterNum(partNumber, displayNum);
    if (actualChapterNum) {
        await loadAndRenderMainChapter(actualChapterNum, onLoadComplete);
    }
}
