import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, GripVertical, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { getCourseTypes, saveCourseType, deleteCourseType, CourseType, CourseFieldDefinition } from '../lib/certificates';
import Notification from '../components/Notification';
import { supabase } from '../lib/supabase';

interface CourseTypesManagerProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

type NotificationState = {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
} | null;

export default function CourseTypesManager({ currentPage, onNavigate }: CourseTypesManagerProps) {
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<Partial<CourseType> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<NotificationState>(null);
  const [qualifiedTrainerCounts, setQualifiedTrainerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCourseTypes();
  }, []);

  async function loadCourseTypes() {
    setLoading(true);
    const data = await getCourseTypes();
    setCourseTypes(data);
    await loadQualifiedTrainerCounts(data);
    setLoading(false);
  }

  async function loadQualifiedTrainerCounts(types: CourseType[]) {
    const counts: Record<string, number> = {};

    for (const type of types) {
      if (type.trainer_type_id) {
        const { count, error } = await supabase
          .from('trainer_trainer_types')
          .select('*', { count: 'exact', head: true })
          .eq('trainer_type_id', type.trainer_type_id);

        if (!error) {
          counts[type.id] = count || 0;
        } else {
          counts[type.id] = 0;
        }
      } else {
        counts[type.id] = 0;
      }
    }

    setQualifiedTrainerCounts(counts);
  }

  function handleCreate() {
    setEditingType({
      name: '',
      code: '',
      description: '',
      duration_days: null,
      duration_unit: 'days',
      certificate_validity_months: 36,
      sort_order: courseTypes.length + 1,
      active: true,
      required_fields: [],
      certificate_field_mappings: {},
      default_course_data: {},
      trainer_type_id: null
    });
    setShowModal(true);
  }

  function handleEdit(type: CourseType) {
    setEditingType(type);
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this course type? This cannot be undone and may affect existing bookings.')) return;

    try {
      await deleteCourseType(id);
      await loadCourseTypes();
      setNotification({ type: 'success', message: 'Course type deleted successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to delete course type' });
    }
  }

  function closeModal() {
    setShowModal(false);
    setEditingType(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Course Types</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {courseTypes.length} {courseTypes.length === 1 ? 'type' : 'types'} configured
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Course Type
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courseTypes.map(type => (
            <div
              key={type.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{type.name}</h3>
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-2">{type.code}</p>
                  {type.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{type.description}</p>
                  )}
                </div>
                {!type.active && (
                  <span className="px-2 py-1 text-xs bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded">
                    Inactive
                  </span>
                )}
              </div>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-500">Duration:</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {type.duration_days ? `${type.duration_days} ${type.duration_unit || 'days'}` : 'From booking'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-500">Certificate Validity:</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {type.certificate_validity_months ? `${type.certificate_validity_months} months` : 'No expiry'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-500">Required Fields:</span>
                  <span className="text-slate-600 dark:text-slate-300">{type.required_fields.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Qualified Trainers:
                  </span>
                  <span className={`text-slate-600 dark:text-slate-300 font-medium ${
                    qualifiedTrainerCounts[type.id] === 0 ? 'text-yellow-600 dark:text-yellow-400' : ''
                  }`}>
                    {qualifiedTrainerCounts[type.id] || 0}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(type)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(type.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {courseTypes.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-4">No course types configured yet</p>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            >
              Create First Course Type
            </button>
          </div>
        )}
      </main>

      {showModal && editingType && (
        <CourseTypeModal
          courseType={editingType}
          onClose={closeModal}
          onSave={async () => {
            await loadCourseTypes();
            closeModal();
          }}
          onNotify={(type, message) => setNotification({ type, message })}
        />
      )}

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

interface CourseTypeModalProps {
  courseType: Partial<CourseType>;
  onClose: () => void;
  onSave: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

function CourseTypeModal({ courseType, onClose, onSave, onNotify }: CourseTypeModalProps) {
  const [formData, setFormData] = useState<Partial<CourseType>>(courseType);
  const [saving, setSaving] = useState(false);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [trainerTypes, setTrainerTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [dropdownInputs, setDropdownInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    loadTrainerTypes();
  }, []);

  async function loadTrainerTypes() {
    const { data, error } = await supabase
      .from('trainer_types')
      .select('id, name')
      .order('sort_order');

    if (!error && data) {
      setTrainerTypes(data);
    }
  }

  function addField() {
    const newField: CourseFieldDefinition = {
      name: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      scope: 'candidate',
      placeholder: ''
    };

    setFormData(prev => ({
      ...prev,
      required_fields: [...(prev.required_fields || []), newField]
    }));
  }

  function updateField(index: number, updates: Partial<CourseFieldDefinition>) {
    const fields = [...(formData.required_fields || [])];
    fields[index] = { ...fields[index], ...updates };
    setFormData(prev => ({ ...prev, required_fields: fields }));
  }

  function removeField(index: number) {
    const fields = [...(formData.required_fields || [])];
    const fieldName = fields[index].name;
    fields.splice(index, 1);

    const newDefaults = { ...(formData.default_course_data || {}) };
    delete newDefaults[fieldName];

    setFormData(prev => ({
      ...prev,
      required_fields: fields,
      default_course_data: newDefaults
    }));
  }

  function handleFieldDragStart(index: number) {
    setDraggedFieldIndex(index);
  }

  function handleFieldDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedFieldIndex === null || draggedFieldIndex === index) return;
    setDragOverIndex(index);
  }

  function handleFieldDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedFieldIndex === null || draggedFieldIndex === dropIndex) {
      setDraggedFieldIndex(null);
      setDragOverIndex(null);
      return;
    }

    const fields = [...(formData.required_fields || [])];
    const draggedField = fields[draggedFieldIndex];
    fields.splice(draggedFieldIndex, 1);
    fields.splice(dropIndex, 0, draggedField);

    setFormData(prev => ({ ...prev, required_fields: fields }));
    setDraggedFieldIndex(null);
    setDragOverIndex(null);
  }

  function handleFieldDragEnd() {
    setDraggedFieldIndex(null);
    setDragOverIndex(null);
  }

  function updateDefaultValue(fieldName: string, value: any) {
    setFormData(prev => ({
      ...prev,
      default_course_data: {
        ...(prev.default_course_data || {}),
        [fieldName]: value
      }
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await saveCourseType(formData);
      onNotify('success', 'Course type saved successfully');
      onSave();
    } catch (error) {
      onNotify('error', 'Failed to save course type');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 dark:bg-slate-950/90 flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold uppercase tracking-wider">
              {formData.id ? 'Edit Course Type' : 'Create Course Type'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure course type details and certificate fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Course Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g., Forklift Training"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                required
                placeholder="e.g., FLT"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm uppercase text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this course type"
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Duration
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formData.duration_days || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_days: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Use booking"
                  min="1"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                />
                <select
                  value={formData.duration_unit || 'days'}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_unit: e.target.value as 'hours' | 'days' }))}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Leave empty to use booking's duration
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Certificate Validity (months)
              </label>
              <input
                type="number"
                value={formData.certificate_validity_months || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, certificate_validity_months: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Leave empty for no expiry"
                min="1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                min="0"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Required Trainer Type
            </label>
            <select
              value={formData.trainer_type_id || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, trainer_type_id: e.target.value || null }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
            >
              <option value="">No requirement (any trainer can teach this)</option>
              {trainerTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              If selected, only trainers with this trainer type can teach this course
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span>Active (available for booking)</span>
            </label>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider">Required Fields</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Define fields that must be filled when issuing certificates
                </p>
              </div>
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Field
              </button>
            </div>

            <div className="space-y-3">
              {(formData.required_fields || []).map((field, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleFieldDragStart(index)}
                  onDragOver={(e) => handleFieldDragOver(e, index)}
                  onDrop={(e) => handleFieldDrop(e, index)}
                  onDragEnd={handleFieldDragEnd}
                  className={`bg-slate-50 dark:bg-slate-950 border rounded-lg p-4 transition-all ${
                    draggedFieldIndex === index
                      ? 'opacity-50 scale-95 border-slate-300 dark:border-slate-600'
                      : dragOverIndex === index && draggedFieldIndex !== null
                      ? 'border-blue-500 border-2'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-2 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 text-slate-500 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Field Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            const autoName = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                            updateField(index, { label, name: autoName });
                          }}
                          placeholder="e.g., Equipment Types"
                          className="w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                        />
                        {field.name && (
                          <p className="text-[10px] text-slate-500 mt-1 font-mono">
                            Internal name: {field.name}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Field Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, { type: e.target.value as any })}
                            className="w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="dropdown">Dropdown</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Scope</label>
                          <select
                            value={field.scope}
                            onChange={(e) => updateField(index, { scope: e.target.value as 'course' | 'candidate' })}
                            className="w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                          >
                            <option value="candidate">Candidate-level</option>
                            <option value="course">Course-level</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(index, { required: e.target.checked })}
                              className="w-3 h-3 rounded"
                            />
                            Required
                          </label>
                        </div>
                      </div>

                      {field.type === 'dropdown' && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Options (comma-separated)</label>
                          <input
                            type="text"
                            value={dropdownInputs[index] ?? (field.options || []).join(', ')}
                            onChange={(e) => {
                              setDropdownInputs(prev => ({ ...prev, [index]: e.target.value }));
                            }}
                            onBlur={(e) => {
                              const options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              updateField(index, { options });
                              setDropdownInputs(prev => {
                                const newInputs = { ...prev };
                                delete newInputs[index];
                                return newInputs;
                              });
                            }}
                            placeholder="e.g., Option 1, Option 2, Option 3"
                            className="w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      )}

                      {field.type === 'number' && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Unit (for duration fields)</label>
                          <select
                            value={field.unit || ''}
                            onChange={(e) => updateField(index, { unit: e.target.value as 'hours' | 'days' | undefined || undefined })}
                            className="w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                          >
                            <option value="">None</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      )}

                      {(field.type === 'text' || field.type === 'number') && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Placeholder</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(index, { placeholder: e.target.value })}
                            placeholder="e.g., Enter equipment types..."
                            className="w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      )}

                      <div className={field.scope === 'course' ? 'bg-blue-500/5 border border-blue-500/20 rounded p-3' : 'bg-green-500/5 border border-green-500/20 rounded p-3'}>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          Default Value (optional)
                          <span className="ml-1 text-slate-500">
                            {field.scope === 'course'
                              ? '- Pre-populates for entire course'
                              : '- Pre-populates for each candidate'}
                          </span>
                        </label>
                        {field.type === 'dropdown' ? (
                          <select
                            value={formData.default_course_data?.[field.name] || ''}
                            onChange={(e) => updateDefaultValue(field.name, e.target.value)}
                            className={`w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 rounded text-xs text-slate-900 dark:text-white ${
                              field.scope === 'course' ? 'border border-blue-500/30' : 'border border-green-500/30'
                            }`}
                          >
                            <option value="">No default</option>
                            {field.options?.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : field.type === 'number' ? (
                          field.unit ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={formData.default_course_data?.[field.name] || ''}
                                onChange={(e) => updateDefaultValue(field.name, parseFloat(e.target.value) || '')}
                                placeholder={field.placeholder || 'Enter value...'}
                                className={`flex-1 px-2 py-1.5 bg-slate-200 dark:bg-slate-900 rounded text-xs text-slate-900 dark:text-white ${
                                  field.scope === 'course' ? 'border border-blue-500/30' : 'border border-green-500/30'
                                }`}
                              />
                              <select
                                value={formData.default_course_data?.[`${field.name}_unit`] || field.unit}
                                onChange={(e) => updateDefaultValue(`${field.name}_unit`, e.target.value)}
                                className={`px-2 py-1.5 bg-slate-200 dark:bg-slate-900 rounded text-xs text-slate-900 dark:text-white ${
                                  field.scope === 'course' ? 'border border-blue-500/30' : 'border border-green-500/30'
                                }`}
                              >
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                              </select>
                            </div>
                          ) : (
                            <input
                              type="number"
                              value={formData.default_course_data?.[field.name] || ''}
                              onChange={(e) => updateDefaultValue(field.name, parseFloat(e.target.value) || '')}
                              placeholder={field.placeholder || 'Enter default value...'}
                              className={`w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 rounded text-xs text-slate-900 dark:text-white ${
                                field.scope === 'course' ? 'border border-blue-500/30' : 'border border-green-500/30'
                              }`}
                            />
                          )
                        ) : field.type === 'date' ? (
                          <input
                            type="date"
                            value={formData.default_course_data?.[field.name] || ''}
                            onChange={(e) => updateDefaultValue(field.name, e.target.value)}
                            className={`w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 rounded text-xs text-slate-900 dark:text-white ${
                              field.scope === 'course' ? 'border border-blue-500/30' : 'border border-green-500/30'
                            }`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData.default_course_data?.[field.name] || ''}
                            onChange={(e) => updateDefaultValue(field.name, e.target.value)}
                            placeholder={field.placeholder || 'Enter default value...'}
                            className={`w-full px-2 py-1.5 bg-slate-200 dark:bg-slate-900 rounded text-xs text-slate-900 dark:text-white ${
                              field.scope === 'course' ? 'border border-blue-500/30' : 'border border-green-500/30'
                            }`}
                          />
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-500">
                        {field.scope === 'course' ? (
                          <span className="text-blue-600 dark:text-blue-400">
                            📋 Course-level: Entered once for the entire course (applies to all candidates)
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">
                            👤 Candidate-level: Entered separately for each individual candidate
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {(formData.required_fields || []).length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm border border-dashed border-slate-300 dark:border-slate-700 rounded">
                No fields defined yet. Click "Add Field" to create certificate fields.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Course Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
