import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Lock, AlertTriangle, Check, Sun, Moon, Monitor, MapPin, Ruler, Plus, Trash2, Edit2, ArrowRight } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { auth, locations, StorageLocation, units as unitsApi, Unit } from '../lib/api';
import ModalPortal from '../components/ModalPortal';

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Locations state
  const [locationList, setLocationList] = useState<StorageLocation[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationIcon, setLocationIcon] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // Units state
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitSymbol, setUnitSymbol] = useState('');
  const [unitDisplayName, setUnitDisplayName] = useState('');
  const [unitConversionGroup, setUnitConversionGroup] = useState<string>('');
  const [unitConversionFactor, setUnitConversionFactor] = useState<string>('1');
  const [unitConvertsToId, setUnitConvertsToId] = useState<string>('');
  const [unitConvertsToAmount, setUnitConvertsToAmount] = useState<string>('');
  const [unitError, setUnitError] = useState<string | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);

  useEffect(() => {
    loadLocations();
    loadUnits();
  }, []);

  const loadLocations = async () => {
    try {
      const data = await locations.list();
      setLocationList(data);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadUnits = async () => {
    try {
      const data = await unitsApi.list();
      setUnitList(data);
    } catch (err) {
      console.error('Failed to load units:', err);
    }
  };

  const handleLanguageChange = (newLocale: 'en' | 'de') => {
    setLocale(newLocale);
  };

  const openLocationModal = (location?: StorageLocation) => {
    if (location) {
      setEditingLocation(location);
      setLocationName(location.name);
      setLocationIcon(location.icon || '');
    } else {
      setEditingLocation(null);
      setLocationName('');
      setLocationIcon('');
    }
    setLocationError(null);
    setShowLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!locationName.trim()) return;

    setSavingLocation(true);
    setLocationError(null);

    try {
      if (editingLocation) {
        await locations.update(editingLocation.id, {
          name: locationName.trim(),
          icon: locationIcon.trim() || null,
        });
      } else {
        await locations.create({
          name: locationName.trim(),
          icon: locationIcon.trim() || undefined,
        });
      }
      setShowLocationModal(false);
      loadLocations();
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (location: StorageLocation) => {
    if (!confirm(t('location.deleteConfirm'))) return;

    try {
      await locations.delete(location.id);
      loadLocations();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('location.deleteHasArticles'));
    }
  };

  const openUnitModal = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitSymbol(unit.symbol);
      setUnitDisplayName(unit.name);
      setUnitConversionGroup(unit.conversionGroup || '');
      setUnitConversionFactor(unit.conversionFactor.toString());
      setUnitConvertsToId(unit.convertsToUnitId || '');
      setUnitConvertsToAmount(unit.convertsToAmount?.toString() || '');
    } else {
      setEditingUnit(null);
      setUnitSymbol('');
      setUnitDisplayName('');
      setUnitConversionGroup('');
      setUnitConversionFactor('1');
      setUnitConvertsToId('');
      setUnitConvertsToAmount('');
    }
    setUnitError(null);
    setShowUnitModal(true);
  };

  const handleSaveUnit = async () => {
    if (!unitSymbol.trim() || !unitDisplayName.trim()) return;

    setSavingUnit(true);
    setUnitError(null);

    try {
      const data = {
        symbol: unitSymbol.trim(),
        name: unitDisplayName.trim(),
        conversionGroup: unitConversionGroup.trim() || null,
        conversionFactor: parseFloat(unitConversionFactor) || 1,
        convertsToUnitId: unitConvertsToId || null,
        convertsToAmount: unitConvertsToAmount ? parseFloat(unitConvertsToAmount) : null,
      };

      if (editingUnit) {
        await unitsApi.update(editingUnit.id, data);
      } else {
        await unitsApi.create(data);
      }
      setShowUnitModal(false);
      loadUnits();
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'Failed to save unit');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!confirm(t('settings.deleteUnitConfirm'))) return;

    try {
      await unitsApi.delete(unit.id);
      loadUnits();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.passwordMismatch'));
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Group units for display
  const conversionGroups = ['mass', 'volume'];
  const getConversionGroupLabel = (group: string) => {
    const labels: Record<string, string> = {
      mass: locale === 'de' ? 'Masse (g, kg)' : 'Mass (g, kg)',
      volume: locale === 'de' ? 'Volumen (ml, l)' : 'Volume (ml, l)',
    };
    return labels[group] || group;
  };

  // Helper to format conversion info
  const getConversionInfo = (unit: Unit): string | null => {
    if (unit.conversionGroup && unit.conversionFactor !== 1) {
      const baseUnit = unitList.find(u => u.conversionGroup === unit.conversionGroup && u.conversionFactor === 1);
      if (baseUnit) {
        return `1 ${unit.symbol} = ${unit.conversionFactor} ${baseUnit.symbol}`;
      }
    }
    if (unit.convertsToUnit && unit.convertsToAmount) {
      return `1 ${unit.symbol} = ${unit.convertsToAmount} ${unit.convertsToUnit.symbol}`;
    }
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>

      {/* Language */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Globe size={20} className="text-primary-600" />
          </div>
          <div>
            <h2 className="font-medium">{t('settings.language')}</h2>
            <p className="text-sm text-gray-500">{t('settings.languageHelp')}</p>
          </div>
        </div>

        <select
          value={locale}
          onChange={(e) => handleLanguageChange(e.target.value as 'en' | 'de')}
          className="input w-full"
        >
          <option value="en">{t('settings.english')}</option>
          <option value="de">{t('settings.german')}</option>
        </select>
      </div>

      {/* Theme */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <Sun size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.theme')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.themeHelp')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <Sun size={24} className="text-yellow-500" />
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{t('settings.themeLight')}</div>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
              theme === 'dark'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <Moon size={24} className="text-blue-500" />
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{t('settings.themeDark')}</div>
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2 ${
              theme === 'system'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <Monitor size={24} className="text-gray-500" />
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{t('settings.themeSystem')}</div>
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Lock size={20} className="text-yellow-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium">{t('settings.password')}</h2>
            <p className="text-sm text-gray-500">{t('auth.changePassword')}</p>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="btn btn-outline"
            >
              {t('auth.changePassword')}
            </button>
          )}
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {passwordError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} />
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                <Check size={16} />
                {t('auth.passwordChanged')}
              </div>
            )}

            <div>
              <label className="label">{t('auth.currentPassword')}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">{t('auth.newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                minLength={4}
                required
              />
            </div>

            <div>
              <label className="label">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                minLength={4}
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordError(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
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
        )}
      </div>

      {/* Storage Locations */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <MapPin size={20} className="text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium">{t('settings.locations')}</h2>
            <p className="text-sm text-gray-500">{t('settings.locationsHelp')}</p>
          </div>
          <button
            onClick={() => openLocationModal()}
            className="btn btn-outline p-2"
          >
            <Plus size={20} />
          </button>
        </div>

        {locationList.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">{t('location.empty')}</p>
        ) : (
          <div className="space-y-2">
            {locationList.map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <span className="text-lg">{loc.icon || '📦'}</span>
                <span className="flex-1 font-medium">{loc.name}</span>
                <span className="text-sm text-gray-500">
                  {loc.articleCount || 0} {t('dashboard.stats.articles')}
                </span>
                <button
                  onClick={() => openLocationModal(loc)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteLocation(loc)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  disabled={(loc.articleCount || 0) > 0}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Units */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Ruler size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium">{t('settings.units')}</h2>
            <p className="text-sm text-gray-500">{t('settings.unitsHelp')}</p>
          </div>
          <button
            onClick={() => openUnitModal()}
            className="btn btn-outline p-2"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-2">
          {unitList.map((unit) => {
            const conversionInfo = getConversionInfo(unit);
            return (
              <div
                key={unit.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  unit.isDefault ? 'bg-gray-50' : 'bg-primary-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{unit.symbol}</span>
                    <span className="text-gray-500">-</span>
                    <span className="text-gray-700">{unit.name}</span>
                  </div>
                  {conversionInfo && (
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <ArrowRight size={12} />
                      {conversionInfo}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openUnitModal(unit)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteUnit(unit)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Logout */}
      <div className="card p-4">
        <button
          onClick={handleLogout}
          className="btn btn-danger w-full"
        >
          {t('auth.logout')}
        </button>
      </div>

      {/* Location Modal */}
      <ModalPortal isOpen={showLocationModal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingLocation ? t('location.edit') : t('location.add')}
            </h3>

            {locationError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} />
                {locationError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">{t('location.name')}</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="input w-full"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">{t('location.icon')}</label>
                <input
                  type="text"
                  value={locationIcon}
                  onChange={(e) => setLocationIcon(e.target.value)}
                  className="input w-full"
                  placeholder="🏠 🧊 🗄️"
                  maxLength={4}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="btn btn-secondary flex-1"
                  disabled={savingLocation}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveLocation}
                  disabled={!locationName.trim() || savingLocation}
                  className="btn btn-primary flex-1"
                >
                  {savingLocation ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Unit Modal */}
      <ModalPortal isOpen={showUnitModal}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingUnit ? t('settings.editUnit') : t('settings.addUnit')}
            </h3>

            {unitError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} />
                {unitError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('settings.unitSymbol')}</label>
                  <input
                    type="text"
                    value={unitSymbol}
                    onChange={(e) => setUnitSymbol(e.target.value)}
                    className="input w-full"
                    placeholder="kg, ml, Stk"
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">{t('settings.unitName')}</label>
                  <input
                    type="text"
                    value={unitDisplayName}
                    onChange={(e) => setUnitDisplayName(e.target.value)}
                    className="input w-full"
                    placeholder="Kilogramm"
                    maxLength={50}
                  />
                </div>
              </div>

              {/* Conversion Group */}
              <div>
                <label className="label">{t('settings.conversionGroup')}</label>
                <select
                  value={unitConversionGroup}
                  onChange={(e) => setUnitConversionGroup(e.target.value)}
                  className="input w-full"
                >
                  <option value="">{t('settings.noConversion')}</option>
                  {conversionGroups.map((group) => (
                    <option key={group} value={group}>
                      {getConversionGroupLabel(group)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('settings.conversionGroupHelp')}</p>
              </div>

              {/* Conversion Factor (only show if conversion group is selected) */}
              {unitConversionGroup && (
                <div>
                  <label className="label">{t('settings.conversionFactor')}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">1 {unitSymbol || '?'} =</span>
                    <input
                      type="number"
                      value={unitConversionFactor}
                      onChange={(e) => setUnitConversionFactor(e.target.value)}
                      className="input w-24"
                      min="0.001"
                      step="any"
                    />
                    <span className="text-gray-600">
                      {unitConversionGroup === 'mass' ? 'g' : unitConversionGroup === 'volume' ? 'ml' : t('settings.baseUnit')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('settings.conversionFactorHelp')}</p>
                </div>
              )}

              {/* Custom Conversion (for units without standard group) */}
              {!unitConversionGroup && (
                <div className="border-t pt-4 mt-4">
                  <label className="label">{t('settings.customConversion')}</label>
                  <p className="text-xs text-gray-500 mb-3">{t('settings.customConversionHelp')}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-600">1 {unitSymbol || '?'} =</span>
                    <input
                      type="number"
                      value={unitConvertsToAmount}
                      onChange={(e) => setUnitConvertsToAmount(e.target.value)}
                      className="input w-20"
                      min="0.001"
                      step="any"
                      placeholder="50"
                    />
                    <select
                      value={unitConvertsToId}
                      onChange={(e) => setUnitConvertsToId(e.target.value)}
                      className="input flex-1"
                    >
                      <option value="">{t('settings.selectUnit')}</option>
                      {unitList
                        .filter((u) => u.id !== editingUnit?.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.symbol} ({u.name})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUnitModal(false)}
                  className="btn btn-secondary flex-1"
                  disabled={savingUnit}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveUnit}
                  disabled={!unitSymbol.trim() || !unitDisplayName.trim() || savingUnit}
                  className="btn btn-primary flex-1"
                >
                  {savingUnit ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  );
}
