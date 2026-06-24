import { useState, useEffect } from 'react';
import { getSignAgeYears, isSignExpired, MAX_SIGN_LIFESPAN_YEARS } from '../utils/signLifespan';
import { useContractsData } from '../hooks/useContractsData';
import apiService from '../services/api';
import { getPriorityMultiplier } from '../utils/geo';

const DEFECT_BASE_SEVERITY = { bassa: 1, media: 1.5, alta_emergenza: 3 };
const SIGN_BASE_SEVERITY = { danneggiato: 2, da_sostituire: 1.5, buono: 1, rimosso: 1 };

function BarChart({ data, colorFn }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '90px', fontSize: '0.8rem', color: 'var(--gray-600)', textAlign: 'right', flexShrink: 0, textTransform: 'capitalize' }}>
                        {item.label}
                    </div>
                    <div style={{ flex: 1, background: 'var(--gray-200)', borderRadius: '999px', height: '22px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(item.value / max) * 100}%`,
                            background: colorFn ? colorFn(item.label) : 'var(--primary)',
                            borderRadius: '999px',
                            transition: 'width 0.5s ease',
                            minWidth: item.value > 0 ? '28px' : '0',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px'
                        }}>
                            {item.value > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: '700' }}>{item.value}</span>
                            )}
                        </div>
                    </div>
                    {item.value === 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>0</span>
                    )}
                </div>
            ))}
        </div>
    );
}

function DonutChart({ data }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '1rem' }}>Nessun dato</div>;

    let offset = 0;
    const radius = 60;
    const circumference = 2 * Math.PI * radius;

    const segments = data.map(item => {
        const pct = item.value / total;
        const seg = { ...item, offset, pct, dash: pct * circumference };
        offset += pct * circumference;
        return seg;
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <svg viewBox="0 0 160 160" style={{ width: '120px', height: '120px', flexShrink: 0 }}>
                {segments.map((seg, i) => (
                    <circle
                        key={i}
                        cx="80" cy="80" r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="28"
                        strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                        strokeDashoffset={-seg.offset}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                    />
                ))}
                <text x="80" y="84" textAnchor="middle" style={{ fontSize: '18px', fontWeight: '700', fill: '#1f2937' }}>{total}</text>
                <text x="80" y="100" textAnchor="middle" style={{ fontSize: '9px', fill: '#6b7280' }}>TOTALE</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {data.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color, flexShrink: 0 }}></div>
                        <span style={{ textTransform: 'capitalize' }}>{item.label}</span>
                        <span style={{ fontWeight: '700', marginLeft: 'auto', paddingLeft: '1rem' }}>
                            {item.value} <span style={{ color: 'var(--gray-400)', fontWeight: '400' }}>({Math.round((item.value / total) * 100)}%)</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CostBarChart({ data }) {
    const max = Math.max(...data.map(d => d.value), 1);
    if (data.length === 0) return <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '1rem' }}>Nessun dato</div>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '90px', fontSize: '0.8rem', color: 'var(--gray-600)', textAlign: 'right', flexShrink: 0, textTransform: 'capitalize' }}>
                        {item.label}
                    </div>
                    <div style={{ flex: 1, background: 'var(--gray-200)', borderRadius: '999px', height: '22px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(item.value / max) * 100}%`,
                            background: item.color || 'var(--primary)',
                            borderRadius: '999px',
                            transition: 'width 0.5s ease',
                            minWidth: item.value > 0 ? '50px' : '0',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px'
                        }}>
                            {item.value > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: '700' }}>€ {item.value.toFixed(2)}</span>
                            )}
                        </div>
                    </div>
                    {item.value === 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>€ 0</span>
                    )}
                </div>
            ))}
        </div>
    );
}

function ContractComparisonChart({ budget, committed, spent }) {
    const data = [
        { label: 'Budget Totale', value: budget, color: '#3b82f6' },
        { label: 'Impegni Attivati', value: committed, color: '#f59e0b' },
        { label: 'Spesa Liquidata', value: spent, color: '#10b981' },
    ];
    return <CostBarChart data={data} />;
}

