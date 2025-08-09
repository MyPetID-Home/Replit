# Pet Tracker

## Overview

Pet Tracker is a modern web application that provides comprehensive pet tracking and management services using NFC (Near Field Communication) technology. The application allows pet owners to store and access their pet's information, track location, manage medical records, and maintain contact information through NFC tags. Built as a Jekyll-based static site hosted on GitHub Pages, it combines client-side functionality with cloud integrations for data persistence and user authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application follows a **Single Page Application (SPA) pattern** built with vanilla JavaScript and Jekyll templating:

- **Client-Side Routing**: Custom router system (`router.js`) handles navigation between pages without full page reloads
- **Component-Based Structure**: Each page (home, contact, location, medical) has dedicated HTML, CSS, and JavaScript files in the `/pages` directory
- **Layout System**: Jekyll layouts provide consistent page structure with `global-app-layout.html` as the main app wrapper
- **State Management**: Centralized application state managed through the `PetTrackerApp` class with local storage persistence

### Authentication System
The application implements **OAuth-based authentication** with Patreon integration:

- **Patreon OAuth**: Primary authentication method for enhanced features and user management
- **Token-Based Security**: Uses Bearer tokens for API authentication with automatic validation
- **Local Storage**: Maintains authentication state across browser sessions with validation checks
- **Anonymous Usage**: Core functionality available without authentication when NFC tag is present

### Data Storage Strategy
The architecture uses a **hybrid approach** for data persistence:

- **GitHub Issues API**: Primary data storage using GitHub repository issues as a database-like system
- **Local Storage**: Client-side caching and offline functionality for user data
- **MongoDB Integration**: Prepared for future database integration with connection string configuration
- **NFC Tag Identification**: Uses NFC tag IDs as unique identifiers for pet records

### NFC Integration
The system is designed around **NFC tag-based pet identification**:

- **Tag Registration**: Associates NFC tags with pet profiles and owner information
- **URL-Based Access**: NFC tags redirect to application URLs with embedded tag identifiers
- **Device Detection**: Automatically detects NFC-capable devices and provides appropriate interfaces
- **Fallback Support**: Manual tag ID entry for devices without NFC capabilities

### Page Architecture
Each functional area follows a **modular page structure**:

- **Home Dashboard**: Central hub displaying pet status, quick actions, and recent activity
- **Contact Management**: Form-based system for managing pet and owner contact information
- **Location Tracking**: Interactive mapping with real-time location updates and geofencing
- **Medical Records**: Comprehensive health information management with medication tracking

## External Dependencies

### Third-Party Services
- **GitHub Pages**: Static site hosting and content delivery
- **GitHub API**: Issue-based data storage and repository integration for pet records
- **Patreon API**: OAuth authentication and user profile management
- **Feather Icons**: Icon library for consistent UI elements throughout the application

### JavaScript Libraries
- **Feather Icons**: Lightweight icon system for UI components
- **Font Awesome**: Additional icon library for enhanced visual elements (loaded via CDN)

### Planned Integrations
- **MongoDB**: Database integration prepared with connection string configuration
- **Google Maps API**: Interactive mapping functionality for location tracking features
- **Geolocation API**: Browser-based location services for real-time pet tracking

### Development Tools
- **Jekyll**: Static site generator for GitHub Pages compatibility
- **CSS Custom Properties**: Modern CSS variable system for consistent theming
- **ES6+ JavaScript**: Modern JavaScript features with class-based architecture
- **LocalStorage API**: Browser storage for offline functionality and data caching
