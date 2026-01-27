import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '../utils/api';
import type { User, Contact} from '../utils/api';
import toast from 'react-hot-toast';

export const useUser = () => {
    const { publicKey } = useWallet();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);

    // Загрузка профиля
    const loadProfile = useCallback(async () => {
        if (!publicKey) {
            setUser(null);
            return;
        }
        
        setLoading(true);
        try {
            const res = await api.getProfile(publicKey.toBase58());
            setUser(res.data);
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setLoading(false);
        }
    }, [publicKey]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // Добавление контакта
    const addContact = async (name: string, address: string) => {
        if (!publicKey) return;
        try {
            const res = await api.addContact(publicKey.toBase58(), name, address);
            // Обновляем локальный стейт
            if (user) {
                setUser({ ...user, contacts: res.data });
            }
            toast.success(`Contact "${name}" added!`);
        } catch (error) {
            toast.error("Failed to add contact");
        }
    };

    // Активация (после депозита)
    const activateRegistration = async () => {
        if (!publicKey) return;
        try {
            const res = await api.registerUser(publicKey.toBase58());
            setUser(res.data); // Обновляем данные пользователя (isRegistered: true)
        } catch (error) {
            console.error(error);
        }
    };

    return {
        user,
        loading,
        addContact,
        activateRegistration,
        refreshUser: loadProfile
    };
};