function StatCard({ icon, value, label, color = 'var(--primary)', sub, large }) {
    return (
        <div className="bento-card" style={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: large ? '2.25rem' : '1.75rem' }}>{icon}</span>
                <div>
                    <div style={{ fontSize: large ? '2.25rem' : '1.75rem', fontWeight: '800', lineHeight: 1, color }}>{value}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: '0.15rem' }}>{label}</div>
                    {sub && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '0.1rem' }}>{sub}</div>}
                </div>
            </div>
        </div>
    );
}

const TYPE_COLORS = {
    divieto: '#ef4444',
    obbligo: '#3b82f6',
    pericolo: '#f59e0b',
    indicazione: '#10b981',
    precedenza: '#8b5cf6'
};

const STATUS_COLORS = {
    buono: '#10b981',
    danneggiato: '#ef4444',
    da_sostituire: '#f59e0b',
    rimosso: '#6b7280'
};

const INTERVENTION_STATUS_COLORS = {
    programmato: '#f59e0b',
    in_corso: '#3b82f6',
    completato: '#10b981',
    verificato_pattuglia: '#8b5cf6',
    liquidato: '#0d9488',
    annullato: '#6b7280'
};

function Dashboard({ signs, interventions }) {
    // === Accordi Quadro / Appalti ===
    const { contracts, priceList, commitments } = useContractsData();

    // === Dissesti Stradali (Buche) ===
    const [pavementDefects, setPavementDefects] = useState([]);
    useEffect(() => {
        apiService.getPavementDefects()
            .then(setPavementDefects)
            .catch(err => console.error('Errore caricamento dissesti:', err));
    }, []);
    const unresolvedEmergencyDefects = pavementDefects.filter(
        d => d.severity === 'alta_emergenza' && d.status !== 'ripristinato'
    );

    // === Zone Sensibili (geofencing per coda priorità spaziale) ===
    const [sensitiveZones, setSensitiveZones] = useState([]);
    useEffect(() => {
        apiService.getSensitiveZones()
            .then(setSensitiveZones)
            .catch(err => console.error('Errore caricamento zone sensibili:', err));
    }, []);

    // === Matrice Priorità Interventi ===
    const [priorityMatrix, setPriorityMatrix] = useState([]);
    useEffect(() => {
        apiService.getPriorityMatrix()
            .then(setPriorityMatrix)
            .catch(() => setPriorityMatrix([]));
    }, [interventions]);

    const withPriority = (lat, lng, baseScore) => {
        const { multiplier, zone } = getPriorityMultiplier(parseFloat(lat), parseFloat(lng), sensitiveZones);
        return { priorityScore: baseScore * multiplier, priorityZone: zone };
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const contractStats = contracts.map(c => {
        const contractCommitments = commitments.filter(cm => cm.contract_id === c.id);
        const committedSum = contractCommitments.reduce((sum, cm) => sum + parseFloat(cm.allocated_amount || 0), 0);

        const contractPriceIds = new Set(priceList.filter(p => p.contract_id === c.id).map(p => p.id));
        const commitmentIds = new Set(contractCommitments.map(cm => cm.id));
        const spentSum = interventions
            .filter(i => i.status === 'liquidato' && i.cost &&
                (contractPriceIds.has(i.price_list_id) || commitmentIds.has(i.commitment_id)))
            .reduce((sum, i) => sum + parseFloat(i.cost), 0);

        const totalBudget = parseFloat(c.total_budget || 0);
        const residual = totalBudget - committedSum;
        const residualPct = totalBudget > 0 ? (residual / totalBudget) * 100 : null;

        const daysToExpiry = c.end_date
            ? Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
            : null;

        return {
            ...c,
            committedSum,
            spentSum,
            totalBudget,
            residual,
            residualPct,
            daysToExpiry,
            isExpiringSoon: daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 90,
            isLowResidual: residualPct !== null && residualPct < 15,
        };
    });

    const contractAlerts = contractStats.filter(c => c.isExpiringSoon || c.isLowResidual);

    // Segnali per tipo
    const byType = ['divieto', 'obbligo', 'pericolo', 'indicazione', 'precedenza'].map(t => ({
        label: t,
        value: signs.filter(s => s.type === t).length,
        color: TYPE_COLORS[t]
    }));

    // Segnali per stato
    const byStatus = ['buono', 'danneggiato', 'da_sostituire', 'rimosso'].map(s => ({
        label: s,
        value: signs.filter(sg => sg.status === s).length,
        color: STATUS_COLORS[s]
    }));

    // Interventi per stato
    const interventionsByStatus = ['programmato', 'in_corso', 'completato', 'verificato_pattuglia', 'liquidato', 'annullato'].map(s => ({
        label: s.replace('_', ' '),
        value: interventions.filter(i => i.status === s).length,
        color: INTERVENTION_STATUS_COLORS[s]
    }));

    // Emergenze stradali attive
    const emergencySigns = signs.filter(s => s.is_emergency);

    // Proiezione fiscale: segnali danneggiati/da sostituire senza intervento attivo collegato
    const activeInterventionSignIds = new Set(
        interventions.filter(i => i.status !== 'annullato').map(i => i.sign_id)
    );
    const signsNeedingIntervention = signs.filter(s =>
        ['danneggiato', 'da_sostituire'].includes(s.status) && !activeInterventionSignIds.has(s.id)
    );
    const avgUnitPrice = priceList.length > 0
        ? priceList.reduce((sum, p) => sum + parseFloat(p.unit_price || 0), 0) / priceList.length
        : 0;
    const fiscalProjection = signsNeedingIntervention.length * avgUnitPrice;

    // Segnali scaduti per usura della pellicola rifrangente (oltre la durata legale)
    const expiredSigns = signs
        .filter(s => isSignExpired(s.installation_date))
        .sort((a, b) => new Date(a.installation_date) - new Date(b.installation_date));

    // Interventi programmati con scadenza superata (non ancora avviati)
    const overdueInterventions = interventions
        .filter(i => i.status === 'programmato' && i.scheduled_date && new Date(i.scheduled_date) < today)
        .map(i => {
            const sign = signs.find(s => s.id === i.sign_id || s.id === parseInt(i.sign_id));
            const baseScore = SIGN_BASE_SEVERITY[sign?.status] ?? 1;
            const { priorityScore, priorityZone } = sign
                ? withPriority(sign.latitude, sign.longitude, baseScore)
                : { priorityScore: baseScore, priorityZone: null };
            return { ...i, priorityScore, priorityZone };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.scheduled_date) - new Date(b.scheduled_date));

    // Dissesti attivi (non ripristinati), ordinati per coda di priorità spaziale
    const activeDefects = pavementDefects
        .filter(d => d.status !== 'ripristinato')
        .map(d => {
            const baseScore = DEFECT_BASE_SEVERITY[d.severity] ?? 1;
            const { priorityScore, priorityZone } = withPriority(d.latitude, d.longitude, baseScore);
            return { ...d, priorityScore, priorityZone };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore);

    // Segnali da sincronizzare
    const unsyncedCount = signs.filter(s => !s.synced).length;
    const damagedCount = signs.filter(s => s.status === 'danneggiato').length;
    const pendingInterventions = interventions.filter(i => i.status === 'programmato' || i.status === 'in_corso').length;

    // Costo totale interventi completati
    const completedCost = interventions
        .filter(i => i.status === 'completato' && i.cost)
        .reduce((sum, i) => sum + parseFloat(i.cost), 0);

    // Costo totale di TUTTI gli interventi inseriti (qualsiasi stato)
    const totalCost = interventions
        .filter(i => i.cost)
        .reduce((sum, i) => sum + parseFloat(i.cost), 0);

    // === Controllo Budget ===
    // Budget impegnato per il futuro: interventi programmati o in corso
    const committedInterventions = interventions.filter(i => (i.status === 'programmato' || i.status === 'in_corso') && i.cost);
    const committedCost = committedInterventions.reduce((sum, i) => sum + parseFloat(i.cost), 0);
    const completedInterventions = interventions.filter(i => i.status === 'completato' && i.cost);

    const getSignType = (signId) => {
        const sign = signs.find(s => s.id === signId || s.id === parseInt(signId));
        return sign ? sign.type : 'altro';
    };

    const groupCostByType = (list) => {
        const totals = {};
        list.forEach(i => {
            const t = getSignType(i.sign_id);
            totals[t] = (totals[t] || 0) + parseFloat(i.cost);
        });
        return Object.entries(totals)
            .map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] || 'var(--primary)' }))
            .sort((a, b) => b.value - a.value);
    };

    const groupCostByMonth = (list, dateField) => {
        const totals = {};
        list.forEach(i => {
            const dateStr = i[dateField] || i.scheduled_date || i.created_at;
            if (!dateStr) return;
            const d = new Date(dateStr);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            totals[key] = (totals[key] || 0) + parseFloat(i.cost);
        });
        return Object.entries(totals)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, value]) => {
                const [year, month] = key.split('-');
                const label = new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
                return { label, value, color: '#0ea5e9' };
            });
    };

    const spentByType = groupCostByType(completedInterventions);
    const committedByType = groupCostByType(committedInterventions);
    const spentByMonth = groupCostByMonth(completedInterventions, 'completed_date');
    const committedByMonth = groupCostByMonth(committedInterventions, 'scheduled_date');

    // Segnali integri vs degradati
    const degradedStatuses = ['danneggiato', 'da_sostituire', 'rimosso'];
    const integriCount = signs.filter(s => !degradedStatuses.includes(s.status)).length;
    const degradatiCount = signs.filter(s => degradedStatuses.includes(s.status)).length;
    const integrityData = [
        { label: 'Integri', value: integriCount, color: '#10b981' },
        { label: 'Degradati', value: degradatiCount, color: '#ef4444' }
    ];

    if (signs.length === 0 && interventions.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>Nessun dato disponibile</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Aggiungi dei segnali per vedere le statistiche</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Banner Emergenze Stradali Attive */}
            {emergencySigns.length > 0 && (
                <div
                    className="animate-pulse-warning"
                    style={{
                        background: '#dc2626',
                        color: 'white',
                        borderRadius: 'var(--border-radius)',
                        padding: '1rem 1.5rem',
                        fontWeight: '800',
                        fontSize: '1.1rem',
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(220,38,38,0.4)'
                    }}
                >
                    🚨 EMERGENZE STRADALI ATTIVE — {emergencySigns.length} segnal{emergencySigns.length === 1 ? 'e' : 'i'} in stato di emergenza
                </div>
            )}

            {/* Banner Dissesti Stradali in Emergenza */}
            {unresolvedEmergencyDefects.length > 0 && (
                <div
                    className="animate-pulse-warning"
                    style={{
                        background: '#dc2626',
                        color: 'white',
                        borderRadius: 'var(--border-radius)',
                        padding: '1rem 1.5rem',
                        fontWeight: '800',
                        fontSize: '1.1rem',
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(220,38,38,0.4)'
                    }}
                >
                    🕳️ DISSESTI IN EMERGENZA — {unresolvedEmergencyDefects.length} buc{unresolvedEmergencyDefects.length === 1 ? 'a' : 'he'} non ripristinat{unresolvedEmergencyDefects.length === 1 ? 'a' : 'e'} ad alta gravità
                </div>
            )}

            {/* KPI cards — bento grid */}
            <div className="bento-grid">
                <div className="bento-2">
                    <StatCard icon="📍" value={signs.length} label="Segnali totali" color="var(--primary)" large />
                </div>
                <div className="bento-1">
                    <StatCard icon="❌" value={damagedCount} label="Danneggiati" color="#ef4444"
                        sub={signs.length > 0 ? `${Math.round((damagedCount / signs.length) * 100)}% del totale` : ''} />
                </div>
                <div className="bento-1">
                    <StatCard icon="🔧" value={pendingInterventions} label="Interventi in corso" color="#f59e0b" />
                </div>
                <div className="bento-1">
                    <StatCard icon="✅" value={interventions.filter(i => i.status === 'completato').length} label="Completati" color="#10b981"
                        sub={completedCost > 0 ? `€ ${completedCost.toFixed(2)}` : ''} />
                </div>
                <div className="bento-2">
                    <StatCard icon="💰" value={`€ ${totalCost.toFixed(2)}`} label="Costo Totale Interventi" color="#0ea5e9"
                        sub={`${interventions.filter(i => i.cost).length} interventi con costo`} />
                </div>
                {expiredSigns.length > 0 && (
                    <div className="bento-1">
                        <StatCard icon="⏳" value={expiredSigns.length} label="Scaduti usura" color="#ef4444"
                            sub={`oltre ${MAX_SIGN_LIFESPAN_YEARS} anni`} />
                    </div>
                )}
                {unsyncedCount > 0 && (
                    <div className="bento-1">
                        <StatCard icon="🔄" value={unsyncedCount} label="Da sincronizzare" color="#6b7280" />
                    </div>
                )}
            </div>

            {/* Alert: segnali scaduti per usura della pellicola rifrangente */}
            {expiredSigns.length > 0 && (
                <div className="card" style={{ border: '2px solid #ef4444', background: '#fef2f2' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#ef4444' }}>
                        ⚠️ Segnale Scaduto per Usura Materiale — Piani di Sostituzione ({expiredSigns.length})
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                        La pellicola rifrangente di questi segnali ha superato i {MAX_SIGN_LIFESPAN_YEARS} anni dalla data di installazione e non garantisce più i requisiti minimi di visibilità notturna.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #fecaca', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>ID</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Tipo</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Data Installazione</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Età</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Posizione</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expiredSigns.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid #fecaca' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>#{s.id}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{s.type}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            {new Date(s.installation_date).toLocaleDateString('it-IT')}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <span className="badge badge-danger">{getSignAgeYears(s.installation_date).toFixed(1)} anni</span>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {parseFloat(s.latitude).toFixed(5)}, {parseFloat(s.longitude).toFixed(5)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Alert Scadenze: interventi programmati e scaduti */}
            {overdueInterventions.length > 0 && (
                <div className="card" style={{ border: '2px solid #ef4444', background: '#fef2f2' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#ef4444' }}>
                        🚨 Alert Scadenze — Interventi Programmati Scaduti ({overdueInterventions.length})
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                        Ordinati per priorità spaziale: interventi in zone sensibili (Scuole, Ospedali, ZTL) salgono in cima alla coda operativa.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #fecaca', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Priorità</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Segnale</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Tipo Intervento</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Data Programmata</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Giorni di Ritardo</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Zona Sensibile</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overdueInterventions.map(i => {
                                    const daysLate = Math.floor((today - new Date(i.scheduled_date)) / (1000 * 60 * 60 * 24));
                                    return (
                                        <tr key={i.id} style={{ borderBottom: '1px solid #fecaca' }}>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{i.priorityScore.toFixed(2)}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#ef4444' }}>#{i.sign_id}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{i.type}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: '#ef4444' }}>
                                                {new Date(i.scheduled_date).toLocaleDateString('it-IT')}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                <span className="badge badge-danger">{daysLate} {daysLate === 1 ? 'giorno' : 'giorni'}</span>
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                {i.priorityZone ? `🏫 ${i.priorityZone.name}` : '-'}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--gray-600)' }}>{i.notes || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Dissesti Attivi - coda priorità spaziale */}
            {activeDefects.length > 0 && (
                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#b45309' }}>
                        🕳️ Dissesti Attivi — Coda Priorità Spaziale ({activeDefects.length})
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                        Priorità = Gravità Base × Moltiplicatore Zona Sensibile. Un dissesto a bassa gravità in area Scuole/Ospedali può precedere un'anomalia di gravità media su un tratto isolato.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Priorità</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Via</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Tipo</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Gravità</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Stato</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Zona Sensibile</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeDefects.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{d.priorityScore.toFixed(2)}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{d.street_name}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{d.defect_type}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{d.severity.replace('_', ' ')}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{d.status.replace('_', ' ')}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            {d.priorityZone ? `🏫 ${d.priorityZone.name}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Monitoraggio Accordi Quadro */}
            {contracts.length > 0 && (
                <div className="card">
                    <h3 className="section-title">
                        📑 Monitoraggio Accordi Quadro
                    </h3>

                    {contractAlerts.length > 0 && (
                        <div style={{ border: '2px solid #ef4444', background: '#fef2f2', borderRadius: 'var(--border-radius)', padding: '1rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.75rem' }}>
                                ⚠️ Attenzione — Accordi Quadro da Verificare ({contractAlerts.length})
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                                {contractAlerts.map(c => (
                                    <li key={c.id} style={{ marginBottom: '0.35rem' }}>
                                        <strong>{c.company}</strong>{c.cig ? ` (CIG ${c.cig})` : ''}
                                        {c.isExpiringSoon && (
                                            <span> — ⏳ in scadenza {c.daysToExpiry === 0 ? 'oggi' : `tra ${c.daysToExpiry} giorni`} ({new Date(c.end_date).toLocaleDateString('it-IT')})</span>
                                        )}
                                        {c.isLowResidual && (
                                            <span> — 💸 budget residuo basso: € {c.residual.toFixed(2)} ({c.residualPct.toFixed(1)}% del totale)</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                        {contractStats.map(c => (
                            <div key={c.id}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                                    {c.company}{c.cig ? ` — CIG ${c.cig}` : ''}
                                    {c.end_date && (
                                        <span style={{ fontWeight: '400', color: 'var(--gray-500)', fontSize: '0.8rem' }}>
                                            {' '}(scadenza {new Date(c.end_date).toLocaleDateString('it-IT')})
                                        </span>
                                    )}
                                </h4>
                                <ContractComparisonChart budget={c.totalBudget} committed={c.committedSum} spent={c.spentSum} />
                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.4rem' }}>
                                    {c.residualPct !== null
                                        ? `Budget residuo: € ${c.residual.toFixed(2)} (${c.residualPct.toFixed(1)}%)`
                                        : 'Budget totale non definito'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Proiezione Fiscale: segnali da intervenire senza intervento attivo */}
            {signsNeedingIntervention.length > 0 && (
                <div className="card">
                    <h3 className="section-title">
                        📈 Proiezione Fiscale — Segnali da Sostituire/Riparare
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        <StatCard icon="🔴" value={signsNeedingIntervention.length} label="Segnali senza intervento attivo" color="#ef4444"
                            sub="Stato danneggiato / da sostituire" />
                        <StatCard icon="💶" value={`€ ${fiscalProjection.toFixed(2)}`} label="Stima Costo Complessivo" color="#0ea5e9"
                            sub={avgUnitPrice > 0 ? `Prezzo medio unitario: € ${avgUnitPrice.toFixed(2)}` : 'Nessuna voce di tariffario disponibile'} />
                    </div>
                </div>
            )}

            {/* Controllo Budget */}
            {interventions.some(i => i.cost) && (
                <div className="card">
                    <h3 className="section-title">
                        💰 Controllo Budget
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <StatCard icon="✅" value={`€ ${completedCost.toFixed(2)}`} label="Spesa Totale Sostenuta" color="#10b981"
                            sub={`${completedInterventions.length} interventi completati`} />
                        <StatCard icon="📅" value={`€ ${committedCost.toFixed(2)}`} label="Budget Impegnato Futuro" color="#f59e0b"
                            sub={`${committedInterventions.length} interventi programmati/in corso`} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: '#10b981' }}>
                                Spesa Sostenuta per Tipologia Segnale
                            </h4>
                            <CostBarChart data={spentByType} />
                        </div>
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: '#f59e0b' }}>
                                Budget Impegnato per Tipologia Segnale
                            </h4>
                            <CostBarChart data={committedByType} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: '#10b981' }}>
                                Spesa Sostenuta per Mese
                            </h4>
                            <CostBarChart data={spentByMonth} />
                        </div>
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: '#f59e0b' }}>
                                Budget Impegnato per Mese
                            </h4>
                            <CostBarChart data={committedByMonth} />
                        </div>
                    </div>
                </div>
            )}

            {/* Grafici riga 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card">
                    <h3 className="section-title">
                        📊 Segnali per Tipologia
                    </h3>
                    <BarChart
                        data={byType.filter(d => d.value > 0).concat(byType.filter(d => d.value === 0))}
                        colorFn={label => TYPE_COLORS[label] || 'var(--primary)'}
                    />
                </div>

                <div className="card">
                    <h3 className="section-title">
                        🩺 Stato di Conservazione: Integri vs Degradati
                    </h3>
                    <DonutChart data={integrityData.filter(d => d.value > 0)} />
                </div>
            </div>

            {/* Grafici riga 1b: dettaglio stati */}
            <div className="card">
                <h3 className="section-title">
                    🔵 Segnali per Stato (dettaglio)
                </h3>
                <DonutChart data={byStatus.filter(d => d.value > 0)} />
            </div>

            {/* Grafici riga 2 */}
            {interventions.length > 0 && (
                <div className="card">
                    <h3 className="section-title">
                        🔧 Interventi per Stato
                    </h3>
                    <DonutChart data={interventionsByStatus.filter(d => d.value > 0)} />
                </div>
            )}

            {/* Tabella segnali danneggiati */}
            {damagedCount > 0 && (
                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#ef4444' }}>
                        ⚠️ Segnali Danneggiati — Richiedono Attenzione
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>ID</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Tipo</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Posizione</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Note</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Sync</th>
                                </tr>
                            </thead>
                            <tbody>
                                {signs.filter(s => s.status === 'danneggiato').map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>#{s.id}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{s.type}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {parseFloat(s.latitude).toFixed(5)}, {parseFloat(s.longitude).toFixed(5)}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--gray-600)' }}>{s.notes || '-'}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{s.synced ? '✅' : '⏳'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Matrice Urgenza Interventi */}
            {priorityMatrix.length > 0 && (
                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary)' }}>
                        🚨 Matrice di Urgenza Interventi ({priorityMatrix.length})
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.75rem' }}>
                        Interventi programmati ordinati per priorità: (Peso Segnale × Gravità) + Peso Strada
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--gray-100)', borderBottom: '2px solid var(--gray-200)' }}>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Priorità</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Intervento</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Segnale</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Via</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Stato</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Scadenza</th>
                                </tr>
                            </thead>
                            <tbody>
                                {priorityMatrix.map((item, i) => {
                                    const isHigh = item.priorityScore >= 20;
                                    const isMed = item.priorityScore >= 10 && !isHigh;
                                    return (
                                        <tr key={item.id} style={{
                                            borderBottom: '1px solid var(--gray-100)',
                                            background: isHigh ? '#fef2f2' : isMed ? '#fffbeb' : 'transparent',
                                            fontWeight: isHigh ? '700' : 'normal'
                                        }}>
                                            <td style={{ padding: '0.5rem 0.75rem', color: isHigh ? '#dc2626' : isMed ? '#d97706' : 'var(--gray-600)', fontWeight: '800' }}>
                                                {isHigh ? '🔴' : isMed ? '🟡' : '🟢'} {item.priorityScore}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.type}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>
                                                #{item.sign_id} {item.sign_type}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--gray-600)', fontSize: '0.8rem' }}>
                                                {item.street_name || '-'}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem',
                                                    background: item.status === 'in_corso' ? '#dbeafe' : '#fef3c7',
                                                    color: item.status === 'in_corso' ? '#1e40af' : '#92400e'
                                                }}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--gray-600)', fontSize: '0.8rem' }}>
                                                {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('it-IT') : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
