import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, AlertTriangle, Package, ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from '../i18n';
import { articles, locations, Article, StorageLocation } from '../lib/api';
import { cn, daysUntilExpiry, formatQuantity } from '../lib/utils';

export default function InventoryPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [articleList, setArticleList] = useState<Article[]>([]);
  const [locationList, setLocationList] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const selectedLocation = searchParams.get('location') || '';
  const showLowStock = searchParams.get('lowStock') === 'true';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [articlesData, locationsData] = await Promise.all([
        articles.list({
          locationId: selectedLocation || undefined,
          search: search || undefined,
          lowStock: showLowStock,
        }),
        locations.list(),
      ]);
      setArticleList(articlesData);
      setLocationList(locationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLocation, showLowStock]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get('search') || '')) {
        loadData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleLocationChange = (locationId: string) => {
    const params = new URLSearchParams(searchParams);
    if (locationId) {
      params.set('location', locationId);
    } else {
      params.delete('location');
    }
    params.delete('lowStock');
    setSearchParams(params);
  };

  // Group articles by location
  const groupedArticles = articleList.reduce((acc, article) => {
    const locId = article.locationId || 'no-location';
    if (!acc[locId]) {
      acc[locId] = [];
    }
    acc[locId].push(article);
    return acc;
  }, {} as Record<string, Article[]>);

  const getExpiryBadge = (article: Article) => {
    if (!article.earliestExpiry) return null;
    const days = daysUntilExpiry(article.earliestExpiry);
    if (days === null) return null;

    if (days < 0) {
      return <span className="badge badge-expired">{t('expiry.expired')}</span>;
    }
    if (days === 0) {
      return <span className="badge badge-warning">{t('expiry.today')}</span>;
    }
    if (days <= 3) {
      return <span className="badge badge-warning">{t('expiry.days', { days })}</span>;
    }
    return null;
  };

  if (loading && articleList.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('inventory.title')}</h1>
        <Link to="/inventory/article/new" className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          <span className="hidden sm:inline">{t('inventory.addArticle')}</span>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={selectedLocation}
          onChange={(e) => handleLocationChange(e.target.value)}
          className="input sm:w-48"
        >
          <option value="">{t('inventory.allLocations')}</option>
          {locationList.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.icon ? `${loc.icon} ` : ''}{loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 text-red-700 flex items-center gap-2">
          <AlertTriangle size={20} />
          {error}
          <button onClick={loadData} className="ml-auto btn btn-outline text-sm">
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Empty State */}
      {articleList.length === 0 && !loading && !error && (
        <div className="card p-8 text-center">
          <Package size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">{t('inventory.empty')}</p>
          <Link to="/inventory/article/new" className="btn btn-primary">
            {t('inventory.addArticle')}
          </Link>
        </div>
      )}

      {/* Article List */}
      {selectedLocation ? (
        // Single location view
        <div className="space-y-2">
          {articleList.map((article) => (
            <ArticleCard key={article.id} article={article} t={t} getExpiryBadge={getExpiryBadge} />
          ))}
        </div>
      ) : (
        // Grouped by location
        <div className="space-y-6">
          {locationList.map((location) => {
            const locArticles = groupedArticles[location.id] || [];
            if (locArticles.length === 0) return null;

            return (
              <div key={location.id}>
                <div className="flex items-center gap-2 mb-2 text-gray-600">
                  <MapPin size={16} />
                  <span className="font-medium">
                    {location.icon ? `${location.icon} ` : ''}{location.name}
                  </span>
                  <span className="text-sm text-gray-400">({locArticles.length})</span>
                </div>
                <div className="space-y-2">
                  {locArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} t={t} getExpiryBadge={getExpiryBadge} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* No location */}
          {groupedArticles['no-location']?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <MapPin size={16} />
                <span className="font-medium">{t('inventory.noLocation')}</span>
                <span className="text-sm">({groupedArticles['no-location'].length})</span>
              </div>
              <div className="space-y-2">
                {groupedArticles['no-location'].map((article) => (
                  <ArticleCard key={article.id} article={article} t={t} getExpiryBadge={getExpiryBadge} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArticleCard({
  article,
  t,
  getExpiryBadge,
}: {
  article: Article;
  t: (key: string, params?: Record<string, string | number>) => string;
  getExpiryBadge: (article: Article) => JSX.Element | null;
}) {
  return (
    <Link
      to={`/inventory/article/${article.id}`}
      className="article-card"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{article.name}</span>
          {article.isLowStock && (
            <span className="badge badge-danger">{t('dashboard.lowStock')}</span>
          )}
          {getExpiryBadge(article)}
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <span className={cn(
            article.totalStock === 0 && 'text-red-500',
            article.isLowStock && article.totalStock! > 0 && 'text-yellow-600'
          )}>
            {formatQuantity(article.totalStock || 0, article.defaultUnit)}
          </span>
        </div>
      </div>
      <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
    </Link>
  );
}
