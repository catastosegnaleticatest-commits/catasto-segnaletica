import { useState, useEffect } from 'react';
import apiService from '../services/api';
import { useContractsData } from '../hooks/useContractsData';

function ContractsTab({ user }) {
    const { contracts, priceList, commitments, loading, error: loadError, reload: loadAll } = useContractsData();
    const [selectedContractId, setSelectedContractId] = useState(null);

    const [showContractForm, setShowContractForm] = useState(false);
    const [contractForm, setContractForm] = useState({ cig: '', company: '', start_date: '', end_date: '', total_budget: '' });
    const [savingContract, setSavingContract] = useState(false);

    const [showPriceForm, setShowPriceForm] = useState(false);
    const [priceForm, setPriceForm] = useState({ item_code: '', description: '', unit_price: '' });
    const [savingPrice, setSavingPrice] = useState(false);

    const [showCommitmentForm, setShowCommitmentForm] = useState(false);
    const [commitmentForm, setCommitmentForm] = useState({ resolution_number: '', allocated_amount: '' });
    const [savingCommitment, setSavingCommitment] = useState(false);

    const [error, setError] = useState(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [editingImporti, setEditingImporti] = useState(false);
    const [importiForm, setImportiForm] = useState({ importo_netto: '', importo_lordo: '', aliquota_iva: '' });

    useEffect(() => {
        if (!selectedContractId && contracts.length > 0) {
            setSelectedContractId(contracts[0].id);
        }
    }, [contracts, selectedContractId]);

    const handlePdfUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedContractId) return;
        e.target.value = '';
        setUploadingPdf(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('pdf', file);
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiService.getApiUrl()}/api/contracts/${selectedContractId}/upload-pdf`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            const data = await res.json();
            if (data.importo_netto || data.importo_lordo) {
                alert(`PDF caricato. Importi estratti automaticamente:\n• Netto: ${data.importo_netto != null ? '€ ' + data.importo_netto.toFixed(2) : 'non trovato'}\n• Lordo: ${data.importo_lordo != null ? '€ ' + data.importo_lordo.toFixed(2) : 'non trovato'}\n\nVerifica e correggi se necessario.`);
            } else {
                alert('PDF caricato. Importi non rilevati automaticamente — inseriscili manualmente.');
            }
            await loadAll();
        } catch (err) {
            setError('Errore upload PDF: ' + err.message);
        } finally {
            setUploadingPdf(false);
        }
    };

    const handleSaveImporti = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiService.getApiUrl()}/api/contracts/${selectedContractId}/importi`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    importo_netto: importiForm.importo_netto !== '' ? parseFloat(importiForm.importo_netto) : null,
                    importo_lordo: importiForm.importo_lordo !== '' ? parseFloat(importiForm.importo_lordo) : null,
                    aliquota_iva: importiForm.aliquota_iva !== '' ? parseFloat(importiForm.aliquota_iva) : null,
                }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            setEditingImporti(false);
            await loadAll();
        } catch (err) {
            setError('Errore salvataggio importi: ' + err.message);
        }
    };

    const handleDeletePdf = async () => {
        if (!confirm('Eliminare il PDF allegato?')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${apiService.getApiUrl()}/api/contracts/${selectedContractId}/pdf`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            await loadAll();
        } catch (err) {
            setError('Errore eliminazione PDF: ' + err.message);
        }
    };

    const handleCreateContract = async (e) => {
        e.preventDefault();
        if (!contractForm.company.trim()) { alert('Indicare l\'impresa'); return; }
        setSavingContract(true);
        setError(null);
        try {
            const newContract = await apiService.createContract({
                cig: contractForm.cig || null,
                company: contractForm.company,
                start_date: contractForm.start_date || null,
                end_date: contractForm.end_date || null,
                total_budget: contractForm.total_budget ? parseFloat(contractForm.total_budget) : null,
            });
            setContractForm({ cig: '', company: '', start_date: '', end_date: '', total_budget: '' });
            setShowContractForm(false);
            setSelectedContractId(newContract.id);
            await loadAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingContract(false);
        }
    };

    const handleCreatePriceItem = async (e) => {
        e.preventDefault();
        if (!selectedContractId) { alert('Seleziona prima un Accordo Quadro'); return; }
        if (!priceForm.description.trim() || !priceForm.unit_price) { alert('Indicare descrizione e prezzo unitario'); return; }
        setSavingPrice(true);
        setError(null);
        try {
            await apiService.createPriceListItem({
                contract_id: selectedContractId,
                item_code: priceForm.item_code || null,
                description: priceForm.description,
                unit_price: parseFloat(priceForm.unit_price),
            });
            setPriceForm({ item_code: '', description: '', unit_price: '' });
            setShowPriceForm(false);
            await loadAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingPrice(false);
        }
    };

    const handleCreateCommitment = async (e) => {
        e.preventDefault();
        if (!selectedContractId) { alert('Seleziona prima un Accordo Quadro'); return; }
        if (!commitmentForm.allocated_amount) { alert('Indicare l\'importo impegnato'); return; }
        setSavingCommitment(true);
        setError(null);
        try {
            await apiService.createCommitment({
                contract_id: selectedContractId,
                resolution_number: commitmentForm.resolution_number || null,
                allocated_amount: parseFloat(commitmentForm.allocated_amount),
            });
            setCommitmentForm({ resolution_number: '', allocated_amount: '' });
            setShowCommitmentForm(false);
            await loadAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingCommitment(false);
        }
    };

    if (loading) {
        return (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    const selectedContract = contracts.find(c => c.id === selectedContractId);
    const contractPriceList = priceList.filter(p => p.contract_id === selectedContractId);
    const contractCommitments = commitments.filter(c => c.contract_id === selectedContractId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(error || loadError) && (
                <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--border-radius)', fontSize: '0.875rem' }}>
                    {error || loadError}
                </div>
            )}

            {/* Lista Accordi Quadro */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>📑 Accordi Quadro ({contracts.length})</h3>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowContractForm(f => !f)}
                        style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem' }}
                    >
                        {showContractForm ? '✕ Annulla' : '+ Nuovo Accordo Quadro'}
                    </button>
                </div>

                {showContractForm && (
                    <form onSubmit={handleCreateContract} style={{ background: 'rgba(59,130,246,0.06)', padding: '1.25rem', borderRadius: 'var(--border-radius)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 1rem', color: '#0369a1', fontSize: '0.95rem' }}>Nuovo Accordo Quadro</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                            <div>
                                <label className="field-label">Impresa *</label>
                                <input type="text" className="form-input" value={contractForm.company} onChange={e => setContractForm(p => ({ ...p, company: e.target.value }))} style={{ fontSize: '0.875rem' }} required />
                            </div>
                            <div>
                                <label className="field-label">CIG</label>
                                <input type="text" className="form-input" value={contractForm.cig} onChange={e => setContractForm(p => ({ ...p, cig: e.target.value }))} placeholder="Es: Z123456789" style={{ fontSize: '0.875rem' }} />
                            </div>
                            <div>
                                <label className="field-label">Data Inizio</label>
                                <input type="date" className="form-input" value={contractForm.start_date} onChange={e => setContractForm(p => ({ ...p, start_date: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                            </div>
                            <div>
                                <label className="field-label">Data Fine</label>
                                <input type="date" className="form-input" value={contractForm.end_date} onChange={e => setContractForm(p => ({ ...p, end_date: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                            </div>
                            <div>
                                <label className="field-label">Budget Totale (€)</label>
                                <input type="number" min="0" step="0.01" className="form-input" value={contractForm.total_budget} onChange={e => setContractForm(p => ({ ...p, total_budget: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowContractForm(false)} style={{ fontSize: '0.875rem' }}>Annulla</button>
                            <button type="submit" className="btn btn-primary" disabled={savingContract} style={{ fontSize: '0.875rem' }}>
                                {savingContract ? '💾 Salvataggio...' : '💾 Salva Accordo Quadro'}
                            </button>
                        </div>
                    </form>
                )}

                {contracts.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                        Nessun Accordo Quadro registrato
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {contracts.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedContractId(c.id)}
                                className="btn"
                                style={{
                                    fontSize: '0.875rem',
                                    padding: '0.6rem 1rem',
                                    textAlign: 'left',
                                    border: c.id === selectedContractId ? '2px solid var(--primary)' : '1px solid var(--gray-300)',
                                    background: c.id === selectedContractId ? 'rgba(59,130,246,0.12)' : 'var(--gray-50)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ fontWeight: '700' }}>{c.company}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                    {c.cig ? `CIG: ${c.cig}` : 'Senza CIG'} {c.total_budget != null ? `· € ${parseFloat(c.total_budget).toFixed(2)}` : ''}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedContract && (
                <>
                    {/* Dettaglio Accordo Quadro */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: '1rem' }}>
                            📋 {selectedContract.company}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
                            <div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>CIG</div>
                                <div style={{ fontWeight: '600' }}>{selectedContract.cig || '-'}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>PERIODO</div>
                                <div style={{ fontWeight: '600' }}>
                                    {selectedContract.start_date ? new Date(selectedContract.start_date).toLocaleDateString('it-IT') : '-'}
                                    {' → '}
                                    {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('it-IT') : '-'}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>BUDGET TOTALE</div>
                                <div style={{ fontWeight: '600' }}>{selectedContract.total_budget != null ? `€ ${parseFloat(selectedContract.total_budget).toFixed(2)}` : '-'}</div>
                            </div>
                        </div>
                    </div>

                    {/* PDF e Importi Accordo */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <h3 className="card-title" style={{ margin: 0 }}>📄 Documento e Importi</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                {selectedContract.pdf_filename && (
                                    <>
                                        <a
                                            href={`${apiService.getApiUrl()}/api/contracts/${selectedContract.id}/pdf`}
                                            target="_blank" rel="noreferrer"
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem' }}
                                        >
                                            📥 Visualizza PDF
                                        </a>
                                        <button
                                            className="btn"
                                            onClick={handleDeletePdf}
                                            style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem', background: 'var(--danger)', color: 'white' }}
                                        >
                                            🗑️ Rimuovi PDF
                                        </button>
                                    </>
                                )}
                                <label style={{ cursor: uploadingPdf ? 'wait' : 'pointer' }}>
                                    <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={uploadingPdf} />
                                    <span className="btn btn-primary" style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem', pointerEvents: 'none' }}>
                                        {uploadingPdf ? '⏳ Analisi AI...' : selectedContract.pdf_filename ? '🔄 Sostituisci PDF' : '📎 Allega PDF'}
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Importi estratti */}
                        {!editingImporti ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
                                <div>
                                    <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>IMPORTO NETTO (senza IVA)</div>
                                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0369a1' }}>
                                        {selectedContract.importo_netto != null ? `€ ${parseFloat(selectedContract.importo_netto).toFixed(2)}` : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>ALIQUOTA IVA</div>
                                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0369a1' }}>
                                        {selectedContract.aliquota_iva != null ? `${selectedContract.aliquota_iva}%` : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>IMPORTO LORDO (IVA inclusa)</div>
                                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0369a1' }}>
                                        {selectedContract.importo_lordo != null ? `€ ${parseFloat(selectedContract.importo_lordo).toFixed(2)}` : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                                        onClick={() => {
                                            setImportiForm({
                                                importo_netto: selectedContract.importo_netto ?? '',
                                                importo_lordo: selectedContract.importo_lordo ?? '',
                                                aliquota_iva: selectedContract.aliquota_iva ?? '',
                                            });
                                            setEditingImporti(true);
                                        }}
                                    >
                                        ✏️ Modifica importi
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                                <div>
                                    <label className="field-label">Importo Netto (€)</label>
                                    <input type="number" min="0" step="0.01" className="form-input" value={importiForm.importo_netto}
                                        onChange={e => setImportiForm(p => ({ ...p, importo_netto: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                                </div>
                                <div>
                                    <label className="field-label">Aliquota IVA (%)</label>
                                    <input type="number" min="0" max="100" step="1" className="form-input" value={importiForm.aliquota_iva}
                                        onChange={e => setImportiForm(p => ({ ...p, aliquota_iva: e.target.value }))} placeholder="Es: 22" style={{ fontSize: '0.875rem' }} />
                                </div>
                                <div>
                                    <label className="field-label">Importo Lordo (€)</label>
                                    <input type="number" min="0" step="0.01" className="form-input" value={importiForm.importo_lordo}
                                        onChange={e => setImportiForm(p => ({ ...p, importo_lordo: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setEditingImporti(false)}>Annulla</button>
                                    <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={handleSaveImporti}>💾 Salva</button>
                                </div>
                            </div>
                        )}
                        {!selectedContract.pdf_filename && (
                            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                                Allega il PDF dell'accordo firmato — l'AI estrae automaticamente gli importi netto/lordo.
                            </div>
                        )}
                    </div>

                    {/* Tariffario */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <h3 className="card-title" style={{ margin: 0 }}>💲 Tariffario ({contractPriceList.length})</h3>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowPriceForm(f => !f)}
                                style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem' }}
                            >
                                {showPriceForm ? '✕ Annulla' : '+ Nuova Voce di Tariffario'}
                            </button>
                        </div>

                        {showPriceForm && (
                            <form onSubmit={handleCreatePriceItem} style={{ background: 'rgba(59,130,246,0.06)', padding: '1.25rem', borderRadius: 'var(--border-radius)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                                    <div>
                                        <label className="field-label">Codice Articolo</label>
                                        <input type="text" className="form-input" value={priceForm.item_code} onChange={e => setPriceForm(p => ({ ...p, item_code: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                                    </div>
                                    <div>
                                        <label className="field-label">Descrizione *</label>
                                        <input type="text" className="form-input" value={priceForm.description} onChange={e => setPriceForm(p => ({ ...p, description: e.target.value }))} style={{ fontSize: '0.875rem' }} required />
                                    </div>
                                    <div>
                                        <label className="field-label">Prezzo Unitario (€) *</label>
                                        <input type="number" min="0" step="0.01" className="form-input" value={priceForm.unit_price} onChange={e => setPriceForm(p => ({ ...p, unit_price: e.target.value }))} style={{ fontSize: '0.875rem' }} required />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowPriceForm(false)} style={{ fontSize: '0.875rem' }}>Annulla</button>
                                    <button type="submit" className="btn btn-primary" disabled={savingPrice} style={{ fontSize: '0.875rem' }}>
                                        {savingPrice ? '💾 Salvataggio...' : '💾 Salva Voce'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {contractPriceList.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                                Nessuna voce di tariffario per questo Accordo Quadro
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Codice</th>
                                            <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Descrizione</th>
                                            <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Prezzo Unitario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contractPriceList.map(p => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{p.item_code || '-'}</td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{p.description}</td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600' }}>€ {parseFloat(p.unit_price).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Impegni di Spesa */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <h3 className="card-title" style={{ margin: 0 }}>🏦 Impegni di Spesa ({contractCommitments.length})</h3>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowCommitmentForm(f => !f)}
                                style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem' }}
                            >
                                {showCommitmentForm ? '✕ Annulla' : '+ Nuovo Impegno di Spesa'}
                            </button>
                        </div>

                        {showCommitmentForm && (
                            <form onSubmit={handleCreateCommitment} style={{ background: 'rgba(59,130,246,0.06)', padding: '1.25rem', borderRadius: 'var(--border-radius)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                                    <div>
                                        <label className="field-label">N. Determina</label>
                                        <input type="text" className="form-input" value={commitmentForm.resolution_number} onChange={e => setCommitmentForm(p => ({ ...p, resolution_number: e.target.value }))} placeholder="Es: Determina n. 45/2026" style={{ fontSize: '0.875rem' }} />
                                    </div>
                                    <div>
                                        <label className="field-label">Importo Impegnato (€) *</label>
                                        <input type="number" min="0" step="0.01" className="form-input" value={commitmentForm.allocated_amount} onChange={e => setCommitmentForm(p => ({ ...p, allocated_amount: e.target.value }))} style={{ fontSize: '0.875rem' }} required />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowCommitmentForm(false)} style={{ fontSize: '0.875rem' }}>Annulla</button>
                                    <button type="submit" className="btn btn-primary" disabled={savingCommitment} style={{ fontSize: '0.875rem' }}>
                                        {savingCommitment ? '💾 Salvataggio...' : '💾 Salva Impegno'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {contractCommitments.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                                Nessun impegno di spesa per questo Accordo Quadro
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {contractCommitments.map(c => {
                                    const allocated = parseFloat(c.allocated_amount);
                                    const residual = parseFloat(c.residual_amount);
                                    const used = allocated - residual;
                                    const usedPct = allocated > 0 ? Math.min((used / allocated) * 100, 100) : 0;
                                    return (
                                        <div key={c.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius)', padding: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{c.resolution_number || `Impegno #${c.id}`}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                                                    Speso € {used.toFixed(2)} di € {allocated.toFixed(2)} — Residuo € {residual.toFixed(2)}
                                                </div>
                                            </div>
                                            <div style={{ background: 'var(--gray-200)', borderRadius: '999px', height: '14px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${usedPct}%`,
                                                    background: usedPct >= 100 ? '#ef4444' : usedPct >= 80 ? '#f59e0b' : '#10b981',
                                                    borderRadius: '999px',
                                                    transition: 'width 0.5s ease'
                                                }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default ContractsTab;
