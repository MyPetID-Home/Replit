// Authentication and user management system
class AuthManager {
    constructor(app = null) {
        this.app = app;
        this.isAuthenticated = false;
        this.currentUser = null;
        this.patreonToken = null;
        this.authCallbacks = [];
    }

    async init() {
        // Check for existing authentication
        this.loadStoredAuth();
        
        // Set up Patreon OAuth if configured
        this.initializePatreonOAuth();
        
        // Handle OAuth callbacks
        this.handleOAuthCallback();
    }

    loadStoredAuth() {
        try {
            // Load authentication state from localStorage
            const storedAuth = localStorage.getItem('petTracker_auth');
            if (storedAuth) {
                const authData = JSON.parse(storedAuth);
                this.currentUser = authData.user;
                this.patreonToken = authData.patreonToken;
                this.isAuthenticated = authData.isAuthenticated;
                
                // Validate stored authentication
                this.validateStoredAuth();
            }
        } catch (error) {
            console.error('Failed to load stored authentication:', error);
            this.clearAuth();
        }
    }

    async validateStoredAuth() {
        if (!this.patreonToken) return;

        try {
            // Validate Patreon token
            const response = await fetch('https://www.patreon.com/api/oauth2/v2/identity', {
                headers: {
                    'Authorization': `Bearer ${this.patreonToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Invalid Patreon token');
            }

            const userData = await response.json();
            this.updateUserData(userData);
            
        } catch (error) {
            console.error('Authentication validation failed:', error);
            this.clearAuth();
        }
    }

    initializePatreonOAuth() {
        // Only initialize if Patreon client ID is available
        if (!window.app?.config?.patreonClientId) {
            console.log('Patreon OAuth not configured');
            return;
        }

        // Add Patreon login button to UI if needed
        this.addPatreonLoginButton();
    }

    addPatreonLoginButton() {
        const authContainer = document.querySelector('.auth-container');
        if (authContainer && !authContainer.querySelector('.patreon-login')) {
            const patreonButton = document.createElement('button');
            patreonButton.className = 'btn btn-patreon patreon-login';
            patreonButton.innerHTML = `
                <i data-feather="external-link"></i>
                Login with Patreon
            `;
            patreonButton.onclick = () => this.loginWithPatreon();
            
            authContainer.appendChild(patreonButton);
            
            if (window.feather) {
                feather.replace();
            }
        }
    }

    loginWithPatreon() {
        if (!window.app?.config?.patreonClientId) {
            window.app?.showToast('Patreon OAuth not configured', 'error');
            return;
        }

        const clientId = window.app.config.patreonClientId;
        const redirectUri = encodeURIComponent(window.location.origin + '/oauth/patreon');
        const scope = encodeURIComponent('identity identity.memberships');
        const state = this.generateRandomState();
        
        // Store state for validation
        sessionStorage.setItem('patreon_oauth_state', state);
        
        const patreonAuthUrl = `https://www.patreon.com/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${clientId}&` +
            `redirect_uri=${redirectUri}&` +
            `scope=${scope}&` +
            `state=${state}`;

        window.location.href = patreonAuthUrl;
    }

    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            window.app?.showToast('Authentication failed: ' + error, 'error');
            return;
        }

        if (code && state) {
            // Validate state
            const storedState = sessionStorage.getItem('patreon_oauth_state');
            if (state !== storedState) {
                console.error('OAuth state mismatch');
                window.app?.showToast('Authentication failed: Invalid state', 'error');
                return;
            }

            // Exchange code for token
            this.exchangeCodeForToken(code);
        }
    }

    async exchangeCodeForToken(code) {
        try {
            // This would typically be handled by GitHub Actions workflow
            // For client-side, we'll trigger the workflow
            const response = await fetch('/.github/workflows/patreon-oauth.yml', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: code,
                    redirect_uri: window.location.origin + '/oauth/patreon'
                })
            });

            if (response.ok) {
                const tokenData = await response.json();
                await this.handleSuccessfulAuth(tokenData);
            } else {
                throw new Error('Failed to exchange code for token');
            }
        } catch (error) {
            console.error('Token exchange failed:', error);
            window.app?.showToast('Authentication failed: ' + error.message, 'error');
        }
    }

    async handleSuccessfulAuth(tokenData) {
        this.patreonToken = tokenData.access_token;
        
        // Fetch user information
        try {
            const userResponse = await fetch('https://www.patreon.com/api/oauth2/v2/identity?include=memberships', {
                headers: {
                    'Authorization': `Bearer ${this.patreonToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (userResponse.ok) {
                const userData = await userResponse.json();
                this.updateUserData(userData);
                this.isAuthenticated = true;
                
                // Save authentication state
                this.saveAuthState();
                
                // Notify authentication callbacks
                this.notifyAuthCallbacks();
                
                window.app?.showToast('Successfully authenticated with Patreon!', 'success');
                
                // Redirect to appropriate page
                window.router?.navigateTo('/');
            } else {
                throw new Error('Failed to fetch user data');
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
            window.app?.showToast('Authentication partially failed: ' + error.message, 'warning');
        }
    }

    updateUserData(patreonUserData) {
        if (patreonUserData && patreonUserData.data) {
            const user = patreonUserData.data;
            this.currentUser = {
                id: user.id,
                email: user.attributes.email,
                firstName: user.attributes.first_name,
                lastName: user.attributes.last_name,
                fullName: user.attributes.full_name,
                imageUrl: user.attributes.image_url,
                isEmailVerified: user.attributes.is_email_verified,
                patreonId: user.id,
                memberships: this.extractMemberships(patreonUserData.included),
                authenticatedAt: new Date().toISOString()
            };
        }
    }

    extractMemberships(includedData) {
        if (!includedData) return [];
        
        return includedData
            .filter(item => item.type === 'member')
            .map(membership => ({
                id: membership.id,
                patronStatus: membership.attributes.patron_status,
                pledgeRelationshipStart: membership.attributes.pledge_relationship_start,
                lifetimeSupportCents: membership.attributes.lifetime_support_cents,
                currentlyEntitledAmountCents: membership.attributes.currently_entitled_amount_cents
            }));
    }

    saveAuthState() {
        try {
            const authData = {
                user: this.currentUser,
                patreonToken: this.patreonToken,
                isAuthenticated: this.isAuthenticated,
                savedAt: new Date().toISOString()
            };
            
            localStorage.setItem('petTracker_auth', JSON.stringify(authData));
        } catch (error) {
            console.error('Failed to save authentication state:', error);
        }
    }

    clearAuth() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.patreonToken = null;
        
        localStorage.removeItem('petTracker_auth');
        sessionStorage.removeItem('patreon_oauth_state');
        
        this.notifyAuthCallbacks();
    }

    logout() {
        this.clearAuth();
        window.app?.showToast('Successfully logged out', 'success');
        window.router?.navigateTo('/');
    }

    // Utility methods
    generateRandomState() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    onAuthChange(callback) {
        this.authCallbacks.push(callback);
    }

    notifyAuthCallbacks() {
        this.authCallbacks.forEach(callback => {
            try {
                callback(this.isAuthenticated, this.currentUser);
            } catch (error) {
                console.error('Auth callback error:', error);
            }
        });
    }

    // User permission checks
    isPatreonSupporter() {
        if (!this.currentUser || !this.currentUser.memberships) return false;
        
        return this.currentUser.memberships.some(membership => 
            membership.patronStatus === 'active_patron'
        );
    }

    hasMinimumSupport(amountCents) {
        if (!this.currentUser || !this.currentUser.memberships) return false;
        
        return this.currentUser.memberships.some(membership => 
            membership.currentlyEntitledAmountCents >= amountCents
        );
    }

    canAccessPremiumFeatures() {
        return this.isPatreonSupporter() || this.hasMinimumSupport(500); // $5 minimum
    }
}

// Export class for global access
window.PetTrackerAuth = AuthManager;
