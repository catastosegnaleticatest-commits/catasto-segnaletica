import { describe, it, expect, vi } from 'vitest';
import {
    loginSchema,
    registerSchema,
    changePasswordSchema,
    updateUserSchema,
    createSignSchema,
    updateSignSchema,
    createInterventionSchema,
    updateInterventionSchema,
    validateBody,
} from './schemas.js';

describe('loginSchema', () => {
    it('accetta username e password validi', () => {
        const result = loginSchema.safeParse({ username: 'admin', password: 'admin123' });
        expect(result.success).toBe(true);
    });

    it('rifiuta username vuoto', () => {
        const result = loginSchema.safeParse({ username: '', password: 'admin123' });
        expect(result.success).toBe(false);
    });

    it('rifiuta password vuota', () => {
        const result = loginSchema.safeParse({ username: 'admin', password: '' });
        expect(result.success).toBe(false);
    });

    it('rifiuta campi mancanti', () => {
        const result = loginSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

describe('registerSchema', () => {
    it('accetta dati validi senza role', () => {
        const result = registerSchema.safeParse({ username: 'mario', password: 'segreta123' });
        expect(result.success).toBe(true);
    });

    it('rifiuta username troppo corto', () => {
        const result = registerSchema.safeParse({ username: 'ab', password: 'segreta123' });
        expect(result.success).toBe(false);
    });

    it('rifiuta password troppo corta', () => {
        const result = registerSchema.safeParse({ username: 'mario', password: '123' });
        expect(result.success).toBe(false);
    });

    it('rifiuta un role non valido', () => {
        const result = registerSchema.safeParse({ username: 'mario', password: 'segreta123', role: 'superadmin' });
        expect(result.success).toBe(false);
    });

    it('accetta i role validi', () => {
        for (const role of ['admin', 'operatore', 'tecnico']) {
            const result = registerSchema.safeParse({ username: 'mario', password: 'segreta123', role });
            expect(result.success).toBe(true);
        }
    });
});

describe('changePasswordSchema', () => {
    it('accetta password valide', () => {
        const result = changePasswordSchema.safeParse({ currentPassword: 'vecchia', newPassword: 'nuova123' });
        expect(result.success).toBe(true);
    });

    it('rifiuta newPassword troppo corta', () => {
        const result = changePasswordSchema.safeParse({ currentPassword: 'vecchia', newPassword: '123' });
        expect(result.success).toBe(false);
    });

    it('rifiuta currentPassword vuota', () => {
        const result = changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'nuova123' });
        expect(result.success).toBe(false);
    });
});

describe('updateUserSchema', () => {
    it('accetta un role valido', () => {
        expect(updateUserSchema.safeParse({ role: 'admin' }).success).toBe(true);
    });

    it('rifiuta un role non valido', () => {
        expect(updateUserSchema.safeParse({ role: 'superuser' }).success).toBe(false);
    });
});

describe('createSignSchema', () => {
    const validSign = {
        type: 'stop',
        latitude: 45.5,
        longitude: 9.2,
        status: 'buono',
        installation_date: '2024-01-01',
        notes: 'nota',
    };

    it('accetta un segnale valido senza foto', () => {
        const result = createSignSchema.safeParse(validSign);
        expect(result.success).toBe(true);
    });

    it('accetta una foto base64 valida', () => {
        const result = createSignSchema.safeParse({
            ...validSign,
            photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        });
        expect(result.success).toBe(true);
    });

    it('rifiuta una foto con formato non valido', () => {
        const result = createSignSchema.safeParse({
            ...validSign,
            photo: 'not-a-valid-data-url',
        });
        expect(result.success).toBe(false);
    });

    it('rifiuta latitudine fuori range', () => {
        const result = createSignSchema.safeParse({ ...validSign, latitude: 200 });
        expect(result.success).toBe(false);
    });

    it('rifiuta longitudine fuori range', () => {
        const result = createSignSchema.safeParse({ ...validSign, longitude: -200 });
        expect(result.success).toBe(false);
    });

    it('rifiuta type mancante o vuoto', () => {
        expect(createSignSchema.safeParse({ ...validSign, type: '' }).success).toBe(false);
        const { type, ...withoutType } = validSign;
        expect(createSignSchema.safeParse(withoutType).success).toBe(false);
    });

    it('rifiuta uno status non valido', () => {
        const result = createSignSchema.safeParse({ ...validSign, status: 'rotto' });
        expect(result.success).toBe(false);
    });
});

describe('updateSignSchema', () => {
    it('richiede uno status valido (a differenza della create non è opzionale)', () => {
        const base = { type: 'stop', latitude: 45.5, longitude: 9.2 };
        expect(updateSignSchema.safeParse(base).success).toBe(false);
        expect(updateSignSchema.safeParse({ ...base, status: 'buono' }).success).toBe(true);
    });
});

describe('createInterventionSchema', () => {
    const validIntervention = {
        sign_id: 1,
        type: 'manutenzione',
        scheduled_date: '2024-02-01',
        cost: 100.5,
        notes: 'nota',
    };

    it('accetta un intervento valido', () => {
        expect(createInterventionSchema.safeParse(validIntervention).success).toBe(true);
    });

    it('rifiuta sign_id non intero o non positivo', () => {
        expect(createInterventionSchema.safeParse({ ...validIntervention, sign_id: 1.5 }).success).toBe(false);
        expect(createInterventionSchema.safeParse({ ...validIntervention, sign_id: -1 }).success).toBe(false);
        expect(createInterventionSchema.safeParse({ ...validIntervention, sign_id: 0 }).success).toBe(false);
    });

    it('rifiuta cost negativo', () => {
        expect(createInterventionSchema.safeParse({ ...validIntervention, cost: -5 }).success).toBe(false);
    });

    it('rifiuta type vuoto', () => {
        expect(createInterventionSchema.safeParse({ ...validIntervention, type: '' }).success).toBe(false);
    });
});

describe('updateInterventionSchema', () => {
    const validUpdate = {
        type: 'manutenzione',
        scheduled_date: '2024-02-01',
        completed_date: null,
        status: 'programmato',
        cost: 50,
        notes: null,
    };

    it('accetta un aggiornamento valido', () => {
        expect(updateInterventionSchema.safeParse(validUpdate).success).toBe(true);
    });

    it('rifiuta uno status non valido', () => {
        expect(updateInterventionSchema.safeParse({ ...validUpdate, status: 'sospeso' }).success).toBe(false);
    });

    it('accetta tutti gli status validi', () => {
        for (const status of ['programmato', 'in_corso', 'completato', 'annullato']) {
            expect(updateInterventionSchema.safeParse({ ...validUpdate, status }).success).toBe(true);
        }
    });
});

describe('validateBody middleware', () => {
    function createRes() {
        return {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
        };
    }

    it('chiama next() e normalizza req.body quando i dati sono validi', () => {
        const req = { body: { username: 'admin', password: 'pwd' } };
        const res = createRes();
        const next = vi.fn();

        validateBody(loginSchema)(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.statusCode).toBeNull();
        expect(req.body).toEqual({ username: 'admin', password: 'pwd' });
    });

    it('risponde 400 con i dettagli degli errori quando i dati non sono validi', () => {
        const req = { body: { username: '', password: '' } };
        const res = createRes();
        const next = vi.fn();

        validateBody(loginSchema)(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Dati non validi');
        expect(Array.isArray(res.body.details)).toBe(true);
        expect(res.body.details.length).toBeGreaterThan(0);
    });
});
