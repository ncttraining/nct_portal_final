import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Save, Trash2, Edit2, Move, Type, Palette, ListPlus, Tag, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  getCourseTypes,
  getCertificateTemplates,
  saveCertificateTemplate,
  deleteCertificateTemplate,
  duplicateCertificateTemplate,
  uploadCertificateBackground,
  CourseType,
  CourseFieldDefinition,
  CertificateTemplate,
  CertificateField
} from '../lib/certificates';
import Notification from '../components/Notification';

interface CertificateTemplatesProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;
const PREVIEW_SCALE = 0.25;

export default function CertificateTemplates({ currentPage, onNavigate }: CertificateTemplatesProps) {
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedCourseType, setSelectedCourseType] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<CertificateTemplate> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's' | false>(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialFieldState, setInitialFieldState] = useState<{ width: number; height: number; x: number; y: number; fontSize: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [showCourseTypeChanger, setShowCourseTypeChanger] = useState(false);
  const [newCourseTypeId, setNewCourseTypeId] = useState<string>('');
  const [showCourseTypeConfirm, setShowCourseTypeConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCourseType) {
      loadTemplates();
    }
  }, [selectedCourseType]);

  async function loadData() {
    setLoading(true);
    const types = await getCourseTypes();
    setCourseTypes(types);
    if (types.length > 0 && !selectedCourseType) {
      setSelectedCourseType(types[0].id);
    }
    setLoading(false);
  }

  async function loadTemplates() {
    if (!selectedCourseType) return;
    const data = await getCertificateTemplates(selectedCourseType);
    setTemplates(data);
  }

  function createNewTemplate() {
    const courseType = courseTypes.find(ct => ct.id === selectedCourseType);
    if (!courseType) return;

    const defaultFields: CertificateField[] = [
      {
        id: 'candidate_name',
        name: 'candidate_name',
        label: 'Candidate Name',
        type: 'text',
        x: 840,
        y: 1400,
        width: 800,
        height: 80,
        fontSize: 64,
        fontFamily: 'Arial',
        color: '#000000',
        align: 'center',
        bold: true,
        italic: false
      },
      {
        id: 'certificate_number',
        name: 'certificate_number',
        label: 'Certificate Number',
        type: 'text',
        x: 100,
        y: 100,
        width: 600,
        height: 50,
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#666666',
        align: 'left',
        bold: false,
        italic: false
      },
      {
        id: 'course_date',
        name: 'course_date',
        label: 'Course Date',
        type: 'date',
        x: 840,
        y: 2000,
        width: 800,
        height: 60,
        fontSize: 36,
        fontFamily: 'Arial',
        color: '#333333',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        id: 'trainer_name',
        name: 'trainer_name',
        label: 'Trainer Name',
        type: 'text',
        x: 840,
        y: 2800,
        width: 800,
        height: 50,
        fontSize: 32,
        fontFamily: 'Arial',
        color: '#333333',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        id: 'course_duration',
        name: 'course_duration',
        label: 'Course Duration',
        type: 'text',
        x: 840,
        y: 2400,
        width: 800,
        height: 60,
        fontSize: 32,
        fontFamily: 'Arial',
        color: '#333333',
        align: 'center',
        bold: false,
        italic: false
      }
    ];

    const courseTypeFields: CertificateField[] = (courseType.required_fields || []).map((field, index) => ({
      id: field.name,
      name: field.name,
      label: field.label,
      type: 'text',
      x: 840,
      y: 2200 + (index * 150),
      width: 800,
      height: 60,
      fontSize: 32,
      fontFamily: 'Arial',
      color: '#333333',
      align: 'center',
      bold: false,
      italic: false
    }));

    setEditingTemplate({
      course_type_id: selectedCourseType,
      name: `${courseType.name} Certificate Template`,
      background_image_url: '',
      page_width: A4_WIDTH,
      page_height: A4_HEIGHT,
      fields_config: [...defaultFields, ...courseTypeFields],
      is_active: true
    });
    setShowEditor(true);
  }

  function editTemplate(template: CertificateTemplate) {
    setEditingTemplate(template);
    setShowEditor(true);
  }

  async function handleBackgroundUpload(file: File) {
    if (!editingTemplate) return;

    const courseType = courseTypes.find(ct => ct.id === selectedCourseType);
    if (!courseType) return;

    setUploading(true);
    try {
      const url = await uploadCertificateBackground(file, courseType.code);
      setEditingTemplate({
        ...editingTemplate,
        background_image_url: url
      });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to upload background image' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveTemplate() {
    if (!editingTemplate) return;

    if (!editingTemplate.background_image_url) {
      setNotification({ type: 'warning', message: 'Please upload a background image' });
      return;
    }

    try {
      await saveCertificateTemplate(editingTemplate);
      await loadTemplates();
      setShowEditor(false);
      setEditingTemplate(null);
      setNotification({ type: 'success', message: 'Template saved successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to save template' });
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return;

    try {
      await deleteCertificateTemplate(id);
      await loadTemplates();
      setNotification({ type: 'success', message: 'Template deleted successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to delete template' });
    }
  }

  async function handleDuplicateTemplate(id: string) {
    try {
      await duplicateCertificateTemplate(id);
      await loadTemplates();
      setNotification({ type: 'success', message: 'Template duplicated successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to duplicate template' });
    }
  }

  function openCourseTypeChanger() {
    if (!editingTemplate) return;
    setNewCourseTypeId(editingTemplate.course_type_id || '');
    setShowCourseTypeChanger(true);
  }

  function promptChangeCourseType() {
    if (!editingTemplate || !newCourseTypeId) return;

    const oldCourseTypeId = editingTemplate.course_type_id;

    if (oldCourseTypeId !== newCourseTypeId) {
      setShowCourseTypeConfirm(true);
    } else {
      setShowCourseTypeChanger(false);
    }
  }

  async function handleChangeCourseType() {
    if (!editingTemplate || !newCourseTypeId) return;

    const newCourseType = courseTypes.find(ct => ct.id === newCourseTypeId);
    if (!newCourseType) return;

    setEditingTemplate({
      ...editingTemplate,
      course_type_id: newCourseTypeId,
      name: editingTemplate.name?.includes('(Copy)')
        ? `${newCourseType.name} Certificate Template (Copy)`
        : `${newCourseType.name} Certificate Template`
    });

    setShowCourseTypeChanger(false);
    setShowCourseTypeConfirm(false);
    setNotification({ type: 'info', message: 'Course type changed. Remember to review and update fields as needed.' });
  }

  function cancelChangeCourseType() {
    setShowCourseTypeConfirm(false);
    setShowCourseTypeChanger(false);
    setNewCourseTypeId(editingTemplate?.course_type_id || '');
  }

  function updateField(fieldId: string, updates: Partial<CertificateField>) {
    if (!editingTemplate) return;

    const fields = (editingTemplate.fields_config || []) as CertificateField[];
    const updatedFields = fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    setEditingTemplate({
      ...editingTemplate,
      fields_config: updatedFields
    });
  }

  function addCustomField() {
    if (!editingTemplate) return;

    const fields = (editingTemplate.fields_config || []) as CertificateField[];
    const newField: CertificateField = {
      id: `custom_${Date.now()}`,
      name: `custom_field_${fields.length + 1}`,
      label: 'Custom Field',
      type: 'text',
      x: 400,
      y: 400,
      width: 600,
      height: 60,
      fontSize: 32,
      fontFamily: 'Arial',
      color: '#000000',
      align: 'left',
      bold: false,
      italic: false
    };

    setEditingTemplate({
      ...editingTemplate,
      fields_config: [...fields, newField]
    });
    setSelectedFieldId(newField.id);
  }

  function addCourseTypeField(courseField: CourseFieldDefinition) {
    if (!editingTemplate) return;

    const fields = (editingTemplate.fields_config || []) as CertificateField[];

    const newField: CertificateField = {
      id: courseField.name,
      name: courseField.name,
      label: courseField.label,
      type: 'text',
      x: 840,
      y: 2200 + (fields.length * 120),
      width: 800,
      height: 60,
      fontSize: 32,
      fontFamily: 'Arial',
      color: '#333333',
      align: 'center',
      bold: false,
      italic: false
    };

    setEditingTemplate({
      ...editingTemplate,
      fields_config: [...fields, newField]
    });
    setSelectedFieldId(newField.id);
  }

  function getAvailableCourseFields(): CourseFieldDefinition[] {
    if (!editingTemplate) return [];

    const courseTypeId = editingTemplate.course_type_id || selectedCourseType;
    const courseType = courseTypes.find(ct => ct.id === courseTypeId);
    if (!courseType || !courseType.required_fields) return [];

    const existingFieldNames = ((editingTemplate.fields_config || []) as CertificateField[])
      .map(f => f.name);

    return courseType.required_fields.filter(
      field => !existingFieldNames.includes(field.name)
    );
  }

  function getAvailableSystemFields(): Array<{name: string, label: string}> {
    if (!editingTemplate) return [];

    const systemFields = [
      { name: 'candidate_name', label: 'Candidate Name' },
      { name: 'certificate_number', label: 'Certificate Number' },
      { name: 'course_name', label: 'Course Name' },
      { name: 'course_date', label: 'Course Date' },
      { name: 'course_duration', label: 'Course Duration' },
      { name: 'trainer_name', label: 'Trainer Name' }
    ];

    const existingFieldNames = ((editingTemplate.fields_config || []) as CertificateField[])
      .map(f => f.name);

    return systemFields.filter(field => !existingFieldNames.includes(field.name));
  }

  function addSystemField(fieldName: string, fieldLabel: string) {
    if (!editingTemplate) return;

    const defaultConfigs: Record<string, Partial<CertificateField>> = {
      candidate_name: { x: 840, y: 1400, width: 800, height: 80, fontSize: 64, bold: true },
      certificate_number: { x: 100, y: 100, width: 600, height: 50, fontSize: 24 },
      course_name: { x: 840, y: 1200, width: 800, height: 60, fontSize: 48, bold: true },
      course_date: { x: 840, y: 2000, width: 800, height: 60, fontSize: 36 },
      course_duration: { x: 840, y: 2400, width: 800, height: 60, fontSize: 32 },
      trainer_name: { x: 840, y: 2800, width: 800, height: 50, fontSize: 32 }
    };

    const config = defaultConfigs[fieldName] || {};

    const newField: CertificateField = {
      id: fieldName,
      name: fieldName,
      label: fieldLabel,
      type: 'text',
      x: config.x || 100,
      y: config.y || 100,
      width: config.width || 800,
      height: config.height || 60,
      fontSize: config.fontSize || 32,
      fontFamily: 'Arial',
      color: '#333333',
      align: 'center',
      bold: config.bold || false,
      italic: false
    };

    const fields = [...((editingTemplate.fields_config || []) as CertificateField[]), newField];
    setEditingTemplate({
      ...editingTemplate,
      fields_config: fields
    });
  }

  function getFieldType(fieldName: string): 'system' | 'course' | 'custom' {
    const systemFields = ['candidate_name', 'certificate_number', 'course_name', 'course_date', 'course_duration', 'trainer_name'];
    if (systemFields.includes(fieldName)) return 'system';

    const courseTypeId = editingTemplate?.course_type_id || selectedCourseType;
    const courseType = courseTypes.find(ct => ct.id === courseTypeId);
    const courseFieldNames = (courseType?.required_fields || []).map(f => f.name);
    if (courseFieldNames.includes(fieldName)) return 'course';

    return 'custom';
  }

  function addAllCourseFields() {
    const availableFields = getAvailableCourseFields();
    if (!editingTemplate || availableFields.length === 0) return;

    const fields = (editingTemplate.fields_config || []) as CertificateField[];
    const baseY = 2200;

    const newFields: CertificateField[] = availableFields.map((courseField, index) => ({
      id: courseField.name,
      name: courseField.name,
      label: courseField.label,
      type: 'text',
      x: 840,
      y: baseY + ((fields.length + index) * 120),
      width: 800,
      height: 60,
      fontSize: 32,
      fontFamily: 'Arial',
      color: '#333333',
      align: 'center',
      bold: false,
      italic: false
    }));

    setEditingTemplate({
      ...editingTemplate,
      fields_config: [...fields, ...newFields]
    });
  }

  function removeField(fieldId: string) {
    if (!editingTemplate) return;

    const fields = (editingTemplate.fields_config || []) as CertificateField[];
    setEditingTemplate({
      ...editingTemplate,
      fields_config: fields.filter(f => f.id !== fieldId)
    });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }

  function handleFieldMouseDown(e: React.MouseEvent, fieldId: string) {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  }

  function handleResizeMouseDown(e: React.MouseEvent, fieldId: string, direction: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's') {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setResizing(direction);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });

    // Capture initial field state for proportional resizing
    const fields = (editingTemplate?.fields_config || []) as CertificateField[];
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setInitialFieldState({
        width: field.width,
        height: field.height,
        x: field.x,
        y: field.y,
        fontSize: field.fontSize
      });
    }
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragging && !resizing) return;
      if (!selectedFieldId || !editingTemplate) return;

      const fields = (editingTemplate.fields_config || []) as CertificateField[];
      const field = fields.find(f => f.id === selectedFieldId);
      if (!field) return;

      const deltaX = (e.clientX - dragStart.x) / PREVIEW_SCALE;
      const deltaY = (e.clientY - dragStart.y) / PREVIEW_SCALE;

      if (dragging) {
        updateField(selectedFieldId, {
          x: Math.max(0, Math.min(A4_WIDTH - field.width, field.x + deltaX)),
          y: Math.max(0, Math.min(A4_HEIGHT - field.height, field.y + deltaY))
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (resizing && initialFieldState) {
        // Calculate total delta from start of resize
        const totalDeltaX = (e.clientX - dragStart.x) / PREVIEW_SCALE;
        const totalDeltaY = (e.clientY - dragStart.y) / PREVIEW_SCALE;

        let newWidth = initialFieldState.width;
        let newHeight = initialFieldState.height;
        let newX = initialFieldState.x;
        let newY = initialFieldState.y;

        // Handle different resize directions
        switch (resizing) {
          case 'se': // Southeast - drag bottom-right
            newWidth = Math.max(50, initialFieldState.width + totalDeltaX);
            newHeight = Math.max(20, initialFieldState.height + totalDeltaY);
            break;
          case 'sw': // Southwest - drag bottom-left
            newWidth = Math.max(50, initialFieldState.width - totalDeltaX);
            newHeight = Math.max(20, initialFieldState.height + totalDeltaY);
            newX = initialFieldState.x + (initialFieldState.width - newWidth);
            break;
          case 'ne': // Northeast - drag top-right
            newWidth = Math.max(50, initialFieldState.width + totalDeltaX);
            newHeight = Math.max(20, initialFieldState.height - totalDeltaY);
            newY = initialFieldState.y + (initialFieldState.height - newHeight);
            break;
          case 'nw': // Northwest - drag top-left
            newWidth = Math.max(50, initialFieldState.width - totalDeltaX);
            newHeight = Math.max(20, initialFieldState.height - totalDeltaY);
            newX = initialFieldState.x + (initialFieldState.width - newWidth);
            newY = initialFieldState.y + (initialFieldState.height - newHeight);
            break;
          case 'e': // East - drag right edge
            newWidth = Math.max(50, initialFieldState.width + totalDeltaX);
            break;
          case 'w': // West - drag left edge
            newWidth = Math.max(50, initialFieldState.width - totalDeltaX);
            newX = initialFieldState.x + (initialFieldState.width - newWidth);
            break;
          case 'n': // North - drag top edge
            newHeight = Math.max(20, initialFieldState.height - totalDeltaY);
            newY = initialFieldState.y + (initialFieldState.height - newHeight);
            break;
          case 's': // South - drag bottom edge
            newHeight = Math.max(20, initialFieldState.height + totalDeltaY);
            break;
        }

        // Constrain to canvas
        newX = Math.max(0, Math.min(A4_WIDTH - newWidth, newX));
        newY = Math.max(0, Math.min(A4_HEIGHT - newHeight, newY));

        // Scale font size proportionally with height change
        const heightRatio = newHeight / initialFieldState.height;
        const newFontSize = Math.round(Math.max(8, Math.min(200, initialFieldState.fontSize * heightRatio)));

        updateField(selectedFieldId, {
          width: newWidth,
          height: newHeight,
          x: newX,
          y: newY,
          fontSize: newFontSize
        });
      }
    }

    function handleMouseUp() {
      setDragging(false);
      setResizing(false);
      setInitialFieldState(null);
    }

    if (dragging || resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, selectedFieldId, dragStart, editingTemplate, initialFieldState]);

  const selectedField = selectedFieldId
    ? ((editingTemplate?.fields_config || []) as CertificateField[]).find(f => f.id === selectedFieldId)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  if (showEditor && editingTemplate) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
        <header className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between max-w-[1800px] mx-auto">
            <div>
              <h1 className="text-xl font-semibold tracking-wide">
                CERTIFICATE TEMPLATE EDITOR
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {editingTemplate.id ? 'Edit' : 'Create'} certificate template (A4 size: 2480x3508px)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveTemplate}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingTemplate(null);
                  setSelectedFieldId(null);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1800px] mx-auto px-6 py-6">
          {editingTemplate.id && getAvailableCourseFields().length > 0 && (
            <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-300 mb-1">
                      New Course Fields Available
                    </h4>
                    <p className="text-sm text-emerald-400/80">
                      {getAvailableCourseFields().length} {getAvailableCourseFields().length === 1 ? 'field has' : 'fields have'} been added to the course type and {getAvailableCourseFields().length === 1 ? 'is' : 'are'} not yet in this template.
                    </p>
                  </div>
                </div>
                <button
                  onClick={addAllCourseFields}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add All Fields
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[320px_1fr_320px] gap-6">
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-4">
                  Template Settings
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Template Name</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Course Type</label>
                    {showCourseTypeChanger ? (
                      <div className="space-y-2">
                        <select
                          value={newCourseTypeId}
                          onChange={(e) => setNewCourseTypeId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        >
                          {courseTypes.map(type => (
                            <option key={type.id} value={type.id}>
                              {type.name} ({type.code})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={promptChangeCourseType}
                            className="flex-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => setShowCourseTypeChanger(false)}
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white">
                          {courseTypes.find(ct => ct.id === editingTemplate.course_type_id)?.name || 'Unknown'} (
                          {courseTypes.find(ct => ct.id === editingTemplate.course_type_id)?.code || 'N/A'})
                        </div>
                        <button
                          onClick={openCourseTypeChanger}
                          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Change Course Type
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Background Image</label>
                    {editingTemplate.background_image_url ? (
                      <div className="space-y-2">
                        <img
                          src={editingTemplate.background_image_url}
                          alt="Background"
                          className="w-full h-32 object-cover rounded border border-slate-300 dark:border-slate-700"
                        />
                        <label className="flex items-center justify-center gap-2 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded cursor-pointer transition-colors">
                          <Upload className="w-3 h-3" />
                          Change Background
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handleBackgroundUpload(e.target.files[0])}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 px-3 py-2 text-sm border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded cursor-pointer transition-colors h-32">
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Upload A4 Background'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleBackgroundUpload(e.target.files[0])}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                      Recommended: 2480x3508px (A4 at 300 DPI)
                    </p>
                  </div>
                </div>
              </div>

              {getAvailableSystemFields().length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <ListPlus className="w-4 h-4" />
                      Available System Fields
                    </h3>
                    <span className="text-xs text-blue-600/70 dark:text-blue-400/70 bg-blue-500/20 px-2 py-1 rounded">
                      {getAvailableSystemFields().length} available
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {getAvailableSystemFields().map((field) => (
                      <div
                        key={field.name}
                        className="p-3 rounded border border-blue-500/30 bg-slate-50/50 dark:bg-slate-950/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">{field.label}</div>
                            <div className="text-xs text-blue-600/60 dark:text-blue-400/60 mt-1">
                              <span className="inline-block px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
                                system
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => addSystemField(field.name, field.label)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getAvailableCourseFields().length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <ListPlus className="w-4 h-4" />
                      Available Course Fields
                    </h3>
                    <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 bg-emerald-500/20 px-2 py-1 rounded">
                      {getAvailableCourseFields().length} available
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {getAvailableCourseFields().map((field) => (
                      <div
                        key={field.name}
                        className="p-3 rounded border border-emerald-500/30 bg-slate-50/50 dark:bg-slate-950/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{field.label}</div>
                            <div className="text-xs text-emerald-600/60 dark:text-emerald-400/60 mt-1">
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                                {field.scope}
                              </span>
                              {field.required && (
                                <span className="inline-block ml-1 px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400">
                                  required
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => addCourseTypeField(field)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider">Certificate Fields</h3>
                  <button
                    onClick={addCustomField}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Field
                  </button>
                </div>

                <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto">
                  {((editingTemplate.fields_config || []) as CertificateField[]).map((field) => {
                    const fieldType = getFieldType(field.name);
                    const badgeColors = {
                      system: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
                      course: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
                      custom: 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                    };
                    const badgeLabels = {
                      system: 'System',
                      course: 'Course',
                      custom: 'Custom'
                    };

                    return (
                      <div
                        key={field.id}
                        onClick={() => setSelectedFieldId(field.id)}
                        className={`p-3 rounded border cursor-pointer transition-colors ${
                          selectedFieldId === field.id
                            ? 'bg-blue-500/20 border-blue-500'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium truncate">{field.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColors[fieldType]} whitespace-nowrap`}>
                              {badgeLabels[fieldType]}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {field.width}x{field.height}px at ({field.x}, {field.y})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider">Preview (25% scale)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Click and drag fields to position them</p>
              </div>
              <div
                ref={previewRef}
                className="relative border border-slate-300 dark:border-slate-700 mx-auto bg-white cursor-crosshair"
                style={{
                  width: `${A4_WIDTH * PREVIEW_SCALE}px`,
                  height: `${A4_HEIGHT * PREVIEW_SCALE}px`,
                  backgroundImage: editingTemplate.background_image_url ? `url(${editingTemplate.background_image_url})` : 'none',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center'
                }}
                onClick={() => setSelectedFieldId(null)}
              >
                {((editingTemplate.fields_config || []) as CertificateField[]).map((field) => (
                  <div
                    key={field.id}
                    className={`absolute group ${
                      selectedFieldId === field.id ? 'ring-2 ring-blue-500 z-10' : 'hover:ring-2 hover:ring-blue-400'
                    }`}
                    style={{
                      left: `${field.x * PREVIEW_SCALE}px`,
                      top: `${field.y * PREVIEW_SCALE}px`,
                      width: `${field.width * PREVIEW_SCALE}px`,
                      height: `${field.height * PREVIEW_SCALE}px`,
                      cursor: dragging ? 'grabbing' : 'grab'
                    }}
                    onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="w-full h-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center"
                      style={{
                        fontSize: `${field.fontSize * PREVIEW_SCALE}px`,
                        fontFamily: field.fontFamily,
                        color: field.color,
                        textAlign: field.align,
                        fontWeight: field.bold ? 'bold' : 'normal',
                        fontStyle: field.italic ? 'italic' : 'normal'
                      }}
                    >
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded pointer-events-none">
                        {field.label}
                      </span>
                    </div>
                    {selectedFieldId === field.id && (
                      <>
                        {/* Corner handles */}
                        <div
                          className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nwse-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')}
                        />
                        <div
                          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nesw-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')}
                        />
                        <div
                          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nesw-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')}
                        />
                        <div
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white cursor-nwse-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')}
                        />
                        {/* Edge handles */}
                        <div
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-blue-500 border border-white cursor-ns-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'n')}
                        />
                        <div
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-blue-500 border border-white cursor-ns-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 's')}
                        />
                        <div
                          className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-4 bg-blue-500 border border-white cursor-ew-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'w')}
                        />
                        <div
                          className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-4 bg-blue-500 border border-white cursor-ew-resize rounded-sm"
                          onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'e')}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {selectedField ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Field Properties
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedField.label}
                        onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">X Position</label>
                        <input
                          type="number"
                          value={selectedField.x}
                          onChange={(e) => updateField(selectedField.id, { x: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Y Position</label>
                        <input
                          type="number"
                          value={selectedField.y}
                          onChange={(e) => updateField(selectedField.id, { y: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Width</label>
                        <input
                          type="number"
                          value={selectedField.width}
                          onChange={(e) => updateField(selectedField.id, { width: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Height</label>
                        <input
                          type="number"
                          value={selectedField.height}
                          onChange={(e) => updateField(selectedField.id, { height: parseInt(e.target.value) || 40 })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Font Size</label>
                      <input
                        type="number"
                        value={selectedField.fontSize}
                        onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) || 16 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                        <Palette className="w-3 h-3" />
                        Text Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedField.color}
                          onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                          className="w-12 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedField.color}
                          onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm font-mono text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Text Alignment</label>
                      <select
                        value={selectedField.align}
                        onChange={(e) => updateField(selectedField.id, { align: e.target.value as 'left' | 'center' | 'right' })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Font Family</label>
                      <select
                        value={selectedField.fontFamily}
                        onChange={(e) => updateField(selectedField.id, { fontFamily: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Verdana">Verdana</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedField.bold}
                          onChange={(e) => updateField(selectedField.id, { bold: e.target.checked })}
                          className="rounded"
                        />
                        Bold
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedField.italic}
                          onChange={(e) => updateField(selectedField.id, { italic: e.target.checked })}
                          className="rounded"
                        />
                        Italic
                      </label>
                    </div>

                    <button
                      onClick={() => removeField(selectedField.id)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-4 text-sm bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Field
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    Select a field to edit its properties
                  </p>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-2">Tips</h4>
                <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 space-y-1">
                  <li>• Click and drag fields to move them</li>
                  <li>• Drag the corner handle to resize</li>
                  <li>• Use the properties panel for precise control</li>
                  <li>• A4 size is 2480x3508 pixels at 300 DPI</li>
                </ul>
              </div>
            </div>
          </div>
        </main>

        {showCourseTypeConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Change course type to "{courseTypes.find(ct => ct.id === newCourseTypeId)?.name}"?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Note: Course-specific fields from the old course type may no longer be valid. You can remove them and add new course fields from the available fields panel.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={cancelChangeCourseType}
                    className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangeCourseType}
                    className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Select Course Type</label>
          <select
            value={selectedCourseType || ''}
            onChange={(e) => setSelectedCourseType(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
          >
            {courseTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Templates</h2>
          <button
            onClick={createNewTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
            >
              <div className="aspect-[2480/3508] bg-slate-100 dark:bg-slate-950 rounded mb-3 overflow-hidden">
                {template.background_image_url ? (
                  <img
                    src={template.background_image_url}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                    No Background
                  </div>
                )}
              </div>
              <h3 className="font-semibold mb-1">{template.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {(template.fields_config as CertificateField[]).length} fields configured
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => editTemplate(template)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicateTemplate(template.id)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors"
                  title="Duplicate this template"
                >
                  <Copy className="w-3 h-3" />
                  Duplicate
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <p>No templates created yet for this course type</p>
            <button
              onClick={createNewTemplate}
              className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            >
              Create First Template
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
