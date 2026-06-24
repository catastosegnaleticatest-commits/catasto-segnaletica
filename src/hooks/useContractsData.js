import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

// Hook condiviso per caricare i dati di Accordi Quadro, Tariffario e Impegni di
// Spesa, usati sia in ContractsTab che in InterventionsTab e nella Dashboard.
export function useContractsData() {
    const [contracts, setContracts] = useState([]);
    const [priceList, setPriceList] = useState([]);
    const [commitments, setCommitments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [contractsData, priceData, commitmentsData] = await Promise.all([
                apiService.getContracts(),
                apiService.getPriceList(),
                apiService.getCommitments(),
            ]);
            setContracts(contractsData);
            setPriceList(priceData);
            setCommitments(commitmentsData);
            setError(null);
            return { contracts: contractsData, priceList: priceData, commitments: commitmentsData };
        } catch (err) {
            setError(err.message);
            console.error('Errore caricamento dati appalti:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return { contracts, priceList, commitments, loading, error, reload };
}
