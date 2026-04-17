import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLanguage } from './LanguageContext';

const CurrencyContext = createContext(null);
const STORAGE_KEY = 'travel_currency';
const RATE_CACHE_KEY = 'travel_usd_vnd_rate';
const RATE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;

export const CurrencyProvider = ({ children }) => {
  const { lang } = useLanguage();
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'VND' ? 'VND' : 'USD';
  });
  const [usdToVndRate, setUsdToVndRate] = useState(() => {
    const cached = Number(localStorage.getItem(RATE_CACHE_KEY));
    return Number.isFinite(cached) && cached > 0 ? cached : 25500;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency);
  }, [currency]);

  useEffect(() => {
    const loadRate = async () => {
      const ts = Number(localStorage.getItem(`${RATE_CACHE_KEY}_ts`));
      const stillFresh = Number.isFinite(ts) && Date.now() - ts < RATE_CACHE_MAX_AGE_MS;
      if (stillFresh) return;
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        const nextRate = Number(data?.rates?.VND);
        if (Number.isFinite(nextRate) && nextRate > 0) {
          setUsdToVndRate(nextRate);
          localStorage.setItem(RATE_CACHE_KEY, String(nextRate));
          localStorage.setItem(`${RATE_CACHE_KEY}_ts`, String(Date.now()));
        }
      } catch {
        // Keep existing cached/default rate when offline.
      }
    };
    loadRate();
  }, []);

  const value = useMemo(() => {
    const convertFromUsd = (amountUsd) => {
      const base = Number(amountUsd || 0);
      return currency === 'VND' ? base * usdToVndRate : base;
    };
    const formatMoney = (amountUsd) => {
      const converted = convertFromUsd(amountUsd);
      const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'VND' ? 0 : 2,
      }).format(converted);
    };
    return {
      currency,
      setCurrency: (next) => setCurrency(next === 'VND' ? 'VND' : 'USD'),
      usdToVndRate,
      formatMoney,
      convertFromUsd,
    };
  }, [currency, usdToVndRate, lang]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
