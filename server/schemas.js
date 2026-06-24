import { z } from 'zod';

// === AUTH ===

export const loginSchema = z.object({
    username: z.string().trim().min(1, 'Username obbligatorio'),
    password: z.string().min(1, 'Password obbligatoria'),
});

export const registerSchema = z.object({
    username: z.string().trim().min(3, 'Username troppo corto').max(50),
    password: z.string().min(6, 'Password troppo corta (minimo 6 caratteri)'),
    role: z.enum(['admin', 'operatore', 'tecnico']).optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Password attuale obbligatoria'),
    newPassword: z.string().min(6, 'La nuova password deve avere almeno 6 caratteri'),
});

// === USERS ===

export const updateUserSchema = z.object({
    role: z.enum(['admin', 'operatore', 'tecnico']),
});

// === SIGNS ===

const photoSchema = z.string().regex(/^data:image\/[a-zA-Z]+;base64,/, 'Formato foto non valido').optional().nullable();

export const pdfDocSchema = z.string().regex(/^data:application\/pdf;base64,/, 'Formato documento non valido (solo PDF)').optional().nullable();

export const createSignSchema = z.object({
    type: z.string().trim().min(1, 'Tipo segnale obbligatorio'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    status: z.enum(['buono', 'danneggiato', 'da_sostituire', 'rimosso']).optional(),
    installation_date: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    ordinanza_rif: z.string().trim().max(255).optional().nullable(),
    numero_autorizzazione: z.string().trim().max(100).optional().nullable(),
    proprietario: z.string().trim().max(255).optional().nullable(),
    is_emergency: z.boolean().optional(),
    support_id: z.number().int().positive().optional().nullable(),
    installation_height_cm: z.number().int().gte(0).lte(500).optional().nullable(),
    closest_civic_number: z.string().trim().max(50).optional().nullable(),
    location_context: z.enum(['marciapiede', 'pista_ciclabile', 'carreggiata']).optional().nullable(),
    street_name: z.string().trim().max(255).optional().nullable(),
    road_segment: z.string().trim().max(100).optional().nullable(),
    carriageway_side: z.enum(['destra', 'sinistra', 'centro', 'ambo_i_lati']).optional().nullable(),
    dimensions: z.string().trim().max(50).optional().nullable(),
    reflective_class: z.enum(['classe1', 'classe2', 'classe3']).optional().nullable(),
    photo: photoSchema,
    ordinanza_doc: pdfDocSchema,
    ordinanza_doc_name: z.string().trim().max(255).optional().nullable(),
});

export const updateSignSchema = z.object({
    type: z.string().trim().min(1, 'Tipo segnale obbligatorio'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    status: z.enum(['buono', 'danneggiato', 'da_sostituire', 'rimosso']),
    installation_date: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    ordinanza_rif: z.string().trim().max(255).optional().nullable(),
    numero_autorizzazione: z.string().trim().max(100).optional().nullable(),
    proprietario: z.string().trim().max(255).optional().nullable(),
    is_emergency: z.boolean().optional(),
    support_id: z.number().int().positive().optional().nullable(),
    installation_height_cm: z.number().int().gte(0).lte(500).optional().nullable(),
    closest_civic_number: z.string().trim().max(50).optional().nullable(),
    location_context: z.enum(['marciapiede', 'pista_ciclabile', 'carreggiata']).optional().nullable(),
    street_name: z.string().trim().max(255).optional().nullable(),
    road_segment: z.string().trim().max(100).optional().nullable(),
    carriageway_side: z.enum(['destra', 'sinistra', 'centro', 'ambo_i_lati']).optional().nullable(),
    dimensions: z.string().trim().max(50).optional().nullable(),
    reflective_class: z.enum(['classe1', 'classe2', 'classe3']).optional().nullable(),
    photo: photoSchema,
    ordinanza_doc: pdfDocSchema,
    ordinanza_doc_name: z.string().trim().max(255).optional().nullable(),
});

export const bulkImportSignsSchema = z.object({
    signs: z.array(createSignSchema).min(1, 'Nessun segnale da importare').max(5000, 'Troppi segnali (massimo 5000 per volta)'),
});

// === SUPPORTS (Pali / Portali / Staffe) ===

export const createSupportSchema = z.object({
    street_name: z.string().trim().min(1, 'Via obbligatoria'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    type: z.enum(['palo', 'portale', 'staffa_muro']),
    condition: z.string().trim().optional().nullable(),
    last_inspected_at: z.string().optional().nullable(),
});

export const updateSupportSchema = createSupportSchema;

// === PAVEMENT DEFECTS (Dissesti stradali) ===

export const createPavementDefectSchema = z.object({
    street_name: z.string().trim().min(1, 'Via obbligatoria'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    defect_type: z.enum(['buca', 'avvallamento', 'crepa', 'cedimento']),
    severity: z.enum(['bassa', 'media', 'alta_emergenza']),
    photo: photoSchema,
    description: z.string().optional().nullable(),
    status: z.enum(['segnalato', 'preso_in_carico', 'ripristinato']).optional(),
});

export const updatePavementDefectSchema = z.object({
    street_name: z.string().trim().min(1, 'Via obbligatoria'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    defect_type: z.enum(['buca', 'avvallamento', 'crepa', 'cedimento']),
    severity: z.enum(['bassa', 'media', 'alta_emergenza']),
    description: z.string().optional().nullable(),
    status: z.enum(['segnalato', 'preso_in_carico', 'ripristinato']).optional(),
});

// === ROAD MARKINGS (Segnaletica Orizzontale) ===

export const createRoadMarkingSchema = z.object({
    street_name: z.string().trim().min(1, 'Via obbligatoria'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    marking_type: z.enum(['strisce_pedonali', 'mezzeria', 'stop', 'arresto', 'ciclabile', 'parcheggio', 'altro']),
    material: z.enum(['vernice', 'termoplastico', 'resina', 'vernice_premiscelata']),
    status: z.enum(['ottimo', 'buono', 'discreto', 'da_rifare']).optional(),
    length_m: z.number().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
    photo: photoSchema,
    parent_vertical_id: z.number().int().positive().optional().nullable(),
    geometry_json: z.string().optional().nullable(),
});

export const updateRoadMarkingSchema = z.object({
    street_name: z.string().trim().min(1, 'Via obbligatoria'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    marking_type: z.enum(['strisce_pedonali', 'mezzeria', 'stop', 'arresto', 'ciclabile', 'parcheggio', 'altro']),
    material: z.enum(['vernice', 'termoplastico', 'resina', 'vernice_premiscelata']),
    status: z.enum(['ottimo', 'buono', 'discreto', 'da_rifare']).optional(),
    length_m: z.number().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
    photo: photoSchema,
});

// === TRAFFIC LIGHTS (Impianti Semaforici) ===

export const createTrafficLightSchema = z.object({
    location_name: z.string().trim().min(1, 'Ubicazione obbligatoria'),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    type: z.enum(['intersezione', 'pedonale', 'pedonale_a_chiamata', 'lanterna_singola']),
    status: z.enum(['operativo', 'guasto', 'manutenzione', 'fuori_servizio']).optional(),
    last_maintenance_date: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const updateTrafficLightSchema = createTrafficLightSchema;

export const createTrafficLightInterventionSchema = z.object({
    traffic_light_id: z.number().int().positive(),
    type: z.string().trim().min(1, 'Tipo intervento obbligatorio'),
    scheduled_date: z.string().optional().nullable(),
    cost: z.number().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const updateTrafficLightInterventionSchema = z.object({
    type: z.string().trim().min(1, 'Tipo intervento obbligatorio'),
    scheduled_date: z.string().optional().nullable(),
    completed_date: z.string().optional().nullable(),
    status: z.enum(['programmato', 'in_corso', 'completato', 'annullato']),
    cost: z.number().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
});

// === CONTRACTS / PRICE LIST / COMMITMENTS ===

export const createContractSchema = z.object({
    cig: z.string().trim().optional().nullable(),
    company: z.string().trim().min(1, 'Azienda obbligatoria'),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    total_budget: z.number().nonnegative().optional().nullable(),
});

export const createPriceListItemSchema = z.object({
    contract_id: z.number().int().positive(),
    item_code: z.string().trim().optional().nullable(),
    description: z.string().trim().min(1, 'Descrizione obbligatoria'),
    unit_price: z.number().nonnegative(),
});

export const createCommitmentSchema = z.object({
    contract_id: z.number().int().positive(),
    resolution_number: z.string().trim().optional().nullable(),
    allocated_amount: z.number().nonnegative(),
});

// === INTERVENTIONS ===

export const createInterventionSchema = z.object({
    sign_id: z.number().int().positive(),
    type: z.string().trim().min(1, 'Tipo intervento obbligatorio'),
    scheduled_date: z.string().optional().nullable(),
    price_list_id: z.number().int().positive('Voce di listino obbligatoria'),
    quantity: z.number().positive('La quantità deve essere maggiore di zero'),
    commitment_id: z.number().int().positive().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const updateInterventionSchema = z.object({
    type: z.string().trim().min(1, 'Tipo intervento obbligatorio'),
    scheduled_date: z.string().optional().nullable(),
    completed_date: z.string().optional().nullable(),
    status: z.enum(['programmato', 'in_corso', 'completato', 'verificato_pattuglia', 'liquidato', 'annullato']),
    notes: z.string().optional().nullable(),
});

// === ACCIDENT LOGS ===

export const createAccidentLogSchema = z.object({
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    date: z.string().optional().nullable(),
    severity: z.enum(['lieve', 'media', 'grave', 'mortale']).optional().nullable(),
});

// === SEGNALAZIONI UFFICIO TRIBUTI (verifica passi carrabili) ===

export const createTaxReportSchema = z.object({
    sign_id: z.number().int().positive().optional().nullable(),
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    numero_rilevato: z.string().trim().max(100).optional().nullable(),
    motivo: z.enum(['non_censito', 'numero_non_corrispondente']),
    note: z.string().optional().nullable(),
});

// === PROGETTI E VARIANTI VIABILITA (Simulazione AI) ===

export const createTrafficProjectSchema = z.object({
    project_name: z.string().trim().min(1, 'Nome progetto obbligatorio'),
    target_streets: z.string().trim().min(1, 'Via/zona target obbligatoria'),
});

export const simulateViabilitySchema = z.object({
    project_id: z.number().int().positive().optional(),
    project_name: z.string().trim().min(1).optional(),
    target_streets: z.string().trim().min(1).optional(),
    modification_request: z.string().trim().min(1, 'Descrizione modifica obbligatoria'),
}).refine(data => data.project_id || (data.project_name && data.target_streets), {
    message: 'Specificare project_id oppure project_name e target_streets',
});

// === MIDDLEWARE ===

export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Dati non validi',
                details: result.error.issues.map(issue => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
        }
        req.body = result.data;
        next();
    };
}
