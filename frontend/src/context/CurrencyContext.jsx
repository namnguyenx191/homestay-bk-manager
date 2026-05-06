import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLanguage } from './LanguageContext';

const CurrencyContext = createContext(null);
const STORAGE_KEY = 'travel_currency';
const USD_TO_VND_RATE = 25500;

export const CurrencyProvider = ({ children }) => {
  const { lang } = useLanguage();
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'VND' ? 'VND' : 'VND';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, 'VND');
  }, [currency]);

  const value = useMemo(() => {
    /** Hệ thống lưu giá gốc theo USD -> luôn hiển thị VND cố định. */
    const convertFromUsd = (amountUsd) => Number(amountUsd || 0) * USD_TO_VND_RATE;
    const formatMoney = (amountUsd) => {
      const converted = convertFromUsd(amountUsd);
      const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(converted);
    };
    return {
      currency: 'VND',
      setCurrency: () => setCurrency('VND'),
      usdToVndRate: USD_TO_VND_RATE,
      formatMoney,
      convertFromUsd,
    };
  }, [lang]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
