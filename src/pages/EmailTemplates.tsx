import { useEffect, useState } from 'react';
import { Mail, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import type { EmailTemplate } from '../lib/email';

interface EmailTemplatesProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function EmailTemplates({ currentPage, onNavigate }: EmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading templates:', error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }

  async function handleDeleteTemplate(template: EmailTemplate) {
    if (template.is_core) {
      alert('Core email templates cannot be deleted. They can only be edited.');
      return;
    }

    if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', template.id);

    if (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    } else {
      loadTemplates();
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />
      <div className="border-b border-slate-800 px-6 py-3 bg-slate-900/50">
        <div className="flex items-center justify-end gap-3 max-w-7xl mx-auto">
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No email templates yet</p>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <span className="px-2 py-1 text-xs bg-slate-800 rounded-full font-mono">
                        {template.template_key}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{template.description}</p>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-500">Subject:</span>
                        <p className="text-sm text-slate-300 mt-1">{template.subject_template}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-500">Body Preview:</span>
                        <p className="text-sm text-slate-300 mt-1 line-clamp-2">
                          {template.body_text || template.body_html.replace(/<[^>]*>/g, '')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowModal(true);
                      }}
                      className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit template"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={template.is_core}
                      className={`p-2 rounded-lg transition-colors ${
                        template.is_core
                          ? 'opacity-50 cursor-not-allowed text-slate-600'
                          : 'hover:bg-red-900/50 text-red-400'
                      }`}
                      title={template.is_core ? 'Core templates cannot be deleted' : 'Delete template'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <TemplateModal
            template={editingTemplate}
            onClose={() => {
              setShowModal(false);
              setEditingTemplate(null);
            }}
            onSave={() => {
              loadTemplates();
              setShowModal(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onSave,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    template_key: template?.template_key || '',
    name: template?.name || '',
    subject_template: template?.subject_template || '',
    body_html: template?.body_html || '',
    body_text: template?.body_text || '',
    description: template?.description || '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (template) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: formData.name,
            subject_template: formData.subject_template,
            body_html: formData.body_html,
            body_text: formData.body_text,
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({
            template_key: formData.template_key,
            name: formData.name,
            subject_template: formData.subject_template,
            body_html: formData.body_html,
            body_text: formData.body_text,
            description: formData.description,
          });

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-semibold uppercase tracking-wider">
            {template ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Insurance Expiry Reminder"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Template Key * {template && '(cannot be changed)'}
              </label>
              <input
                type="text"
                required
                disabled={!!template}
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="insurance_expiry_reminder"
              />
              <p className="text-xs text-slate-500 mt-1">Unique identifier (use underscores)</p>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="Brief description of when this template is used"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Subject Template *
            </label>
            <input
              type="text"
              required
              value={formData.subject_template}
              onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="Insurance Document Expiry - {{trainer_name}}"
            />
            <p className="text-xs text-slate-500 mt-1">
              Use {`{{placeholder}}`} for dynamic values (e.g., {`{{trainer_name}}, {{expiry_date}}`})
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              HTML Body *
            </label>
            <textarea
              required
              rows={12}
              value={formData.body_html}
              onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
              placeholder="<html><body>Hi {{trainer_name}}, ...</body></html>"
            />
            <p className="text-xs text-slate-500 mt-1">
              HTML version of the email with styling
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Plain Text Body
            </label>
            <textarea
              rows={8}
              value={formData.body_text}
              onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="Hi {{trainer_name}}, ..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Plain text fallback (optional, will use HTML if not provided)
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Available Placeholders:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <code className="bg-slate-900 px-2 py-1 rounded">{`{{trainer_name}}`}</code>
              <code className="bg-slate-900 px-2 py-1 rounded">{`{{trainer_type}}`}</code>
              <code className="bg-slate-900 px-2 py-1 rounded">{`{{email}}`}</code>
              <code className="bg-slate-900 px-2 py-1 rounded">{`{{telephone}}`}</code>
              <code className="bg-slate-900 px-2 py-1 rounded">{`{{expiry_date}}`}</code>
              <code className="bg-slate-900 px-2 py-1 rounded">{`{{expiry_status}}`}</code>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
