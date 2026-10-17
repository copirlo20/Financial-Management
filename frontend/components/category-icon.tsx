import {
  Award,
  Baby,
  Banknote,
  Briefcase,
  Car,
  CircleEllipsis,
  CirclePlus,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shield,
  Shirt,
  ShoppingBag,
  Smartphone,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIconName } from "@fm/shared/category-icons";

const ICONS: Record<CategoryIconName, LucideIcon> = {
  tag: Tag,
  utensils: Utensils,
  coffee: Coffee,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  house: House,
  receipt: Receipt,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  smartphone: Smartphone,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  film: Film,
  users: Users,
  baby: Baby,
  "paw-print": PawPrint,
  shield: Shield,
  gift: Gift,
  "circle-ellipsis": CircleEllipsis,
  wallet: Wallet,
  banknote: Banknote,
  award: Award,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
  "hand-coins": HandCoins,
  "circle-plus": CirclePlus,
};

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name as CategoryIconName]) || Tag;
  return <Icon className={className} aria-hidden />;
}

export function CategoryBadge({ icon, color }: { icon: string | null; color: string | null }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: color ?? "#64748B" }}
    >
      <CategoryIcon name={icon} className="size-4" />
    </span>
  );
}
