import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { recipes as recipesApi, Recipe } from '../lib/api';
import { useAsync } from '../lib/hooks';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Clock,
  Users,
  ChefHat,
  MoreVertical,
  Edit,
  Trash2,
  Flame
} from 'lucide-react';

export default function RecipesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: allRecipes, loading, error, execute: loadRecipes } = useAsync<Recipe[]>();

  useEffect(() => {
    loadRecipes(() => recipesApi.list());
  }, []);

  const filteredRecipes = useMemo(() => {
    if (!allRecipes) return [];
    if (!searchQuery.trim()) return allRecipes;

    const query = searchQuery.toLowerCase();
    return allRecipes.filter(recipe =>
      recipe.name.toLowerCase().includes(query) ||
      recipe.description?.toLowerCase().includes(query)
    );
  }, [allRecipes, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('recipe.deleteConfirm'))) return;

    try {
      await recipesApi.delete(id);
      loadRecipes(() => recipesApi.list());
    } catch (err) {
      console.error('Failed to delete recipe:', err);
    }
    setMenuOpen(null);
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const getTotalTime = (recipe: Recipe) => {
    const total = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    return total > 0 ? formatTime(total) : null;
  };

  if (loading && !allRecipes) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {t('common.error')}: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('recipe.title')}</h1>
        <Link
          to="/recipes/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">{t('recipe.add')}</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('common.search')}
          className="input pl-10 w-full"
        />
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <UtensilsCrossed size={40} className="text-primary-600" />
          </div>
          {searchQuery ? (
            <p className="text-gray-500">{t('common.noData')}</p>
          ) : (
            <>
              <p className="text-gray-500 mb-2">{t('recipe.empty')}</p>
              <Link to="/recipes/new" className="text-primary-600 hover:underline">
                {t('recipe.add')}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className="card overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Recipe Image */}
              <div
                className="h-32 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center cursor-pointer"
                onClick={() => navigate(`/recipes/${recipe.id}`)}
              >
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ChefHat size={48} className="text-primary-400" />
                )}
              </div>

              {/* Recipe Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/recipes/${recipe.id}`}
                    className="font-semibold text-gray-900 hover:text-primary-600 line-clamp-1"
                  >
                    {recipe.name}
                  </Link>

                  {/* Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === recipe.id ? null : recipe.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical size={16} className="text-gray-400" />
                    </button>

                    {menuOpen === recipe.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpen(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-20 py-1 min-w-[140px]">
                          <Link
                            to={`/recipes/${recipe.id}/edit`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setMenuOpen(null)}
                          >
                            <Edit size={16} />
                            {t('common.edit')}
                          </Link>
                          <button
                            onClick={() => handleDelete(recipe.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                          >
                            <Trash2 size={16} />
                            {t('common.delete')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {recipe.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {recipe.description}
                  </p>
                )}

                {/* Meta Info */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users size={14} />
                    <span>{recipe.servings}</span>
                  </div>

                  {getTotalTime(recipe) && (
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{getTotalTime(recipe)}</span>
                    </div>
                  )}

                  {recipe.totalCalories !== undefined && recipe.totalCalories > 0 && (
                    <div className="flex items-center gap-1">
                      <Flame size={14} />
                      <span>{Math.round(recipe.totalCalories / recipe.servings)} kcal</span>
                    </div>
                  )}
                </div>

                {/* Cook Button */}
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="btn-primary w-full mt-3 text-sm py-2 flex items-center justify-center gap-2"
                >
                  <UtensilsCrossed size={16} />
                  {t('recipe.cook')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
