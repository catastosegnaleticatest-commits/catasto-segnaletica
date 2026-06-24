import {
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    createUserWithEmailAndPassword,
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider,
    onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';

// Converti username in email sintetica per Firebase Auth
const toEmail = (username) => `${username.toLowerCase().trim()}@catasto.local`;

export const authService = {
    // Login con username + password
    async login(username, password) {
        const email = toEmail(username);
        const cred  = await signInWithEmailAndPassword(auth, email, password);
        const profile = await authService.getUserProfile(cred.user.uid);
        if (!profile) throw new Error('Profilo utente non trovato. Contatta l\'amministratore.');
        return { uid: cred.user.uid, username: profile.username, role: profile.role, requiresPasswordChange: profile.requiresPasswordChange || false };
    },

    async logout() {
        await signOut(auth);
    },

    // Crea utente (solo admin)
    async createUser(username, password, role) {
        const email = toEmail(username);
        const cred  = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', cred.user.uid), {
            username,
            role,
            email,
            requiresPasswordChange: true,
            createdAt: new Date().toISOString(),
        });
        return cred.user.uid;
    },

    // Cambio password (utente corrente)
    async changePassword(currentPassword, newPassword) {
        const user = auth.currentUser;
        if (!user) throw new Error('Nessun utente autenticato');
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPassword);
        await updateDoc(doc(db, 'users', user.uid), { requiresPasswordChange: false });
    },

    // Reset password da admin (genera password temporanea)
    async resetUserPassword(uid, tempPassword) {
        // Firebase Admin SDK non disponibile lato client — usiamo un workaround:
        // scriviamo la richiesta di reset in Firestore e la gestiamo manualmente
        await updateDoc(doc(db, 'users', uid), {
            pendingPasswordReset: tempPassword,
            requiresPasswordChange: true,
        });
        return { tempPassword };
    },

    // Profilo utente da Firestore
    async getUserProfile(uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? { uid, ...snap.data() } : null;
    },

    // Lista tutti gli utenti (solo admin)
    async listUsers() {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    },

    // Elimina utente (solo admin — richiede re-auth o Firebase Admin)
    async deleteUserProfile(uid) {
        await deleteDoc(doc(db, 'users', uid));
        // Nota: l'account Firebase Auth non viene eliminato lato client senza Admin SDK
        // L'utente non potrà più accedere perché il profilo Firestore è rimosso
    },

    // Aggiorna ruolo utente
    async updateUserRole(uid, role) {
        await updateDoc(doc(db, 'users', uid), { role });
    },

    // Observer per cambio stato auth
    onAuthChange(callback) {
        return onAuthStateChanged(auth, callback);
    },

    currentUser() {
        return auth.currentUser;
    },
};

export default authService;
