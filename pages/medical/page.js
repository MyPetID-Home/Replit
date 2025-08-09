// Medical page functionality
window.medicalPage = {
    isInitialized: false,
    formData: {},
    medications: [],
    vaccinations: [],
    validationRules: {
        weight: { pattern: /^\d+(\.\d+)?$/, message: 'Weight must be a valid number' },
        height: { pattern: /^\d+(\.\d+)?$/, message: 'Height must be a valid number' },
        microchipId: { pattern: /^[0-9A-Fa-f]{15}$/, message: 'Microchip ID must be 15 digits' },
        vetPhone: { pattern: /^\+?[\d\s\-\(\)]+$/, message: 'Please enter a valid phone number' },
        vetEmail: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address' }
    },

    init() {
        if (this.isInitialized) return;
        
        console.log('Initializing medical page');
        
        // Load existing medical information
        this.loadMedicalData();
        
        // Set up form validation
        this.setupFormValidation();
        
        // Set up auto-save
        this.setupAutoSave();
        
        // Initialize medications and vaccinations
        this.initializeMedicationsAndVaccinations();
        
        this.isInitialized = true;
    },

    async loadMedicalData() {
        try {
            if (!app.nfcTagId) {
                app.showToast('Please connect your pet tracker first', 'warning');
                return;
            }

            // Load from app.currentUser or localStorage
            const medicalData = app.currentUser?.medicalInfo || 
                              utils.loadFromLocalStorage(`petTracker_medical_${app.nfcTagId}`, {});

            this.formData = medicalData;
            this.medications = medicalData.medications || [];
            this.vaccinations = medicalData.vaccinations || {};
            
            this.populateForm(medicalData);
            this.updateMedicalSummary(medicalData);
            this.updateVaccinationSummary(this.vaccinations);
            
        } catch (error) {
            console.error('Failed to load medical data:', error);
            app.showToast('Failed to load medical information', 'error');
        }
    },

    populateForm(data) {
        const form = document.getElementById('medical-form');
        if (!form) return;

        // Populate simple fields
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field && typeof data[key] === 'string') {
                field.value = data[key] || '';
            }
        });

        // Populate medications
        if (data.medications && data.medications.length > 0) {
            this.populateMedications(data.medications);
        }

        // Populate vaccinations
        if (data.vaccinations) {
            this.populateVaccinations(data.vaccinations);
        }

        // Handle checkboxes for vaccination status
        if (data.vaccinationStatus) {
            data.vaccinationStatus.forEach(vaccination => {
                const checkbox = form.querySelector(`input[value="${vaccination}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    },

    populateMedications(medications) {
        const medicationsList = document.getElementById('medications-list');
        if (!medicationsList) return;

        // Clear existing medications except the first template
        const existingMedications = medicationsList.querySelectorAll('.medication-entry');
        existingMedications.forEach((entry, index) => {
            if (index > 0) entry.remove();
        });

        medications.forEach((medication, index) => {
            if (index === 0) {
                // Use the first existing entry
                const firstEntry = medicationsList.querySelector('.medication-entry');
                const nameInput = firstEntry.querySelector('input[name="medicationName[]"]');
                const dosageInput = firstEntry.querySelector('input[name="medicationDosage[]"]');
                const notesInput = firstEntry.querySelector('input[name="medicationNotes[]"]');
                
                if (nameInput) nameInput.value = medication.name || '';
                if (dosageInput) dosageInput.value = medication.dosage || '';
                if (notesInput) notesInput.value = medication.notes || '';
            } else {
                // Add new entries for additional medications
                this.addMedication(medication);
            }
        });
    },

    populateVaccinations(vaccinations) {
        const form = document.getElementById('medical-form');
        if (!form) return;

        Object.keys(vaccinations).forEach(vaccinationType => {
            const checkbox = form.querySelector(`input[value="${vaccinationType}"]`);
            const dateField = form.querySelector(`input[name="${vaccinationType}Date"]`);
            
            if (vaccinations[vaccinationType]) {
                if (checkbox) checkbox.checked = true;
                if (dateField && vaccinations[vaccinationType].date) {
                    dateField.value = vaccinations[vaccinationType].date;
                }
            }
        });
    },

    setupFormValidation() {
        const form = document.getElementById('medical-form');
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

        // Pattern validation
        if (value && rules.pattern && !rules.pattern.test(value)) {
            isValid = false;
            errorMessage = rules.message;
        }

        this.showFieldValidation(field, isValid, errorMessage);
        return isValid;
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
        const form = document.getElementById('medical-form');
        if (!form) return;

        // Auto-save form data every 60 seconds for medical data (less frequent due to sensitivity)
        const autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.saveToLocalStorage();
            }
        }, 60000);

        // Save on window unload
        window.addEventListener('beforeunload', () => {
            clearInterval(autoSaveInterval);
            if (this.hasUnsavedChanges()) {
                this.saveToLocalStorage();
            }
        });
    },

    hasUnsavedChanges() {
        const form = document.getElementById('medical-form');
        if (!form) return false;

        const currentData = this.extractFormData(form);
        return JSON.stringify(currentData) !== JSON.stringify(this.formData);
    },

    saveToLocalStorage() {
        if (!app.nfcTagId) return;

        const form = document.getElementById('medical-form');
        if (!form) return;

        const medicalData = this.extractFormData(form);
        utils.saveToLocalStorage(`petTracker_medical_${app.nfcTagId}`, medicalData);
    },

    extractFormData(form) {
        const formData = new FormData(form);
        const medicalData = {};
        
        // Extract simple fields
        for (const [key, value] of formData.entries()) {
            if (!key.includes('[]')) {
                medicalData[key] = value.trim();
            }
        }

        // Extract medications
        const medicationNames = formData.getAll('medicationName[]');
        const medicationDosages = formData.getAll('medicationDosage[]');
        const medicationNotes = formData.getAll('medicationNotes[]');
        
        medicalData.medications = medicationNames.map((name, index) => ({
            name: name.trim(),
            dosage: medicationDosages[index]?.trim() || '',
            notes: medicationNotes[index]?.trim() || ''
        })).filter(med => med.name); // Only include medications with names

        // Extract vaccinations
        const vaccinationCheckboxes = form.querySelectorAll('input[name="vaccinations[]"]:checked');
        medicalData.vaccinationStatus = Array.from(vaccinationCheckboxes).map(cb => cb.value);
        
        // Extract vaccination dates
        medicalData.vaccinations = {};
        ['rabies', 'dhpp', 'bordetella', 'lyme'].forEach(vacType => {
            const dateField = form.querySelector(`input[name="${vacType}Date"]`);
            if (dateField && dateField.value) {
                medicalData.vaccinations[vacType] = {
                    date: dateField.value,
                    isActive: medicalData.vaccinationStatus.includes(vacType)
                };
            }
        });

        return medicalData;
    },

    async saveMedicalInfo(event) {
        event.preventDefault();
        
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        const form = event.target;
        
        // Validate all fields
        let isFormValid = true;
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isFormValid = false;
            }
        });

        if (!isFormValid) {
            app.showToast('Please fix validation errors before saving', 'error');
            return;
        }

        app.showLoading(true);

        try {
            const medicalData = this.extractFormData(form);

            // Save to app user data
            if (app.currentUser) {
                app.currentUser.medicalInfo = medicalData;
            }

            // Save to localStorage
            utils.saveToLocalStorage(`petTracker_medical_${app.nfcTagId}`, medicalData);

            // Update form data
            this.formData = medicalData;
            this.medications = medicalData.medications;
            this.vaccinations = medicalData.vaccinations;

            // Update summaries
            this.updateMedicalSummary(medicalData);
            this.updateVaccinationSummary(medicalData.vaccinations);

            // Create GitHub issue for medical update
            await app.createGitHubIssue(
                `Medical Information Updated - ${app.nfcTagId}`,
                `Medical information has been updated for pet tracker ${app.nfcTagId}\n\n` +
                `Pet: ${app.currentUser?.petName || 'Unknown'}\n` +
                `Weight: ${medicalData.weight || 'Not specified'} ${medicalData.weightUnit || ''}\n` +
                `Veterinarian: ${medicalData.veterinarianName || 'Not specified'}\n` +
                `Clinic: ${medicalData.vetClinicName || 'Not specified'}\n` +
                `Medications: ${medicalData.medications?.length || 0} listed\n` +
                `Allergies: ${this.hasAllergies(medicalData) ? 'Yes' : 'No'}\n` +
                `Updated: ${new Date().toISOString()}`,
                ['medical-update', `tag-${app.nfcTagId}`]
            );

            app.showToast('Medical information saved successfully!', 'success');

        } catch (error) {
            console.error('Failed to save medical information:', error);
            app.showToast('Failed to save medical information: ' + utils.formatError(error), 'error');
        } finally {
            app.showLoading(false);
        }
    },

    hasAllergies(data) {
        return !!(data.foodAllergies || data.medicationAllergies || data.environmentalAllergies);
    },

    updateMedicalSummary(data) {
        const summaryElement = document.getElementById('medical-summary');
        if (!summaryElement) return;

        if (!data || Object.keys(data).length === 0) {
            summaryElement.innerHTML = '<p class="text-muted">Medical information will appear here after saving</p>';
            return;
        }

        const summaryHtml = `
            <div class="medical-summary-content">
                ${data.weight && data.weightUnit ? `<div class="summary-item">
                    <strong>Weight:</strong> ${data.weight} ${data.weightUnit}
                </div>` : ''}
                
                ${data.microchipId ? `<div class="summary-item">
                    <strong>Microchip ID:</strong> ${utils.escapeHtml(data.microchipId)}
                </div>` : ''}
                
                ${data.veterinarianName ? `<div class="summary-item">
                    <strong>Veterinarian:</strong> ${utils.escapeHtml(data.veterinarianName)}
                    ${data.vetClinicName ? ` at ${utils.escapeHtml(data.vetClinicName)}` : ''}
                </div>` : ''}
                
                ${data.vetPhone ? `<div class="summary-item">
                    <strong>Vet Phone:</strong> 
                    <a href="tel:${data.vetPhone}" class="contact-link">
                        ${utils.escapeHtml(data.vetPhone)}
                    </a>
                </div>` : ''}
                
                ${data.medications && data.medications.length > 0 ? `<div class="summary-item">
                    <strong>Current Medications:</strong>
                    <ul class="medication-list">
                        ${data.medications.map(med => 
                            `<li>${utils.escapeHtml(med.name)}${med.dosage ? ` - ${utils.escapeHtml(med.dosage)}` : ''}</li>`
                        ).join('')}
                    </ul>
                </div>` : ''}
                
                ${this.hasAllergies(data) ? `<div class="summary-item alert-item">
                    <strong>⚠️ Allergies:</strong>
                    <div class="allergy-list">
                        ${data.foodAllergies ? `<div><em>Food:</em> ${utils.escapeHtml(data.foodAllergies)}</div>` : ''}
                        ${data.medicationAllergies ? `<div><em>Medication:</em> ${utils.escapeHtml(data.medicationAllergies)}</div>` : ''}
                        ${data.environmentalAllergies ? `<div><em>Environmental:</em> ${utils.escapeHtml(data.environmentalAllergies)}</div>` : ''}
                    </div>
                </div>` : ''}
                
                ${data.emergencyInstructions ? `<div class="summary-item emergency-item">
                    <strong>🚨 Emergency Instructions:</strong>
                    <div class="emergency-text">${utils.escapeHtml(data.emergencyInstructions)}</div>
                </div>` : ''}
            </div>
        `;

        summaryElement.innerHTML = summaryHtml;
    },

    updateVaccinationSummary(vaccinations) {
        const summaryElement = document.getElementById('vaccination-summary');
        if (!summaryElement) return;

        if (!vaccinations || Object.keys(vaccinations).length === 0) {
            summaryElement.innerHTML = '<p class="text-muted">Vaccination status will appear here</p>';
            return;
        }

        const currentDate = new Date();
        const vaccinationHtml = Object.entries(vaccinations).map(([type, info]) => {
            const vacDate = new Date(info.date);
            const isExpiringSoon = (currentDate - vacDate) / (1000 * 60 * 60 * 24 * 365) > 0.8; // 80% of year
            const statusClass = isExpiringSoon ? 'vaccination-warning' : 'vaccination-current';
            
            return `
                <div class="vaccination-item ${statusClass}">
                    <div class="vaccination-name">${type.toUpperCase()}</div>
                    <div class="vaccination-date">${utils.formatDate(info.date)}</div>
                    <div class="vaccination-status">
                        <i data-feather="${isExpiringSoon ? 'alert-triangle' : 'check-circle'}"></i>
                        ${isExpiringSoon ? 'Due Soon' : 'Current'}
                    </div>
                </div>
            `;
        }).join('');

        summaryElement.innerHTML = vaccinationHtml;
        feather.replace();
    },

    initializeMedicationsAndVaccinations() {
        // Ensure at least one medication entry exists
        const medicationsList = document.getElementById('medications-list');
        if (medicationsList && medicationsList.children.length === 0) {
            this.addMedication();
        }
    },

    addMedication(medicationData = null) {
        const medicationsList = document.getElementById('medications-list');
        if (!medicationsList) return;

        const medicationEntry = document.createElement('div');
        medicationEntry.className = 'medication-entry';
        
        medicationEntry.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Medication Name</label>
                    <input type="text" name="medicationName[]" class="form-input" 
                           placeholder="e.g., Metacam" value="${medicationData?.name || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Dosage</label>
                    <input type="text" name="medicationDosage[]" class="form-input" 
                           placeholder="e.g., 5mg twice daily" value="${medicationData?.dosage || ''}">
                </div>
                <div class="form-group medication-actions">
                    <button type="button" class="btn btn-danger btn-sm" onclick="medicalPage.removeMedication(this)">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Purpose/Notes</label>
                <input type="text" name="medicationNotes[]" class="form-input" 
                       placeholder="e.g., For arthritis pain" value="${medicationData?.notes || ''}">
            </div>
        `;

        medicationsList.appendChild(medicationEntry);
        feather.replace();
    },

    removeMedication(button) {
        const medicationEntry = button.closest('.medication-entry');
        const medicationsList = document.getElementById('medications-list');
        
        // Don't remove if it's the only medication entry
        if (medicationsList.children.length > 1) {
            medicationEntry.remove();
        } else {
            // Clear the fields instead
            const inputs = medicationEntry.querySelectorAll('input');
            inputs.forEach(input => input.value = '');
        }
    },

    resetForm() {
        const confirmed = confirm('Are you sure you want to reset the form? All unsaved changes will be lost.');
        if (!confirmed) return;

        const form = document.getElementById('medical-form');
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

            // Reset medications to single entry
            const medicationsList = document.getElementById('medications-list');
            if (medicationsList) {
                medicationsList.innerHTML = '';
                this.addMedication();
            }
        }

        // Load original data
        this.loadMedicalData();
        
        app.showToast('Form reset successfully', 'success');
    },

    exportMedicalData() {
        if (!this.formData || Object.keys(this.formData).length === 0) {
            app.showToast('No medical data to export', 'warning');
            return;
        }

        const medicalReport = this.generateMedicalReport(this.formData);
        
        const blob = new Blob([medicalReport], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pet-medical-record-${app.nfcTagId}-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        app.showToast('Medical data exported successfully', 'success');
    },

    generateMedicalReport(data) {
        const petName = app.currentUser?.petName || 'Pet';
        const report = [
            `MEDICAL RECORD - ${petName}`,
            `NFC Tag ID: ${app.nfcTagId}`,
            `Generated: ${utils.formatDate(new Date(), 'long')}`,
            '',
            '--- BASIC INFORMATION ---',
            data.weight ? `Weight: ${data.weight} ${data.weightUnit || ''}` : '',
            data.height ? `Height: ${data.height} ${data.heightUnit || ''}` : '',
            data.microchipId ? `Microchip ID: ${data.microchipId}` : '',
            data.birthDate ? `Birth Date: ${data.birthDate}` : '',
            '',
            '--- VETERINARY CARE ---',
            data.veterinarianName ? `Veterinarian: ${data.veterinarianName}` : '',
            data.vetClinicName ? `Clinic: ${data.vetClinicName}` : '',
            data.vetPhone ? `Phone: ${data.vetPhone}` : '',
            data.vetEmail ? `Email: ${data.vetEmail}` : '',
            data.vetAddress ? `Address: ${data.vetAddress}` : '',
            '',
            '--- MEDICATIONS ---'
        ];

        if (data.medications && data.medications.length > 0) {
            data.medications.forEach((med, index) => {
                report.push(`${index + 1}. ${med.name}`);
                if (med.dosage) report.push(`   Dosage: ${med.dosage}`);
                if (med.notes) report.push(`   Notes: ${med.notes}`);
                report.push('');
            });
        } else {
            report.push('No current medications');
            report.push('');
        }

        report.push('--- ALLERGIES ---');
        if (data.foodAllergies) report.push(`Food Allergies: ${data.foodAllergies}`);
        if (data.medicationAllergies) report.push(`Medication Allergies: ${data.medicationAllergies}`);
        if (data.environmentalAllergies) report.push(`Environmental Allergies: ${data.environmentalAllergies}`);
        if (!this.hasAllergies(data)) report.push('No known allergies');
        
        report.push('');
        report.push('--- MEDICAL CONDITIONS ---');
        if (data.chronicConditions) report.push(`Chronic Conditions: ${data.chronicConditions}`);
        if (data.pastSurgeries) report.push(`Past Surgeries: ${data.pastSurgeries}`);
        if (data.behavioralIssues) report.push(`Behavioral Notes: ${data.behavioralIssues}`);
        
        report.push('');
        report.push('--- EMERGENCY INFORMATION ---');
        if (data.emergencyInstructions) report.push(data.emergencyInstructions);
        if (data.criticalMedications) report.push(`Critical Medications: ${data.criticalMedications}`);

        return report.filter(line => line !== null && line !== undefined).join('\n');
    },

    schedulePetCare() {
        document.getElementById('care-reminder-modal').style.display = 'flex';
    },

    closeCareReminderModal() {
        document.getElementById('care-reminder-modal').style.display = 'none';
    },

    async saveCareReminder(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const reminder = {
            id: utils.generateId('reminder'),
            type: formData.get('reminderType'),
            date: formData.get('reminderDate'),
            notes: formData.get('reminderNotes'),
            createdAt: new Date().toISOString(),
            isActive: true
        };

        try {
            // Save reminder (in a real app, this would sync with calendar)
            const reminders = utils.loadFromLocalStorage(`petTracker_reminders_${app.nfcTagId}`, []);
            reminders.push(reminder);
            utils.saveToLocalStorage(`petTracker_reminders_${app.nfcTagId}`, reminders);

            // Create GitHub issue for reminder
            await app.createGitHubIssue(
                `Care Reminder Scheduled - ${app.nfcTagId}`,
                `Care reminder scheduled for pet tracker ${app.nfcTagId}\n\n` +
                `Type: ${reminder.type}\n` +
                `Date: ${reminder.date}\n` +
                `Notes: ${reminder.notes || 'None'}\n` +
                `Created: ${reminder.createdAt}`,
                ['care-reminder', `tag-${app.nfcTagId}`]
            );

            this.closeCareReminderModal();
            app.showToast('Care reminder scheduled successfully!', 'success');

        } catch (error) {
            console.error('Failed to schedule reminder:', error);
            app.showToast('Failed to schedule reminder: ' + utils.formatError(error), 'error');
        }
    },

    contactVet() {
        if (!this.formData.vetPhone && !this.formData.vetEmail) {
            app.showToast('No veterinarian contact information available', 'warning');
            return;
        }

        const contactOptions = [];
        if (this.formData.vetPhone) {
            contactOptions.push(`<a href="tel:${this.formData.vetPhone}" class="btn btn-primary">
                <i data-feather="phone"></i> Call ${this.formData.vetPhone}
            </a>`);
        }
        if (this.formData.vetEmail) {
            contactOptions.push(`<a href="mailto:${this.formData.vetEmail}" class="btn btn-primary">
                <i data-feather="mail"></i> Email ${this.formData.vetEmail}
            </a>`);
        }

        const content = `
            <div class="vet-contact">
                <h3>Contact Veterinarian</h3>
                ${this.formData.veterinarianName ? `<p><strong>Dr. ${this.formData.veterinarianName}</strong></p>` : ''}
                ${this.formData.vetClinicName ? `<p>${this.formData.vetClinicName}</p>` : ''}
                <div class="contact-options">
                    ${contactOptions.join('')}
                </div>
            </div>
        `;

        app.showModal(content);
        feather.replace();
    },

    printMedicalCard() {
        if (!this.formData || Object.keys(this.formData).length === 0) {
            app.showToast('No medical information to print', 'warning');
            return;
        }

        const medicalReport = this.generateMedicalReport(this.formData);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Pet Medical Record</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            padding: 20px; 
                            line-height: 1.6;
                            color: #333;
                        }
                        h1 { 
                            color: #1C2526; 
                            margin-bottom: 20px; 
                            border-bottom: 2px solid #1C2526;
                            padding-bottom: 10px;
                        }
                        .emergency { 
                            background: #ffebee; 
                            padding: 10px; 
                            border-left: 4px solid #f44336; 
                            margin: 10px 0;
                        }
                        .section { 
                            margin-bottom: 20px; 
                            page-break-inside: avoid;
                        }
                        pre { 
                            white-space: pre-wrap; 
                            font-family: inherit;
                        }
                    </style>
                </head>
                <body>
                    <h1>Pet Medical Record</h1>
                    <div class="emergency">
                        <strong>EMERGENCY CONTACT:</strong><br>
                        ${this.formData.vetPhone ? `Veterinarian: ${this.formData.vetPhone}<br>` : ''}
                        Owner: ${app.currentUser?.contactInfo?.primaryPhone || 'Not available'}
                    </div>
                    <div class="section">
                        <pre>${medicalReport}</pre>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    },

    async reportMedicalEmergency() {
        if (!app.nfcTagId) {
            app.showToast('Please connect your pet tracker first', 'warning');
            return;
        }

        const emergencyContent = `
            <div class="medical-emergency-form">
                <h3>🚨 Medical Emergency</h3>
                <p class="emergency-warning">This will create a high-priority emergency alert.</p>
                
                <form onsubmit="medicalPage.submitMedicalEmergency(event)">
                    <div class="form-group">
                        <label class="form-label">Emergency Type:</label>
                        <select name="emergencyType" class="form-select" required>
                            <option value="">Select emergency type</option>
                            <option value="injured">Pet is Injured</option>
                            <option value="poisoned">Potential Poisoning</option>
                            <option value="allergic-reaction">Allergic Reaction</option>
                            <option value="seizure">Seizure</option>
                            <option value="respiratory">Breathing Problems</option>
                            <option value="unconscious">Unconscious</option>
                            <option value="other">Other Medical Emergency</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Symptoms/Details:</label>
                        <textarea name="symptoms" class="form-textarea" 
                                  placeholder="Describe the symptoms and current condition..." 
                                  rows="4" required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Current Location:</label>
                        <textarea name="location" class="form-textarea" 
                                  placeholder="Where is the pet right now?" 
                                  rows="2"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="contactVet" checked>
                            Send alert to veterinarian (if contact info available)
                        </label>
                    </div>
                    
                    <div class="emergency-info">
                        <strong>This alert will include:</strong>
                        <ul>
                            <li>Pet's medical history and allergies</li>
                            <li>Current medications</li>
                            <li>Emergency contact information</li>
                            <li>Veterinarian contact details</li>
                        </ul>
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

    async submitMedicalEmergency(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const emergency = {
            type: 'medical',
            emergencyType: formData.get('emergencyType'),
            symptoms: formData.get('symptoms'),
            location: formData.get('location'),
            contactVet: formData.get('contactVet') === 'on',
            medicalHistory: this.formData,
            timestamp: new Date().toISOString()
        };

        app.showLoading(true);

        try {
            // Create high-priority GitHub issue
            const emergencyReport = this.generateEmergencyReport(emergency);
            
            await app.createGitHubIssue(
                `🚨 MEDICAL EMERGENCY - ${app.nfcTagId}`,
                emergencyReport,
                ['medical-emergency', 'high-priority', 'urgent', `tag-${app.nfcTagId}`]
            );

            app.hideModal();
            app.showToast('Medical emergency alert sent successfully!', 'success');

            // Show emergency contact information
            this.showEmergencyContacts();

        } catch (error) {
            console.error('Failed to send medical emergency alert:', error);
            app.showToast('Failed to send emergency alert: ' + utils.formatError(error), 'error');
        } finally {
            app.showLoading(false);
        }
    },

    generateEmergencyReport(emergency) {
        const petName = app.currentUser?.petName || 'Pet';
        const ownerInfo = app.currentUser?.contactInfo || {};
        
        let report = `MEDICAL EMERGENCY ALERT\n`;
        report += `Pet: ${petName}\n`;
        report += `NFC Tag: ${app.nfcTagId}\n`;
        report += `Emergency Type: ${emergency.emergencyType}\n`;
        report += `Time: ${utils.formatDate(emergency.timestamp, 'long')}\n\n`;
        
        report += `SYMPTOMS/CONDITION:\n${emergency.symptoms}\n\n`;
        
        if (emergency.location) {
            report += `CURRENT LOCATION:\n${emergency.location}\n\n`;
        }
        
        report += `OWNER CONTACT:\n`;
        report += `Name: ${ownerInfo.ownerName || 'Not available'}\n`;
        report += `Phone: ${ownerInfo.primaryPhone || 'Not available'}\n`;
        if (ownerInfo.email) report += `Email: ${ownerInfo.email}\n`;
        report += `\n`;
        
        if (this.formData.veterinarianName) {
            report += `VETERINARIAN:\n`;
            report += `Name: ${this.formData.veterinarianName}\n`;
            if (this.formData.vetClinicName) report += `Clinic: ${this.formData.vetClinicName}\n`;
            if (this.formData.vetPhone) report += `Phone: ${this.formData.vetPhone}\n`;
            if (this.formData.vetEmail) report += `Email: ${this.formData.vetEmail}\n`;
            report += `\n`;
        }
        
        report += `CRITICAL MEDICAL INFORMATION:\n`;
        
        if (this.hasAllergies(this.formData)) {
            report += `⚠️ ALLERGIES:\n`;
            if (this.formData.foodAllergies) report += `Food: ${this.formData.foodAllergies}\n`;
            if (this.formData.medicationAllergies) report += `Medications: ${this.formData.medicationAllergies}\n`;
            if (this.formData.environmentalAllergies) report += `Environmental: ${this.formData.environmentalAllergies}\n`;
            report += `\n`;
        }
        
        if (this.formData.medications && this.formData.medications.length > 0) {
            report += `CURRENT MEDICATIONS:\n`;
            this.formData.medications.forEach((med, index) => {
                report += `${index + 1}. ${med.name}`;
                if (med.dosage) report += ` - ${med.dosage}`;
                if (med.notes) report += ` (${med.notes})`;
                report += `\n`;
            });
            report += `\n`;
        }
        
        if (this.formData.chronicConditions) {
            report += `CHRONIC CONDITIONS:\n${this.formData.chronicConditions}\n\n`;
        }
        
        if (this.formData.emergencyInstructions) {
            report += `EMERGENCY INSTRUCTIONS:\n${this.formData.emergencyInstructions}\n\n`;
        }
        
        return report;
    },

    showEmergencyContacts() {
        const contacts = [];
        
        if (this.formData.vetPhone) {
            contacts.push({
                name: `${this.formData.veterinarianName || 'Veterinarian'} ${this.formData.vetClinicName ? `(${this.formData.vetClinicName})` : ''}`,
                phone: this.formData.vetPhone,
                type: 'vet'
            });
        }
        
        if (app.currentUser?.contactInfo?.primaryPhone) {
            contacts.push({
                name: 'Pet Owner',
                phone: app.currentUser.contactInfo.primaryPhone,
                type: 'owner'
            });
        }
        
        if (app.currentUser?.contactInfo?.emergencyPhone) {
            contacts.push({
                name: app.currentUser.contactInfo.emergencyName || 'Emergency Contact',
                phone: app.currentUser.contactInfo.emergencyPhone,
                type: 'emergency'
            });
        }
        
        const contactsHtml = contacts.map(contact => `
            <div class="emergency-contact-item">
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-phone">${contact.phone}</div>
                </div>
                <a href="tel:${contact.phone}" class="btn btn-danger">
                    <i data-feather="phone"></i>
                    Call Now
                </a>
            </div>
        `).join('');
        
        const content = `
            <div class="emergency-contacts">
                <h3>🚨 Emergency Contacts</h3>
                <p>Alert sent successfully. Contact these numbers immediately:</p>
                <div class="contacts-list">
                    ${contactsHtml}
                </div>
                <div class="emergency-note">
                    <p><strong>Note:</strong> Emergency responders have been notified with your pet's medical information.</p>
                </div>
            </div>
        `;
        
        app.showModal(content);
        feather.replace();
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
medicalPage.init();
