// Enhanced routing system for folder-based pages
class Router {
    constructor(app = null) {
        this.app = app;
        this.routes = new Map();
        this.currentPage = null;
        this.basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
        this.pageCache = new Map();
        
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Define available routes and their configurations
        this.routes.set('/', {
            path: '/pages/home/',
            title: 'Dashboard',
            icon: 'home',
            requiresAuth: false
        });
        
        this.routes.set('/home', {
            path: '/pages/home/',
            title: 'Dashboard',
            icon: 'home',
            requiresAuth: false
        });
        
        this.routes.set('/contact', {
            path: '/pages/contact/',
            title: 'Contact Information',
            icon: 'user',
            requiresAuth: true
        });
        
        this.routes.set('/location', {
            path: '/pages/location/',
            title: 'Location Tracking',
            icon: 'map-pin',
            requiresAuth: true
        });
        
        this.routes.set('/medical', {
            path: '/pages/medical/',
            title: 'Medical Information',
            icon: 'heart',
            requiresAuth: true
        });
    }

    async init() {
        // Set up navigation event listeners
        this.setupNavigationListeners();
        
        // Handle initial route
        const initialRoute = this.getCurrentRoute();
        await this.navigateTo(initialRoute);
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            const route = event.state?.route || this.getCurrentRoute();
            this.navigateTo(route, false);
        });
    }

    getCurrentRoute() {
        const path = window.location.pathname;
        const hash = window.location.hash.replace('#', '');
        
        // Check if hash contains a route
        if (hash && this.routes.has('/' + hash)) {
            return '/' + hash;
        }
        
        // Check if path contains a route
        for (const [route] of this.routes) {
            if (path.includes(route.replace('/', ''))) {
                return route;
            }
        }
        
        // Default to home
        return '/';
    }

    setupNavigationListeners() {
        // Handle navigation clicks
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[data-route]');
            if (link) {
                event.preventDefault();
                const route = link.getAttribute('data-route');
                this.navigateTo(route);
            }
        });
        
        // Handle form submissions that should navigate
        document.addEventListener('submit', (event) => {
            const form = event.target.closest('form[data-route]');
            if (form) {
                event.preventDefault();
                const route = form.getAttribute('data-route');
                this.navigateTo(route);
            }
        });
    }

    async navigateTo(route, updateHistory = true) {
        try {
            // Validate route
            if (!this.routes.has(route)) {
                console.error('Route not found:', route);
                route = '/'; // Fallback to home
            }

            const routeConfig = this.routes.get(route);
            
            // Check authentication requirements
            if (routeConfig.requiresAuth && !window.app?.nfcTagId) {
                this.showAuthRequired();
                return;
            }

            // Show loading state
            window.app?.showLoading(true);

            // Load page content
            const pageContent = await this.loadPage(routeConfig.path);
            
            // Update page container
            const mainContent = document.getElementById('main-content') || document.getElementById('app-main');
            if (mainContent) {
                mainContent.innerHTML = pageContent.html;
                
                // Update page title
                document.title = `${routeConfig.title} - Pet Tracker`;
                
                // Update navigation active state
                this.updateNavigationState(route);
                
                // Load page-specific CSS
                if (pageContent.css) {
                    this.loadPageCSS(pageContent.css, route);
                }
                
                // Execute page-specific JavaScript
                if (pageContent.js) {
                    await this.executePageJS(pageContent.js, route);
                }
                
                // Update browser history
                if (updateHistory) {
                    const url = new URL(window.location);
                    url.hash = route.substring(1);
                    window.history.pushState({ route }, routeConfig.title, url);
                }
                
                this.currentPage = route;
            }

            // Hide loading state
            window.app?.showLoading(false);
            
        } catch (error) {
            console.error('Navigation failed:', error);
            window.app?.showToast('Failed to load page: ' + error.message, 'error');
            window.app?.showLoading(false);
        }
    }

    async loadPage(pagePath) {
        // Check cache first
        if (this.pageCache.has(pagePath)) {
            return this.pageCache.get(pagePath);
        }

        try {
            // Load page HTML
            const htmlResponse = await fetch(`${pagePath}page.html`);
            if (!htmlResponse.ok) {
                throw new Error(`Failed to load page HTML: ${htmlResponse.status}`);
            }
            const html = await htmlResponse.text();

            // Try to load page CSS (optional)
            let css = '';
            try {
                const cssResponse = await fetch(`${pagePath}page.css`);
                if (cssResponse.ok) {
                    css = await cssResponse.text();
                }
            } catch (error) {
                console.log('No custom CSS for page:', pagePath);
            }

            // Try to load page JavaScript (optional)
            let js = '';
            try {
                const jsResponse = await fetch(`${pagePath}page.js`);
                if (jsResponse.ok) {
                    js = await jsResponse.text();
                }
            } catch (error) {
                console.log('No custom JavaScript for page:', pagePath);
            }

            const pageContent = { html, css, js };
            
            // Cache the page content
            this.pageCache.set(pagePath, pageContent);
            
            return pageContent;
            
        } catch (error) {
            console.error('Failed to load page:', error);
            
            // Return error page content
            return {
                html: `
                    <div class="error-page">
                        <div class="error-content">
                            <h1><i data-feather="alert-triangle"></i> Page Not Found</h1>
                            <p>The requested page could not be loaded.</p>
                            <button class="btn btn-primary" onclick="router.navigateTo('/')">
                                <i data-feather="home"></i>
                                Go Home
                            </button>
                        </div>
                    </div>
                `,
                css: `
                    .error-page {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 60vh;
                        text-align: center;
                    }
                    .error-content h1 {
                        color: var(--danger-color);
                        margin-bottom: 1rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                    }
                `,
                js: ''
            };
        }
    }

    loadPageCSS(css, route) {
        // Remove existing page-specific CSS
        const existingStyle = document.getElementById('page-specific-css');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Add new page-specific CSS
        if (css.trim()) {
            const style = document.createElement('style');
            style.id = 'page-specific-css';
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    async executePageJS(js, route) {
        try {
            // Create a new function scope for the page JavaScript
            const pageFunction = new Function('app', 'router', 'route', js);
            await pageFunction(window.app, this, route);
        } catch (error) {
            console.error('Error executing page JavaScript:', error);
        }
    }

    updateNavigationState(currentRoute) {
        // Update navigation links active state
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const route = link.getAttribute('data-route');
            link.classList.toggle('active', route === currentRoute);
        });
    }

    showAuthRequired() {
        const authContent = `
            <div class="auth-required">
                <div class="auth-content">
                    <h2><i data-feather="lock"></i> Authentication Required</h2>
                    <p>Please scan your pet's NFC tag or enter the tag ID to continue.</p>
                    
                    <form class="auth-form" onsubmit="router.handleManualAuth(event)">
                        <div class="form-group">
                            <label class="form-label" for="tagId">NFC Tag ID:</label>
                            <input type="text" id="tagId" name="tagId" class="form-input" 
                                   placeholder="Enter your pet's NFC tag ID" required>
                        </div>
                        <button type="submit" class="btn btn-primary">
                            <i data-feather="tag"></i>
                            Connect to Pet Tracker
                        </button>
                    </form>
                    
                    <div class="auth-help">
                        <p>Don't have an NFC tag? <a href="#contact" data-route="/contact">Contact us</a> to get started.</p>
                    </div>
                </div>
            </div>
        `;

        const mainContent = document.getElementById('main-content') || document.getElementById('app-main');
        if (mainContent) {
            mainContent.innerHTML = authContent;
        }

        // Initialize feather icons
        if (window.feather) {
            feather.replace();
        }
    }

    handleManualAuth(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const tagId = formData.get('tagId');
        
        if (tagId && window.app) {
            window.app.setNFCTag(tagId);
            // Navigate to the originally requested route or home
            this.navigateTo(this.currentPage || '/');
        }
    }

    // Utility methods for navigation
    goBack() {
        window.history.back();
    }

    goForward() {
        window.history.forward();
    }

    refresh() {
        // Clear page cache and reload current page
        if (this.currentPage) {
            const routeConfig = this.routes.get(this.currentPage);
            if (routeConfig) {
                this.pageCache.delete(routeConfig.path);
                this.navigateTo(this.currentPage, false);
            }
        }
    }

    getRouteInfo(route) {
        return this.routes.get(route);
    }

    getAllRoutes() {
        return Array.from(this.routes.entries()).map(([route, config]) => ({
            route,
            ...config
        }));
    }
}

// Export class for global access
window.PetTrackerRouter = Router;
