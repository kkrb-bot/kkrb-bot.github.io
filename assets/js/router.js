/**
 * ルーター管理
 * ページルーティングとURLハッシュ変更を処理
 */

class Router {
    constructor() {
        this.currentPage = 'home';
        this.currentSubpage = null;
        this.onHomePage = false;
        this.originalTitle = document.title;
    }

    /**
     * ルーターを初期化
     */
    init() {
        this.handleRouteChange();

        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });

        window.addEventListener('blur', () => {
            if (this.onHomePage) {
                document.title = '＿＿、大変だ……！';
            }
        });

        window.addEventListener('focus', () => {
            if (this.onHomePage) {
                document.title = this.originalTitle;
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (this.onHomePage) {
                if (document.hidden) {
                    document.title = '＿＿、大変だ……！';
                } else {
                    document.title = this.originalTitle;
                }
            }
        });

        window.addEventListener('beforeunload', () => {
            if (this.onHomePage) {
                document.title = '＿＿、大変だ……！';
            }
        });

        window.addEventListener('pagehide', () => {
            if (this.onHomePage) {
                document.title = '＿＿、大変だ……！';
            }
        });
    }

    /**
     * ヘッダータイトルを更新
     * @param {string} page - ページ名
     */
    /**
     * ヘッダータイトルと h1 を直接設定
     * @param {string} title - 設定するタイトル
     */
    setHeaderTitle(title) {
        const headerTitle = document.querySelector('.header-title');
        if (headerTitle) {
            headerTitle.textContent = title;
        }
        
        // Also update the h1 in the page content
        const epArticle = document.querySelector('article[data-page="ep"]');
        if (epArticle) {
            const h1 = epArticle.querySelector('h1');
            if (h1) {
                h1.textContent = title;
            }
        }
    }

    updateHeaderTitle(page) {
        const headerTitle = document.querySelector('.header-title');
        if (!headerTitle) return;

        const pageTypeMap = {
            'home': 'ネ〇くんは大変なものを盗んでいきました',
            'love': '親愛ストーリー',
            'main': 'メインストーリー',
            'event': 'イベントストーリー',
            'lgst': 'ログインストーリー',
            'card': 'カードストーリー',
            'ep': 'エピソード'
        };

        headerTitle.textContent = pageTypeMap[page] || 'ネ〇くんは大変なものを盗んでいきました';
    }

    /**
     * ページタイトル（ブラウザタブタイトル）を更新
     * h2とサブページがある場合は "h2 - [ページタイプ]" 形式を使用; それ以外は h1 または元のタイトルを使用
     */
    updatePageTitle() {
        let newTitle = this.originalTitle;
        const pageTypeMap = {
            'love': '親愛ストーリー',
            'main': 'メインストーリー',
            'event': 'イベントストーリー',
            'lgst': 'ログインストーリー',
            'card': 'カードストーリー',
            'ep': 'エピソード'
        };

        if (this.currentPage !== 'home') {
            const contentSelector = `[data-page="${this.currentPage}"] h2`;
            const h2Element = document.querySelector(contentSelector);

            if (this.currentSubpage && h2Element) {
                const h2Text = h2Element.textContent.trim();
                const pageTypeTitle = pageTypeMap[this.currentPage] || this.originalTitle;
                newTitle = `${h2Text} - ${pageTypeTitle}`;
            } else if (!this.currentSubpage) {
                newTitle = pageTypeMap[this.currentPage] || this.originalTitle;
            }
        }

        document.title = newTitle;
    }

    /**
     * ルート変更を処理
     */
    handleRouteChange() {
        const hash = window.location.hash.substring(1) || 'home';
        const parts = hash.split('/');
        const page = parts[0];
        const subpage = parts.length > 1 ? parts.slice(1).join('/') : null;

        this.currentPage = page;
        this.currentSubpage = subpage || null;

        this.onHomePage = (this.currentPage === 'home' || this.currentPage === 'search');

        this.navigateToPage(this.currentPage, this.currentSubpage);
    }

    /**
     * 指定されたページに移動
     * @param {string} page - ページ名
     * @param {string} subpage - サブページ
     */
    navigateToPage(page, subpage) {
        if (uiManager && typeof uiManager.showPage === 'function') {
            uiManager.showPage(page, subpage);
        } else {
            console.error('[Router] uiManager or showPage method not available');
        }

        // Only update header title if it's not an ep page (ep pages will set their own titles)
        if (page !== 'ep') {
            this.updateHeaderTitle(page);
        }

        switch (page) {
            case 'love':
                if (subpage) {
                    initLoveScenario(parseInt(subpage), () => this.updateTitleAfterLoad());
                } else {
                    this.showLoveCharacterList();
                    setTimeout(() => this.updatePageTitle(), 100);
                }
                break;
            case 'main':
                if (subpage) {
                    const parts = subpage.split('/');
                    if (parts[0] === '1.5' && parts.length === 1) {
                        this.showPart1_5ChapterList();
                    } else if (parts.length === 2) {
                        initMainScenario(parseFloat(parts[0]), parseInt(parts[1]), () => this.updateTitleAfterLoad());
                    }
                } else {
                    this.showMainChapterList();
                }
                setTimeout(() => this.updatePageTitle(), 100);
                break;
            case 'event':
                if (subpage) {
                    initEventScenario(parseInt(subpage), () => this.updateTitleAfterLoad());
                } else {
                    this.showEventList();
                }
                setTimeout(() => this.updatePageTitle(), 100);
                break;
            case 'lgst':
                if (subpage) {
                    initCampaignScenario(parseInt(subpage), () => this.updateTitleAfterLoad());
                } else {
                    this.showCampaignList();
                }
                setTimeout(() => this.updatePageTitle(), 100);
                break;
            case 'card':
                if (subpage) {
                    initCardScenario(parseInt(subpage), () => this.updateTitleAfterLoad());
                } else {
                    showCardList();
                }
                setTimeout(() => this.updatePageTitle(), 100);
                break;
            case 'ep':
                if (subpage) {
                    const parts = subpage.split('/');
                    if (parts[0] === 'spot' && parts[1]) {
                        this.setHeaderTitle('スポットエピソード');
                        initEpSpotScenario(parseInt(parts[1]), () => this.updateTitleAfterLoad());
                    } else if (parts[0] === 'chara' && parts[1]) {
                        this.setHeaderTitle('キャラクターエピソード');
                        initEpCharaScenario(parseInt(parts[1]), () => this.updateTitleAfterLoad());
                    } else if (parts[0] === 'card') {
                        if (parts[1]) {
                            // Show individual card scenario
                            this.setHeaderTitle('カードエピソード');
                            initEpCardScenario(parseInt(parts[1]), () => this.updateTitleAfterLoad());
                        } else {
                            // Show card list
                            this.setHeaderTitle('カードエピソード');
                            this.showEpCardList();
                        }
                    } else if (parts[0] === 'special' && parts[1]) {
                        this.setHeaderTitle('スペシャル');
                        initEpSpecialScenario(parts[1], () => this.updateTitleAfterLoad());
                    }
                } else {
                    this.setHeaderTitle('エピソード');
                    this.showEpMenu();
                }
                setTimeout(() => this.updatePageTitle(), 100);
                break;
            case 'search':
                initSearchUI();
                break;
            case 'home':
                break;
        }
    }

    /**
     * 親愛ストーリーキャラクターリストを表示
     */
    async showLoveCharacterList() {
        const loveContent = document.querySelector('#love-content');
        if (loveContent && uiManager) {
            loveContent.innerHTML = await uiManager.generateLoveCharacterList();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * メインストーリーの章リストを表示
     */
    async showMainChapterList() {
        const mainContent = document.querySelector('#main-content');
        if (mainContent) {
            mainContent.innerHTML = await generateMainChapterList();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * 1.5部の章リストを表示
     */
    showPart1_5ChapterList() {
        const mainContent = document.querySelector('#main-content');
        if (mainContent) {
            mainContent.innerHTML = generatePart1_5ChapterList();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * イベントストーリーリストを表示
     */
    async showEventList() {
        const eventContent = document.querySelector('#event-content');
        if (eventContent) {
            eventContent.innerHTML = await generateEventTopList();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * キャンペーンストーリーリストを表示
     */
    async showCampaignList() {
        const campaignContent = document.querySelector('#campaign-content');
        if (campaignContent) {
            campaignContent.innerHTML = await generateCampaignTopList();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * エピソードメニューを表示
     */
    async showEpMenu() {
        const epContent = document.querySelector('#ep-content');
        if (epContent && uiManager) {
            epContent.innerHTML = await uiManager.generateEpMenu();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * EP カードリストを表示
     */
    async showEpCardList() {
        const epContent = document.querySelector('#ep-content');
        if (epContent && uiManager) {
            epContent.innerHTML = await uiManager.generateEpCardListView();
        }
        if (typeof toc !== 'undefined' && toc) {
            toc.destroy();
            toc.init();
        }
    }

    /**
     * 非同期読み込み完了後にタイトルを更新
     * 非同期読み込み関数から呼び出される
     */
    updateTitleAfterLoad() {
        this.updatePageTitle();
    }
}

let router = null;

/**
 * ルーターを初期化
 */
function initRouter() {
    router = new Router();
    router.init();
}
