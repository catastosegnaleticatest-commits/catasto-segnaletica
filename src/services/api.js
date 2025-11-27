// Servizio per gestire la comunicazione con il backend
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
console.log('🔗 API URL configurato:', API_URL);

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
        this.socket = null;
        this.isServerOnline = false;
    }

    // Connetti WebSocket
    connectSocket() {
        if (this.socket) return this.socket;

        this.socket = io(API_URL, {
            auth: { token: this.token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            console.log('✅ Connesso al server');
            this.isServerOnline = true;
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnesso dal server');
            this.isServerOnline = false;
        });

        return this.socket;
    }

    // Disconnetti WebSocket
    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Headers per richieste autenticate
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    // Salva token
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    // Rimuovi token
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
        this.disconnectSocket();
    }

    // === AUTH ===
    async login(username, password) {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore di login');
        }

        const data = await response.json();
        this.setToken(data.token);
        return data;
    }

    async register(username, password, role) {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ username, password, role })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore di registrazione');
        }

        return await response.json();
    }

    async changePassword(currentPassword, newPassword) {
        const response = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore durante il cambio password');
        }

        return await response.json();
    }

    async resetUserPassword(userId, newPassword = 'password123') {
        const response = await fetch(`${API_URL}/api/users/${userId}/reset-password`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ newPassword })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore durante il reset della password');
        }

        return await response.json();
    }

    // === SIGNS ===
    async getSigns() {
        const response = await fetch(`${API_URL}/api/signs`, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error('Errore nel caricamento dei segnali');
        return await response.json();
    }

    async getSign(id) {
        const response = await fetch(`${API_URL}/api/signs/${id}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error('Segnale non trovato');
        return await response.json();
    }

    async createSign(signData) {
        const response = await fetch(`${API_URL}/api/signs`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(signData)
        });

        if (!response.ok) throw new Error('Errore nella creazione del segnale');
        return await response.json();
    }

    async updateSign(id, signData) {
        const response = await fetch(`${API_URL}/api/signs/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(signData)
        });

        if (!response.ok) throw new Error('Errore nell\'aggiornamento del segnale');
        return await response.json();
    }

    async deleteSign(id) {
        const response = await fetch(`${API_URL}/api/signs/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error('Errore nell\'eliminazione del segnale');
        return await response.json();
    }

    // Ottieni URL foto (con token nell'header, non come query param)
    getPhotoUrl(signId) {
        return `${API_URL}/api/signs/${signId}/photo`;
    }

    // Ottieni tutte le foto di un segnale
    async getSignPhotos(signId) {
        const response = await fetch(`${API_URL}/api/signs/${signId}/photos`, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error('Errore nel recupero delle foto');
        return await response.json();
    }

    // Carica foto dal server come blob e converte in data URL
    async getPhotoAsDataUrl(signId) {
        try {
            const response = await fetch(`${API_URL}/api/signs/${signId}/photo`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error('Foto non trovata');
            }

            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Errore caricamento foto dal server:', error);
            return null;
        }
    }

    // Carica foto specifica per ID
    async getPhotoByIdAsDataUrl(photoId) {
        try {
            const response = await fetch(`${API_URL}/api/photos/${photoId}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error('Foto non trovata');
            }

            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Errore caricamento foto:', error);
            return null;
        }
    }

    // Carica una nuova foto per un segnale
    async uploadPhoto(signId, photoDataUrl, isPrimary = false) {
        try {
            console.log(`📸 Tentativo upload foto per segnale ${signId}, isPrimary: ${isPrimary}`);
            console.log(`📏 Dimensione data URL: ${photoDataUrl ? photoDataUrl.length : 0} caratteri`);
            
            const headers = this.getHeaders();
            console.log(`🔗 URL: ${API_URL}/api/signs/${signId}/photos`);
            console.log(`🔑 Headers:`, headers);

            const requestBody = {
                photo: photoDataUrl, // Invia il data URL, il server lo crittografa
                is_primary: isPrimary
            };

            const response = await fetch(`${API_URL}/api/signs/${signId}/photos`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            console.log(`📡 Risposta ricevuta: status ${response.status}, type: ${response.headers.get('content-type')}`);

            // Verifica se la risposta è JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ Risposta non JSON dal server:', text.substring(0, 500));
                console.error('📋 Status:', response.status);
                console.error('📋 Headers:', Object.fromEntries(response.headers.entries()));
                
                // Se è HTML, probabilmente è una pagina di errore
                if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                    throw new Error(`Il server ha restituito HTML invece di JSON (status ${response.status}). Verifica i log su Render. L'endpoint potrebbe non essere disponibile.`);
                }
                
                throw new Error(`Risposta non valida dal server (status ${response.status}): ${text.substring(0, 100)}`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Errore dal server:', errorData);
                throw new Error(errorData.error || errorData.details || 'Errore nel caricamento della foto');
            }

            const result = await response.json();
            console.log('✅ Foto caricata con successo:', result);
            return result;
        } catch (error) {
            console.error('❌ Errore upload foto:', error);
            if (error.message.includes('Unexpected token')) {
                throw new Error('Il server non ha ancora il codice aggiornato. Attendi il deploy su Render o riavvia il server.');
            }
            throw error;
        }
    }

    // Elimina una foto
    async deletePhoto(photoId) {
        const response = await fetch(`${API_URL}/api/photos/${photoId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore nell\'eliminazione della foto');
        }

        return await response.json();
    }

    // Imposta foto primaria
    async setPrimaryPhoto(photoId) {
        const response = await fetch(`${API_URL}/api/photos/${photoId}/primary`, {
            method: 'PUT',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore nell\'aggiornamento della foto primaria');
        }

        return await response.json();
    }

    // === INTERVENTIONS ===
    async getInterventions() {
        const response = await fetch(`${API_URL}/api/interventions`, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error('Errore nel caricamento degli interventi');
        return await response.json();
    }

    async createIntervention(interventionData) {
        const response = await fetch(`${API_URL}/api/interventions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(interventionData)
        });

        if (!response.ok) throw new Error('Errore nella creazione dell\'intervento');
        return await response.json();
    }

    // === STATUS ===
    async getServerStatus() {
        try {
            const response = await fetch(`${API_URL}/api/status`);
            if (!response.ok) throw new Error('Server offline');
            const data = await response.json();
            this.isServerOnline = data.online;
            return data;
        } catch (error) {
            this.isServerOnline = false;
            throw error;
        }
    }
}

export default new ApiService();
