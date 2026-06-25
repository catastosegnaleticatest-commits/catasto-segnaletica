import {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';

// Helper audit log — fire-and-forget, non blocca mai l'operazione principale
function _audit(operation, table, recordId, details = {}) {
    const username = auth.currentUser?.email?.replace('@catasto.local', '') || 'sistema';
    addDoc(collection(db, 'audit_log'), {
        operation,
        table_name: table,
        record_id: String(recordId ?? ''),
        details: JSON.stringify(details),
        username,
        timestamp: new Date().toISOString(),
    }).catch(() => {});
}

// ─── Compressione foto ────────────────────────────────────────────────────────
// Firestore: max 1 MB per documento. Comprimiamo a ~120 KB base64 max.
async function compressPhoto(dataUrl, maxW = 800, maxH = 600, quality = 0.55) {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image/')) { resolve(null); return; }
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

// ─── Segnali ─────────────────────────────────────────────────────────────────
export const signsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'signs'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async get(id) {
        const snap = await getDoc(doc(db, 'signs', id));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async create(data) {
        const photo = data.photo ? await compressPhoto(data.photo) : null;
        const ref = await addDoc(collection(db, 'signs'), {
            ...data,
            photo,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'signs', ref.id, { type: data.type, status: data.status });
        return { id: ref.id, ...data, photo };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        if (data.photo && data.photo.startsWith('data:image/')) {
            update.photo = await compressPhoto(data.photo);
        }
        await updateDoc(doc(db, 'signs', id), update);
        _audit('UPDATE', 'signs', id, { fields: Object.keys(data) });
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'signs', id));
        _audit('DELETE', 'signs', id);
    },

    // Listener real-time (aggiorna la UI automaticamente)
    subscribe(callback) {
        const q = query(collection(db, 'signs'), orderBy('created_at', 'desc'));
        return onSnapshot(q, snap => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    },

    // Import bulk da mobile
    async bulkImport(signsArray) {
        const batch = writeBatch(db);
        let count = 0;
        for (const s of signsArray) {
            const photo = s.photo || s._photo
                ? await compressPhoto(s.photo || s._photo)
                : null;
            const ref = doc(collection(db, 'signs'));
            batch.set(ref, {
                type: s.type,
                latitude: s.latitude,
                longitude: s.longitude,
                status: s.status || 'buono',
                notes: s.notes || null,
                photo,
                installation_date: s.installation_date || null,
                ordinanza_rif: s.ordinanza_rif || null,
                numero_autorizzazione: s.numero_autorizzazione || null,
                proprietario: s.proprietario || null,
                created_at: s.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            count++;
            // Firestore batch max 500 operazioni
            if (count % 499 === 0) { await batch.commit(); }
        }
        await batch.commit();
        return { count };
    },
};

// ─── Interventi ──────────────────────────────────────────────────────────────
export const interventionsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'interventions'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getBySignId(signId) {
        const snap = await getDocs(query(
            collection(db, 'interventions'),
            where('sign_id', '==', String(signId)),
            orderBy('created_at', 'desc'),
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async create(data) {
        const ref = await addDoc(collection(db, 'interventions'), {
            ...data,
            sign_id: String(data.sign_id),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'interventions', ref.id, { sign_id: data.sign_id, type: data.type });
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'interventions', id), update);
        _audit('UPDATE', 'interventions', id, { status: data.status });
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'interventions', id));
        _audit('DELETE', 'interventions', id);
    },

    subscribe(callback) {
        const q = query(collection(db, 'interventions'), orderBy('created_at', 'desc'));
        return onSnapshot(q, snap => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    },
};

// ─── Segnaletica Orizzontale ─────────────────────────────────────────────────
export const roadMarkingsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'road_markings'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async create(data) {
        const ref = await addDoc(collection(db, 'road_markings'), {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'road_markings', ref.id, { type: data.type });
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'road_markings', id), update);
        _audit('UPDATE', 'road_markings', id, { status: data.status });
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'road_markings', id));
        _audit('DELETE', 'road_markings', id);
    },
};

// ─── Impianti Semaforici ─────────────────────────────────────────────────────
export const trafficLightsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'traffic_lights'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async create(data) {
        const ref = await addDoc(collection(db, 'traffic_lights'), {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'traffic_lights', ref.id, { location: data.location });
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'traffic_lights', id), update);
        _audit('UPDATE', 'traffic_lights', id, { status: data.status });
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'traffic_lights', id));
        _audit('DELETE', 'traffic_lights', id);
    },
};

