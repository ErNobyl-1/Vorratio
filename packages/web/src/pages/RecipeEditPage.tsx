import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import {
  recipes as recipesApi,
  articles as articlesApi,
  units as unitsApi,
  Recipe,
  Article,
  Unit,
  CreateRecipeInput
} from '../lib/api';
import { useAsync } from '../lib/hooks';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Search
} from 'lucide-react';

interface IngredientForm {
  id?: string;
  articleId: string | null;
  categoryMatch: string | null;
  quantity: number;
  unit: string;
  notes: string;
  optional: boolean;
}

export default function RecipeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isNew = !id || id === 'new';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState(4);
  const [prepTime, setPrepTime] = useState<number | null>(null);
  const [cookTime, setCookTime] = useState<number | null>(null);
  const [instructions, setInstructions] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState<IngredientForm[]>([]);

  // Article search
  const [articleSearch, setArticleSearch] = useState('');
  const [showArticleDropdown, setShowArticleDropdown] = useState<number | null>(null);

  const { data: recipe, loading: loadingRecipe, execute: loadRecipe } = useAsync<Recipe>();
  const { data: allArticles, execute: loadArticles } = useAsync<Article[]>();
  const { data: unitList, execute: loadUnits } = useAsync<Unit[]>();

  useEffect(() => {
    loadArticles(() => articlesApi.list());
    loadUnits(() => unitsApi.list());

    if (!isNew && id) {
      loadRecipe(() => recipesApi.get(id));
    }
  }, [id, isNew]);

  // Populate form when recipe loads
  useEffect(() => {
    if (recipe) {
      setName(recipe.name);
      setDescription(recipe.description || '');
      setServings(recipe.servings);
      setPrepTime(recipe.prepTime);
      setCookTime(recipe.cookTime);
      setInstructions(recipe.instructions || '');
      setImageUrl(recipe.imageUrl || '');
      setIngredients(
        recipe.ingredients?.map(ing => ({
          id: ing.id,
          articleId: ing.articleId,
          categoryMatch: ing.categoryMatch,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes || '',
          optional: ing.optional,
        })) || []
      );
    }
  }, [recipe]);

  const filteredArticles = allArticles?.filter(a =>
    a.name.toLowerCase().includes(articleSearch.toLowerCase())
  ).slice(0, 10) || [];

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        articleId: null,
        categoryMatch: '',
        quantity: 1,
        unit: 'pcs',
        notes: '',
        optional: false,
      },
    ]);
  };

  const updateIngredient = (index: number, updates: Partial<IngredientForm>) => {
    setIngredients(ingredients.map((ing, i) => (i === index ? { ...ing, ...updates } : ing)));
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const selectArticle = (index: number, article: Article) => {
    updateIngredient(index, {
      articleId: article.id,
      categoryMatch: null,
      unit: article.defaultUnit,
    });
    setShowArticleDropdown(null);
    setArticleSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Recipe name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data: CreateRecipeInput = {
        name: name.trim(),
        description: description.trim() || null,
        servings,
        prepTime,
        cookTime,
        instructions: instructions.trim() || null,
        imageUrl: imageUrl.trim() || null,
        ingredients: ingredients
          .filter(ing => ing.articleId || ing.categoryMatch)
          .map(ing => ({
            articleId: ing.articleId,
            categoryMatch: ing.categoryMatch || null,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes || null,
            optional: ing.optional,
          })),
      };

      if (isNew) {
        const created = await recipesApi.create(data);
        navigate(`/recipes/${created.id}`);
      } else {
        await recipesApi.update(id!, data);
        navigate(`/recipes/${id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  if (loadingRecipe && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">
          {isNew ? t('recipe.add') : t('recipe.edit')}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('recipe.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('recipe.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('recipe.prepTime')} (min)
              </label>
              <input
                type="number"
                value={prepTime || ''}
                onChange={(e) => setPrepTime(e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('recipe.cookTime')} (min)
              </label>
              <input
                type="number"
                value={cookTime || ''}
                onChange={(e) => setCookTime(e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="input w-full"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Ingredients */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-gray-900">{t('recipe.ingredients')}</h2>
            <button
              type="button"
              onClick={addIngredient}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              {t('recipe.addIngredient')}
            </button>
          </div>

          {ingredients.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              {t('recipe.ingredientsEmpty')}
            </p>
          ) : (
            <div className="space-y-3">
              {ingredients.map((ing, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="text-gray-400 cursor-move mt-2">
                    <GripVertical size={16} />
                  </div>

                  <div className="flex-1 grid grid-cols-12 gap-2">
                    {/* Quantity */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(index, { quantity: parseFloat(e.target.value) || 0 })}
                        className="input w-full text-sm"
                        step="0.1"
                        min="0"
                      />
                    </div>

                    {/* Unit */}
                    <div className="col-span-2">
                      <select
                        value={ing.unit}
                        onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                        className="input w-full text-sm"
                      >
                        {unitList?.map((unit) => (
                          <option key={unit.id} value={unit.symbol}>{unit.symbol}</option>
                        ))}
                      </select>
                    </div>

                    {/* Article / Category */}
                    <div className="col-span-5 relative">
                      {ing.articleId ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-gray-700">
                            {allArticles?.find(a => a.id === ing.articleId)?.name || 'Article'}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateIngredient(index, { articleId: null, categoryMatch: '' })}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                              type="text"
                              value={showArticleDropdown === index ? articleSearch : ing.categoryMatch || ''}
                              onChange={(e) => {
                                setArticleSearch(e.target.value);
                                updateIngredient(index, { categoryMatch: e.target.value });
                              }}
                              onFocus={() => {
                                setShowArticleDropdown(index);
                                setArticleSearch(ing.categoryMatch || '');
                              }}
                              className="input w-full text-sm pl-7"
                              placeholder="Search article or type category..."
                            />
                          </div>

                          {showArticleDropdown === index && filteredArticles.length > 0 && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowArticleDropdown(null)}
                              />
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                                {filteredArticles.map((article) => (
                                  <button
                                    key={article.id}
                                    type="button"
                                    onClick={() => selectArticle(index, article)}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <span>{article.name}</span>
                                    <span className="text-xs text-gray-400">({article.defaultUnit})</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* Optional */}
                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="checkbox"
                        id={`optional-${index}`}
                        checked={ing.optional}
                        onChange={(e) => updateIngredient(index, { optional: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor={`optional-${index}`} className="text-xs text-gray-500">
                        Optional
                      </label>
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('recipe.instructions')}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="input w-full"
            rows={8}
            placeholder={t('recipe.instructionsPlaceholder')}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={saving}
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Save size={18} />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
