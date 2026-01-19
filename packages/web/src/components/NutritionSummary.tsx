import { Flame, Beef, Wheat, Droplet, Leaf } from 'lucide-react';
import { useTranslation } from '../i18n';

interface NutritionData {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
}

interface NutritionSummaryProps {
  data: NutritionData;
  servings?: number;
  compact?: boolean;
}

export default function NutritionSummary({ data, servings = 1, compact = false }: NutritionSummaryProps) {
  const { t } = useTranslation();

  const hasNutrition = data.calories || data.protein || data.carbs || data.fat || data.fiber;

  if (!hasNutrition) {
    return null;
  }

  const multiply = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return Math.round(value * servings);
  };

  const items = [
    {
      label: t('article.calories'),
      value: multiply(data.calories),
      unit: 'kcal',
      icon: Flame,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      label: t('article.protein'),
      value: multiply(data.protein),
      unit: 'g',
      icon: Beef,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: t('article.carbs'),
      value: multiply(data.carbs),
      unit: 'g',
      icon: Wheat,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: t('article.fat'),
      value: multiply(data.fat),
      unit: 'g',
      icon: Droplet,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
    },
    {
      label: t('article.fiber'),
      value: multiply(data.fiber),
      unit: 'g',
      icon: Leaf,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
  ].filter(item => item.value !== null);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${item.bgColor}`}
            title={item.label}
          >
            <item.icon size={12} className={item.color} />
            <span className="font-medium">{item.value}</span>
            <span className="text-gray-500">{item.unit}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={`text-center p-3 rounded-lg ${item.bgColor}`}
        >
          <item.icon size={20} className={`mx-auto mb-1 ${item.color}`} />
          <div className="font-semibold text-gray-900">
            {item.value}
            <span className="text-xs text-gray-500 ml-0.5">{item.unit}</span>
          </div>
          <div className="text-xs text-gray-500 truncate">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// Daily value percentages (based on 2000 kcal diet)
const DAILY_VALUES = {
  calories: 2000,
  protein: 50,
  carbs: 300,
  fat: 65,
  fiber: 25,
};

interface NutritionBarProps {
  data: NutritionData;
  servings?: number;
}

export function NutritionBars({ data, servings = 1 }: NutritionBarProps) {
  const { t } = useTranslation();

  const hasNutrition = data.calories || data.protein || data.carbs || data.fat || data.fiber;

  if (!hasNutrition) {
    return null;
  }

  const getPercentage = (value: number | null | undefined, dailyValue: number) => {
    if (value === null || value === undefined) return 0;
    return Math.min(100, Math.round((value * servings / dailyValue) * 100));
  };

  const items = [
    {
      label: t('article.calories'),
      value: data.calories,
      unit: 'kcal',
      dailyValue: DAILY_VALUES.calories,
      color: 'bg-orange-500',
    },
    {
      label: t('article.protein'),
      value: data.protein,
      unit: 'g',
      dailyValue: DAILY_VALUES.protein,
      color: 'bg-red-500',
    },
    {
      label: t('article.carbs'),
      value: data.carbs,
      unit: 'g',
      dailyValue: DAILY_VALUES.carbs,
      color: 'bg-amber-500',
    },
    {
      label: t('article.fat'),
      value: data.fat,
      unit: 'g',
      dailyValue: DAILY_VALUES.fat,
      color: 'bg-yellow-500',
    },
    {
      label: t('article.fiber'),
      value: data.fiber,
      unit: 'g',
      dailyValue: DAILY_VALUES.fiber,
      color: 'bg-green-500',
    },
  ].filter(item => item.value !== null && item.value !== undefined);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percentage = getPercentage(item.value, item.dailyValue);
        const actualValue = Math.round((item.value || 0) * servings);

        return (
          <div key={item.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">{item.label}</span>
              <span className="text-gray-500">
                {actualValue} {item.unit} ({percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${item.color}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 mt-2">
        * Percent Daily Values based on a 2,000 calorie diet
      </p>
    </div>
  );
}
