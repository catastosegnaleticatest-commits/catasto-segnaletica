import { useState, useEffect, useCallback } from 'react';
import { contractsService, priceListService, commitmentsService } from '../services/firestoreService';

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
                contractsService.getAll(),
                priceListService.getAll(),
                commitmentsService.getAll(),
            ]);
            setContracts(contractsData);
            setPriceList(priceData);
            setCommitments(commitmentsData);
            setError(null);
            return { contracts: contractsData, priceList: priceData, commitments: commitmentsData };
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    return { contracts, priceList, commitments, loading, error, reload };
}
