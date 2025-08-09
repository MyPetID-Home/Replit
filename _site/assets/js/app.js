// Main application initialization and global state management
class PetTrackerApp {
    constructor() {
        this.currentUser = null;
        this.nfcTagId = null;
        this.isInitialized = false;
        this.config = {
            apiBaseUrl: window.location.origin,
            githubRepo: this.getGithubRepo(),
            patreonClientId: this.getEnvVar('PATREON_CLIENT_ID'),
            mongodbConnectionString: this.getEnvVar('MONGODB_CONNECTION_STRING')
        };
        
        this.init();
    }

    getEnvVar(name, fallback = null) {
        // In a Jekyll/GitHub Pages environment, these would be set via GitHub secrets
        return window.env?.[name] || fallback;
    }

    getGithubRepo() {
        // Extract GitHub repo from current URL or environment
        const currentUrl = window.location.href;
        const githubMatch = currentUrl.match(/github\.io\/([^\/]+)/);
        return githubMatch ? githubMatch[1] : 'pet-tracker';
    }

    async init() {
        try {
            console.log('Starting app initialization...');
            this.showLoading(true);
            
            // Initialize authentication module
            console.log('Checking for PetTrackerAuth:', !!window.PetTrackerAuth);
            if (window.PetTrackerAuth) {
                this.auth = new window.PetTrackerAuth(this);
                console.log('Auth instance created:', !!this.auth);
                if (this.auth && typeof this.auth.init === 'function') {
                    console.log('Calling auth.init()...');
                    await this.auth.init();
                    console.log('Auth initialized successfully');
                }
            } else {
                console.warn('PetTrackerAuth not available, skipping auth initialization');
            }
            
            // Initialize router module
            console.log('Checking for PetTrackerRouter:', !!window.PetTrackerRouter);
            if (window.PetTrackerRouter) {
                this.router = new window.PetTrackerRouter(this);
                console.log('Router instance created:', !!this.router);
                if (this.router && typeof this.router.init === 'function') {
                    console.log('Calling router.init()...');
                    await this.router.init();
                    console.log('Router initialized successfully');
                }
            } else {
                console.warn('PetTrackerRouter not available, skipping router initialization');
            }
            
            // Check for NFC tag in URL or localStorage
            console.log('Initializing NFC tag...');
            this.initializeNFCTag();
            
            // Initialize device detection
            console.log('Initializing device detection...');
            this.initializeDeviceDetection();
            
            // Set up global event listeners
            console.log('Setting up event listeners...');
            this.setupGlobalEventListeners();
            
            this.isInitialized = true;
            this.showLoading(false);
            
            console.log('Application initialized successfully!');
            this.showToast('Application initialized successfully', 'success');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showToast('Failed to initialize application: ' + error.message, 'error');
            this.showLoading(false);
        }
    }

    initializeNFCTag() {
        // Check URL parameters for NFC tag ID
        const urlParams = new URLSearchParams(window.location.search);
        const tagId = urlParams.get('nfc') || urlParams.get('tag') || urlParams.get('dogId');
        
        if (tagId) {
            this.setNFCTag(tagId);
        } else {
            // Check localStorage for previously stored tag
            const storedTag = localStorage.getItem('petTracker_nfcTag');
            if (storedTag) {
                this.setNFCTag(storedTag);
            }
        }
    }

    setNFCTag(tagId) {
        this.nfcTagId = tagId;
        localStorage.setItem('petTracker_nfcTag', tagId);
        
        // Update navigation to show tag-specific options
        this.updateNavigationForTag(tagId);
        
        // Load user-specific data
        this.loadUserData(tagId);
        
        this.showToast(`Connected to pet tracker: ${tagId}`, 'success');
    }

    async loadUserData(tagId) {
        try {
            // Try to load user data from GitHub Pages data structure
            const response = await fetch(`/data/users/${tagId}/profile.json`);
            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                this.updateUIForUser(userData);
            } else {
                // Create new user data structure
                await this.createUserDataStructure(tagId);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            // Fallback to creating new user structure
            await this.createUserDataStructure(tagId);
        }
    }

    async createUserDataStructure(tagId) {
        const defaultUserData = {
            tagId: tagId,
            createdAt: new Date().toISOString(),
            petName: '',
            ownerName: '',
            contactInfo: {},
            medicalInfo: {},
            location: {
                lastKnown: null,
                history: []
            },
            preferences: {
                notifications: true,
                trackingEnabled: true
            }
        };

        this.currentUser = defaultUserData;
        
        // Create GitHub issue for new tag registration
        await this.createGitHubIssue('New Pet Tracker Registration', 
            `New NFC tag registered: ${tagId}\n\nCreated at: ${new Date().toISOString()}`, 
            ['new-registration', `tag-${tagId}`]);
    }

    updateNavigationForTag(tagId) {
        const navElement = document.querySelector('.nav-tag-info');
        if (navElement) {
            navElement.textContent = `Tag: ${tagId}`;
            navElement.style.display = 'block';
        }
    }

    updateUIForUser(userData) {
        // Update any global UI elements based on user data
        document.body.classList.add('user-authenticated');
        
        // Update page title if pet name is available
        if (userData.petName) {
            document.title = `${userData.petName} - Pet Tracker`;
        }
    }

