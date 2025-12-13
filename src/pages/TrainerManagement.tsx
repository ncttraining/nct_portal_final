import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, UserCheck, UserX, MapPin, Mail, Phone, CheckCircle, XCircle, AlertCircle, Copy, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  supabase,
  type Trainer,
  type TrainerAttribute,
  type AttributeOption,
  loadAttributesForType,
  loadOptionsForAttribute,
  loadAttributeValues,
  saveAttributeValues
} from '../lib/supabase';
import { sendTemplateEmail } from '../lib/email';
import {
  getTrainerTypes,
  assignTrainerType,
  removeTrainerType,
  checkFutureBookingsForTrainerType,
  getTrainerTypesForMultipleTrainers,
  type TrainerType as LibTrainerType
} from '../lib/trainer-types';

interface TrainerType {
  id: string;
  name: string;
  description: string;
}

interface ExtendedTrainer extends Trainer {
  user_id: string | null;
  active: boolean;
  suspended: boolean;
  can_login?: boolean;
  trainer_type_name?: string;
  assigned_types?: LibTrainerType[];
}

interface TrainerManagementProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function TrainerManagement({ currentPage, onNavigate }: TrainerManagementProps) {
  const [trainers, setTrainers] = useState<ExtendedTrainer[]>([]);
  const [trainerTypes, setTrainerTypes] = useState<TrainerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<ExtendedTrainer | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; email: string; password: string; user_id?: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadTrainers(), loadTrainerTypes()]);
    setLoading(false);
  }

  async function loadTrainers() {
    const { data, error } = await supabase
      .from('trainers')
      .select(`
        *,
        user:users!user_id (
          can_login
        ),
        trainer_type:trainer_types!trainer_type_id (
          name
        )
      `)
      .order('name');

    if (error) {
      console.error('Error loading trainers:', error);
      return;
    }

    const trainerIds = (data || []).map(t => t.id);
    const trainerTypesMap = await getTrainerTypesForMultipleTrainers(trainerIds);

    const trainersWithDetails = (data || []).map((t: any) => ({
      ...t,
      can_login: t.user?.can_login || false,
      trainer_type_name: t.trainer_type?.name || 'Unassigned',
      assigned_types: trainerTypesMap[t.id] || []
    }));

    setTrainers(trainersWithDetails);
  }

  async function loadTrainerTypes() {
    const { data, error } = await supabase
      .from('trainer_types')
      .select('*')
      .order('sort_order, name');

    if (error) {
      console.error('Error loading trainer types:', error);
      return;
    }

    setTrainerTypes(data || []);
  }

  async function handleToggleSuspend(trainer: ExtendedTrainer) {
    const action = trainer.suspended ? 'unsuspend' : 'suspend';
    const message = trainer.suspended
      ? `Are you sure you want to unsuspend ${trainer.name}? They will be able to login and appear in trainer lists.`
      : `Are you sure you want to suspend ${trainer.name}? They will not be able to login and won't appear in trainer lists.`;

    if (!confirm(message)) {
      return;
    }

    const { error } = await supabase
      .from('trainers')
      .update({ suspended: !trainer.suspended })
      .eq('id', trainer.id);

    if (error) {
      alert(`Error ${action}ing trainer: ` + error.message);
      return;
    }

    await loadTrainers();
  }

  const filteredTrainers = trainers.filter((trainer) => {
    const matchesSearch =
      trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trainer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trainer.postcode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || trainer.assigned_types?.some(at => at.id === filterType);

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && trainer.active) ||
      (filterStatus === 'inactive' && !trainer.active) ||
      (filterStatus === 'suspended' && trainer.suspended) ||
      (filterStatus === 'can_login' && trainer.can_login) ||
      (filterStatus === 'no_login' && !trainer.can_login);

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors">
      <PageHeader
        currentPage={currentPage}
        onNavigate={onNavigate}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Trainer Management</h1>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, email, or postcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 w-full lg:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {trainerTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="can_login">Portal Access</option>
                <option value="no_login">No Portal Access</option>
              </select>

              <button
                onClick={() => {
                  setEditingTrainer(null);
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Trainer
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Total: {filteredTrainers.length}</span>
            <span>Active: {filteredTrainers.filter(t => t.active).length}</span>
            <span>Portal Access: {filteredTrainers.filter(t => t.can_login).length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading trainers...</div>
        ) : filteredTrainers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-4">No trainers found matching your criteria</p>
            <button
              onClick={() => {
                setEditingTrainer(null);
                setShowAddModal(true);
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add Your First Trainer
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredTrainers.map((trainer) => (
                    <tr key={trainer.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{trainer.name}</div>
                        {trainer.day_rate && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">£{Number(trainer.day_rate).toFixed(2)}/day</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {trainer.assigned_types && trainer.assigned_types.length > 0 ? (
                            trainer.assigned_types.map((type) => (
                              <span key={type.id} className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300">
                                {type.name}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-slate-500/20 text-slate-500 dark:text-slate-400">
                              No types assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {trainer.email}
                        </div>
                        {trainer.telephone && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" />
                            {trainer.telephone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {trainer.postcode || 'Not set'}
                        </div>
                        {trainer.town && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{trainer.town}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {trainer.suspended ? (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">SUSPENDED</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1">
                                {trainer.active ? (
                                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                )}
                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                  {trainer.active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {trainer.can_login ? (
                                  <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <UserX className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                )}
                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                  {trainer.can_login ? 'Portal Access' : 'No Portal Access'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingTrainer(trainer);
                              setShowAddModal(true);
                            }}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Edit Trainer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(trainer)}
                            className={`p-2 rounded-lg transition-colors ${
                              trainer.suspended
                                ? 'text-green-600 dark:text-green-400 hover:bg-green-500/20'
                                : 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/20'
                            }`}
                            title={trainer.suspended ? 'Unsuspend Trainer' : 'Suspend Trainer'}
                          >
                            {trainer.suspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showAddModal && (
        <TrainerFormModal
          trainer={editingTrainer}
          trainerTypes={trainerTypes}
          onClose={() => {
            setShowAddModal(false);
            setEditingTrainer(null);
          }}
          onSuccess={(data) => {
            setShowAddModal(false);
            setEditingTrainer(null);
            if (data) {
              setSuccessData(data);
              setShowSuccess(true);
            }
            loadTrainers();
          }}
        />
      )}

      {showSuccess && successData && (
        <SuccessModal
          data={successData}
          onClose={() => {
            setShowSuccess(false);
            setSuccessData(null);
          }}
        />
      )}
    </div>
  );
}

function TrainerFormModal({
  trainer,
  trainerTypes,
  onClose,
  onSuccess
}: {
  trainer: ExtendedTrainer | null;
  trainerTypes: TrainerType[];
  onClose: () => void;
  onSuccess: (data?: { name: string; email: string; password: string }) => void;
}) {
  const [formData, setFormData] = useState({
    name: trainer?.name || '',
    trainer_type_id: trainer?.trainer_type_id || '',
    email: trainer?.email || '',
    telephone: trainer?.telephone || '',
    address1: trainer?.address1 || '',
    address2: trainer?.address2 || '',
    town: trainer?.town || '',
    postcode: trainer?.postcode || '',
    day_rate: trainer?.day_rate?.toString() || '',
    receive_booking_notifications: trainer?.receive_booking_notifications !== false
  });

  const [selectedTrainerTypes, setSelectedTrainerTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const [attributes, setAttributes] = useState<TrainerAttribute[]>([]);
  const [attributeOptions, setAttributeOptions] = useState<Record<string, AttributeOption[]>>({});
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trainer?.id) {
      loadTrainerTypes();
    }
  }, [trainer?.id]);

  useEffect(() => {
    if (formData.trainer_type_id) {
      loadAttributesForTrainerType(formData.trainer_type_id);
    }
  }, [formData.trainer_type_id]);

  async function loadTrainerTypes() {
    if (!trainer?.id) return;
    setLoadingTypes(true);
    try {
      const types = await getTrainerTypes(trainer.id);
      setSelectedTrainerTypes(types.map(t => t.id));
    } catch (err) {
      console.error('Error loading trainer types:', err);
    } finally {
      setLoadingTypes(false);
    }
  }

  async function handleRemoveTrainerType(typeId: string) {
    if (!trainer?.id) {
      setSelectedTrainerTypes(selectedTrainerTypes.filter(id => id !== typeId));
      return;
    }

    try {
      const bookingsCheck = await checkFutureBookingsForTrainerType(trainer.id, typeId);

      if (bookingsCheck.booking_count > 0) {
        const typeName = trainerTypes.find(t => t.id === typeId)?.name || 'this type';
        const message = `Warning: This trainer has ${bookingsCheck.booking_count} upcoming booking(s) for ${typeName} courses.\n\nEarliest: ${bookingsCheck.earliest_booking_date}\nLatest: ${bookingsCheck.latest_booking_date}\n\nAre you sure you want to remove this trainer type?`;

        if (!confirm(message)) {
          return;
        }
      }

      setSelectedTrainerTypes(selectedTrainerTypes.filter(id => id !== typeId));
    } catch (err) {
      console.error('Error checking future bookings:', err);
      if (confirm('Unable to check for future bookings. Remove this trainer type anyway?')) {
        setSelectedTrainerTypes(selectedTrainerTypes.filter(id => id !== typeId));
      }
    }
  }

  useEffect(() => {
    if (trainer?.id && attributes.length > 0) {
      loadExistingAttributeValues();
    }
  }, [trainer?.id, attributes]);

  async function loadAttributesForTrainerType(typeId: string) {
    const attrs = await loadAttributesForType(typeId);
    setAttributes(attrs);

    const options: Record<string, AttributeOption[]> = {};
    for (const attr of attrs) {
      if (attr.field_type === 'multiselect') {
        options[attr.id] = await loadOptionsForAttribute(attr.id);
      }
    }
    setAttributeOptions(options);
  }

  async function loadExistingAttributeValues() {
    if (!trainer?.id) return;

    const values = await loadAttributeValues(trainer.id);
    const valuesMap: Record<string, any> = {};

    values.forEach((val) => {
      const attr = attributes.find((a) => a.id === val.attribute_id);
      if (!attr) return;

      if (attr.field_type === 'text') valuesMap[attr.name] = val.value_text || '';
      else if (attr.field_type === 'date') valuesMap[attr.name] = val.value_date || '';
      else if (attr.field_type === 'number') valuesMap[attr.name] = val.value_number?.toString() || '';
      else if (attr.field_type === 'multiselect') valuesMap[attr.name] = val.value_array || [];
    });

    setAttributeValues(valuesMap);
  }

  async function geocodeAddress(parts: string[]): Promise<{ latitude: number; longitude: number }> {
    const address = parts.filter(Boolean).join(', ');
    if (!address) return { latitude: 0, longitude: 0 };

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=gb&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }

    return { latitude: 0, longitude: 0 };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (!formData.name || !formData.email) {
        throw new Error('Please fill in all required fields');
      }

      if (selectedTrainerTypes.length === 0) {
        throw new Error('Please select at least one trainer type');
      }

      const coords = await geocodeAddress([
        formData.address1,
        formData.address2,
        formData.town,
        formData.postcode
      ]);

      if (trainer?.id) {
        await updateTrainer(coords);
      } else {
        await createTrainer(coords);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSaving(false);
    }
  }

  async function createTrainer(coords: { latitude: number; longitude: number }) {
    const password = generatePassword();

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-trainer-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: password,
          fullName: formData.name,
          trainerName: formData.name,
          trainerTypeId: selectedTrainerTypes[0],
          telephone: formData.telephone,
          address1: formData.address1,
          address2: formData.address2,
          town: formData.town,
          postcode: formData.postcode,
          dayRate: formData.day_rate ? parseFloat(formData.day_rate) : null,
          latitude: coords.latitude,
          longitude: coords.longitude
        })
      }
    );

    const functionResult = await response.json();

    if (!response.ok || !functionResult.success) {
      throw new Error(functionResult.error || 'Failed to create trainer');
    }

    const trainerId = functionResult.trainerId;

    if (attributes.length > 0) {
      await saveAttributeValues(trainerId, attributes, attributeValues);
    }

    if (insuranceFile) {
      await uploadInsuranceFile(trainerId);
    }

    for (const typeId of selectedTrainerTypes) {
      await assignTrainerType(trainerId, typeId);
    }

    await sendTemplateEmail(formData.email, 'trainer_account_created', {
      trainer_name: formData.name,
      email: formData.email,
      password: password
    });

    setSaving(false);
    onSuccess({ name: formData.name, email: formData.email, password, user_id: functionResult.userId });
  }

  async function updateTrainer(coords: { latitude: number; longitude: number }) {
    if (!trainer?.id) return;

    const { error: updateError } = await supabase
      .from('trainers')
      .update({
        name: formData.name,
        trainer_type_id: formData.trainer_type_id,
        email: formData.email,
        telephone: formData.telephone,
        address1: formData.address1,
        address2: formData.address2,
        town: formData.town,
        postcode: formData.postcode,
        day_rate: formData.day_rate ? parseFloat(formData.day_rate) : null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        receive_booking_notifications: formData.receive_booking_notifications,
        updated_at: new Date().toISOString()
      })
      .eq('id', trainer.id);

    if (updateError) throw updateError;

    await syncTrainerTypes(trainer.id);

    if (attributes.length > 0) {
      await saveAttributeValues(trainer.id, attributes, attributeValues);
    }

    if (insuranceFile) {
      await uploadInsuranceFile(trainer.id);
    }

    setSaving(false);
    onSuccess();
  }

  async function syncTrainerTypes(trainerId: string) {
    const currentTypes = await getTrainerTypes(trainerId);
    const currentTypeIds = currentTypes.map(t => t.id);

    const typesToAdd = selectedTrainerTypes.filter(id => !currentTypeIds.includes(id));
    const typesToRemove = currentTypeIds.filter(id => !selectedTrainerTypes.includes(id));

    for (const typeId of typesToAdd) {
      await assignTrainerType(trainerId, typeId);
    }

    for (const typeId of typesToRemove) {
      await removeTrainerType(trainerId, typeId);
    }
  }

  async function uploadInsuranceFile(trainerId: string) {
    if (!insuranceFile) return;

    const fileExt = insuranceFile.name.split('.').pop();
    const fileName = `${trainerId}_${Date.now()}.${fileExt}`;
    const filePath = `insurance/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('trainer-insurance')
      .upload(filePath, insuranceFile);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('trainer-insurance')
      .getPublicUrl(filePath);

    await supabase
      .from('trainers')
      .update({
        insurance_file_name: fileName,
        insurance_url: urlData.publicUrl
      })
      .eq('id', trainerId);
  }

  function generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  function toggleMultiselectOption(attrName: string, optionCode: string) {
    setAttributeValues((prev) => {
      const current = prev[attrName] || [];
      return {
        ...prev,
        [attrName]: current.includes(optionCode)
          ? current.filter((c: string) => c !== optionCode)
          : [...current, optionCode]
      };
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {trainer ? 'Edit Trainer' : 'Add New Trainer'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-600 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Trainer Name <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Trainer Types <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                {trainerTypes.map((type) => (
                  <label key={type.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedTrainerTypes.includes(type.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTrainerTypes([...selectedTrainerTypes, type.id]);
                        } else {
                          handleRemoveTrainerType(type.id);
                        }
                      }}
                      className="w-4 h-4 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{type.name}</div>
                      {type.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{type.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {selectedTrainerTypes.length === 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">Please select at least one trainer type</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Email Address <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!trainer}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Telephone
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address2}
                onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Town / City
              </label>
              <input
                type="text"
                value={formData.town}
                onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Postcode
              </label>
              <input
                type="text"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Agreed Day Rate (£)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.day_rate}
                onChange={(e) => setFormData({ ...formData, day_rate: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notification Preferences</h3>
            <label className="flex items-start gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-3 rounded-lg">
              <input
                type="checkbox"
                checked={formData.receive_booking_notifications}
                onChange={(e) => setFormData({ ...formData, receive_booking_notifications: e.target.checked })}
                className="mt-1 w-4 h-4 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Receive Booking Notifications</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  When enabled, this trainer will receive email notifications for new bookings, booking changes, cancellations, and when bookings are moved to them from other trainers. Note: Only applies if the trainer has an email address configured.
                </div>
              </div>
            </label>
          </div>

          {attributes.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attributes.map((attr) => (
                  <div key={attr.id} className={attr.field_type === 'multiselect' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                      {attr.label} {attr.is_required && <span className="text-red-600 dark:text-red-400">*</span>}
                    </label>
                    {attr.field_type === 'text' && (
                      <input
                        type="text"
                        value={attributeValues[attr.name] || ''}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr.name]: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={attr.is_required}
                      />
                    )}
                    {attr.field_type === 'date' && (
                      <input
                        type="date"
                        value={attributeValues[attr.name] || ''}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr.name]: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={attr.is_required}
                      />
                    )}
                    {attr.field_type === 'number' && (
                      <input
                        type="number"
                        step="0.01"
                        value={attributeValues[attr.name] || ''}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr.name]: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={attr.is_required}
                      />
                    )}
                    {attr.field_type === 'multiselect' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {attributeOptions[attr.id]?.map((option) => (
                          <label
                            key={option.id}
                            className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={(attributeValues[attr.name] || []).includes(option.code)}
                              onChange={() => toggleMultiselectOption(attr.name, option.code)}
                              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              Insurance Documentation
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {trainer?.insurance_file_name && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Current: {trainer.insurance_file_name}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : trainer ? 'Update Trainer' : 'Create Trainer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SuccessModal({
  data,
  onClose
}: {
  data: { name: string; email: string; password: string; user_id?: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    navigator.clipboard.writeText(data.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Trainer Created Successfully!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">User account has been created and email sent</p>
            </div>
          </div>

          <div className="space-y-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Trainer Name</p>
              <p className="text-slate-900 dark:text-white font-medium">{data.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Email Address</p>
              <p className="text-slate-900 dark:text-white font-medium">{data.email}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Temporary Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded text-blue-600 dark:text-blue-300 font-mono">
                  {data.password}
                </code>
                <button
                  onClick={copyPassword}
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  title="Copy password"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Important:</strong> The trainer account has been created but portal access is disabled.
              You can enable portal login through User Management when ready.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors"
            >
              Done
            </button>
            {data.user_id && (
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('users')
                      .update({ can_login: true })
                      .eq('id', data.user_id);

                    if (error) throw error;

                    await sendTemplateEmail(data.email, 'trainer_account_created', {
                      trainer_name: data.name,
                      email: data.email,
                      password: data.password
                    });

                    onClose();
                  } catch (error) {
                    console.error('Error enabling login:', error);
                    alert('Failed to enable login. Please try again.');
                  }
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Enable Login & Send Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
