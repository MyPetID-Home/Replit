// Contact page functionality
window.contactPage = {
    isInitialized: false,
    formData: {},
    validationRules: {
        petName: { required: true, minLength: 2 },
        ownerName: { required: true, minLength: 2 },
        primaryPhone: { required: true, pattern: /^\+?[\d\s\-\(\)]+$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
    },

    init() {
        if (this.isInitialized) return;
        
        console.log('Initializing contact page');
        
        // Load existing contact information
        this.loadContactData();
        
        // Set up form validation
        this.setupFormValidation();
        
        // Set up auto-save
        this.setupAutoSave();
        
        this.isInitialized = true;
    },

    async loadContactData() {
        try {
            if (!app.nfcTagId) {
                app.showToast('Please connect your pet tracker first', 'warning');
                return;
            }

            // Load from app.currentUser or localStorage
            const contactData = app.currentUser?.contactInfo || 
                              utils.loadFromLocalStorage(`petTracker_contact_${app.nfcTagId}`, {});

            this.formData = contactData;
            this.populateForm(contactData);
            this.updateContactSummary(contactData);
            
        } catch (error) {
            console.error('Failed to load contact data:', error);
            app.showToast('Failed to load contact information', 'error');
        }
    },

    populateForm(data) {
        const form = document.getElementById('contact-form');
        if (!form) return;

        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                field.value = data[key] || '';
            }
        });
    },

    setupFormValidation() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        // Real-time validation on input
        form.addEventListener('input', (event) => {
            this.validateField(event.target);
        });

        // Validation on blur for better UX
        form.addEventListener('blur', (event) => {
            this.validateField(event.target);
        }, true);
    },

    validateField(field) {
        const name = field.name;
        const value = field.value.trim();
        const rules = this.validationRules[name];
        
        if (!rules) return true;

        let isValid = true;
        let errorMessage = '';

        // Required validation
        if (rules.required && !value) {
            isValid = false;
            errorMessage = `${this.getFieldLabel(name)} is required`;
        }

        // Minimum length validation
        if (isValid && rules.minLength && value.length < rules.minLength) {
            isValid = false;
            errorMessage = `${this.getFieldLabel(name)} must be at least ${rules.minLength} characters`;
        }

        // Pattern validation
        if (isValid && rules.pattern && value && !rules.pattern.test(value)) {
            isValid = false;
            errorMessage = `Please enter a valid ${this.getFieldLabel(name).toLowerCase()}`;
        }

        // Email specific validation
        if (isValid && name === 'email' && value && !utils.isValidEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }

        // Phone specific validation
        if (isValid && (name === 'primaryPhone' || name === 'secondaryPhone' || name === 'emergencyPhone') && 
            value && !utils.isValidPhone(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }

        this.showFieldValidation(field, isValid, errorMessage);
        return isValid;
    },

    getFieldLabel(fieldName) {
        const labels = {
            petName: 'Pet Name',
            ownerName: 'Owner Name',
            primaryPhone: 'Primary Phone',
            secondaryPhone: 'Secondary Phone',
            email: 'Email Address',
            emergencyPhone: 'Emergency Contact Phone'
        };
        return labels[fieldName] || fieldName;
    },

    showFieldValidation(field, isValid, message) {
        // Remove existing validation classes and messages
        field.classList.remove('field-valid', 'field-invalid');
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        if (!isValid && message) {
            field.classList.add('field-invalid');
            const errorElement = document.createElement('div');
            errorElement.className = 'field-error';
            errorElement.textContent = message;
            field.parentNode.appendChild(errorElement);
        } else if (field.value.trim()) {
            field.classList.add('field-valid');
        }
    },

    setupAutoSave() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        // Auto-save form data every 30 seconds
        const autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.saveToLocalStorage();
            }
        }, 30000);

        // Save on window unload
        window.addEventListener('beforeunload', () => {
            clearInterval(autoSaveInterval);
            if (this.hasUnsavedChanges()) {
                this.saveToLocalStorage();
            }
        });
    },

    hasUnsavedChanges() {
        const form = document.getElementById('contact-form');
        if (!form) return false;

        const formData = new FormData(form);
        const currentData = {};
        
        for (const [key, value] of formData.entries()) {
            currentData[key] = value.trim();
        }

        return JSON.stringify(currentData) !== JSON.stringify(this.formData);
    },

    saveToLocalStorage() {
        if (!app.nfcTagId) return;

        const form = document.getElementById('contact-form');
        if (!form) return;

        const formData = new FormData(form);
        const contactData = {};
        
        for (const [key, value] of formData.entries()) {
            contactData[key] = value.trim();
        }

        utils.saveToLocalStorage(`petTracker_contact_${app.nfcTagId}`, contactData);
    },

    async saveContact(event) {
        event.preventDefault();
        
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        const form = event.target;
        const formData = new FormData(form);
        
        // Validate all fields
        let isFormValid = true;
        const contactData = {};
        
        for (const [key, value] of formData.entries()) {
            const field = form.querySelector(`[name="${key}"]`);
            contactData[key] = value.trim();
            
            if (!this.validateField(field)) {
                isFormValid = false;
            }
        }

        if (!isFormValid) {
            app.showToast('Please fix validation errors before saving', 'error');
            return;
        }

        app.showLoading(true);

        try {
            // Save to app user data
            if (app.currentUser) {
                app.currentUser.contactInfo = contactData;
            }

            // Save to localStorage
            utils.saveToLocalStorage(`petTracker_contact_${app.nfcTagId}`, contactData);

            // Update form data
            this.formData = contactData;

            // Update contact summary
            this.updateContactSummary(contactData);

            // Create GitHub issue for contact update
            await app.createGitHubIssue(
                `Contact Information Updated - ${app.nfcTagId}`,
                `Contact information has been updated for pet tracker ${app.nfcTagId}\n\n` +
                `Pet Name: ${contactData.petName}\n` +
                `Owner: ${contactData.ownerName}\n` +
                `Primary Phone: ${contactData.primaryPhone}\n` +
                `Email: ${contactData.email || 'Not provided'}\n` +
                `Updated: ${new Date().toISOString()}`,
                ['contact-update', `tag-${app.nfcTagId}`]
            );

            app.showToast('Contact information saved successfully!', 'success');

        } catch (error) {
            console.error('Failed to save contact information:', error);
            app.showToast('Failed to save contact information: ' + utils.formatError(error), 'error');
        } finally {
            app.showLoading(false);
        }
    },

    updateContactSummary(data) {
        const summaryElement = document.getElementById('contact-summary');
        if (!summaryElement) return;

        if (!data || Object.keys(data).length === 0) {
            summaryElement.innerHTML = '<p class="text-muted">Contact information will appear here after saving</p>';
            return;
        }

        const summaryHtml = `
            <div class="contact-summary-content">
                ${data.petName ? `<div class="summary-item">
                    <strong>Pet:</strong> ${utils.escapeHtml(data.petName)}
                    ${data.petBreed ? ` (${utils.escapeHtml(data.petBreed)})` : ''}
                </div>` : ''}
                
                ${data.ownerName ? `<div class="summary-item">
                    <strong>Owner:</strong> ${utils.escapeHtml(data.ownerName)}
                </div>` : ''}
                
                ${data.primaryPhone ? `<div class="summary-item">
                    <strong>Phone:</strong> 
                    <a href="tel:${data.primaryPhone}" class="contact-link">
                        ${utils.escapeHtml(data.primaryPhone)}
                    </a>
                </div>` : ''}
                
                ${data.email ? `<div class="summary-item">
                    <strong>Email:</strong> 
                    <a href="mailto:${data.email}" class="contact-link">
                        ${utils.escapeHtml(data.email)}
                    </a>
                </div>` : ''}
                
                ${data.emergencyName && data.emergencyPhone ? `<div class="summary-item">
                    <strong>Emergency:</strong> ${utils.escapeHtml(data.emergencyName)} - 
                    <a href="tel:${data.emergencyPhone}" class="contact-link">
                        ${utils.escapeHtml(data.emergencyPhone)}
                    </a>
                </div>` : ''}
                
                ${data.address ? `<div class="summary-item">
                    <strong>Address:</strong> ${utils.escapeHtml(data.address)}
                </div>` : ''}
            </div>
        `;

        summaryElement.innerHTML = summaryHtml;
    },

    resetForm() {
        const confirmed = confirm('Are you sure you want to reset the form? All unsaved changes will be lost.');
        if (!confirmed) return;

        const form = document.getElementById('contact-form');
        if (form) {
            form.reset();
            
            // Clear validation classes
            form.querySelectorAll('.field-valid, .field-invalid').forEach(field => {
                field.classList.remove('field-valid', 'field-invalid');
            });
            
            // Remove error messages
            form.querySelectorAll('.field-error').forEach(error => {
                error.remove();
            });
        }

        // Load original data
        this.loadContactData();
        
        app.showToast('Form reset successfully', 'success');
    },

    async generateQR() {
        if (!this.formData || Object.keys(this.formData).length === 0) {
            app.showToast('Please save contact information first', 'warning');
            return;
        }

        try {
            // Create contact info string for QR code
            const contactInfo = this.formatContactForQR(this.formData);
            
            // Generate QR code using a QR code library
            const qrContainer = document.getElementById('qr-code-container');
            if (qrContainer) {
                qrContainer.innerHTML = `
                    <div class="qr-placeholder">
                        <i data-feather="qr-code"></i>
                        <p>QR Code would be generated here with contact information</p>
                        <small>Contact: ${contactInfo}</small>
                    </div>
                `;
                feather.replace();
            }

            document.getElementById('qr-modal').style.display = 'flex';
            
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            app.showToast('Failed to generate QR code', 'error');
        }
    },

    formatContactForQR(data) {
        const parts = [];
        if (data.petName) parts.push(`Pet: ${data.petName}`);
        if (data.ownerName) parts.push(`Owner: ${data.ownerName}`);
        if (data.primaryPhone) parts.push(`Phone: ${data.primaryPhone}`);
        if (data.email) parts.push(`Email: ${data.email}`);
        return parts.join(' | ');
    },

    closeQRModal() {
        document.getElementById('qr-modal').style.display = 'none';
    },

    downloadQR() {
        app.showToast('QR code download feature would be implemented here', 'info');
    },

    testContacts() {
        if (!this.formData.primaryPhone && !this.formData.secondaryPhone && !this.formData.emergencyPhone) {
            app.showToast('No phone numbers to test', 'warning');
            return;
        }

        const phones = [];
        if (this.formData.primaryPhone) phones.push(`Primary: ${this.formData.primaryPhone}`);
        if (this.formData.secondaryPhone) phones.push(`Secondary: ${this.formData.secondaryPhone}`);
        if (this.formData.emergencyPhone) phones.push(`Emergency: ${this.formData.emergencyPhone}`);

        const content = `
            <div class="test-contacts">
                <h3>Test Contact Numbers</h3>
                <p>Click on any number to call:</p>
                <div class="phone-list">
                    ${phones.map(phone => {
                        const number = phone.split(': ')[1];
                        return `
                            <div class="phone-item">
                                <span>${phone}</span>
                                <a href="tel:${number}" class="btn btn-sm btn-primary">
                                    <i data-feather="phone"></i>
                                    Call
                                </a>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        app.showModal(content);
        feather.replace();
    },

    shareContact() {
        if (!this.formData || Object.keys(this.formData).length === 0) {
            app.showToast('No contact information to share', 'warning');
            return;
        }

        const shareText = utils.formatContactInfo(this.formData);
        
        if (navigator.share) {
            navigator.share({
                title: `${this.formData.petName || 'Pet'} Contact Information`,
                text: shareText
            }).catch(err => console.log('Error sharing:', err));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText).then(() => {
                app.showToast('Contact information copied to clipboard', 'success');
            }).catch(() => {
                app.showToast('Failed to copy contact information', 'error');
            });
        }
    },

    printContactCard() {
        if (!this.formData || Object.keys(this.formData).length === 0) {
            app.showToast('No contact information to print', 'warning');
            return;
        }

        const printContent = `
            <div class="print-contact-card">
                <h2>${this.formData.petName || 'Pet'} - Contact Information</h2>
                <div class="contact-details">
                    ${utils.formatContactInfo(this.formData).split('\n').map(line => 
                        `<p>${utils.escapeHtml(line)}</p>`
                    ).join('')}
                </div>
                <div class="tag-info">
                    <p><strong>NFC Tag ID:</strong> ${app.nfcTagId}</p>
                    <p><strong>Generated:</strong> ${utils.formatDate(new Date())}</p>
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Pet Contact Card</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .print-contact-card { max-width: 400px; }
                        h2 { color: #1C2526; margin-bottom: 20px; }
                        p { margin: 5px 0; }
                        .tag-info { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    },

    async reportLost() {
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        const lostContent = `
            <div class="lost-report-form">
                <h3>🚨 Report Pet Lost</h3>
                <p>This will create an emergency alert with your pet's information.</p>
                
                <form onsubmit="contactPage.submitLostReport(event)">
                    <div class="form-group">
                        <label class="form-label">Last Seen Location:</label>
                        <textarea name="lastSeenLocation" class="form-textarea" 
                                  placeholder="Describe where your pet was last seen..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Additional Details:</label>
                        <textarea name="additionalDetails" class="form-textarea" 
                                  placeholder="Any other important information..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="includeLocation" checked>
                            Include current location in report
                        </label>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-danger">
                            <i data-feather="alert-triangle"></i>
                            Submit Lost Report
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="app.hideModal()">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;

        app.showModal(lostContent);
        feather.replace();
    },

    async submitLostReport(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const lostReport = {
            type: 'lost',
            lastSeenLocation: formData.get('lastSeenLocation'),
            additionalDetails: formData.get('additionalDetails'),
            includeLocation: formData.get('includeLocation') === 'on',
            petInfo: this.formData
        };

        app.showLoading(true);

        try {
            // Get location if requested
            if (lostReport.includeLocation) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000
                        });
                    });
                    
                    lostReport.currentLocation = `${position.coords.latitude}, ${position.coords.longitude}`;
                } catch (locationError) {
                    console.error('Failed to get location for lost report:', locationError);
                    lostReport.currentLocation = 'Location unavailable';
                }
            }

            // Create high-priority GitHub issue
            await app.createGitHubIssue(
                `🚨 LOST PET ALERT - ${app.nfcTagId}`,
                `LOST PET ALERT for ${this.formData.petName || 'Pet'}\n\n` +
                `Pet Information:\n` +
                `- Name: ${this.formData.petName || 'Unknown'}\n` +
                `- Breed: ${this.formData.petBreed || 'Unknown'}\n` +
                `- Color: ${this.formData.petColor || 'Unknown'}\n\n` +
                `Owner Information:\n` +
                `- Name: ${this.formData.ownerName || 'Unknown'}\n` +
                `- Phone: ${this.formData.primaryPhone || 'Unknown'}\n` +
                `- Email: ${this.formData.email || 'Unknown'}\n\n` +
                `Last Seen: ${lostReport.lastSeenLocation}\n` +
                `Current Location: ${lostReport.currentLocation || 'Not provided'}\n` +
                `Additional Details: ${lostReport.additionalDetails || 'None provided'}\n\n` +
                `Report Time: ${new Date().toISOString()}`,
                ['lost-pet', 'emergency', 'high-priority', `tag-${app.nfcTagId}`]
            );

            app.hideModal();
            app.showToast('Lost pet report submitted successfully!', 'success');

        } catch (error) {
            console.error('Failed to submit lost report:', error);
            app.showToast('Failed to submit lost report: ' + utils.formatError(error), 'error');
        } finally {
            app.showLoading(false);
        }
    },

    destroy() {
        // Cleanup when leaving the page
        if (this.hasUnsavedChanges()) {
            this.saveToLocalStorage();
        }
        this.isInitialized = false;
    }
};

// Initialize the page
contactPage.init();
