export const ACCOUNTS     = ['Cash', 'HDFC Bank', 'Wallet'] as const;
export const CC_MODES     = ['ICICI', 'HDFC'] as const;
export const OTHER_CR     = ['Bommi', 'Ramya', 'Others'] as const;
export const ALL_CR       = [...CC_MODES, ...OTHER_CR] as const;
export const MNS          = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
export const TXN_PAGE     = 40;
export const GEMINI_KEY    = import.meta.env.VITE_GEMINI_KEY as string;
export const ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS as string || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export const CATEGORIES = [
  'Long Term Loan','Jewel Loan','Insurance','SIP/Savings','Emergency Fund',
  'Rent','Vijaya Amma','Staff Salary','Groceries','Milk','Vegetables',
  'Fruits','Food/Eating Out','Snacks','Meat','Education','Kids','Health & Medical','Amma',
  'Body Care','Dress','Entertainment','Travel','Gifts/Functions','Home Care',
  'Maintenance','Internet/Recharge','Electricity','Cylinder','Car','Daily Expenses',
  'NGO','Others',
] as const;

export const INCOME_CATS = ['Salary','Cashback','Other Income'] as const;
export const ALL_MODES   = [...ACCOUNTS, ...CC_MODES, ...OTHER_CR] as const;

export const CR_COLORS: Record<string, string> = {
  ICICI:'#7C3AED', HDFC:'#1D4ED8',
  Bommi:'#0891B2', Ramya:'#0E7490', Others:'#6B7280',
};

// GAS web app URL — update after deploying
export const GAS_URL = import.meta.env.VITE_GAS_URL as string;
