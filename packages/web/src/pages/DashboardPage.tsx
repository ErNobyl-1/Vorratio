import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, TrendingDown, ChevronRight, UtensilsCrossed, RefreshCw, Coffee, Sun, Moon, Cookie, Check, Plus, Trash2, Undo2, X, ExternalLink, Flame } from 'lucide-react';
import { useTranslation } from '../i18n';
import { dashboard, DashboardData, mealPlan, MealPlanEntry, MealType } from '../lib/api';
import { cn, daysUntilExpiry } from '../lib/utils';
import { format } from 'date-fns';
import ModalPortal from '../components/ModalPortal';
import NutritionSummary from '../components/NutritionSummary';

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  BREAKFAST: <Coffee size={20} className="text-orange-500" />,
  LUNCH: <Sun size={20} className="text-yellow-500" />,
  DINNER: <Moon size={20} className="text-indigo-500" />,
  SNACK: <Cookie size={20} className="text-amber-500" />,
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [todayMeals, setTodayMeals] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [dashboardResult, mealsResult] = await Promise.all([
        dashboard.get(),
        mealPlan.list(today, today),
      ]);
      setData(dashboardResult);
      setTodayMeals(mealsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCompleteMeal = async () => {
    if (!selectedMeal) return;
    setActionLoading(true);
    try {
      await mealPlan.complete(selectedMeal.id);
      setSelectedMeal(null);
      loadData();
    } catch (err) {
      console.error('Failed to complete meal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUncompleteMeal = async () => {
    if (!selectedMeal) return;
    setActionLoading(true);
    try {
      await mealPlan.uncomplete(selectedMeal.id);
      setSelectedMeal(null);
      loadData();
    } catch (err) {
      console.error('Failed to uncomplete meal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMeal = async () => {
    if (!selectedMeal) return;
    setActionLoading(true);
    try {
      await mealPlan.delete(selectedMeal.id);
      setSelectedMeal(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete meal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 text-red-500" size={32} />
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={loadData} className="btn btn-primary">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const allExpiring = [...data.expiring.expired, ...data.expiring.expiringSoon];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn btn-outline p-2"
        >
          <RefreshCw size={20} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Today's Meal Plan - Modern 2x2 Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={20} className="text-primary-600" />
            <h2 className="font-semibold text-gray-900">{t('dashboard.todaysMeals')}</h2>
          </div>
          <Link to="/meal-plan" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            {t('dashboard.viewAll')}
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {MEAL_TYPES.map((mealType) => {
            const meals = todayMeals.filter(m => m.mealType === mealType);
            const mealTypeKey = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack';
            const allCompleted = meals.length > 0 && meals.every(m => m.completedAt);

            return (
              <div
                key={mealType}
                className={cn(
                  "card p-4 min-h-[120px] flex flex-col transition-all",
                  allCompleted && "bg-green-50 border-green-200"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    mealType === 'BREAKFAST' && "bg-orange-100",
                    mealType === 'LUNCH' && "bg-yellow-100",
                    mealType === 'DINNER' && "bg-indigo-100",
                    mealType === 'SNACK' && "bg-amber-100"
                  )}>
                    {MEAL_ICONS[mealType]}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{t(`mealPlan.${mealTypeKey}`)}</span>
                  {allCompleted && <Check size={18} className="text-green-600 ml-auto" />}
                </div>
                <div className="flex-1">
                  {meals.length > 0 ? (
                    <div className="space-y-2">
                      {meals.map((meal) => (
                        <button
                          key={meal.id}
                          onClick={() => setSelectedMeal(meal)}
                          className={cn(
                            'block w-full text-left rounded-lg px-3 py-2 transition-all',
                            meal.completedAt
                              ? 'bg-green-100/50 text-gray-500'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                          )}
                        >
                          <div className={cn(
                            "font-medium text-sm",
                            meal.completedAt && "line-through"
                          )}>
                            {meal.recipe.name}
                          </div>
                          {meal.completedAt && (
                            <div className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                              <Check size={12} />
                              {t('mealPlan.cooked')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Link
                      to={`/meal-plan?addMeal=${mealType}`}
                      className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg py-3 transition-colors border-2 border-dashed border-gray-200 hover:border-primary-300"
                    >
                      <Plus size={16} />
                      {t('mealPlan.addMeal')}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's Nutrition Summary */}
        {(() => {
          const totalNutrition = todayMeals.reduce(
            (acc, meal) => {
              if (meal.nutrition) {
                acc.calories += meal.nutrition.calories;
                acc.protein += meal.nutrition.protein;
                acc.carbs += meal.nutrition.carbs;
                acc.fat += meal.nutrition.fat;
                acc.fiber += meal.nutrition.fiber;
              }
              return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
          );

          const hasNutrition = totalNutrition.calories > 0 || totalNutrition.protein > 0 ||
                               totalNutrition.carbs > 0 || totalNutrition.fat > 0 || totalNutrition.fiber > 0;

          if (!hasNutrition) return null;

          return (
            <div className="card p-4 mt-3">
              <div className="flex items-center gap-2 mb-3">
                <Flame size={18} className="text-orange-500" />
                <span className="font-medium text-gray-700">{t('dashboard.todaysNutrition')}</span>
              </div>
              <NutritionSummary
                data={{
                  calories: totalNutrition.calories,
                  protein: totalNutrition.protein,
                  carbs: totalNutrition.carbs,
                  fat: totalNutrition.fat,
                  fiber: totalNutrition.fiber,
                }}
                compact
              />
            </div>
          );
        })()}
      </div>

      {/* Expiring Soon */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-500" />
            <h2 className="font-semibold">
              {t('dashboard.expiringSoon')}
              {allExpiring.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({allExpiring.length})
                </span>
              )}
            </h2>
          </div>
          <Link to="/inventory" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            {t('dashboard.viewAll')}
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {allExpiring.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {t('dashboard.noExpiring')}
            </div>
          ) : (
            allExpiring.slice(0, 5).map((batch) => {
              const days = daysUntilExpiry(batch.expiryDate);
              const isExpired = days !== null && days < 0;
              const isToday = days === 0;

              return (
                <Link
                  key={batch.id}
                  to={`/inventory/article/${batch.article?.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="font-medium">{batch.article?.name}</div>
                    <div className="text-sm text-gray-500">
                      {batch.quantity} {batch.article?.defaultUnit}
                      {batch.article?.location && (
                        <span className="ml-2">{batch.article.location.name}</span>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    'badge',
                    isExpired && 'badge-expired',
                    isToday && 'badge-warning',
                    !isExpired && !isToday && 'badge-warning'
                  )}>
                    {isExpired
                      ? t('expiry.expired')
                      : isToday
                        ? t('expiry.today')
                        : days === 1
                          ? t('expiry.tomorrow')
                          : t('expiry.days', { days: days || 0 })
                    }
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Low Stock */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown size={20} className="text-red-500" />
            <h2 className="font-semibold">
              {t('dashboard.lowStock')}
              {data.lowStock.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({data.lowStock.length})
                </span>
              )}
            </h2>
          </div>
          <Link to="/inventory?lowStock=true" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            {t('dashboard.viewAll')}
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {data.lowStock.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {t('dashboard.noLowStock')}
            </div>
          ) : (
            data.lowStock.slice(0, 5).map((article) => (
              <Link
                key={article.id}
                to={`/inventory/article/${article.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="font-medium">{article.name}</div>
                  <div className="text-sm text-gray-500">
                    {article.location?.name || t('inventory.noLocation')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-medium">
                    {article.totalStock} / {article.minStock} {article.defaultUnit}
                  </div>
                  <div className="text-sm text-gray-500">
                    -{article.shortfall} {article.defaultUnit}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Meal Action Modal */}
      <ModalPortal isOpen={!!selectedMeal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedMeal?.recipe.name}</h3>
              <button
                onClick={() => setSelectedMeal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {selectedMeal?.completedAt ? (
                <button
                  onClick={handleUncompleteMeal}
                  disabled={actionLoading}
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <Undo2 size={18} />
                  {t('mealPlan.markNotCooked')}
                </button>
              ) : (
                <button
                  onClick={handleCompleteMeal}
                  disabled={actionLoading}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {t('mealPlan.markCooked')}
                </button>
              )}

              <button
                onClick={() => {
                  if (selectedMeal) {
                    navigate(`/recipes/${selectedMeal.recipe.id}`);
                  }
                }}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <ExternalLink size={18} />
                {t('mealPlan.viewRecipe')}
              </button>

              <button
                onClick={handleDeleteMeal}
                disabled={actionLoading}
                className="btn btn-danger w-full flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                {t('common.delete')}
              </button>
            </div>

            {actionLoading && (
              <div className="mt-4 flex justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
              </div>
            )}
          </div>
        </div>
      </ModalPortal>
    </div>
  );
}
