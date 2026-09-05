import { AGENTS, AgentKey } from './types';
export const APPROVED_LEGAL_NAMES = ['Nwachuku','Ezra','Victor','Uchechukwu'] as const;
export const MASTER_RULES = [
 'Only approved stakeholders can use this system.',
 'Nigeria and African markets are the primary focus.',
 'All major decisions require formal Administrator approval.',
 'Capital protection is more important than aggressive profit-seeking.',
 'Every analysis must be transparent and based on real data.',
 'Educational notes will be provided, but important truths will never be softened.',
 'All approved decisions are permanently recorded.',
];
export const OUTPUT_PARTS = ['Agent Perspectives','Recommended Path','Reasons','Alternatives','Risk Level','Combined Verdict','Confidence Score','Short Educational Note','Data Freshness Label','Uncertainty Statement','Archive Comparison'];
export function normalizeLegalName(value: string) { return value.trim().replace(/\s+/g,' '); }
export function isApprovedLegalName(value: string) { return APPROVED_LEGAL_NAMES.includes(normalizeLegalName(value) as never); }
export function approvalPhrase(username: string) { return `Approved by ${username}`; }
export function getAgent(key: AgentKey) { return AGENTS.find(a=>a.key===key); }
