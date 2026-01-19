import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n';
import { articles, locations, StorageLocation, CreateArticleInput, units as unitsApi, Unit } from '../lib/api';

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isNew = !id || id === 'new';

  const [locationList, setLocationList] = useState<StorageLocation[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateArticleInput>({
    name: '',
    defaultUnit: 'pcs',
    packageSize: 1,
    packageUnit: 'pcs',
    locationId: null,
    minStock: null,
    defaultExpiryDays: null,
    category: '',
    isConsumable: true,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [locs, units] = await Promise.all([
          locations.list(),
          unitsApi.list(),
        ]);
        setLocationList(locs);
        setUnitList(units);

        if (!isNew && id) {
          const article = await articles.get(id);
          setFormData({
            name: article.name,
            defaultUnit: article.defaultUnit,
            packageSize: article.packageSize,
            packageUnit: article.packageUnit,
            locationId: article.locationId,
            minStock: article.minStock,
            defaultExpiryDays: article.defaultExpiryDays,
            category: article.category || '',
            isConsumable: article.isConsumable,
            calories: article.calories,
            protein: article.protein,
            carbs: article.carbs,
            fat: article.fat,
            fiber: article.fiber,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data: CreateArticleInput = {
        ...formData,
        category: formData.category || null,
        minStock: formData.minStock || null,
        defaultExpiryDays: formData.defaultExpiryDays || null,
        calories: formData.calories || null,
        protein: formData.protein || null,
        carbs: formData.carbs || null,
        fat: formData.fat || null,
        fiber: formData.fiber || null,
      };

      if (isNew) {
        const created = await articles.create(data);
        navigate(`/inventory/article/${created.id}`);
      } else if (id) {
        await articles.update(id, data);
        navigate(`/inventory/article/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof CreateArticleInput>(field: K, value: CreateArticleInput[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? t('article.create') : t('article.edit')}
        </h1>
      </div>

      {error && (
        <div className="card p-4 mb-6 bg-red-50 text-red-700 flex items-center gap-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('article.name')} *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">{t('article.location')}</label>
            <select
              value={formData.locationId || ''}
              onChange={(e) => updateField('locationId', e.target.value || null)}
              className="input"
            >
              <option value="">{t('inventory.noLocation')}</option>
              {locationList.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.icon ? `${loc.icon} ` : ''}{loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('article.category')}</label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => updateField('category', e.target.value)}
              className="input"
              placeholder={t('article.categoryPlaceholder')}
            />
          </div>
        </div>

        {/* Package & Units */}
        <div className="card p-4 space-y-4">
          <h3 className="font-medium">{t('article.packageSize')}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('article.packageSize')}</label>
              <input
                type="number"
                value={formData.packageSize}
                onChange={(e) => updateField('packageSize', parseFloat(e.target.value) || 1)}
                className="input"
                min="0.01"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">{t('article.unit')}</label>
              <select
                value={formData.packageUnit}
                onChange={(e) => updateField('packageUnit', e.target.value)}
                className="input"
              >
                {unitList.map((unit) => (
                  <option key={unit.id} value={unit.symbol}>{unit.symbol}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{t('article.unitDefault')}</label>
            <select
              value={formData.defaultUnit}
              onChange={(e) => updateField('defaultUnit', e.target.value)}
              className="input"
            >
              {unitList.map((unit) => (
                <option key={unit.id} value={unit.symbol}>{unit.symbol}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock & Expiry */}
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('article.minStock')}</label>
            <input
              type="number"
              value={formData.minStock ?? ''}
              onChange={(e) => updateField('minStock', e.target.value ? parseFloat(e.target.value) : null)}
              className="input"
              min="0"
              step="0.01"
              placeholder="0"
            />
            <p className="text-sm text-gray-500 mt-1">{t('article.minStockHelp')}</p>
          </div>

          <div>
            <label className="label">{t('article.expiryDefault')}</label>
            <input
              type="number"
              value={formData.defaultExpiryDays ?? ''}
              onChange={(e) => updateField('defaultExpiryDays', e.target.value ? parseInt(e.target.value) : null)}
              className="input"
              min="1"
              step="1"
              placeholder="7"
            />
            <p className="text-sm text-gray-500 mt-1">{t('article.expiryDefaultHelp')}</p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isConsumable"
                checked={formData.isConsumable}
                onChange={(e) => updateField('isConsumable', e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <label htmlFor="isConsumable" className="text-sm">
                {t('article.isConsumable')}
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-1 ml-6">{t('article.isConsumableHelp')}</p>
          </div>
        </div>

        {/* Nutrition */}
        <div className="card p-4 space-y-4">
          <h3 className="font-medium">{t('article.nutrition')}</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('article.calories')}</label>
              <input
                type="number"
                value={formData.calories ?? ''}
                onChange={(e) => updateField('calories', e.target.value ? parseFloat(e.target.value) : null)}
                className="input"
                min="0"
                step="1"
                placeholder="kcal"
              />
            </div>
            <div>
              <label className="label">{t('article.protein')} (g)</label>
              <input
                type="number"
                value={formData.protein ?? ''}
                onChange={(e) => updateField('protein', e.target.value ? parseFloat(e.target.value) : null)}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="label">{t('article.carbs')} (g)</label>
              <input
                type="number"
                value={formData.carbs ?? ''}
                onChange={(e) => updateField('carbs', e.target.value ? parseFloat(e.target.value) : null)}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="label">{t('article.fat')} (g)</label>
              <input
                type="number"
                value={formData.fat ?? ''}
                onChange={(e) => updateField('fat', e.target.value ? parseFloat(e.target.value) : null)}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="label">{t('article.fiber')} (g)</label>
              <input
                type="number"
                value={formData.fiber ?? ''}
                onChange={(e) => updateField('fiber', e.target.value ? parseFloat(e.target.value) : null)}
                className="input"
                min="0"
                step="0.1"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary flex-1"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
