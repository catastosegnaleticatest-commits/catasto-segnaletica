import {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

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
        return { id: ref.id, ...data, photo };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        if (data.photo && data.photo.startsWith('data:image/')) {
            update.photo = await compressPhoto(data.photo);
        }
        await updateDoc(doc(db, 'signs', id), update);
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'signs', id));
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
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'interventions', id), update);
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'interventions', id));
    },

    subscribe(callback) {
        const q = query(collection(db, 'interventions'), orderBy('created_at', 'desc'));
        return onSnapshot(q, snap => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
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
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'traffic_lights', id), update);
        return { id, ...update };
    },

    async delete(id) {
        await deleteDoc(doc(db, 'traffic_lights', id));
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
        return { id: ref.id, ...data };
    },

    async update(id, data) {
        const update = { ...data, updated_at: new Date().toISOString() };
        await updateDoc(doc(db, 'traffic_light_interventions', id), update);
        return { id, ...update };
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
