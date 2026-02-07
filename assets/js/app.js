/**
 * Application entry point
 * Initialize all modules and event listeners
 */

/**
 * Initialize application
 */
function initApp() {
    initTemplateManager();
    initUIManager();
    initRouter();
    initSearch();  // Start background data loading
}

/**
 * Start application when DOM loading is complete
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
