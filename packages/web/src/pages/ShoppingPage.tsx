import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import {
  shoppingLists as shoppingApi,
  articles as articlesApi,
  settings as settingsApi,
  ShoppingList,
  ShoppingListItem,
  Article,
  AppSettings
} from '../lib/api';
import { useAsync } from '../lib/hooks';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Calendar,
  Package,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Edit,
  HelpCircle,
  Save
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { de, enUS, Locale } from 'date-fns/locale';
import ModalPortal from '../components/ModalPortal';

export default function ShoppingPage() {
  const { t, locale } = useTranslation();
  const dateLocale = locale === 'de' ? de : enUS;

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Default: shop date = today, plan until = today + 7 days
  const today = new Date();
  const [shopDate, setShopDate] = useState(format(today, 'yyyy-MM-dd'));
  const [planUntil, setPlanUntil] = useState(format(addDays(today, 7), 'yyyy-MM-dd'));
  const [expandPurchased, setExpandPurchased] = useState(false);

  // Add item form
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemArticleId, setAddItemArticleId] = useState<string | null>(null);
  const [addItemCustomName, setAddItemCustomName] = useState('');
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [addItemUnit, setAddItemUnit] = useState('pcs');
  const [addingItem, setAddingItem] = useState(false);

  const { data: activeList, loading, execute: loadActiveList } = useAsync<ShoppingList>();
  const { data: allArticles, execute: loadArticles } = useAsync<Article[]>();
  const { data: appSettings, execute: loadSettings } = useAsync<AppSettings>();

  useEffect(() => {
    loadActiveList(() => shoppingApi.getActive().catch(() => null));
    loadArticles(() => articlesApi.list());
    loadSettings(() => settingsApi.get());
  }, []);


  const filteredArticles = useMemo(() => {
    if (!allArticles || !addItemSearch) return [];
    return allArticles
      .filter(a => a.name.toLowerCase().includes(addItemSearch.toLowerCase()))
      .slice(0, 8);
  }, [allArticles, addItemSearch]);

  const { unpurchased, purchased } = useMemo(() => {
    if (!activeList?.items) return { unpurchased: [], purchased: [] };
    return {
      unpurchased: activeList.items.filter(i => !i.purchased),
      purchased: activeList.items.filter(i => i.purchased),
    };
  }, [activeList]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await shoppingApi.generate({
        shopDate: new Date(shopDate).toISOString(),
        planUntil: new Date(planUntil).toISOString(),
      });
      setShowGenerateModal(false);
      loadActiveList(() => shoppingApi.getActive());
    } catch (err) {
      console.error('Failed to generate shopping list:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleTogglePurchased = async (item: ShoppingListItem) => {
    if (!activeList) return;
    try {
      await shoppingApi.updateItem(activeList.id, item.id, {
        purchased: !item.purchased,
      });
      loadActiveList(() => shoppingApi.getActive());
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeList) return;
    try {
      await shoppingApi.deleteItem(activeList.id, itemId);
      loadActiveList(() => shoppingApi.getActive());
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!activeList) return;
    try {
      await shoppingApi.updateItem(activeList.id, itemId, {
        neededQuantity: newQuantity,
      });
      loadActiveList(() => shoppingApi.getActive());
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const handleUpdatePurchaseDetails = async (
    itemId: string,
    details: { purchasedQuantity?: number; actualPrice?: number; purchaseDate?: string | null; expiryDate?: string | null }
  ) => {
    if (!activeList) return;
    try {
      await shoppingApi.updateItem(activeList.id, itemId, details);
      loadActiveList(() => shoppingApi.getActive());
    } catch (err) {
      console.error('Failed to update purchase details:', err);
    }
  };

  const handleAddItem = async () => {
    if (!activeList) return;
    if (!addItemArticleId && !addItemCustomName.trim()) return;

    setAddingItem(true);
    try {
      await shoppingApi.addItem(activeList.id, {
        articleId: addItemArticleId || undefined,
        customName: addItemCustomName || undefined,
        quantity: addItemQuantity,
        unit: addItemUnit,
        reason: 'MANUAL',
      });
      setShowAddItemModal(false);
      setAddItemSearch('');
      setAddItemArticleId(null);
      setAddItemCustomName('');
      setAddItemQuantity(1);
      loadActiveList(() => shoppingApi.getActive());
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setAddingItem(false);
    }
  };

  const handleComplete = async () => {
    if (!activeList || !confirm(t('shopping.completeShop') + '?')) return;

    setCompleting(true);
    try {
      await shoppingApi.complete(activeList.id);
      loadActiveList(() => shoppingApi.getActive().catch(() => null));
    } catch (err) {
      console.error('Failed to complete shopping:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleDeleteList = async () => {
    if (!activeList || !confirm('Delete this shopping list?')) return;

    try {
      await shoppingApi.delete(activeList.id);
      loadActiveList(() => shoppingApi.getActive().catch(() => null));
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      RECIPE: t('shopping.itemReason.recipe'),
      LOW_STOCK: t('shopping.itemReason.lowStock'),
      FORECAST: t('shopping.itemReason.forecast'),
      MANUAL: t('shopping.itemReason.manual'),
    };
    return labels[reason] || reason;
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'RECIPE':
        return <Calendar size={12} className="text-blue-500" />;
      case 'LOW_STOCK':
        return <AlertTriangle size={12} className="text-orange-500" />;
      case 'MANUAL':
        return <Plus size={12} className="text-gray-500" />;
      default:
        return <Package size={12} className="text-gray-500" />;
    }
  };

  if (loading && !activeList) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // No active list - show generate prompt
  if (!activeList) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('shopping.title')}</h1>

        <div className="card p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <ShoppingCart size={40} className="text-primary-600" />
          </div>
          <p className="text-gray-500 mb-4">{t('shopping.empty')}</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw size={18} />
            {t('shopping.generateList')}
          </button>
        </div>

        {/* Generate Modal */}
        <ModalPortal isOpen={showGenerateModal}>
          <GenerateModal
            shopDate={shopDate}
            planUntil={planUntil}
            onShopDateChange={setShopDate}
            onPlanUntilChange={setPlanUntil}
            onGenerate={handleGenerate}
            onClose={() => setShowGenerateModal(false)}
            generating={generating}
            t={t}
          />
        </ModalPortal>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('shopping.title')}</h1>
          <p className="text-sm text-gray-500">
            {format(new Date(activeList.shopDate), 'd. MMM', { locale: dateLocale })} - {format(new Date(activeList.planUntil), 'd. MMM', { locale: dateLocale })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddItemModal(true)}
            className="btn-secondary p-2"
            title={t('shopping.addItem')}
          >
            <Plus size={20} />
          </button>
          <button
            onClick={handleDeleteList}
            className="btn-secondary p-2 text-red-600 hover:bg-red-50"
            title={t('common.delete')}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            {t('shopping.purchased')}: {purchased.length} / {(activeList.totalItems || 0)}
          </span>
          {appSettings && activeList.estimatedTotal !== undefined && activeList.estimatedTotal > 0 && (
            <span className="text-sm font-medium text-gray-700">
              {t('shopping.estimatedTotal', { amount: `${appSettings.currency} ${activeList.estimatedTotal.toFixed(2)}` })}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full transition-all"
            style={{ width: `${(activeList.totalItems || 0) > 0 ? (purchased.length / (activeList.totalItems || 1)) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Unpurchased Items */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">{t('shopping.remaining')}</h2>
        </div>
        {unpurchased.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            All items purchased!
          </div>
        ) : (
          <div className="divide-y">
            {unpurchased.map((item) => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                onToggle={() => handleTogglePurchased(item)}
                onDelete={() => handleDeleteItem(item.id)}
                onUpdateQuantity={(qty) => handleUpdateQuantity(item.id, qty)}
                onUpdatePurchaseDetails={(details) => handleUpdatePurchaseDetails(item.id, details)}
                getReasonIcon={getReasonIcon}
                getReasonLabel={getReasonLabel}
                currency={appSettings?.currency || '€'}
                t={t}
                dateLocale={dateLocale}
              />
            ))}
          </div>
        )}
      </div>

      {/* Purchased Items (collapsible) */}
      {purchased.length > 0 && (
        <div className="card">
          <button
            onClick={() => setExpandPurchased(!expandPurchased)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Check size={18} className="text-green-600" />
              {t('shopping.purchased')} ({purchased.length})
            </h2>
            {expandPurchased ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {expandPurchased && (
            <div className="divide-y border-t">
              {purchased.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => handleTogglePurchased(item)}
                  onDelete={() => handleDeleteItem(item.id)}
                  onUpdateQuantity={(qty) => handleUpdateQuantity(item.id, qty)}
                  onUpdatePurchaseDetails={(details) => handleUpdatePurchaseDetails(item.id, details)}
                  getReasonIcon={getReasonIcon}
                  getReasonLabel={getReasonLabel}
                  currency={appSettings?.currency || '€'}
                  t={t}
                  dateLocale={dateLocale}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complete Button */}
      {purchased.length > 0 && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {completing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <Check size={20} />
              {t('shopping.completeShop')}
            </>
          )}
        </button>
      )}

      {/* Add Item Modal */}
      <ModalPortal isOpen={showAddItemModal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('shopping.addItem')}</h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Search Article */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={addItemSearch}
                  onChange={(e) => {
                    setAddItemSearch(e.target.value);
                    setAddItemArticleId(null);
                  }}
                  placeholder="Search article or type custom name..."
                  className="input w-full pl-10"
                />
              </div>

              {/* Article suggestions */}
              {filteredArticles.length > 0 && !addItemArticleId && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {filteredArticles.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => {
                        setAddItemArticleId(article.id);
                        setAddItemSearch(article.name);
                        setAddItemUnit(article.defaultUnit);
                      }}
                      className="w-full p-2 text-left hover:bg-gray-50 text-sm flex justify-between"
                    >
                      <span>{article.name}</span>
                      <span className="text-gray-400">{article.defaultUnit}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom name if no article */}
              {!addItemArticleId && addItemSearch && filteredArticles.length === 0 && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Add as custom item:
                  </label>
                  <input
                    type="text"
                    value={addItemCustomName || addItemSearch}
                    onChange={(e) => setAddItemCustomName(e.target.value)}
                    className="input w-full"
                  />
                </div>
              )}

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(parseFloat(e.target.value) || 1)}
                    min={0.1}
                    step={0.1}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={addItemUnit}
                    onChange={(e) => setAddItemUnit(e.target.value)}
                    className="input w-full"
                  >
                    <option value="pcs">pcs</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">L</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="btn-secondary flex-1"
                  disabled={addingItem}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={(!addItemArticleId && !addItemCustomName && !addItemSearch) || addingItem}
                  className="btn-primary flex-1"
                >
                  {addingItem ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto" />
                  ) : (
                    t('common.add')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  );
}

// Shopping item row component
function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
  onUpdateQuantity,
  onUpdatePurchaseDetails,
  getReasonIcon,
  getReasonLabel,
  currency,
  t,
  dateLocale,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onUpdatePurchaseDetails: (details: { purchasedQuantity?: number; actualPrice?: number; purchaseDate?: string | null; expiryDate?: string | null }) => void;
  getReasonIcon: (reason: string) => React.ReactNode;
  getReasonLabel: (reason: string) => string;
  currency: string;
  t: (key: string) => string;
  dateLocale: Locale;
}) {
  const [editing, setEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(item.quantity.toString());

  // Purchase details state
  const [purchasedQty, setPurchasedQty] = useState(
    (item.purchasedQuantity ?? item.quantity).toString()
  );
  const [actualPrice, setActualPrice] = useState(
    item.actualPrice?.toString() || item.estimatedPrice?.toString() || ''
  );
  const [purchaseDate, setPurchaseDate] = useState(
    item.purchaseDate ? format(new Date(item.purchaseDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [expiryDate, setExpiryDate] = useState(
    item.expiryDate ? format(new Date(item.expiryDate), 'yyyy-MM-dd') : ''
  );
  const [detailsChanged, setDetailsChanged] = useState(false);

  const handleSaveQuantity = () => {
    const newQuantity = parseFloat(editQuantity);
    if (!isNaN(newQuantity) && newQuantity > 0) {
      onUpdateQuantity(newQuantity);
    }
    setEditing(false);
  };

  const handleSavePurchaseDetails = () => {
    const details: { purchasedQuantity?: number; actualPrice?: number; purchaseDate?: string | null; expiryDate?: string | null } = {};

    const qty = parseFloat(purchasedQty);
    if (!isNaN(qty) && qty > 0) {
      details.purchasedQuantity = qty;
    }

    const price = parseFloat(actualPrice);
    if (!isNaN(price) && price >= 0) {
      details.actualPrice = price;
    }

    if (purchaseDate) {
      details.purchaseDate = new Date(purchaseDate).toISOString();
    } else {
      details.purchaseDate = null;
    }

    if (expiryDate) {
      details.expiryDate = new Date(expiryDate).toISOString();
    } else {
      details.expiryDate = null;
    }

    onUpdatePurchaseDetails(details);
    setDetailsChanged(false);
  };

  const handleDetailChange = () => {
    setDetailsChanged(true);
  };

  return (
    <div className={`p-4 ${item.purchased ? 'bg-green-50' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            item.purchased
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-primary-500'
          }`}
        >
          {item.purchased && <Check size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`font-medium ${item.purchased ? 'text-green-800' : 'text-gray-900'}`}>
            {item.article?.name || item.customName}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  onBlur={handleSaveQuantity}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveQuantity()}
                  className="w-16 px-1 py-0.5 border rounded text-xs"
                  min="0.01"
                  step="0.01"
                  autoFocus
                />
                <span>{item.unit}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditQuantity(item.quantity.toString());
                  setEditing(true);
                }}
                className="flex items-center gap-1 hover:text-primary-600"
              >
                {/* Show recommended packs if available, otherwise show raw quantity */}
                {item.recommendedPacks && item.recommendedPacks > 0 && item.article?.packageSize ? (
                  <span className="flex flex-col sm:flex-row sm:items-center sm:gap-1">
                    <span className="flex items-center gap-1">
                      {item.recommendedPacks}× {item.article.packageSize} {item.article.packageUnit || item.unit}
                      {!item.purchased && <Edit size={10} className="sm:hidden" />}
                    </span>
                    <span className="text-gray-400">({item.quantity} {item.unit})</span>
                  </span>
                ) : (
                  <span>{item.quantity} {item.unit}</span>
                )}
                {!item.purchased && <Edit size={10} className="hidden sm:inline" />}
              </button>
            )}
            <span className="flex items-center gap-1">
              {getReasonIcon(item.reason)}
              {getReasonLabel(item.reason)}
            </span>
          </div>
        </div>

        {/* Price display */}
        <div className="text-right text-sm mr-2">
          {item.actualPrice !== null && item.actualPrice !== undefined ? (
            <span className="text-green-700 font-medium">
              {currency} {item.actualPrice.toFixed(2)}
            </span>
          ) : item.estimatedPrice !== null && item.estimatedPrice !== undefined ? (
            <span className="text-gray-600">
              {currency} {item.estimatedPrice.toFixed(2)}
            </span>
          ) : (
            <span className="text-gray-400 flex items-center gap-1" title="No price data available">
              <HelpCircle size={12} />
              ?
            </span>
          )}
        </div>

        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Purchase details form - shown when item is purchased */}
      {item.purchased && (
        <div className="mt-3 ml-9 p-3 bg-white rounded-lg border border-green-200">
          <div className="grid grid-cols-2 gap-3">
            {/* Purchased quantity */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t('batch.quantity')}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={purchasedQty}
                  onChange={(e) => {
                    setPurchasedQty(e.target.value);
                    handleDetailChange();
                  }}
                  className="input w-full text-sm py-1"
                  min="0.01"
                  step="0.01"
                />
                <span className="text-xs text-gray-500">{item.unit}</span>
              </div>
            </div>

            {/* Actual price */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t('batch.price')}
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">{currency}</span>
                <input
                  type="number"
                  value={actualPrice}
                  onChange={(e) => {
                    setActualPrice(e.target.value);
                    handleDetailChange();
                  }}
                  className="input w-full text-sm py-1"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Purchase date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t('batch.purchaseDate')}
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => {
                  setPurchaseDate(e.target.value);
                  handleDetailChange();
                }}
                className="input w-full text-sm py-1"
              />
            </div>

            {/* Expiry date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t('batch.expiryDate')}
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  handleDetailChange();
                }}
                className="input w-full text-sm py-1"
              />
            </div>
          </div>

          {/* Save button - only shown when there are changes */}
          {detailsChanged && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSavePurchaseDetails}
                className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
              >
                <Save size={12} />
                {t('common.save')}
              </button>
            </div>
          )}

          {/* Show saved values summary */}
          {!detailsChanged && (item.purchasedQuantity || item.actualPrice || item.purchaseDate || item.expiryDate) && (
            <div className="mt-2 text-xs text-green-700">
              {item.purchasedQuantity && item.purchasedQuantity !== item.quantity && (
                <span className="mr-3">✓ {item.purchasedQuantity} {item.unit}</span>
              )}
              {item.actualPrice !== null && item.actualPrice !== undefined && (
                <span className="mr-3">✓ {currency} {item.actualPrice.toFixed(2)}</span>
              )}
              {item.purchaseDate && (
                <span className="mr-3">✓ {format(new Date(item.purchaseDate), 'PP', { locale: dateLocale })}</span>
              )}
              {item.expiryDate && (
                <span>✓ MHD: {format(new Date(item.expiryDate), 'PP', { locale: dateLocale })}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Generate modal component
function GenerateModal({
  shopDate,
  planUntil,
  onShopDateChange,
  onPlanUntilChange,
  onGenerate,
  onClose,
  generating,
  t,
}: {
  shopDate: string;
  planUntil: string;
  onShopDateChange: (date: string) => void;
  onPlanUntilChange: (date: string) => void;
  onGenerate: () => void;
  onClose: () => void;
  generating: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{t('shopping.generateList')}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('shopping.shopDate')}
            </label>
            <input
              type="date"
              value={shopDate}
              onChange={(e) => onShopDateChange(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('shopping.planUntil')}
            </label>
            <input
              type="date"
              value={planUntil}
              onChange={(e) => onPlanUntilChange(e.target.value)}
              className="input w-full"
            />
          </div>

          <p className="text-sm text-gray-500">
            {t('shopping.generateDescription')}
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={generating}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onGenerate}
              disabled={generating}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {generating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <RefreshCw size={18} />
                  {t('shopping.generateList')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
