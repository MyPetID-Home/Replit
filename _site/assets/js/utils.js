// Utility functions for the Pet Tracker application
window.Utils = {
    // Date and time utilities
    formatDate(date, format = 'short') {
        if (!date) return 'Unknown';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        
        const options = {
            short: { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            },
            long: { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            },
            time: {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        };
        
        return d.toLocaleDateString('en-US', options[format] || options.short);
    },

    formatTimeAgo(date) {
        if (!date) return 'Unknown';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        
        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
        
        return this.formatDate(date);
    },

    // Location utilities
    formatCoordinates(lat, lng, precision = 6) {
        if (lat == null || lng == null) return 'Unknown location';
        
        const latFixed = parseFloat(lat).toFixed(precision);
        const lngFixed = parseFloat(lng).toFixed(precision);
        
        return `${latFixed}, ${lngFixed}`;
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        if (!lat1 || !lng1 || !lat2 || !lng2) return null;
        
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in kilometers
    },

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

    formatDistance(distanceKm) {
        if (distanceKm == null) return 'Unknown distance';
        
        if (distanceKm < 1) {
            return `${Math.round(distanceKm * 1000)}m`;
        } else if (distanceKm < 10) {
            return `${distanceKm.toFixed(1)}km`;
        } else {
            return `${Math.round(distanceKm)}km`;
        }
    },

    async getAddressFromCoordinates(lat, lng) {
        try {
            // Using a free geocoding service (replace with your preferred service)
            const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            
            if (response.ok) {
                const data = await response.json();
                return data.display_name || data.locality || 'Unknown address';
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
        }
        
        return 'Address unavailable';
    },

    // String utilities
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    truncateText(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    },

    generateId(prefix = 'id') {
        return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // Validation utilities
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    isValidNFCTag(tagId) {
        if (!tagId) return false;
        // Basic validation - alphanumeric, 6-20 characters
        return /^[a-zA-Z0-9]{6,20}$/.test(tagId);
    },

    // Data storage utilities
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    },

    loadFromLocalStorage(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return defaultValue;
        }
    },

    // Device detection
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    },

    isAndroid() {
        return /Android/.test(navigator.userAgent);
    },

    hasNFCSupport() {
        return 'NDEFReader' in window;
    },

    // Network utilities
    async fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                
                if (i === retries - 1) throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                if (i === retries - 1) throw error;
                await this.delay(1000 * Math.pow(2, i)); // Exponential backoff
            }
        }
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // UI utilities
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Error handling
    formatError(error) {
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        if (error.message) return error.message;
        return 'An unknown error occurred';
    },

    logError(error, context = '') {
        const errorInfo = {
            message: this.formatError(error),
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.error('Error logged:', errorInfo);
        
        // Could send to error tracking service
        // this.sendErrorToTracking(errorInfo);
    },

    // Data formatting
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Medical information helpers
    formatMedicalInfo(info) {
        if (!info || typeof info !== 'object') return 'No medical information available';
        
        const formatted = [];
        
        if (info.allergies && info.allergies.length > 0) {
            formatted.push(`Allergies: ${info.allergies.join(', ')}`);
        }
        
        if (info.medications && info.medications.length > 0) {
            formatted.push(`Medications: ${info.medications.join(', ')}`);
        }
        
        if (info.conditions && info.conditions.length > 0) {
            formatted.push(`Conditions: ${info.conditions.join(', ')}`);
        }
        
        if (info.veterinarian) {
            formatted.push(`Veterinarian: ${info.veterinarian}`);
        }
        
        return formatted.length > 0 ? formatted.join('\n') : 'No medical information available';
    },

    // Contact information helpers
    formatContactInfo(contact) {
        if (!contact || typeof contact !== 'object') return 'No contact information available';
        
        const formatted = [];
        
        if (contact.ownerName) {
            formatted.push(`Owner: ${contact.ownerName}`);
        }
        
        if (contact.phone) {
            formatted.push(`Phone: ${contact.phone}`);
        }
        
        if (contact.email) {
            formatted.push(`Email: ${contact.email}`);
        }
        
        if (contact.emergencyContact) {
            formatted.push(`Emergency: ${contact.emergencyContact}`);
        }
        
        return formatted.length > 0 ? formatted.join('\n') : 'No contact information available';
    }
};

// Make utilities available globally
window.utils = window.Utils;
