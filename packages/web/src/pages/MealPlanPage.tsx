import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import {
  mealPlan as mealPlanApi,
  recipes as recipesApi,
  MealPlanEntry,
  MealType,
  Recipe
} from '../lib/api';
import { useAsync } from '../lib/hooks';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar,
  UtensilsCrossed,
  Check,
  Clock,
  Users,
  Trash2,
  Undo2,
  ExternalLink,
  Flame,
  Beef,
  Wheat,
  Droplet
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  parseISO
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import ModalPortal from '../components/ModalPortal';

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export default function MealPlanPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateLocale = locale === 'de' ? de : enUS;

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('LUNCH');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [servings, setServings] = useState(2);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: entries, loading, execute: loadEntries } = useAsync<MealPlanEntry[]>();
  const { data: allRecipes, execute: loadRecipes } = useAsync<Recipe[]>();

  useEffect(() => {
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(weekEnd, 'yyyy-MM-dd');
    loadEntries(() => mealPlanApi.list(from, to));
    loadRecipes(() => recipesApi.list());
  }, [currentWeek]);

  // Handle addRecipe query param (from recipe detail page)
  useEffect(() => {
    const addRecipeId = searchParams.get('addRecipe');
    if (addRecipeId && allRecipes) {
      const recipe = allRecipes.find(r => r.id === addRecipeId);
      if (recipe) {
        setSelectedRecipeId(addRecipeId);
        setSelectedDate(new Date());
        setServings(recipe.servings);
        setShowAddModal(true);
      }
    }
  }, [searchParams, allRecipes]);

  // Handle addMeal query param (from dashboard - opens modal with meal type pre-selected)
  useEffect(() => {
    const addMealType = searchParams.get('addMeal') as MealType | null;
    if (addMealType && MEAL_TYPES.includes(addMealType)) {
      setSelectedDate(new Date());
      setSelectedMealType(addMealType);
      setShowAddModal(true);
    }
  }, [searchParams]);

  const getMealsForDay = (date: Date, mealType: MealType) => {
    if (!entries) return [];
    return entries.filter(
      e => isSameDay(parseISO(e.date), date) && e.mealType === mealType
    );
  };

  // Calculate total nutrition for a day
  const getDayNutrition = (date: Date) => {
    if (!entries) return null;
    const dayEntries = entries.filter(e => isSameDay(parseISO(e.date), date));
    if (dayEntries.length === 0) return null;

    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const entry of dayEntries) {
      if (entry.nutrition) {
        totals.calories += entry.nutrition.calories || 0;
        totals.protein += entry.nutrition.protein || 0;
        totals.carbs += entry.nutrition.carbs || 0;
        totals.fat += entry.nutrition.fat || 0;
      }
    }

    // Only return if we have some nutrition data
    if (totals.calories === 0 && totals.protein === 0 && totals.carbs === 0 && totals.fat === 0) {
      return null;
    }

    return totals;
  };

  const getMealTypeLabel = (type: MealType) => {
    const labels: Record<MealType, string> = {
      BREAKFAST: t('mealPlan.breakfast'),
      LUNCH: t('mealPlan.lunch'),
      DINNER: t('mealPlan.dinner'),
      SNACK: t('mealPlan.snack'),
    };
    return labels[type];
  };

  const filteredRecipes = useMemo(() => {
    if (!allRecipes) return [];
    if (!recipeSearch) return allRecipes;
    return allRecipes.filter(r =>
      r.name.toLowerCase().includes(recipeSearch.toLowerCase())
    );
  }, [allRecipes, recipeSearch]);

  const handleAddMeal = async () => {
    if (!selectedDate || !selectedRecipeId) return;

    setAdding(true);
    try {
      await mealPlanApi.create({
        date: selectedDate.toISOString(),
        mealType: selectedMealType,
        recipeId: selectedRecipeId,
        servings,
      });

      setShowAddModal(false);
      setSelectedRecipeId('');
      setRecipeSearch('');

      // Reload entries
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');
      loadEntries(() => mealPlanApi.list(from, to));
    } catch (err) {
      console.error('Failed to add meal:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMeal = async () => {
    if (!selectedMeal) return;
    setActionLoading(true);
    try {
      await mealPlanApi.delete(selectedMeal.id);
      setSelectedMeal(null);
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');
      loadEntries(() => mealPlanApi.list(from, to));
    } catch (err) {
      console.error('Failed to delete meal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteMeal = async () => {
    if (!selectedMeal) return;
    setActionLoading(true);
    try {
      await mealPlanApi.complete(selectedMeal.id);
      setSelectedMeal(null);
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');
      loadEntries(() => mealPlanApi.list(from, to));
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
      await mealPlanApi.uncomplete(selectedMeal.id);
      setSelectedMeal(null);
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');
      loadEntries(() => mealPlanApi.list(from, to));
    } catch (err) {
      console.error('Failed to uncomplete meal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const openAddModal = (date: Date, mealType: MealType) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setSelectedRecipeId('');
    setServings(2);
    setRecipeSearch('');
    setShowAddModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('mealPlan.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="btn-secondary p-2"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="btn-secondary px-3 py-2 text-sm"
          >
            <Calendar size={16} className="mr-1 inline" />
            {t('expiry.today')}
          </button>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="btn-secondary p-2"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Week Header */}
      <div className="text-center text-gray-600">
        {format(weekStart, 'd. MMM', { locale: dateLocale })} - {format(weekEnd, 'd. MMM yyyy', { locale: dateLocale })}
      </div>

      {loading && !entries ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        /* Calendar Grid */
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day Headers */}
            <div className="grid grid-cols-8 gap-1 mb-1">
              <div className="p-2" /> {/* Empty corner */}
              {daysInWeek.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`p-2 text-center rounded-lg ${
                    isSameDay(day, new Date())
                      ? 'bg-primary-100 text-primary-700 font-semibold'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="text-xs uppercase">
                    {format(day, 'EEE', { locale: dateLocale })}
                  </div>
                  <div className="text-lg font-medium">
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Meal Rows */}
            {MEAL_TYPES.map((mealType) => (
              <div key={mealType} className="grid grid-cols-8 gap-1 mb-1">
                {/* Meal Type Label */}
                <div className="p-2 flex items-center justify-end">
                  <span className="text-sm font-medium text-gray-600">
                    {getMealTypeLabel(mealType)}
                  </span>
                </div>

                {/* Day Cells */}
                {daysInWeek.map((day) => {
                  const meals = getMealsForDay(day, mealType);
                  return (
                    <div
                      key={`${day.toISOString()}-${mealType}`}
                      className="min-h-[80px] p-1 bg-white border rounded-lg"
                    >
                      {meals.map((meal) => (
                        <button
                          key={meal.id}
                          onClick={() => setSelectedMeal(meal)}
                          className={`w-full text-left p-2 rounded text-xs mb-1 relative transition-colors ${
                            meal.completedAt
                              ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                              : 'bg-primary-50 border border-primary-200 hover:bg-primary-100'
                          }`}
                        >
                          <div className="font-medium text-gray-800 truncate pr-5">
                            {meal.recipe.name}
                          </div>
                          <div className="text-gray-500 flex items-center gap-2">
                            <Users size={10} />
                            <span>{meal.servings}</span>
                          </div>

                          {meal.completedAt && (
                            <div className="absolute top-1 right-1">
                              <Check size={14} className="text-green-600" />
                            </div>
                          )}
                        </button>
                      ))}

                      {/* Add button */}
                      <button
                        onClick={() => openAddModal(day, mealType)}
                        className="w-full p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded flex items-center justify-center"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Daily Nutrition Summary Row */}
            <div className="grid grid-cols-8 gap-1 mt-2">
              <div className="p-2 flex items-center justify-end">
                <span className="text-xs font-medium text-gray-500">
                  {t('article.calories')}
                </span>
              </div>
              {daysInWeek.map((day) => {
                const nutrition = getDayNutrition(day);
                if (!nutrition) {
                  return (
                    <div
                      key={`nutrition-${day.toISOString()}`}
                      className="p-2 text-center text-xs text-gray-300"
                    >
                      -
                    </div>
                  );
                }
                return (
                  <div
                    key={`nutrition-${day.toISOString()}`}
                    className="p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-center gap-1 text-xs" title={t('article.calories')}>
                        <Flame size={10} className="text-orange-500" />
                        <span className="font-medium">{Math.round(nutrition.calories)}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs" title={t('article.protein')}>
                        <Beef size={10} className="text-red-500" />
                        <span>{Math.round(nutrition.protein)}g</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs" title={t('article.carbs')}>
                        <Wheat size={10} className="text-amber-500" />
                        <span>{Math.round(nutrition.carbs)}g</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs" title={t('article.fat')}>
                        <Droplet size={10} className="text-yellow-500" />
                        <span>{Math.round(nutrition.fat)}g</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Meal Modal */}
      <ModalPortal isOpen={showAddModal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('mealPlan.addMeal')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Display */}
              {selectedDate && (
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="font-medium">
                    {format(selectedDate, 'EEEE, d. MMMM', { locale: dateLocale })}
                  </span>
                  <span className="text-gray-500 ml-2">
                    {getMealTypeLabel(selectedMealType)}
                  </span>
                </div>
              )}

              {/* Meal Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('mealPlan.mealType')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedMealType(type)}
                      className={`px-3 py-2 text-xs rounded-lg border ${
                        selectedMealType === type
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {getMealTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipe Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('mealPlan.selectRecipe')}
                </label>
                <input
                  type="text"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="input w-full mb-2"
                />
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  {filteredRecipes.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {t('common.noData')}
                    </div>
                  ) : (
                    filteredRecipes.map((recipe: Recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => {
                          setSelectedRecipeId(recipe.id);
                          setServings(recipe.servings);
                        }}
                        className={`w-full p-3 text-left border-b last:border-0 flex items-center gap-3 ${
                          selectedRecipeId === recipe.id
                            ? 'bg-primary-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 bg-primary-100 rounded flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed size={20} className="text-primary-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">
                            {recipe.name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Users size={12} />
                            <span>{recipe.servings}</span>
                            {recipe.prepTime && (
                              <>
                                <Clock size={12} className="ml-2" />
                                <span>{recipe.prepTime}min</span>
                              </>
                            )}
                          </div>
                        </div>
                        {selectedRecipeId === recipe.id && (
                          <Check size={20} className="text-primary-600" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Servings */}
              {selectedRecipeId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('recipe.servings')}
                  </label>
                  <input
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                    min={1}
                    className="input w-full"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                  disabled={adding}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddMeal}
                  disabled={!selectedRecipeId || adding}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {adding ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  ) : (
                    <>
                      <Plus size={18} />
                      {t('common.add')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

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
