// Home page functionality
window.homePage = {
    isInitialized: false,
    activityRefreshInterval: null,

    init() {
        if (this.isInitialized) return;
        
        console.log('Initializing home page');
        
        // Load pet information if NFC tag is connected
        this.loadPetInformation();
        
        // Load recent activity
        this.loadRecentActivity();
        
        // Set up periodic refresh
        this.setupPeriodicRefresh();
        
        // Initialize status updates
        this.updatePetStatus();
        
        this.isInitialized = true;
    },

    async loadPetInformation() {
        const petInfoElement = document.getElementById('pet-info');
        const connectionPrompt = document.getElementById('connection-prompt');
        
        if (!app.nfcTagId) {
            // Show connection prompt
            if (connectionPrompt) {
                connectionPrompt.style.display = 'block';
            }
            return;
        }

        // Hide connection prompt
        if (connectionPrompt) {
            connectionPrompt.style.display = 'none';
        }

        try {
            if (app.currentUser && petInfoElement) {
                const petInfo = `
                    <div class="pet-details">
                        <h3>${app.currentUser.petName || 'Pet'}</h3>
                        <p><strong>Tag ID:</strong> ${app.nfcTagId}</p>
                        <p><strong>Owner:</strong> ${app.currentUser.ownerName || 'Not specified'}</p>
                        <p><strong>Registered:</strong> ${utils.formatDate(app.currentUser.createdAt)}</p>
                    </div>
                `;
                petInfoElement.innerHTML = petInfo;
            }
        } catch (error) {
            console.error('Failed to load pet information:', error);
            if (petInfoElement) {
                petInfoElement.innerHTML = '<p class="text-danger">Failed to load pet information</p>';
            }
        }
    },

    async loadRecentActivity() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        try {
            if (app.currentUser && app.currentUser.location && app.currentUser.location.history) {
                const recentActivities = app.currentUser.location.history
                    .slice(-5) // Last 5 activities
                    .reverse()
                    .map(activity => `
                        <div class="activity-item">
                            <div class="activity-icon">
                                <i data-feather="map-pin"></i>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">Location Updated</div>
                                <div class="activity-details">
                                    ${utils.formatCoordinates(activity.latitude, activity.longitude, 4)}
                                </div>
                                <div class="activity-time">${utils.formatTimeAgo(activity.timestamp)}</div>
                            </div>
                        </div>
                    `).join('');

                if (recentActivities) {
                    activityList.innerHTML = recentActivities;
                    feather.replace();
                } else {
                    activityList.innerHTML = '<p class="text-muted">No recent activity</p>';
                }
            } else {
                activityList.innerHTML = '<p class="text-muted">No recent activity</p>';
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            activityList.innerHTML = '<p class="text-danger">Failed to load activity</p>';
        }
    },

    updatePetStatus() {
        const statusElement = document.getElementById('pet-status');
        if (!statusElement) return;

        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');

        if (!app.nfcTagId) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Disconnected';
            return;
        }

        // Check last activity time
        const lastActivity = app.currentUser?.location?.lastKnown?.timestamp;
        if (lastActivity) {
            const timeSinceLastActivity = Date.now() - new Date(lastActivity).getTime();
            const hoursAgo = timeSinceLastActivity / (1000 * 60 * 60);

            if (hoursAgo < 1) {
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Active';
            } else if (hoursAgo < 6) {
                statusDot.className = 'status-dot warning';
                statusText.textContent = 'Recently Active';
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Inactive';
            }
        } else {
            statusDot.className = 'status-dot unknown';
            statusText.textContent = 'Unknown';
        }
    },

    async updateLocation() {
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        app.showLoading(true);

        try {
            // Get current location
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                });
            });

            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            // Update location through app
            await app.handleLocationUpdate(locationData);

            // Refresh the page data
            this.loadRecentActivity();
            this.updatePetStatus();
            this.loadLocationSummary();

            app.showToast('Location updated successfully!', 'success');
        } catch (error) {
            console.error('Failed to update location:', error);
            
            let errorMessage = 'Failed to update location';
            if (error.code === 1) {
                errorMessage = 'Location access denied. Please enable location services.';
            } else if (error.code === 2) {
                errorMessage = 'Location unavailable. Please try again.';
            } else if (error.code === 3) {
                errorMessage = 'Location request timed out. Please try again.';
            }
            
            app.showToast(errorMessage, 'error');
        } finally {
            app.showLoading(false);
        }
    },

    async reportEmergency() {
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        const emergencyContent = `
            <div class="emergency-form">
                <h3>🚨 Emergency Alert</h3>
                <p>Please provide details about the emergency:</p>
                
                <form onsubmit="homePage.submitEmergency(event)">
                    <div class="form-group">
                        <label class="form-label">Emergency Type:</label>
                        <select name="type" class="form-select" required>
                            <option value="">Select emergency type</option>
                            <option value="lost">Pet is Lost</option>
                            <option value="injured">Pet is Injured</option>
                            <option value="sick">Pet is Sick</option>
                            <option value="found">Found Someone's Pet</option>
                            <option value="other">Other Emergency</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Details:</label>
                        <textarea name="details" class="form-textarea" 
                                  placeholder="Provide additional details about the situation..."
                                  rows="4"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="includeLocation" checked>
                            Include current location
                        </label>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-danger">
                            <i data-feather="alert-triangle"></i>
                            Send Emergency Alert
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="app.hideModal()">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        app.showModal(emergencyContent);
        feather.replace();
    },

    async submitEmergency(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const emergencyData = {
            type: formData.get('type'),
            details: formData.get('details'),
            includeLocation: formData.get('includeLocation') === 'on'
        };

        app.showLoading(true);

        try {
            // Get location if requested
            if (emergencyData.includeLocation) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000
                        });
                    });
                    
                    emergencyData.location = `${position.coords.latitude}, ${position.coords.longitude}`;
                } catch (locationError) {
                    console.error('Failed to get location for emergency:', locationError);
                    emergencyData.location = 'Location unavailable';
                }
            }

            // Handle emergency through app
            await app.handleEmergency(emergencyData);

            app.hideModal();
            app.showToast('Emergency alert sent successfully!', 'success');
        } catch (error) {
            console.error('Failed to send emergency alert:', error);
            app.showToast('Failed to send emergency alert: ' + error.message, 'error');
        } finally {
            app.showLoading(false);
        }
    },

    async scanNFC() {
        if (!utils.hasNFCSupport()) {
            app.showToast('NFC is not supported on this device', 'warning');
            return;
        }

        try {
            app.showToast('Hold your device near the NFC tag...', 'info');
            
            const ndef = new NDEFReader();
            await ndef.scan();
            
            ndef.addEventListener('reading', ({ message, serialNumber }) => {
                console.log('NFC tag detected:', serialNumber);
                app.setNFCTag(serialNumber);
                this.loadPetInformation();
                this.updatePetStatus();
            });
        } catch (error) {
            console.error('NFC scan failed:', error);
            app.showToast('NFC scan failed: ' + error.message, 'error');
        }
    },

    handleManualEntry(event) {
        event.preventDefault();
        
        const input = event.target.querySelector('input');
        const tagId = input.value.trim();
        
        if (!utils.isValidNFCTag(tagId)) {
            app.showToast('Please enter a valid NFC tag ID', 'error');
            return;
        }

        app.setNFCTag(tagId);
        this.loadPetInformation();
        this.updatePetStatus();
        
        // Clear the input
        input.value = '';
    },

    async loadLocationSummary() {
        const locationSummary = document.getElementById('location-summary');
        if (!locationSummary) return;

        try {
            const lastLocation = app.currentUser?.location?.lastKnown;
            
            if (lastLocation) {
                const address = await utils.getAddressFromCoordinates(
                    lastLocation.latitude, 
                    lastLocation.longitude
                );
                
                locationSummary.innerHTML = `
                    <div class="location-details">
                        <p><strong>Coordinates:</strong> ${utils.formatCoordinates(lastLocation.latitude, lastLocation.longitude, 4)}</p>
                        <p><strong>Address:</strong> ${address}</p>
                        <p><strong>Last Updated:</strong> ${utils.formatTimeAgo(lastLocation.timestamp)}</p>
                        <p><strong>Accuracy:</strong> ±${lastLocation.accuracy}m</p>
                    </div>
                `;
            } else {
                locationSummary.innerHTML = '<p class="text-muted">No location data available</p>';
            }
        } catch (error) {
            console.error('Failed to load location summary:', error);
            locationSummary.innerHTML = '<p class="text-danger">Failed to load location data</p>';
        }
    },

    setupPeriodicRefresh() {
        // Refresh activity every 30 seconds
        this.activityRefreshInterval = setInterval(() => {
            this.loadRecentActivity();
            this.updatePetStatus();
            this.loadLocationSummary();
        }, 30000);
    },

    refreshActivity() {
        this.loadRecentActivity();
        this.loadLocationSummary();
        this.updatePetStatus();
        app.showToast('Activity refreshed', 'success');
    },

    destroy() {
        // Cleanup when leaving the page
        if (this.activityRefreshInterval) {
            clearInterval(this.activityRefreshInterval);
            this.activityRefreshInterval = null;
        }
        this.isInitialized = false;
    }
};

// Initialize the page
homePage.init();
