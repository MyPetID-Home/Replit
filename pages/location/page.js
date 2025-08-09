// Location page functionality
window.locationPage = {
    isInitialized: false,
    map: null,
    currentMarker: null,
    historyMarkers: [],
    geofences: [],
    locationHistory: [],
    watchId: null,
    refreshInterval: null,

    init() {
        if (this.isInitialized) return;
        
        console.log('Initializing location page');
        
        // Load location data
        this.loadLocationData();
        
        // Load geofences
        this.loadGeofences();
        
        // Update status and analytics
        this.updateLocationStatus();
        this.updateAnalytics();
        
        // Set up periodic updates
        this.setupPeriodicUpdates();
        
        this.isInitialized = true;
    },

    async loadLocationData() {
        try {
            if (!app.nfcTagId) {
                document.getElementById('current-location-info').innerHTML = 
                    '<p class="text-warning">Please connect your pet tracker first</p>';
                return;
            }

            // Load from app.currentUser or localStorage
            const locationData = app.currentUser?.location || 
                               utils.loadFromLocalStorage(`petTracker_location_${app.nfcTagId}`, {
                                   lastKnown: null,
                                   history: []
                               });

            this.locationHistory = locationData.history || [];
            
            if (locationData.lastKnown) {
                this.displayCurrentLocation(locationData.lastKnown);
            }
            
            this.displayLocationHistory();
            
        } catch (error) {
            console.error('Failed to load location data:', error);
            app.showToast('Failed to load location data', 'error');
        }
    },

    displayCurrentLocation(location) {
        const infoElement = document.getElementById('current-location-info');
        if (!infoElement) return;

        const accuracy = location.accuracy ? `±${Math.round(location.accuracy)}m` : 'Unknown';
        const timeAgo = utils.formatTimeAgo(location.timestamp);

        infoElement.innerHTML = `
            <div class="current-location-details">
                <div class="location-detail">
                    <strong>Coordinates:</strong>
                    <span>${utils.formatCoordinates(location.latitude, location.longitude, 6)}</span>
                </div>
                <div class="location-detail">
                    <strong>Accuracy:</strong>
                    <span>${accuracy}</span>
                </div>
                <div class="location-detail">
                    <strong>Last Updated:</strong>
                    <span>${timeAgo}</span>
                </div>
                <div class="location-detail">
                    <strong>Source:</strong>
                    <span class="source-${location.source || 'unknown'}">${location.source || 'Unknown'}</span>
                </div>
                <div class="location-actions">
                    <button class="btn btn-sm btn-outline" onclick="locationPage.getAddressForLocation(${location.latitude}, ${location.longitude})">
                        <i data-feather="map-pin"></i>
                        Get Address
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="locationPage.openInMaps(${location.latitude}, ${location.longitude})">
                        <i data-feather="external-link"></i>
                        Open in Maps
                    </button>
                </div>
            </div>
        `;

        feather.replace();
    },

    displayLocationHistory() {
        const historyElement = document.getElementById('location-history');
        if (!historyElement) return;

        if (!this.locationHistory || this.locationHistory.length === 0) {
            historyElement.innerHTML = '<p class="text-muted">No location history available</p>';
            return;
        }

        // Show last 5 locations
        const recentLocations = this.locationHistory.slice(-5).reverse();
        
        const historyHtml = recentLocations.map(location => `
            <div class="history-item">
                <div class="history-icon">
                    <i data-feather="map-pin"></i>
                </div>
                <div class="history-content">
                    <div class="history-coordinates">${utils.formatCoordinates(location.latitude, location.longitude, 4)}</div>
                    <div class="history-time">${utils.formatTimeAgo(location.timestamp)}</div>
                    <div class="history-accuracy">±${Math.round(location.accuracy || 0)}m</div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-outline" onclick="locationPage.showLocationOnMap(${location.latitude}, ${location.longitude})">
                        <i data-feather="eye"></i>
                    </button>
                </div>
            </div>
        `).join('');

        historyElement.innerHTML = historyHtml;
        feather.replace();
    },

    updateLocationStatus() {
        const statusElement = document.getElementById('location-status');
        if (!statusElement) return;

        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');

        if (!app.nfcTagId) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Disconnected';
            return;
        }

        const lastLocation = this.locationHistory[this.locationHistory.length - 1];
        if (!lastLocation) {
            statusDot.className = 'status-dot unknown';
            statusText.textContent = 'No Data';
            return;
        }

        const timeSinceUpdate = Date.now() - new Date(lastLocation.timestamp).getTime();
        const minutesAgo = timeSinceUpdate / (1000 * 60);

        if (minutesAgo < 5) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Live';
        } else if (minutesAgo < 30) {
            statusDot.className = 'status-dot warning';
            statusText.textContent = 'Recent';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Stale';
        }
    },

    updateAnalytics() {
        // Calculate total distance
        let totalDistance = 0;
        if (this.locationHistory.length > 1) {
            for (let i = 1; i < this.locationHistory.length; i++) {
                const prev = this.locationHistory[i - 1];
                const curr = this.locationHistory[i];
                const distance = utils.calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
                if (distance) totalDistance += distance;
            }
        }

        // Locations today
        const today = new Date().toDateString();
        const locationsToday = this.locationHistory.filter(location => 
            new Date(location.timestamp).toDateString() === today
        ).length;

        // Last update
        const lastLocation = this.locationHistory[this.locationHistory.length - 1];
        const lastUpdate = lastLocation ? utils.formatTimeAgo(lastLocation.timestamp) : '--';

        // Average accuracy
        const accuracies = this.locationHistory.map(l => l.accuracy).filter(a => a);
        const avgAccuracy = accuracies.length > 0 ? 
            `±${Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)}m` : '--';

        // Update UI
        document.getElementById('total-distance').textContent = utils.formatDistance(totalDistance);
        document.getElementById('locations-today').textContent = locationsToday.toString();
        document.getElementById('last-update').textContent = lastUpdate;
        document.getElementById('location-accuracy').textContent = avgAccuracy;
    },

    async updateCurrentLocation() {
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        app.showLoading(true);

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 60000
                });
            });

            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString(),
                source: 'manual'
            };

            // Add to history
            this.locationHistory.push(locationData);

            // Update app data
            if (app.currentUser) {
                app.currentUser.location = app.currentUser.location || {};
                app.currentUser.location.lastKnown = locationData;
                app.currentUser.location.history = this.locationHistory;
            }

            // Save to localStorage
            utils.saveToLocalStorage(`petTracker_location_${app.nfcTagId}`, {
                lastKnown: locationData,
                history: this.locationHistory
            });

            // Update UI
            this.displayCurrentLocation(locationData);
            this.displayLocationHistory();
            this.updateLocationStatus();
            this.updateAnalytics();

            // Create GitHub issue
            await app.createGitHubIssue(
                `Location Update - ${app.nfcTagId}`,
                `Manual location update for pet tracker ${app.nfcTagId}\n\n` +
                `Latitude: ${locationData.latitude}\n` +
                `Longitude: ${locationData.longitude}\n` +
                `Accuracy: ${locationData.accuracy}m\n` +
                `Timestamp: ${locationData.timestamp}`,
                ['location-update', 'manual', `tag-${app.nfcTagId}`]
            );

            // Check geofences
            this.checkGeofences(locationData);

            app.showToast('Location updated successfully!', 'success');

        } catch (error) {
            console.error('Failed to update location:', error);
            
            let errorMessage = 'Failed to get location';
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

    async shareLocation() {
        if (!this.locationHistory || this.locationHistory.length === 0) {
            app.showToast('No location to share', 'warning');
            return;
        }

        const lastLocation = this.locationHistory[this.locationHistory.length - 1];
        const shareText = `${app.currentUser?.petName || 'Pet'}'s location: ` +
                         `https://maps.google.com/maps?q=${lastLocation.latitude},${lastLocation.longitude}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${app.currentUser?.petName || 'Pet'} Location`,
                    text: shareText,
                    url: `https://maps.google.com/maps?q=${lastLocation.latitude},${lastLocation.longitude}`
                });
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(shareText);
                app.showToast('Location link copied to clipboard', 'success');
            } catch (error) {
                app.showToast('Failed to copy location link', 'error');
            }
        }
    },

    viewHistory() {
        this.loadDetailedHistory();
        document.getElementById('history-modal').style.display = 'flex';
    },

    loadDetailedHistory() {
        const detailedHistory = document.getElementById('detailed-history');
        if (!detailedHistory) return;

        if (!this.locationHistory || this.locationHistory.length === 0) {
            detailedHistory.innerHTML = '<p class="text-muted">No location history available</p>';
            return;
        }

        const historyHtml = this.locationHistory.slice().reverse().map((location, index) => `
            <div class="detailed-history-item">
                <div class="history-index">#${this.locationHistory.length - index}</div>
                <div class="history-info">
                    <div class="history-coords">${utils.formatCoordinates(location.latitude, location.longitude, 6)}</div>
                    <div class="history-meta">
                        <span class="history-time">${utils.formatDate(location.timestamp, 'long')}</span>
                        <span class="history-accuracy">±${Math.round(location.accuracy || 0)}m</span>
                        <span class="history-source source-${location.source || 'unknown'}">${location.source || 'unknown'}</span>
                    </div>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-sm btn-outline" onclick="locationPage.openInMaps(${location.latitude}, ${location.longitude})">
                        <i data-feather="external-link"></i>
                        Maps
                    </button>
                </div>
            </div>
        `).join('');

        detailedHistory.innerHTML = historyHtml;
        feather.replace();
    },

    closeHistoryModal() {
        document.getElementById('history-modal').style.display = 'none';
    },

    filterHistory() {
        const filter = document.getElementById('history-filter').value;
        let filteredHistory = [...this.locationHistory];

        const now = new Date();
        switch (filter) {
            case 'today':
                filteredHistory = filteredHistory.filter(location => 
                    new Date(location.timestamp).toDateString() === now.toDateString()
                );
                break;
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredHistory = filteredHistory.filter(location => 
                    new Date(location.timestamp) >= weekAgo
                );
                break;
            case 'month':
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                filteredHistory = filteredHistory.filter(location => 
                    new Date(location.timestamp) >= monthAgo
                );
                break;
        }

        // Update detailed history with filtered data
        const originalHistory = this.locationHistory;
        this.locationHistory = filteredHistory;
        this.loadDetailedHistory();
        this.locationHistory = originalHistory;
    },

    refreshHistory() {
        this.loadLocationData();
        this.loadDetailedHistory();
        app.showToast('History refreshed', 'success');
    },

    exportHistory() {
        if (!this.locationHistory || this.locationHistory.length === 0) {
            app.showToast('No location history to export', 'warning');
            return;
        }

        const csvContent = [
            'Timestamp,Latitude,Longitude,Accuracy,Source',
            ...this.locationHistory.map(location => 
                `${location.timestamp},${location.latitude},${location.longitude},${location.accuracy || ''},${location.source || ''}`
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pet-location-history-${app.nfcTagId}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        app.showToast('Location history exported', 'success');
    },

    refreshLocation() {
        this.loadLocationData();
        this.updateLocationStatus();
        this.updateAnalytics();
        app.showToast('Location data refreshed', 'success');
    },

    centerMap() {
        if (this.map && this.currentMarker) {
            // Center map on current location (would be implemented with actual map library)
            app.showToast('Map centered on current location', 'info');
        } else {
            app.showToast('No location to center on', 'warning');
        }
    },

    initializeMap() {
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;

        // Replace placeholder with map implementation
        mapContainer.innerHTML = `
            <div class="map-implementation">
                <div class="map-message">
                    <i data-feather="map"></i>
                    <p>Interactive map would be implemented here using a mapping library like Leaflet or Google Maps</p>
                    <div class="map-features">
                        <p>Features would include:</p>
                        <ul>
                            <li>Real-time location markers</li>
                            <li>Location history trail</li>
                            <li>Geofence visualization</li>
                            <li>Interactive controls</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        feather.replace();
    },

    showLocationOnMap(lat, lng) {
        // Would show specific location on map
        app.showToast(`Showing location: ${utils.formatCoordinates(lat, lng, 4)}`, 'info');
    },

    async getAddressForLocation(lat, lng) {
        try {
            const address = await utils.getAddressFromCoordinates(lat, lng);
            app.showToast(`Address: ${address}`, 'info');
        } catch (error) {
            app.showToast('Failed to get address', 'error');
        }
    },

    openInMaps(lat, lng) {
        const url = `https://maps.google.com/maps?q=${lat},${lng}`;
        window.open(url, '_blank');
    },

    setGeofence() {
        document.getElementById('geofence-modal').style.display = 'flex';
    },

    addGeofence() {
        document.getElementById('geofence-modal').style.display = 'flex';
    },

    closeGeofenceModal() {
        document.getElementById('geofence-modal').style.display = 'none';
    },

    useCurrentLocation() {
        const input = document.querySelector('input[name="centerLocation"]');
        if (!input) return;

        if (this.locationHistory && this.locationHistory.length > 0) {
            const lastLocation = this.locationHistory[this.locationHistory.length - 1];
            input.value = `${lastLocation.latitude}, ${lastLocation.longitude}`;
        } else {
            app.showToast('No current location available', 'warning');
        }
    },

    async saveGeofence(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const geofence = {
            id: utils.generateId('geofence'),
            name: formData.get('zoneName'),
            centerLocation: formData.get('centerLocation'),
            radius: parseInt(formData.get('radius')),
            alertType: formData.get('alertType'),
            createdAt: new Date().toISOString(),
            isActive: true
        };

        try {
            // Parse coordinates from center location
            const coords = geofence.centerLocation.split(',').map(c => parseFloat(c.trim()));
            if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
                throw new Error('Invalid coordinates format');
            }

            geofence.centerLat = coords[0];
            geofence.centerLng = coords[1];

            // Add to geofences
            this.geofences.push(geofence);

            // Save to localStorage
            utils.saveToLocalStorage(`petTracker_geofences_${app.nfcTagId}`, this.geofences);

            // Update UI
            this.displayGeofences();

            // Create GitHub issue
            await app.createGitHubIssue(
                `Geofence Created - ${app.nfcTagId}`,
                `New geofence created for pet tracker ${app.nfcTagId}\n\n` +
                `Zone Name: ${geofence.name}\n` +
                `Center: ${geofence.centerLocation}\n` +
                `Radius: ${geofence.radius}m\n` +
                `Alert Type: ${geofence.alertType}\n` +
                `Created: ${geofence.createdAt}`,
                ['geofence', 'configuration', `tag-${app.nfcTagId}`]
            );

            this.closeGeofenceModal();
            app.showToast('Safe zone created successfully!', 'success');

        } catch (error) {
            console.error('Failed to save geofence:', error);
            app.showToast('Failed to create safe zone: ' + utils.formatError(error), 'error');
        }
    },

    loadGeofences() {
        if (!app.nfcTagId) return;

        this.geofences = utils.loadFromLocalStorage(`petTracker_geofences_${app.nfcTagId}`, []);
        this.displayGeofences();
    },

    displayGeofences() {
        const geofenceList = document.getElementById('geofence-list');
        if (!geofenceList) return;

        if (this.geofences.length === 0) {
            geofenceList.innerHTML = '<p class="text-muted">No safe zones configured</p>';
            return;
        }

        const geofenceHtml = this.geofences.map(geofence => `
            <div class="geofence-item ${!geofence.isActive ? 'geofence-inactive' : ''}">
                <div class="geofence-info">
                    <div class="geofence-name">${utils.escapeHtml(geofence.name)}</div>
                    <div class="geofence-details">
                        <span class="geofence-radius">${geofence.radius}m radius</span>
                        <span class="geofence-alert">${geofence.alertType}</span>
                    </div>
                </div>
                <div class="geofence-actions">
                    <button class="btn btn-sm btn-outline" onclick="locationPage.toggleGeofence('${geofence.id}')">
                        <i data-feather="${geofence.isActive ? 'pause' : 'play'}"></i>
                        ${geofence.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="locationPage.deleteGeofence('${geofence.id}')">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
        `).join('');

        geofenceList.innerHTML = geofenceHtml;
        feather.replace();
    },

    toggleGeofence(geofenceId) {
        const geofence = this.geofences.find(g => g.id === geofenceId);
        if (!geofence) return;

        geofence.isActive = !geofence.isActive;
        utils.saveToLocalStorage(`petTracker_geofences_${app.nfcTagId}`, this.geofences);
        this.displayGeofences();

        app.showToast(`Safe zone ${geofence.isActive ? 'enabled' : 'disabled'}`, 'success');
    },

    deleteGeofence(geofenceId) {
        const confirmed = confirm('Are you sure you want to delete this safe zone?');
        if (!confirmed) return;

        this.geofences = this.geofences.filter(g => g.id !== geofenceId);
        utils.saveToLocalStorage(`petTracker_geofences_${app.nfcTagId}`, this.geofences);
        this.displayGeofences();

        app.showToast('Safe zone deleted', 'success');
    },

    checkGeofences(location) {
        if (!this.geofences || this.geofences.length === 0) return;

        this.geofences.forEach(geofence => {
            if (!geofence.isActive) return;

            const distance = utils.calculateDistance(
                location.latitude, location.longitude,
                geofence.centerLat, geofence.centerLng
            ) * 1000; // Convert to meters

            const isInside = distance <= geofence.radius;
            const wasInside = geofence.lastStatus === 'inside';

            if (isInside !== wasInside) {
                const event = isInside ? 'entered' : 'exited';
                
                if ((geofence.alertType === 'enter' && event === 'entered') ||
                    (geofence.alertType === 'exit' && event === 'exited') ||
                    geofence.alertType === 'both') {
                    
                    this.triggerGeofenceAlert(geofence, event, location);
                }
            }

            geofence.lastStatus = isInside ? 'inside' : 'outside';
        });

        // Save updated geofence states
        utils.saveToLocalStorage(`petTracker_geofences_${app.nfcTagId}`, this.geofences);
    },

    async triggerGeofenceAlert(geofence, event, location) {
        const alertMessage = `${app.currentUser?.petName || 'Pet'} has ${event} the safe zone "${geofence.name}"`;
        
        // Create GitHub issue for geofence alert
        await app.createGitHubIssue(
            `🚨 Geofence Alert - ${app.nfcTagId}`,
            `Geofence alert for pet tracker ${app.nfcTagId}\n\n` +
            `Pet ${event} safe zone: ${geofence.name}\n` +
            `Location: ${location.latitude}, ${location.longitude}\n` +
            `Zone Center: ${geofence.centerLat}, ${geofence.centerLng}\n` +
            `Zone Radius: ${geofence.radius}m\n` +
            `Timestamp: ${location.timestamp}`,
            ['geofence-alert', event, `tag-${app.nfcTagId}`]
        );

        app.showToast(alertMessage, 'warning');
    },

    setupPeriodicUpdates() {
        // Refresh location data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.updateLocationStatus();
            this.updateAnalytics();
        }, 30000);
    },

    destroy() {
        // Cleanup when leaving the page
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        this.isInitialized = false;
    }
};

// Initialize the page
locationPage.init();