// ─── Interventi Semaforici ────────────────────────────────────────────────────
export const trafficLightInterventionsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'traffic_light_interventions'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async create(data) {
        const ref = await addDoc(collection(db, 'traffic_light_interventions'), {
            ...data,
            traffic_light_id: String(data.traffic_light_id),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'traffic_light_interventions', ref.id, { traffic_light_id: data.traffic_light_id });
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'traffic_light_interventions', id), update);
        _audit('UPDATE', 'traffic_light_interventions', id, { status: data.status });
        return { id, ...update };
    },
};

// ─── Dissesti Stradali ───────────────────────────────────────────────────────
export const pavementDefectsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'pavement_issues'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async create(data) {
        const photo = data.photo ? await compressPhoto(data.photo) : null;
        const ref = await addDoc(collection(db, 'pavement_issues'), {
            ...data, photo, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'pavement_issues', ref.id, { type: data.type });
        return { id: ref.id, ...data, photo };
    },
    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'pavement_issues', id), update);
        _audit('UPDATE', 'pavement_issues', id, { status: data.status });
        return { id, ...update };
    },
    async delete(id) {
        await deleteDoc(doc(db, 'pavement_issues', id));
        _audit('DELETE', 'pavement_issues', id);
    },
    async forward(id) {
        const snap = await getDoc(doc(db, 'pavement_issues', id));
        const defect = { id: snap.id, ...snap.data() };
        const transmission = { forwarded_at: new Date().toISOString(), forwarded_to: 'Ufficio Tecnico' };
        await updateDoc(doc(db, 'pavement_issues', id), { status: 'preso_in_carico', ...transmission, updated_at: new Date().toISOString() });
        _audit('UPDATE', 'pavement_issues', id, { status: 'preso_in_carico', forwarded_to: 'Ufficio Tecnico' });
        return { defect: { ...defect, ...transmission, status: 'preso_in_carico' }, transmission };
    },
};

// ─── Segnalazioni Passi Carrai ────────────────────────────────────────────────
export const taxReportsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'tax_reports'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async create(data) {
        const ref = await addDoc(collection(db, 'tax_reports'), {
            ...data, status: 'aperta', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'tax_reports', ref.id, { address: data.address });
        return { id: ref.id, ...data };
    },
    async updateStatus(id, status) {
        await updateDoc(doc(db, 'tax_reports', id), { status, updated_at: new Date().toISOString() });
        _audit('UPDATE', 'tax_reports', id, { status });
    },
};

// ─── Accordi Quadro ──────────────────────────────────────────────────────────
export const contractsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'contracts'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async create(data) {
        const ref = await addDoc(collection(db, 'contracts'), {
            ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        _audit('INSERT', 'contracts', ref.id, { name: data.name });
        return { id: ref.id, ...data };
    },
    async update(id, data) {
        await updateDoc(doc(db, 'contracts', id), { ...data, updated_at: new Date().toISOString() });
        _audit('UPDATE', 'contracts', id, { fields: Object.keys(data) });
    },
    async delete(id) {
        await deleteDoc(doc(db, 'contracts', id));
        _audit('DELETE', 'contracts', id);
    },
};

// ─── Tariffario ──────────────────────────────────────────────────────────────
export const priceListService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'price_list'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async create(data) {
        const ref = await addDoc(collection(db, 'price_list'), {
            ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        return { id: ref.id, ...data };
    },
    async delete(id) { await deleteDoc(doc(db, 'price_list', id)); },
};

// ─── Impegni di Spesa ────────────────────────────────────────────────────────
export const commitmentsService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'commitments'), orderBy('created_at', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async create(data) {
        const ref = await addDoc(collection(db, 'commitments'), {
            ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        return { id: ref.id, ...data };
    },
    async delete(id) { await deleteDoc(doc(db, 'commitments', id)); },
};

// ─── Audit Log ───────────────────────────────────────────────────────────────
export const auditLogService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'audit_log'), orderBy('timestamp', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async log(operation, tableName, recordId, details, username) {
        await addDoc(collection(db, 'audit_log'), {
            operation, table_name: tableName, record_id: String(recordId),
            details: JSON.stringify(details), username: username || 'sistema',
            timestamp: new Date().toISOString(),
        });
    },
};

// ─── Feedback utenti (CommandBar) ────────────────────────────────────────────
export const feedbacksService = {
    async getAll() {
        const snap = await getDocs(query(collection(db, 'feedbacks'), orderBy('date', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async create(text, username) {
        await addDoc(collection(db, 'feedbacks'), {
            text,
            username: username || 'anonimo',
            date: new Date().toISOString(),
        });
    },
};

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getStats() {
    const [signsSnap, interventionsSnap] = await Promise.all([
        getDocs(collection(db, 'signs')),
        getDocs(collection(db, 'interventions')),
    ]);
    return {
        totalSigns: signsSnap.size,
        totalInterventions: interventionsSnap.size,
        pendingSync: 0,
        online: true,
    };
}
