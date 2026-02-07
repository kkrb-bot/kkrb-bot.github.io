/**
 * Template Manager
 * A lightweight template loader and renderer
 */

class TemplateManager {
    constructor() {
        this.templates = new Map();
        this.templatePath = 'assets/templates/';
    }

    /**
     * Load a template file
     * @param {string} templateName - Template file name (without extension)
     * @returns {Promise<string>} Template content
     */
    async loadTemplate(templateName) {
        // Return cached template if available
        if (this.templates.has(templateName)) {
            return this.templates.get(templateName);
        }

        try {
            const response = await fetch(`${this.templatePath}${templateName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${templateName}`);
            }
            const template = await response.text();
            this.templates.set(templateName, template);
            return template;
        } catch (error) {
            console.error(`Error loading template ${templateName}:`, error);
            return '';
        }
    }

    /**
     * Render a template with data (supports nested sections)
     * @param {string} template - Template string
     * @param {Object} data - Data object for rendering
     * @returns {string} Rendered HTML
     */
    render(template, data) {
        let result = template;
        let maxIterations = 10; // Prevent infinite loops
        let iteration = 0;

        // Handle sections (loops) recursively until no more sections remain
        while (/\{\{#(\w+)\}\}/.test(result) && iteration < maxIterations) {
            result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
                const items = data[key];
                
                // Handle arrays - loop through items
                if (Array.isArray(items)) {
                    return items.map(item => {
                        // Recursively render nested sections
                        return this.render(content, item);
                    }).join('');
                }
                
                // Handle truthy values (booleans, strings, objects, etc.)
                if (items) {
                    return this.render(content, data);
                }
                
                // Falsy values - return empty string
                return '';
            });
            iteration++;
        }

        // Handle simple variable substitutions
        result = this.renderSimple(result, data);

        return result;
    }

    /**
     * Render simple variable substitutions (no sections)
     * @param {string} template - Template string
     * @param {Object} data - Data object
     * @returns {string} Rendered string
     */
    renderSimple(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data.hasOwnProperty(key) ? data[key] : '';
        });
    }

    /**
     * Load and render a template in one call
     * @param {string} templateName - Template file name (without extension)
     * @param {Object} data - Data object for rendering
     * @returns {Promise<string>} Rendered HTML
     */
    async renderTemplate(templateName, data) {
        const template = await this.loadTemplate(templateName);
        return this.render(template, data);
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templates.clear();
    }

    /**
     * Clear specific template from cache
     * @param {string} templateName - Template file name to clear
     */
    clearTemplate(templateName) {
        this.templates.delete(templateName);
    }
}

// Create global instance
let templateManager = null;

/**
 * Initialize Template Manager
 */
function initTemplateManager() {
    templateManager = new TemplateManager();
}
