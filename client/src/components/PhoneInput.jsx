import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../services/api';
import { Phone, UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * PhoneInput - Reusable phone input with auto customer detection
 * Props:
 *   value, onChange - controlled input
 *   onCustomerFound(customer) - callback when a matching customer is found
 *   className - extra styling
 *   placeholder
 */
export default function PhoneInput({ value, onChange, onCustomerFound, className, placeholder = '05XX XXX XX XX' }) {
    const [debouncedPhone, setDebouncedPhone] = useState('');
    const timerRef = useRef(null);
    const [dismissed, setDismissed] = useState(false);

    // U3: Auto-format Turkish phone: 05XX XXX XX XX
    const handleChange = (e) => {
        let raw = e.target.value.replace(/[^0-9]/g, '');
        if (raw.length > 11) raw = raw.slice(0, 11);
        let formatted = raw;
        if (raw.length > 4) formatted = raw.slice(0, 4) + ' ' + raw.slice(4);
        if (raw.length > 7) formatted = raw.slice(0, 4) + ' ' + raw.slice(4, 7) + ' ' + raw.slice(7);
        if (raw.length > 9) formatted = raw.slice(0, 4) + ' ' + raw.slice(4, 7) + ' ' + raw.slice(7, 9) + ' ' + raw.slice(9);
        onChange({ ...e, target: { ...e.target, value: formatted } });
    };

    // Debounce
    useEffect(() => {
        setDismissed(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            const cleaned = value?.replace(/[^0-9]/g, '') || '';
            if (cleaned.length >= 10) {
                setDebouncedPhone(cleaned);
            } else {
                setDebouncedPhone('');
            }
        }, 500);
        return () => clearTimeout(timerRef.current);
    }, [value]);

    // Search customer by phone (exact match)
    const { data: lookupResult, isLoading } = useQuery({
        queryKey: ['customer-phone-lookup', debouncedPhone],
        queryFn: () => customersApi.lookupByPhone(debouncedPhone).then(r => r.data),
        enabled: debouncedPhone.length >= 10
    });

    const matchedCustomer = lookupResult || null;

    const handleFill = () => {
        if (matchedCustomer && onCustomerFound) {
            onCustomerFound(matchedCustomer);
            setDismissed(true);
        }
    };

    return (
        <div className="relative">
            <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="tel"
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className={cn(
                        'w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm',
                        className
                    )}
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Match result */}
            {debouncedPhone && !dismissed && !isLoading && (
                <div className="mt-1.5">
                    {matchedCustomer ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                            <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-green-700 font-medium">{matchedCustomer.fullName}</span>
                            <button
                                type="button"
                                onClick={handleFill}
                                className="ml-auto text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                                Bilgileri Doldur
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-sm">
                            <UserPlus className="w-4 h-4 text-orange-600 shrink-0" />
                            <span className="text-orange-700">Yeni müşteri olarak kaydedilecek</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
