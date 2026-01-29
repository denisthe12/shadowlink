// client/src/hooks/useShadowWire.ts
import { useState, useCallback } from 'react';
import { ShadowWireClient } from '@radr/shadowwire';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { Buffer } from 'buffer';
import { saveTxToHistory } from '../components/TransactionHistory';

const USD1_MINT = 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB';
const DECIMALS = 6; // У USD1 6 знаков

export const useShadowWire = () => {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();
    // Инициализируем клиент один раз (lazy init)
    const [client] = useState(() => new ShadowWireClient({ debug: true }));
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [deposited, setDeposited] = useState<number>(0);

    // --- GET BALANCE ---
    const updateBalance = useCallback(async () => {
        if (!publicKey) return;
        try {
            // Запрашиваем баланс именно для USD1
            const bal = await client.getBalance(publicKey.toBase58(), 'USD1');
            // Конвертируем из минимальных единиц
            setBalance(bal.available / Math.pow(10, DECIMALS));
            setDeposited(bal.deposited / Math.pow(10, DECIMALS));
        } catch (error) {
            console.error("Failed to fetch balance:", error);
        }
    }, [publicKey, client]);

    // --- DEPOSIT ---
    const deposit = async (amount: number) => {
        if (!publicKey || !signTransaction) throw new Error("Wallet not connected");
        
        setLoading(true);
        const toastId = toast.loading("Preparing Deposit...");

        try {
            const amountSmallest = Math.floor(amount * Math.pow(10, DECIMALS));

            // 1. Получаем транзакцию от SDK
            const response = await client.deposit({
                wallet: publicKey.toBase58(),
                amount: amountSmallest,
                token_mint: USD1_MINT
            });

            // 2. Десериализуем
            const transaction = Transaction.from(Buffer.from(response.unsigned_tx_base64, 'base64'));
            
            // 3. Обновляем Blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // 4. Подписываем и отправляем
            toast.loading("Please sign transaction...", { id: toastId });
            const signedTx = await signTransaction(transaction);
            
            toast.loading("Sending to Blockchain...", { id: toastId });
            const signature = await connection.sendRawTransaction(signedTx.serialize());
            
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

            toast.success(`Deposit Successful! +${amount} USD1`, { id: toastId });
            saveTxToHistory(signature, 'Deposit');
            updateBalance(); // Обновляем цифру в хедере
            return true;
        } catch (error: any) {
            console.error(error);
            toast.error(`Deposit Failed: ${error.message}`, { id: toastId });
            return false;
        } finally {
            setLoading(false);
        }
    };

    // --- WITHDRAW (Logic from PDF) ---
    const withdraw = async (amount: number) => {
        if (!publicKey || !signTransaction) throw new Error("Wallet not connected");

        setLoading(true);
        const toastId = toast.loading("Preparing Withdrawal...");

        try {
            const amountSmallest = Math.floor(amount * Math.pow(10, DECIMALS));

            // 1. Получаем транзакцию от SDK
            const response = await client.withdraw({
                wallet: publicKey.toBase58(),
                amount: amountSmallest,
                token_mint: USD1_MINT // Важно для токенов
            });

            const txBase64 = response.unsigned_tx_base64;
            if (!txBase64) throw new Error("No transaction returned from SDK");

            // 2. Десериализация (Умная, как в примере PDF)
            const buffer = Buffer.from(txBase64, 'base64');
            let transaction: Transaction | VersionedTransaction;

            try {
                // Сначала пробуем Versioned (современный формат)
                transaction = VersionedTransaction.deserialize(new Uint8Array(buffer));
            } catch (e) {
                // Если не вышло, пробуем Legacy
                transaction = Transaction.from(new Uint8Array(buffer));
            }

            // 3. Подписываем
            toast.loading("Please sign withdrawal...", { id: toastId });
            const signedTx = await signTransaction(transaction);

            // 4. Сериализуем обратно
            let serialized: Uint8Array;
            if (signedTx instanceof VersionedTransaction) {
                serialized = signedTx.serialize();
            } else {
                serialized = signedTx.serialize({ requireAllSignatures: false, verifySignatures: false });
            }

            // 5. Отправляем
            toast.loading("Processing Withdrawal...", { id: toastId });
            const signature = await connection.sendRawTransaction(serialized);
            
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

            toast.success(`Withdrawal Successful! -${amount} USD1`, { id: toastId });
            saveTxToHistory(signature, 'withdraw');
            updateBalance();
            return true;
        } catch (error: any) {
            console.error(error);
            toast.error(`Withdraw Failed: ${error.message}`, { id: toastId });
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        client,
        balance,
        updateBalance,
        deposit,
        withdraw,
        loading,
        deposited
    };
};