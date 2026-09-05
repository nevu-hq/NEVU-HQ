export function cn(...classes: Array<string|false|null|undefined>) { return classes.filter(Boolean).join(' '); }
export function formatMoney(value: number, currency='NGN') { return new Intl.NumberFormat('en-NG',{style:'currency',currency,maximumFractionDigits:2}).format(value); }
export function formatDate(value?: string|null) { return value ? new Intl.DateTimeFormat('en-NG',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—'; }