    initializeDeviceDetection() {
        // Detect if running on mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        document.body.classList.toggle('mobile-device', isMobile);
        
        // Detect if Tasker integration is available
        const isTasker = navigator.userAgent.includes('Tasker');
        document.body.classList.toggle('tasker-integration', isTasker);
        
        // Check for NFC capabilities
        if ('NDEFReader' in window) {
            document.body.classList.add('nfc-capable');
            this.initializeNFCReader();
        }
    }

    async initializeNFCReader() {
        try {
            const ndef = new NDEFReader();
            await ndef.scan();
            
            ndef.addEventListener('reading', ({ message, serialNumber }) => {
                console.log('NFC tag detected:', serialNumber);
                this.setNFCTag(serialNumber);
            });
            
            this.showToast('NFC reader initialized', 'success');
        } catch (error) {
            console.error('NFC initialization failed:', error);
        }
    }

    setupGlobalEventListeners() {
        // Handle navigation toggle for mobile
        const navToggle = document.querySelector('.nav-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        if (navToggle && navLinks) {
            navToggle.addEventListener('click', () => {
                navLinks.classList.toggle('show');
            });
        }

        // Handle modal close on overlay click
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.hideModal();
                }
            });
        }

        // Handle escape key for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });

        // Handle Tasker integration events
        window.addEventListener('message', (event) => {
            if (event.origin === 'tasker://') {
                this.handleTaskerMessage(event.data);
            }
        });
    }

    handleTaskerMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'location_update':
                    this.handleLocationUpdate(message.data);
                    break;
                case 'nfc_scan':
                    this.setNFCTag(message.data.tagId);
                    break;
                case 'emergency':
                    this.handleEmergency(message.data);
                    break;
                default:
                    console.log('Unknown Tasker message type:', message.type);
            }
        } catch (error) {
            console.error('Failed to parse Tasker message:', error);
        }
    }

    async handleLocationUpdate(locationData) {
        if (!this.nfcTagId) {
            console.error('No NFC tag ID available for location update');
            return;
        }

        const locationUpdate = {
            tagId: this.nfcTagId,
            timestamp: new Date().toISOString(),
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            source: 'tasker'
        };

        // Create GitHub issue for location update
        await this.createGitHubIssue(
            `Location Update - ${this.nfcTagId}`,
            `Location updated for pet tracker ${this.nfcTagId}\n\n` +
            `Latitude: ${locationData.latitude}\n` +
            `Longitude: ${locationData.longitude}\n` +
            `Accuracy: ${locationData.accuracy}m\n` +
            `Timestamp: ${locationUpdate.timestamp}`,
            ['location-update', `tag-${this.nfcTagId}`]
        );

        // Update local data
        if (this.currentUser) {
            this.currentUser.location.lastKnown = locationUpdate;
            this.currentUser.location.history.push(locationUpdate);
        }

        this.showToast('Location updated successfully', 'success');
    }

    async handleEmergency(emergencyData) {
        if (!this.nfcTagId) {
            console.error('No NFC tag ID available for emergency');
            return;
        }

        // Create high-priority GitHub issue for emergency
        await this.createGitHubIssue(
            `🚨 EMERGENCY - ${this.nfcTagId}`,
            `EMERGENCY ALERT for pet tracker ${this.nfcTagId}\n\n` +
            `Type: ${emergencyData.type}\n` +
            `Details: ${emergencyData.details || 'No additional details'}\n` +
            `Location: ${emergencyData.location || 'Location not available'}\n` +
            `Timestamp: ${new Date().toISOString()}`,
            ['emergency', 'high-priority', `tag-${this.nfcTagId}`]
        );

        this.showToast('Emergency alert sent!', 'warning');
    }

    async createGitHubIssue(title, body, labels = []) {
        try {
            // This would normally use GitHub Actions workflow dispatch
            // For now, we'll use the GitHub API if available
            const response = await fetch(`/.github/workflows/create-nfc-issue.yml`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    body,
                    labels,
                    tagId: this.nfcTagId
                })
            });

            if (response.ok) {
                console.log('GitHub issue created successfully');
            } else {
                throw new Error('Failed to create GitHub issue');
            }
        } catch (error) {
            console.error('Failed to create GitHub issue:', error);
            // Fallback: log to console for manual processing
            console.log('Issue to create:', { title, body, labels, tagId: this.nfcTagId });
        }
    }

    // UI Helper Methods
    showLoading(show = true) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.toggle('show', show);
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                    <i data-feather="x"></i>
                </button>
            </div>
        `;

        toastContainer.appendChild(toast);
        feather.replace();

        // Auto-remove toast after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }

    showModal(content, title = '') {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        
        if (!modalOverlay || !modalContent) return;

        modalContent.innerHTML = `
            ${title ? `<div class="modal-header">
                <h2>${title}</h2>
                <button class="btn-close" onclick="app.hideModal()">
                    <i data-feather="x"></i>
                </button>
            </div>` : ''}
            <div class="modal-body">
                ${content}
            </div>
        `;

        modalOverlay.classList.add('show');
        feather.replace();
    }

    hideModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance
    window.app = new PetTrackerApp();
});
