import {
  Car, Gem, Shield, TrendingUp, AlertTriangle, Building2, User, Briefcase,
  ShoppingCart, Package, Droplets, Leaf, Apple, Utensils, Cookie,
  GraduationCap, Baby, Heart, Sparkles, Shirt, Film, Plane, Gift, Home,
  Wrench, Smartphone, Zap, Flame, Wallet, Banknote, CreditCard, Coins,
  Landmark, Tag
} from 'lucide-react'

interface Props {
  cat: string
  size?: number
}

export default function CatIcon({ cat, size = 16 }: Props) {
  const iconMap: Record<string, React.ReactNode> = {
    'Long Term Loan': <Car size={size} />,
    'Jewel Loan': <Gem size={size} />,
    'Insurance': <Shield size={size} />,
    'SIP/Savings': <TrendingUp size={size} />,
    'Emergency Fund': <AlertTriangle size={size} />,
    'Rent': <Building2 size={size} />,
    'Vijaya Amma': <User size={size} />,
    'Staff Salary': <Briefcase size={size} />,
    'Groceries': <ShoppingCart size={size} />,
    'Rice': <Package size={size} />,
    'Milk': <Droplets size={size} />,
    'Vegetables': <Leaf size={size} />,
    'Fruits': <Apple size={size} />,
    'Food/Eating Out': <Utensils size={size} />,
    'Snacks': <Cookie size={size} />,
    'Meat': <Package size={size} />,
    'Education': <GraduationCap size={size} />,
    'Kids': <Baby size={size} />,
    'Health & Medical': <Heart size={size} />,
    'Amma': <Heart size={size} />,
    'Body Care': <Sparkles size={size} />,
    'Dress': <Shirt size={size} />,
    'Entertainment': <Film size={size} />,
    'Travel': <Plane size={size} />,
    'Gifts/Functions': <Gift size={size} />,
    'Home Care': <Home size={size} />,
    'Maintenance': <Wrench size={size} />,
    'Internet/Recharge': <Smartphone size={size} />,
    'Electricity': <Zap size={size} />,
    'Cylinder': <Flame size={size} />,
    'Car': <Car size={size} />,
    'Daily Expenses': <Wallet size={size} />,
    'NGO': <Heart size={size} />,
    'Others': <Package size={size} />,
    'Salary': <Banknote size={size} />,
    'Cashback': <CreditCard size={size} />,
    'Other Income': <Coins size={size} />,
    'Cash': <Banknote size={size} />,
    'HDFC Bank': <Landmark size={size} />,
    'Wallet': <Wallet size={size} />,
    'ICICI': <CreditCard size={size} />,
    'HDFC': <CreditCard size={size} />,
    'Bommi': <User size={size} />,
    'Ramya': <User size={size} />,
  }

  const icon = iconMap[cat] || <Tag size={size} />

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>
      {icon}
    </span>
  )
}
