import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Settings } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';

interface TrainerType {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

interface Attribute {
  id: string;
  trainer_type_id: string;
  name: string;
  label: string;
  field_type: 'text' | 'date' | 'number' | 'multiselect' | 'file';
  is_required: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

interface AttributeOption {
  id: string;
  attribute_id: string;
  category: string;
  code: string;
  label: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

interface TrainerTypesProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function TrainerTypes({ currentPage, onNavigate }: TrainerTypesProps) {
  const [trainerTypes, setTrainerTypes] = useState<TrainerType[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [options, setOptions] = useState<AttributeOption[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [editingType, setEditingType] = useState<TrainerType | null>(null);
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await Promise.all([loadTrainerTypes(), loadAttributes(), loadOptions()]);
  }

  async function loadTrainerTypes() {
    const { data, error } = await supabase
      .from('trainer_types')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error loading trainer types:', error);
      return;
    }

    setTrainerTypes(data || []);
  }

  async function loadAttributes() {
    console.log('loadAttributes called');
    const { data, error } = await supabase
      .from('trainer_type_attributes')
      .select('*')
      .order('sort_order');

    console.log('loadAttributes response:', { data, error, count: data?.length });

    if (error) {
      console.error('Error loading attributes:', error);
      alert(`Error loading attributes: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      console.warn('No attributes found in database');
    }

    console.log('Loaded attributes:', data);
    setAttributes(data || []);
    console.log('State updated, attributes count:', data?.length || 0);
  }

  async function loadOptions() {
    const { data, error } = await supabase
      .from('trainer_attribute_options')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error loading options:', error);
      return;
    }

    setOptions(data || []);
  }

  async function handleDeleteType(type: TrainerType) {
    const typeAttributes = attributes.filter(a => a.trainer_type_id === type.id);
    if (typeAttributes.length > 0) {
      alert(`Cannot delete "${type.name}" because it has ${typeAttributes.length} attribute(s). Delete the attributes first.`);
      return;
    }

    if (!confirm(`Delete trainer type "${type.name}"?`)) return;

    const { error } = await supabase
      .from('trainer_types')
      .delete()
      .eq('id', type.id);

    if (error) {
      console.error('Error deleting type:', error);
      alert('Could not delete trainer type');
      return;
    }

    await loadTrainerTypes();
  }

  async function handleDeleteAttribute(attribute: Attribute) {
    if (!confirm(`Delete attribute "${attribute.label}"?`)) return;

    const { error } = await supabase
      .from('trainer_type_attributes')
      .delete()
      .eq('id', attribute.id);

    if (error) {
      console.error('Error deleting attribute:', error);
      alert('Could not delete attribute');
      return;
    }

    await loadAttributes();
  }

  function getAttributesForType(typeId: string) {
    console.log('Getting attributes for type:', typeId);
    console.log('All attributes:', attributes.map(a => ({ id: a.id, type_id: a.trainer_type_id, label: a.label })));
    const filtered = attributes.filter(a => {
      const matches = a.trainer_type_id === typeId;
      console.log(`  Checking ${a.label}: "${a.trainer_type_id}" === "${typeId}"? ${matches}`);
      return matches;
    });
    console.log('Found:', filtered.length, 'from total:', attributes.length);
    return filtered;
  }

  function getOptionsForAttribute(attributeId: string) {
    return options.filter(o => o.attribute_id === attributeId);
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-3 bg-white/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-end gap-3 max-w-[1600px] mx-auto">
          <button
            onClick={() => {
              setEditingType(null);
              setShowTypeModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add trainer type
            </button>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-6">
        <div className="space-y-6">
          {trainerTypes.map((type) => {
            const typeAttributes = getAttributesForType(type.id);

            return (
              <div
                key={type.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{type.name}</h2>
                    {type.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{type.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedTypeId(type.id);
                        setEditingAttribute(null);
                        setShowAttributeModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add attribute
                    </button>
                    <button
                      onClick={() => {
                        setEditingType(type);
                        setShowTypeModal(true);
                      }}
                      className="p-2 border border-slate-300 dark:border-slate-600 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteType(type)}
                      className="p-2 bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/50 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {typeAttributes.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">No attributes defined yet</p>
                ) : (
                  <div className="space-y-2">
                    {typeAttributes.map((attr) => {
                      const attrOptions = getOptionsForAttribute(attr.id);

                      return (
                        <div
                          key={attr.id}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{attr.label}</span>
                                <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded">
                                  {attr.field_type}
                                </span>
                                {attr.is_required && (
                                  <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/50 rounded">
                                    required
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Field name: {attr.name}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {attr.field_type === 'multiselect' && (
                                <button
                                  onClick={() => {
                                    setSelectedTypeId(type.id);
                                    setEditingAttribute(attr);
                                    setShowAttributeModal(true);
                                  }}
                                  className="p-1.5 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                  title="Manage options"
                                >
                                  <Settings className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTypeId(type.id);
                                  setEditingAttribute(attr);
                                  setShowAttributeModal(true);
                                }}
                                className="p-1.5 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteAttribute(attr)}
                                className="p-1.5 bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/50 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {attr.field_type === 'multiselect' && attrOptions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                {attrOptions.length} option(s) available
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {attrOptions.slice(0, 10).map((opt) => (
                                  <span
                                    key={opt.id}
                                    className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                                  >
                                    {opt.code}
                                  </span>
                                ))}
                                {attrOptions.length > 10 && (
                                  <span className="text-xs px-2 py-1 text-slate-500 dark:text-slate-400">
                                    +{attrOptions.length - 10} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {trainerTypes.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-slate-500 dark:text-slate-400 mb-4">No trainer types yet. Add your first type to get started.</p>
              <button
                onClick={() => {
                  setEditingType(null);
                  setShowTypeModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add trainer type
              </button>
            </div>
          )}
        </div>
      </main>

      {showTypeModal && (
        <TypeModal
          type={editingType}
          existingTypes={trainerTypes}
          onClose={() => {
            setShowTypeModal(false);
            setEditingType(null);
          }}
          onSave={() => {
            loadTrainerTypes();
            setShowTypeModal(false);
            setEditingType(null);
          }}
        />
      )}

      {showAttributeModal && (
        <AttributeModal
          attribute={editingAttribute}
          trainerTypeId={selectedTypeId}
          existingAttributes={attributes}
          existingOptions={options}
          onClose={() => {
            setShowAttributeModal(false);
            setEditingAttribute(null);
            setSelectedTypeId(null);
          }}
          onSave={() => {
            loadData();
            setShowAttributeModal(false);
            setEditingAttribute(null);
            setSelectedTypeId(null);
          }}
        />
      )}
    </div>
  );
}

function TypeModal({
  type,
  existingTypes,
  onClose,
  onSave
}: {
  type: TrainerType | null;
  existingTypes: TrainerType[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: type?.name || '',
    description: type?.description || '',
    sort_order: type?.sort_order?.toString() || (existingTypes.length + 1).toString()
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a trainer type name.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        sort_order: parseInt(formData.sort_order) || 0,
        updated_at: new Date().toISOString()
      };

      let error;
      if (type) {
        const result = await supabase
          .from('trainer_types')
          .update(payload)
          .eq('id', type.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('trainer_types')
          .insert([payload]);
        error = result.error;
      }

      if (error) {
        console.error('Error saving trainer type:', error);
        alert('Could not save trainer type.');
        return;
      }

      onSave();
    } catch (err) {
      console.error(err);
      alert('Could not save trainer type.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 dark:bg-slate-950/90 flex items-center justify-center z-[100] p-4"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider">
              {type ? 'Edit Trainer Type' : 'Add Trainer Type'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Define a type of trainer (e.g., MHE, First Aid, DCPC)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Trainer type name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              placeholder="e.g., MHE Trainer"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="e.g., Materials Handling Equipment (RTITB) trainers"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Sort order
            </label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, sort_order: e.target.value }))
              }
              min="1"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (type ? 'Updating...' : 'Saving...') : type ? 'Update type' : 'Save type'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AttributeModal({
  attribute,
  trainerTypeId,
  existingAttributes,
  existingOptions,
  onClose,
  onSave
}: {
  attribute: Attribute | null;
  trainerTypeId: string | null;
  existingAttributes: Attribute[];
  existingOptions: AttributeOption[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: attribute?.name || '',
    label: attribute?.label || '',
    field_type: attribute?.field_type || 'text',
    is_required: attribute?.is_required || false,
    sort_order: attribute?.sort_order?.toString() || (existingAttributes.length + 1).toString()
  });
  const [options, setOptions] = useState<AttributeOption[]>(
    attribute ? existingOptions.filter(o => o.attribute_id === attribute.id) : []
  );
  const [newOption, setNewOption] = useState({ category: '', code: '', label: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.label.trim()) {
      alert('Please enter both field name and label.');
      return;
    }

    if (!trainerTypeId) {
      alert('Trainer type ID is missing.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        trainer_type_id: trainerTypeId,
        name: formData.name,
        label: formData.label,
        field_type: formData.field_type,
        is_required: formData.is_required,
        sort_order: parseInt(formData.sort_order) || 0,
        updated_at: new Date().toISOString()
      };

      let attributeId = attribute?.id;
      let error;

      if (attribute) {
        const result = await supabase
          .from('trainer_type_attributes')
          .update(payload)
          .eq('id', attribute.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('trainer_type_attributes')
          .insert([payload])
          .select();
        error = result.error;
        if (result.data && result.data.length > 0) {
          attributeId = result.data[0].id;
        }
      }

      if (error) {
        console.error('Error saving attribute:', error);
        alert('Could not save attribute.');
        return;
      }

      if (formData.field_type === 'multiselect' && attributeId && options.length > 0) {
        if (attribute) {
          await supabase
            .from('trainer_attribute_options')
            .delete()
            .eq('attribute_id', attributeId);
        }

        const optionsPayload = options.map((opt, idx) => ({
          attribute_id: attributeId,
          category: opt.category,
          code: opt.code,
          label: opt.label,
          sort_order: idx + 1
        }));

        const { error: optionsError } = await supabase
          .from('trainer_attribute_options')
          .insert(optionsPayload);

        if (optionsError) {
          console.error('Error saving options:', optionsError);
          alert('Could not save options.');
          return;
        }
      }

      onSave();
    } catch (err) {
      console.error(err);
      alert('Could not save attribute.');
    } finally {
      setSaving(false);
    }
  }

  function addOption() {
    if (!newOption.code.trim() || !newOption.label.trim()) {
      alert('Please enter both code and label.');
      return;
    }

    setOptions([...options, {
      id: `temp-${Date.now()}`,
      attribute_id: attribute?.id || '',
      category: newOption.category,
      code: newOption.code,
      label: newOption.label,
      sort_order: options.length + 1
    }]);

    setNewOption({ category: '', code: '', label: '' });
  }

  function removeOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 dark:bg-slate-950/90 flex items-center justify-center z-[100] p-4"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider">
              {attribute ? 'Edit Attribute' : 'Add Attribute'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Define custom fields for this trainer type
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Field name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                placeholder="e.g., rtitb_number"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Label
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, label: e.target.value }))
                }
                required
                placeholder="e.g., RTITB Number"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Field type
              </label>
              <select
                value={formData.field_type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, field_type: e.target.value as any }))
                }
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
              >
                <option value="text">Text</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
                <option value="multiselect">Multi-select</option>
                <option value="file">File</option>
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Sort order
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sort_order: e.target.value }))
                }
                min="1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, is_required: e.target.checked }))
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Required field</span>
            </label>
          </div>

          {formData.field_type === 'multiselect' && (
            <div className="border border-slate-300 dark:border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Options</h3>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <input
                  type="text"
                  value={newOption.category}
                  onChange={(e) => setNewOption({ ...newOption, category: e.target.value })}
                  placeholder="Category (optional)"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={newOption.code}
                  onChange={(e) => setNewOption({ ...newOption, code: e.target.value })}
                  placeholder="Code (e.g., B1)"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={newOption.label}
                  onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                  placeholder="Label"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={addOption}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Add option
              </button>

              {options.length > 0 && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2"
                    >
                      <div className="text-sm">
                        {opt.category && (
                          <span className="text-slate-500 dark:text-slate-400">{opt.category} / </span>
                        )}
                        <span className="font-medium">{opt.code}</span>
                        <span className="text-slate-500 dark:text-slate-400"> - {opt.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="p-1 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (attribute ? 'Updating...' : 'Saving...') : attribute ? 'Update attribute' : 'Save attribute'}
          </button>
        </form>
      </div>
    </div>
  );
}
