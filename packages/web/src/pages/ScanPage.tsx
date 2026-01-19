import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, AlertTriangle, Keyboard } from 'lucide-react';
import { useTranslation } from '../i18n';
import { articles } from '../lib/api';
import BarcodeScanner from '../components/BarcodeScanner';

export default function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const handleScan = async (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    await searchBarcode(scannedBarcode);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    await searchBarcode(barcode.trim());
  };

  const searchBarcode = async (code: string) => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const article = await articles.getByBarcode(code);
      navigate(`/inventory/article/${article.id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = () => {
    navigate(`/inventory/article/new?barcode=${encodeURIComponent(barcode)}`);
  };

  const handleScanError = (errorMessage: string) => {
    setError(errorMessage);
    setShowManualEntry(true);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('nav.scan')}</h1>

      {/* Camera scanner */}
      {!showManualEntry && !notFound && (
        <BarcodeScanner onScan={handleScan} onError={handleScanError} />
      )}

      {/* Toggle manual entry */}
      <button
        onClick={() => setShowManualEntry(!showManualEntry)}
        className="w-full text-sm text-primary-600 hover:text-primary-700 flex items-center justify-center gap-2"
      >
        <Keyboard size={16} />
        {showManualEntry ? 'Use camera scanner' : 'Enter barcode manually'}
      </button>

      {/* Manual entry */}
      {showManualEntry && (
        <form onSubmit={handleSearch} className="card p-4 space-y-4">
          <div>
            <label className="label">{t('article.barcode')}</label>
            <div className="relative">
              <input
                type="text"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setNotFound(false);
                  setError(null);
                }}
                className="input pr-10 font-mono"
                placeholder="4001234567890"
                autoFocus
              />
              <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !barcode.trim()}
            className="btn btn-primary w-full"
          >
            {loading ? t('common.loading') : t('common.search')}
          </button>
        </form>
      )}

      {/* Loading state after scan */}
      {loading && !showManualEntry && (
        <div className="card p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Looking up barcode...</p>
          <code className="font-mono bg-gray-100 px-2 py-1 rounded mt-2 inline-block">{barcode}</code>
        </div>
      )}

      {/* Not found state */}
      {notFound && (
        <div className="card p-6 text-center">
          <Package size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 mb-4">
            No article found with barcode <code className="font-mono bg-gray-100 px-2 py-1 rounded">{barcode}</code>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setNotFound(false);
                setBarcode('');
              }}
              className="btn btn-secondary flex-1"
            >
              Scan again
            </button>
            <button onClick={handleCreateArticle} className="btn btn-primary flex-1">
              {t('inventory.addArticle')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
