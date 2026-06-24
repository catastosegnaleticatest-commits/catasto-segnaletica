import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Importato dinamicamente in initAiEngine per non rallentare l'avvio del server
let getLlama = null;
let LlamaChatSession = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelPath = process.env.CATASTO_MODEL_PATH || path.join(__dirname, '../models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf');

let llama = null;
let model = null;
let modelAvailable = false;

export async function initAiEngine() {
    if (!fs.existsSync(modelPath)) {
        console.warn(`⚠️  Modello AI non trovato in ${modelPath}. Le funzioni di simulazione AI saranno disabilitate.`);
        return;
    }
    try {
        // Import dinamico: carica node-llama-cpp solo quando effettivamente necessario
        const llamaCpp = await import('node-llama-cpp');
        getLlama = llamaCpp.getLlama;
        LlamaChatSession = llamaCpp.LlamaChatSession;

        llama = await getLlama({ gpu: 'auto' });
        const gpuInfo = llama.gpu ? `GPU: ${llama.gpu}` : 'CPU only';
        model = await llama.loadModel({ modelPath, gpuLayers: 999 });
        modelAvailable = true;
        console.log(`🤖 Motore AI locale inizializzato (${gpuInfo}):`, modelPath);
    } catch (error) {
        console.error('⚠️  Errore inizializzazione motore AI locale:', error.message);
        modelAvailable = false;
    }
}

export function isAiAvailable() {
    return modelAvailable;
}

export async function executeLocalChat(systemPrompt, userPrompt) {
    if (!modelAvailable) {
        throw new Error('Motore AI locale non disponibile: file modello .gguf mancante nella cartella /models');
    }
    const context = await model.createContext();
    try {
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt
        });
        return await session.prompt(userPrompt);
    } finally {
        await context.dispose();
    }
}

export async function executeJsonInference(systemPrompt, userPrompt) {
    const raw = await executeLocalChat(systemPrompt, userPrompt);
    return repairAndParseJson(raw);
}

function repairAndParseJson(raw) {
    let text = raw.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
        text = text.substring(start, end + 1);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('Risposta AI non interpretabile come JSON: ' + error.message);
    }
}

function repairAndParseJsonObject(raw) {
    let text = raw.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        text = text.substring(start, end + 1);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('Risposta AI non interpretabile come JSON oggetto: ' + error.message);
    }
}

function fallbackFeedbackAnalysis(text) {
    const lower = text.toLowerCase();
    const isBug = /errore|bug|crash|non funziona|problema|sbagliato|fallisce|rotto/.test(lower);
    const isSuggestion = /sarebbe|potrebbe|suggerisco|aggiungere|migliorare|vorrei|feature|funzione/.test(lower);
    const isMap = /mappa|cartina|marker|punto|posizione|coordinate/.test(lower);
    const isInterventi = /intervento|interventi|manutenzione|riparazione/.test(lower);
    const isArchivio = /archivio|segnale|catasto|importa|esporta/.test(lower);
    return {
        category: isBug ? 'bug' : isSuggestion ? 'suggerimento' : 'apprezzamento',
        priority: isBug ? 'alta' : 'media',
        summary: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
        impacted_area: isMap ? 'mappa' : isInterventi ? 'interventi' : isArchivio ? 'archivio' : 'generale',
    };
}

export async function analyzeUserFeedback(rawText) {
    const systemPrompt = `Agisci come un analista di applicativi software QA. Analizza il feedback in linguaggio naturale dell'utente e categorizzalo rigorosamente. Genera un output esclusivamente in formato JSON valido: { "category": "bug"|"suggerimento"|"apprezzamento", "priority": "bassa"|"media"|"alta", "summary": "breve sintesi in italiano", "impacted_area": "mappa"|"interventi"|"archivio"|"generale" }`;
    if (!modelAvailable) {
        return fallbackFeedbackAnalysis(rawText);
    }
    try {
        const raw = await executeLocalChat(systemPrompt, rawText);
        return repairAndParseJsonObject(raw);
    } catch {
        return fallbackFeedbackAnalysis(rawText);
    }
}
