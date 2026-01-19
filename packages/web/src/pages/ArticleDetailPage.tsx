import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Plus, Minus, AlertTriangle, MapPin, Calendar, History, UtensilsCrossed, Flame, Package, Barcode, TrendingUp, TrendingDown, RefreshCw, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '../i18n';
import { articles, batches, products as productsApi, consumption, Article, ConsumptionLog, Product, Batch } from '../lib/api';
import { cn, daysUntilExpiry, formatQuantity, formatCurrency } from '../lib/utils';
import NutritionSummary from '../components/NutritionSummary';
import ModalPortal from '../components/ModalPortal';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dateFnsLocale } = useTranslation();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consumeModal, setConsumeModal] = useState<{ batchId?: string; max: number } | null>(null);
  const [consumeAmount, setConsumeAmount] = useState('1');
  const [addBatchModal, setAddBatchModal] = useState(false);
  const [editBatchModal, setEditBatchModal] = useState<{ batch: Batch } | null>(null);
  const [editPurchaseModal, setEditPurchaseModal] = useState<{ batch: Batch } | null>(null);
  const [editConsumptionModal, setEditConsumptionModal] = useState<{ log: ConsumptionLog } | null>(null);
  const [productModal, setProductModal] = useState<{ product?: Product } | null>(null);
  const [stockCorrectionModal, setStockCorrectionModal] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await articles.get(id);
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!article || !window.confirm(t('article.deleteConfirm'))) return;
    try {
      await articles.delete(article.id);
      navigate('/inventory');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleConsume = async () => {
    if (!article || !consumeModal) return;
    const amount = parseFloat(consumeAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      if (consumeModal.batchId) {
        await batches.consume(consumeModal.batchId, amount);
      } else {
        await articles.consume(article.id, amount);
      }
      setConsumeModal(null);
      setConsumeAmount('1');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to consume');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm(t('batch.deleteConfirm'))) return;
    try {
      await batches.delete(batchId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete batch');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm(t('product.deleteConfirm'))) return;
    try {
      await productsApi.delete(productId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  if (loading && !article) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="card p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 text-red-500" size={32} />
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/inventory')} className="btn btn-primary">
          {t('common.back')}
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/inventory')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{article.name}</h1>
          {article.location && (
            <div className="text-gray-500 flex items-center gap-1">
              <MapPin size={16} />
              {article.location.icon ? `${article.location.icon} ` : ''}{article.location.name}
            </div>
          )}
        </div>
        <Link to={`/inventory/article/${article.id}/edit`} className="btn btn-outline p-2">
          <Edit size={20} />
        </Link>
        <button onClick={handleDelete} className="btn btn-danger p-2">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 bg-red-50 text-red-700 flex items-center gap-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {/* Stock Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">{t('inventory.stock')}</div>
            <div className={cn(
              'text-2xl font-bold',
              article.totalStock === 0 && 'text-red-500',
              article.isLowStock && article.totalStock! > 0 && 'text-yellow-600',
              !article.isLowStock && article.totalStock! > 0 && 'text-green-600'
            )}>
              {formatQuantity(article.totalStock || 0, article.defaultUnit)}
            </div>
            {article.minStock !== null && (
              <div className="text-sm text-gray-500">
                Min: {formatQuantity(article.minStock, article.defaultUnit)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStockCorrectionModal(true)}
              className="btn btn-outline flex items-center gap-2"
              title={t('stock.correction')}
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={() => setConsumeModal({ max: article.totalStock || 0 })}
              disabled={!article.totalStock}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Minus size={20} />
              {t('article.consume')}
            </button>
            <button
              onClick={() => setAddBatchModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              {t('article.addBatch')}
            </button>
          </div>
        </div>
      </div>

      {/* Price Information */}
      {(article.lastPurchasePrice != null || article.avgPrice != null) && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold">{t('price.title')}</h2>
            <span className="text-sm text-gray-500">
              ({t('price.perUnit', { unit: article.defaultUnit })})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {article.lastPurchasePrice != null && (
              <div>
                <div className="text-sm text-gray-500">{t('price.lastPrice')}</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency(article.lastPurchasePrice)}
                </div>
              </div>
            )}
            {article.avgPrice != null && (
              <div>
                <div className="text-sm text-gray-500">{t('price.avgPrice')}</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(article.avgPrice)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Article Info */}
      <div className="card p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('article.packageSize')}</span>
          <span>{formatQuantity(article.packageSize, article.packageUnit)}</span>
        </div>
        {article.category && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('article.category')}</span>
            <span>{article.category}</span>
          </div>
        )}
        {article.defaultExpiryDays && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('article.expiryDefault')}</span>
            <span>{article.defaultExpiryDays} {t('expiry.days', { days: article.defaultExpiryDays })}</span>
          </div>
        )}
      </div>

      {/* Products (variants with barcodes) */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-gray-500" />
            <h2 className="font-semibold">{t('product.title')}</h2>
          </div>
          <button
            onClick={() => setProductModal({})}
            className="btn btn-outline text-sm py-1 px-2 flex items-center gap-1"
          >
            <Plus size={16} />
            {t('product.add')}
          </button>
        </div>
        {!article.products?.length ? (
          <div className="p-4 text-center text-gray-500">{t('product.empty')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {article.products.map((product) => (
              <div key={product.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-500 flex flex-wrap gap-3 mt-1">
                      {product.brand && (
                        <span>{product.brand}</span>
                      )}
                      {product.barcode && (
                        <span className="flex items-center gap-1 font-mono text-xs">
                          <Barcode size={14} />
                          {product.barcode}
                        </span>
                      )}
                      {product.packageSize && (
                        <span>
                          {formatQuantity(product.packageSize, product.packageUnit || article.packageUnit)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setProductModal({ product })}
                      className="btn btn-outline text-sm py-1 px-2"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="btn btn-outline text-sm py-1 px-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {product.notes && (
                  <div className="text-sm text-gray-500 mt-2">{product.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}</div>

      {/* Nutrition Info */}
      {(article.calories || article.protein || article.carbs || article.fat || article.fiber) && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={20} className="text-orange-500" />
            <h2 className="font-semibold">{t('article.nutrition')}</h2>
          </div>
          <NutritionSummary data={article} />
        </div>
      )}

      {/* Batches */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">{t('article.batches')}</h2>
          <span className="text-sm text-gray-500">
            {article.batches?.length || 0} {t('common.items', { count: article.batches?.length || 0 })}
          </span>
        </div>
        {!article.batches?.length ? (
          <div className="p-4 text-center text-gray-500">{t('article.noStock')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {article.batches.map((batch) => {
              const days = daysUntilExpiry(batch.expiryDate);
              const isExpired = days !== null && days < 0;
              const isExpiringSoon = days !== null && days >= 0 && days <= 7;

              return (
                <div key={batch.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatQuantity(batch.quantity, article.defaultUnit)}
                      </span>
                      {isExpired && (
                        <span className="badge badge-expired">{t('expiry.expired')}</span>
                      )}
                      {isExpiringSoon && !isExpired && (
                        <span className="badge badge-warning">
                          {days === 0 ? t('expiry.today') : t('expiry.days', { days })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConsumeModal({ batchId: batch.id, max: batch.quantity })}
                        className="btn btn-outline text-sm py-1 px-2"
                      >
                        <Minus size={16} />
                      </button>
                      <button
                        onClick={() => setEditBatchModal({ batch })}
                        className="btn btn-outline text-sm py-1 px-2"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="btn btn-outline text-sm py-1 px-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {format(new Date(batch.purchaseDate), 'PP', { locale: dateFnsLocale })}
                    </span>
                    {batch.expiryDate ? (
                      <span className={cn(
                        'flex items-center gap-1',
                        isExpired && 'text-red-500',
                        isExpiringSoon && !isExpired && 'text-yellow-600'
                      )}>
                        <AlertTriangle size={14} />
                        {format(new Date(batch.expiryDate), 'PP', { locale: dateFnsLocale })}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600">
                        {t('expiry.unknown')}
                      </span>
                    )}
                    {batch.purchasePrice !== null && (
                      <span className="flex items-center gap-1">
                        {formatCurrency(batch.purchasePrice)}
                        {batch.quantity > 0 && (
                          <span className="text-gray-400">
                            ({formatCurrency(batch.purchasePrice / batch.quantity)}/{article.defaultUnit})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {batch.notes && (
                    <div className="text-sm text-gray-500 mt-1">{batch.notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Consume Modal */}
      <ModalPortal isOpen={!!consumeModal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">{t('article.consume')}</h3>
            <div className="mb-4">
              <label className="label">{t('batch.consumeAmount')}</label>
              <input
                type="number"
                value={consumeAmount}
                onChange={(e) => setConsumeAmount(e.target.value)}
                min="0.01"
                max={consumeModal?.max}
                step="0.01"
                className="input"
                autoFocus
              />
              <p className="text-sm text-gray-500 mt-1">
                {t('batch.remaining', { amount: formatQuantity(consumeModal?.max || 0, article.defaultUnit) })}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConsumeModal(null)} className="btn btn-secondary flex-1">
                {t('common.cancel')}
              </button>
              <button onClick={handleConsume} className="btn btn-primary flex-1">
                {t('article.consume')}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Activity History (unified: purchases, consumption, corrections) */}
      <ActivityHistory
        article={article}
        onEditConsumption={(log) => setEditConsumptionModal({ log })}
        onEditPurchase={(batch) => setEditPurchaseModal({ batch })}
        t={t}
        dateFnsLocale={dateFnsLocale}
      />

      {/* Used in Recipes */}
      {(article as any).recipeIngredients?.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <UtensilsCrossed size={20} className="text-gray-500" />
            <h2 className="font-semibold">{t('article.usedInRecipes')}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(article as any).recipeIngredients.map((ing: any) => (
              <Link
                key={ing.id}
                to={`/recipes/${ing.recipe.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <span>{ing.recipe.name}</span>
                <span className="text-sm text-gray-500">
                  {formatQuantity(ing.quantity, ing.unit)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      <ModalPortal isOpen={addBatchModal}>
        <AddBatchModal
          article={article}
          onClose={() => setAddBatchModal(false)}
          onSuccess={() => {
            setAddBatchModal(false);
            loadData();
          }}
          t={t}
        />
      </ModalPortal>

      {/* Product Modal */}
      <ModalPortal isOpen={!!productModal}>
        <ProductModal
          article={article}
          product={productModal?.product}
          onClose={() => setProductModal(null)}
          onSuccess={() => {
            setProductModal(null);
            loadData();
          }}
          t={t}
        />
      </ModalPortal>

      {/* Edit Batch Modal (for stock correction from batch list) */}
      <ModalPortal isOpen={!!editBatchModal}>
        <EditBatchModal
          article={article}
          batch={editBatchModal?.batch}
          onClose={() => setEditBatchModal(null)}
          onSuccess={() => {
            setEditBatchModal(null);
            loadData();
          }}
          t={t}
        />
      </ModalPortal>

      {/* Edit Purchase Modal (for editing purchase transaction from activity history) */}
      <ModalPortal isOpen={!!editPurchaseModal}>
        <EditPurchaseModal
          article={article}
          batch={editPurchaseModal?.batch}
          onClose={() => setEditPurchaseModal(null)}
          onSuccess={() => {
            setEditPurchaseModal(null);
            loadData();
          }}
          t={t}
        />
      </ModalPortal>

      {/* Edit Consumption Modal */}
      <ModalPortal isOpen={!!editConsumptionModal}>
        <EditConsumptionModal
          article={article}
          log={editConsumptionModal?.log}
          onClose={() => setEditConsumptionModal(null)}
          onSuccess={() => {
            setEditConsumptionModal(null);
            loadData();
          }}
          t={t}
        />
      </ModalPortal>

      {/* Stock Correction Modal */}
      <ModalPortal isOpen={stockCorrectionModal}>
        <StockCorrectionModal
          article={article}
          onClose={() => setStockCorrectionModal(false)}
          onSuccess={() => {
            setStockCorrectionModal(false);
            loadData();
          }}
          t={t}
        />
      </ModalPortal>
    </div>
  );
}

function AddBatchModal({
  article,
  onClose,
  onSuccess,
  t,
}: {
  article: Article;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [quantity, setQuantity] = useState(article.packageSize.toString());
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiryDate, setExpiryDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await batches.create({
        articleId: article.id,
        quantity: parseFloat(quantity),
        purchaseDate: purchaseDate || undefined,
        expiryDate: expiryDate || undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-4">{t('batch.addPurchase')}</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">{t('batch.quantity')} ({article.defaultUnit})</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.01"
              step="0.01"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">{t('batch.purchaseDate')}</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">{t('batch.expiryDate')}</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('batch.noExpiryHint')}
            </p>
          </div>

          <div>
            <label className="label">{t('batch.price')}</label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              min="0"
              step="0.01"
              className="input"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label">{t('batch.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductModal({
  article,
  product,
  onClose,
  onSuccess,
  t,
}: {
  article: Article;
  product?: Product;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name || '');
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [brand, setBrand] = useState(product?.brand || '');
  const [packageSize, setPackageSize] = useState(product?.packageSize?.toString() || '');
  const [packageUnit, setPackageUnit] = useState(product?.packageUnit || '');
  const [notes, setNotes] = useState(product?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        name: name.trim(),
        barcode: barcode.trim() || null,
        brand: brand.trim() || null,
        packageSize: packageSize ? parseFloat(packageSize) : null,
        packageUnit: packageUnit.trim() || null,
        notes: notes.trim() || null,
      };

      if (isEdit && product) {
        await productsApi.update(product.id, data);
      } else {
        await productsApi.create({
          articleId: article.id,
          ...data,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {isEdit ? t('product.edit') : t('product.add')}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">{t('product.name')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder={t('product.namePlaceholder')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">{t('product.brand')}</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input"
              placeholder={t('product.brandPlaceholder')}
            />
          </div>

          <div>
            <label className="label">{t('product.barcode')}</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="input font-mono"
              placeholder="4001234567890"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t('article.packageSize')}</label>
              <input
                type="number"
                value={packageSize}
                onChange={(e) => setPackageSize(e.target.value)}
                min="0.01"
                step="0.01"
                className="input"
                placeholder={article.packageSize.toString()}
              />
            </div>
            <div>
              <label className="label">{t('article.unit')}</label>
              <input
                type="text"
                value={packageUnit}
                onChange={(e) => setPackageUnit(e.target.value)}
                className="input"
                placeholder={article.packageUnit}
              />
            </div>
          </div>

          <div>
            <label className="label">{t('batch.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// Edit Batch Modal - for editing current stock (quantity) only
// Purchase data (initialQuantity, price, dates) is edited via EditPurchaseModal
function EditBatchModal({
  article,
  batch,
  onClose,
  onSuccess,
  t,
}: {
  article: Article;
  batch?: Batch;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [quantity, setQuantity] = useState(batch?.quantity?.toString() || '');
  const [expiryDate, setExpiryDate] = useState(
    batch?.expiryDate ? format(new Date(batch.expiryDate), 'yyyy-MM-dd') : ''
  );
  const [notes, setNotes] = useState(batch?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    setLoading(true);
    setError(null);

    try {
      await batches.update(batch.id, {
        quantity: parseFloat(quantity),
        expiryDate: expiryDate || null,
        notes: notes || null,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-4">{t('batch.edit')}</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">{t('inventory.stock')} ({article.defaultUnit})</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              step="0.01"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">{t('batch.expiryDate')}</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('batch.noExpiryHint')}
            </p>
          </div>

          <div>
            <label className="label">{t('batch.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// Edit Purchase Modal - for editing purchase transaction data (initialQuantity, price, dates)
function EditPurchaseModal({
  article,
  batch,
  onClose,
  onSuccess,
  t,
}: {
  article: Article;
  batch?: Batch;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [initialQuantity, setInitialQuantity] = useState(batch?.initialQuantity?.toString() || '');
  const [purchaseDate, setPurchaseDate] = useState(
    batch?.purchaseDate ? format(new Date(batch.purchaseDate), 'yyyy-MM-dd') : ''
  );
  const [expiryDate, setExpiryDate] = useState(
    batch?.expiryDate ? format(new Date(batch.expiryDate), 'yyyy-MM-dd') : ''
  );
  const [purchasePrice, setPurchasePrice] = useState(
    batch?.purchasePrice !== null && batch?.purchasePrice !== undefined ? batch.purchasePrice.toString() : ''
  );
  const [notes, setNotes] = useState(batch?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate consumed amount
  const consumed = batch ? batch.initialQuantity - batch.quantity : 0;
  const hasBeenConsumed = consumed > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    setLoading(true);
    setError(null);

    try {
      await batches.updatePurchase(batch.id, {
        initialQuantity: parseFloat(initialQuantity),
        purchaseDate: purchaseDate || undefined,
        expiryDate: expiryDate || null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        notes: notes || null,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-4">{t('activity.purchase')} {t('common.edit').toLowerCase()}</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {hasBeenConsumed && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{t('batch.alreadyConsumed', { amount: formatQuantity(consumed, article.defaultUnit) })}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">{t('batch.quantity')} ({article.defaultUnit})</label>
            <input
              type="number"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
              min={hasBeenConsumed ? consumed : 0.01}
              step="0.01"
              className="input"
              required
            />
            {hasBeenConsumed && (
              <p className="text-xs text-gray-500 mt-1">
                {t('batch.minQuantityHint', { amount: formatQuantity(consumed, article.defaultUnit) })}
              </p>
            )}
          </div>

          <div>
            <label className="label">{t('batch.purchaseDate')}</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">{t('batch.expiryDate')}</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('batch.noExpiryHint')}
            </p>
          </div>

          <div>
            <label className="label">{t('batch.price')}</label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              min="0"
              step="0.01"
              className="input"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label">{t('batch.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditConsumptionModal({
  article,
  log,
  onClose,
  onSuccess,
  t,
}: {
  article: Article;
  log?: ConsumptionLog;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [quantity, setQuantity] = useState(log?.quantity?.toString() || '');
  const [consumedAt, setConsumedAt] = useState(
    log?.consumedAt ? format(new Date(log.consumedAt), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [notes, setNotes] = useState(log?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!log) return;
    setLoading(true);
    setError(null);

    try {
      await consumption.update(log.id, {
        quantity: parseFloat(quantity),
        consumedAt: new Date(consumedAt).toISOString(),
        notes: notes || null,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-4">{t('consumption.edit')}</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">{t('batch.quantity')} ({article.defaultUnit})</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.01"
              step="0.01"
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">{t('consumption.date')}</label>
            <input
              type="datetime-local"
              value={consumedAt}
              onChange={(e) => setConsumedAt(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">{t('batch.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// Activity History - unified view of all purchases, consumption, and corrections
function ActivityHistory({
  article,
  onEditConsumption,
  onEditPurchase,
  t,
  dateFnsLocale,
}: {
  article: Article & { consumptionLogs?: ConsumptionLog[]; allBatches?: Batch[] };
  onEditConsumption: (log: ConsumptionLog) => void;
  onEditPurchase: (batch: Batch) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dateFnsLocale: any;
}) {
  // Combine batches (purchases) and consumption logs into a single timeline
  type ActivityItem =
    | { type: 'purchase'; date: Date; data: Batch }
    | { type: 'consumption'; date: Date; data: ConsumptionLog };

  const activities: ActivityItem[] = [];

  // Add all batches (purchases) - using allBatches which includes depleted ones
  (article.allBatches || []).forEach((batch) => {
    activities.push({
      type: 'purchase',
      date: new Date(batch.purchaseDate),
      data: batch,
    });
  });

  // Add all consumption logs
  ((article as any).consumptionLogs || []).forEach((log: ConsumptionLog) => {
    activities.push({
      type: 'consumption',
      date: new Date(log.consumedAt),
      data: log,
    });
  });

  // Sort by date descending (newest first)
  activities.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <History size={20} className="text-gray-500" />
        <h2 className="font-semibold">{t('activity.history')}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {activities.slice(0, 30).map((activity) => {
          if (activity.type === 'purchase') {
            const batch = activity.data as Batch;
            return (
              <div key={`purchase-${batch.id}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ShoppingCart size={16} className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-green-600">
                      +{formatQuantity(batch.initialQuantity, article.defaultUnit)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(batch.purchaseDate), 'PP', { locale: dateFnsLocale })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="badge badge-success">{t('activity.purchase')}</span>
                    {batch.purchasePrice !== null && (
                      <div className="text-xs text-gray-500 mt-1">
                        {formatCurrency(batch.purchasePrice)}
                      </div>
                    )}
                    {batch.notes && (
                      <div className="text-xs text-gray-400 mt-1">{batch.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => onEditPurchase(batch)}
                    className="btn btn-outline text-sm py-1 px-2"
                  >
                    <Edit size={16} />
                  </button>
                </div>
              </div>
            );
          } else {
            const log = activity.data as ConsumptionLog;
            const isCorrection = log.source === 'CORRECTION';
            const isAddition = log.quantity < 0; // Negative quantity means addition in corrections

            return (
              <div key={`consumption-${log.id}`} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isCorrection ? 'bg-purple-100' : 'bg-red-100'
                  )}>
                    {isCorrection ? (
                      <RefreshCw size={16} className="text-purple-600" />
                    ) : (
                      <Minus size={16} className="text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className={cn(
                      'font-medium',
                      isCorrection && isAddition ? 'text-green-600' :
                      isCorrection ? 'text-purple-600' : 'text-red-600'
                    )}>
                      {isAddition ? '+' : '-'}{formatQuantity(Math.abs(log.quantity), article.defaultUnit)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(log.consumedAt), 'PP', { locale: dateFnsLocale })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={cn(
                      'badge',
                      log.source === 'MANUAL' && 'badge-info',
                      log.source === 'RECIPE' && 'badge-success',
                      log.source === 'EXPIRED' && 'badge-danger',
                      log.source === 'WASTE' && 'badge-warning',
                      log.source === 'CORRECTION' && 'badge-purple'
                    )}>
                      {t(`consumption.source.${log.source.toLowerCase()}`)}
                    </span>
                    {log.notes && (
                      <div className="text-xs text-gray-400 mt-1">{log.notes}</div>
                    )}
                  </div>
                  {!isCorrection && (
                    <button
                      onClick={() => onEditConsumption(log)}
                      className="btn btn-outline text-sm py-1 px-2"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

// Stock Correction Modal
function StockCorrectionModal({
  article,
  onClose,
  onSuccess,
  t,
}: {
  article: Article;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [actualStock, setActualStock] = useState((article.totalStock || 0).toString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStock = article.totalStock || 0;
  const newStock = parseFloat(actualStock) || 0;
  const difference = newStock - currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await articles.correctStock(article.id, newStock, notes || undefined);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to correct stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold mb-4">{t('stock.correctTitle')}</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500">{t('stock.currentStock')}</div>
            <div className="text-lg font-semibold">
              {formatQuantity(currentStock, article.defaultUnit)}
            </div>
          </div>

          <div>
            <label className="label">{t('stock.actualStock')} ({article.defaultUnit})</label>
            <input
              type="number"
              value={actualStock}
              onChange={(e) => setActualStock(e.target.value)}
              min="0"
              step="0.01"
              className="input"
              required
              autoFocus
            />
          </div>

          {difference !== 0 && (
            <div className={cn(
              'p-3 rounded-lg flex items-center gap-2',
              difference > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}>
              {difference > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              <div>
                <div className="text-sm font-medium">{t('stock.difference')}</div>
                <div className="font-semibold">
                  {difference > 0 ? '+' : ''}{formatQuantity(difference, article.defaultUnit)}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">{t('stock.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder={t('stock.notesPlaceholder')}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || difference === 0}
            className="btn btn-primary flex-1"
          >
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
