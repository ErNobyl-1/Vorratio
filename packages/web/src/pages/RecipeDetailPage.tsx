import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { recipes as recipesApi, Recipe, CookResult } from '../lib/api';
import { useAsync } from '../lib/hooks';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Clock,
  Users,
  ChefHat,
  UtensilsCrossed,
  Flame,
  Minus,
  Plus,
  AlertCircle,
  Check,
  Calendar
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import NutritionSummary from '../components/NutritionSummary';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [servingsMultiplier, setServingsMultiplier] = useState(1);
  const [showCookModal, setShowCookModal] = useState(false);
  const [cookResult, setCookResult] = useState<CookResult | null>(null);
  const [cooking, setCooking] = useState(false);

  const { data: recipe, loading, error, execute: loadRecipe } = useAsync<Recipe>();

  useEffect(() => {
    if (id) {
      loadRecipe(() => recipesApi.get(id));
    }
  }, [id]);

  const handleDelete = async () => {
    if (!recipe || !confirm(t('recipe.deleteConfirm'))) return;

    try {
      await recipesApi.delete(recipe.id);
      navigate('/recipes');
    } catch (err) {
      console.error('Failed to delete recipe:', err);
    }
  };

  const handleCook = async () => {
    if (!recipe) return;

    setCooking(true);
    try {
      const result = await recipesApi.cook(recipe.id, recipe.servings * servingsMultiplier);
      setCookResult(result);
    } catch (err: any) {
      setCookResult({
        success: false,
        message: err.message || 'Failed to cook recipe',
        consumed: [],
      });
    } finally {
      setCooking(false);
    }
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const adjustedServings = recipe ? recipe.servings * servingsMultiplier : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Recipe not found'}
        </div>
        <Link to="/recipes" className="btn-secondary mt-4">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/recipes')} className="btn-secondary p-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{recipe.name}</h1>
        <Link to={`/recipes/${recipe.id}/edit`} className="btn-secondary p-2">
          <Edit size={20} />
        </Link>
        <button onClick={handleDelete} className="btn-secondary p-2 text-red-600 hover:bg-red-50">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Recipe Image / Header Card */}
      <div className="card overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
          {recipe.imageUrl ? (
            <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
          ) : (
            <ChefHat size={64} className="text-primary-400" />
          )}
        </div>

        <div className="p-4">
          {recipe.description && (
            <p className="text-gray-600 mb-4">{recipe.description}</p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary-600" />
              <span>{recipe.servings} {t('recipe.servings')}</span>
            </div>

            {recipe.prepTime && (
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-primary-600" />
                <span>{t('recipe.prepTime')}: {formatTime(recipe.prepTime)}</span>
              </div>
            )}

            {recipe.cookTime && (
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                <span>{t('recipe.cookTime')}: {formatTime(recipe.cookTime)}</span>
              </div>
            )}

            {recipe.nutritionPerServing?.calories && recipe.nutritionPerServing.calories > 0 && (
              <div className="flex items-center gap-2">
                <Flame size={18} className="text-red-500" />
                <span>{Math.round(recipe.nutritionPerServing.calories)} kcal / {t('recipe.servings').toLowerCase()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Servings Adjuster */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">{t('recipe.servings')}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServingsMultiplier(Math.max(0.5, servingsMultiplier - 0.5))}
              className="btn-secondary p-2"
              disabled={servingsMultiplier <= 0.5}
            >
              <Minus size={16} />
            </button>
            <span className="text-xl font-bold text-primary-600 w-12 text-center">
              {adjustedServings}
            </span>
            <button
              onClick={() => setServingsMultiplier(servingsMultiplier + 0.5)}
              className="btn-secondary p-2"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-lg text-gray-900 mb-3">{t('recipe.ingredients')}</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-center gap-3 text-gray-700">
                <span className="w-20 text-right font-medium text-primary-600">
                  {(ing.quantity * servingsMultiplier).toFixed(ing.quantity * servingsMultiplier % 1 === 0 ? 0 : 1)} {ing.unit}
                </span>
                <span className={ing.optional ? 'italic text-gray-500' : ''}>
                  {ing.article?.name || ing.categoryMatch || 'Unknown'}
                  {ing.optional && ' (optional)'}
                </span>
                {ing.notes && (
                  <span className="text-sm text-gray-400">- {ing.notes}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nutrition Info */}
      {recipe.nutritionPerServing && (
        recipe.nutritionPerServing.calories > 0 ||
        recipe.nutritionPerServing.protein > 0 ||
        recipe.nutritionPerServing.carbs > 0 ||
        recipe.nutritionPerServing.fat > 0 ||
        recipe.nutritionPerServing.fiber > 0
      ) ? (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={20} className="text-orange-500" />
            <h2 className="font-semibold text-lg text-gray-900">
              {t('article.nutrition')}
            </h2>
            <span className="text-sm text-gray-500">
              ({adjustedServings} {t('recipe.servings').toLowerCase()})
            </span>
          </div>
          <NutritionSummary
            data={{
              calories: recipe.nutritionPerServing.calories,
              protein: recipe.nutritionPerServing.protein,
              carbs: recipe.nutritionPerServing.carbs,
              fat: recipe.nutritionPerServing.fat,
              fiber: recipe.nutritionPerServing.fiber,
            }}
            servings={adjustedServings}
          />
        </div>
      ) : null}

      {/* Instructions */}
      {recipe.instructions && (
        <div className="card p-4">
          <h2 className="font-semibold text-lg text-gray-900 mb-3">{t('recipe.instructions')}</h2>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {recipe.instructions}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowCookModal(true)}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <UtensilsCrossed size={20} />
          {t('recipe.cook')}
        </button>
        <Link
          to={`/meal-plan?addRecipe=${recipe.id}`}
          className="btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <Calendar size={20} />
          {t('mealPlan.addMeal')}
        </Link>
      </div>

      {/* Cook Modal */}
      <ModalPortal isOpen={showCookModal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            {!cookResult ? (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('recipe.cook')}</h3>
                <p className="text-gray-600 mb-4">
                  Cook <strong>{recipe.name}</strong> for <strong>{adjustedServings}</strong> servings?
                  This will consume ingredients from your inventory.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCookModal(false)}
                    className="btn-secondary flex-1"
                    disabled={cooking}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleCook}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={cooking}
                  >
                    {cooking ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <>
                        <UtensilsCrossed size={18} />
                        {t('recipe.cook')}
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`flex items-center gap-3 mb-4 ${cookResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {cookResult.success ? <Check size={24} /> : <AlertCircle size={24} />}
                  <h3 className="text-lg font-semibold">
                    {cookResult.success ? 'Cooked successfully!' : 'Cannot cook'}
                  </h3>
                </div>

                {cookResult.message && (
                  <p className="text-gray-600 mb-4">{cookResult.message}</p>
                )}

                {cookResult.consumed.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Consumed:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {cookResult.consumed.map((item, i) => (
                        <li key={i}>
                          {item.consumed} {item.unit} {item.name}
                          {item.originalUnit && item.originalUnit !== item.unit && (
                            <span className="text-gray-400 ml-1">
                              ({item.originalQuantity} {item.originalUnit})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cookResult.missing && cookResult.missing.length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-700 mb-2">Missing ingredients:</p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {cookResult.missing.map((item, i) => (
                        <li key={i}>
                          {item.name || item.categoryMatch || 'Unknown'}:
                          {item.error ? (
                            <span> {item.error}</span>
                          ) : (
                            <span> need {item.needed} {item.unit}, have {item.available ?? 0}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowCookModal(false);
                    setCookResult(null);
                    if (cookResult.success) {
                      loadRecipe(() => recipesApi.get(recipe.id));
                    }
                  }}
                  className="btn-primary w-full"
                >
                  {t('common.close')}
                </button>
              </>
            )}
          </div>
        </div>
      </ModalPortal>
    </div>
  );
}
