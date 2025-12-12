import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Search, Plus, X, Upload, FileText, Trash2, Filter, Mail, Send } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
import { sendEmail, sendTemplateEmail, getEmailTemplates, type EmailTemplate } from '../lib/email';
import { getTrainerTypesForMultipleTrainers, type TrainerType as LibTrainerType } from '../lib/trainer-types';
import PageHeader from '../components/PageHeader';

interface TrainerType {
  id: string;
  name: string;
}

interface ExtendedTrainer extends Trainer {
  assigned_types?: LibTrainerType[];
}

interface TrainerMapProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function TrainerMap({ currentPage, onNavigate }: TrainerMapProps) {
  const [trainers, setTrainers] = useState<ExtendedTrainer[]>([]);
  const [trainerTypes, setTrainerTypes] = useState<TrainerType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');
  const [searchPostcode, setSearchPostcode] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [currentSort, setCurrentSort] = useState<{
    mode: 'none' | 'distance';
    origin: { lat: number; lng: number } | null;
  }>({ mode: 'none', origin: null });
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailingTrainer, setEmailingTrainer] = useState<Trainer | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    loadTrainerTypes();
    loadTrainers();
  }, []);

  useEffect(() => {
    loadTrainers();
  }, [selectedTypeId]);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([54.5, -3], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(mapRef.current);

      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && markersLayerRef.current) {
      renderMarkers();
    }
  }, [trainers]);

  async function loadTrainerTypes() {
    const { data, error } = await supabase
      .from('trainer_types')
      .select('id, name')
      .order('sort_order, name');

    if (error) {
      console.error('Error loading trainer types:', error);
      return;
    }

    setTrainerTypes(data || []);
  }

  async function loadTrainers() {
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .eq('suspended', false)
      .order('name');

    if (error) {
      console.error('Error loading trainers:', error);
      return;
    }

    const trainerIds = (data || []).map(t => t.id);
    const trainerTypesMap = await getTrainerTypesForMultipleTrainers(trainerIds);

    const trainersWithTypes = (data || []).map(trainer => ({
      ...trainer,
      assigned_types: trainerTypesMap[trainer.id] || []
    }));

    setTrainers(trainersWithTypes);
  }

  function renderMarkers() {
    if (!markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const displayTrainers = trainers.filter(
      trainer => selectedTypeId === 'all' || trainer.assigned_types?.some(at => at.id === selectedTypeId)
    );

    displayTrainers.forEach((trainer) => {
      if (!trainer.latitude || !trainer.longitude) return;

      const marker = L.marker([trainer.latitude, trainer.longitude]).addTo(
        markersLayerRef.current!
      );

      const trucksHtml =
        trainer.truck_types && trainer.truck_types.length
          ? `<ul style="font-size: 0.75rem; columns: 2; column-gap: 12px; margin: 8px 0;">${trainer.truck_types
              .map((tt) => `<li>${tt}</li>`)
              .join('')}</ul>`
          : '<em>No MHE types recorded</em>';

      const proBits = [];
      if (trainer.day_rate) proBits.push(`Day rate £${Number(trainer.day_rate).toFixed(2)}`);
      if (trainer.rtitb_number) proBits.push(`RTITB ${trainer.rtitb_number}`);
      if (trainer.rtitb_expiry) proBits.push(`RTITB expiry: ${trainer.rtitb_expiry}`);
      if (trainer.insurance_expiry)
        proBits.push(`Insurance expiry: ${trainer.insurance_expiry}`);

      const proHtml = proBits.length
        ? `<p style="font-size: 0.75rem; margin: 4px 0;"><strong>Details:</strong> ${proBits.join(' · ')}</p>`
        : '';

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif;">
          <h3 style="margin: 0 0 8px; font-size: 0.95rem;">${trainer.name}</h3>
          ${trainer.telephone ? `<p style="margin: 4px 0; font-size: 0.8rem;"><strong>Tel:</strong> ${trainer.telephone}</p>` : ''}
          ${trainer.email ? `<p style="margin: 4px 0; font-size: 0.8rem;"><strong>Email:</strong> <a href="mailto:${trainer.email}">${trainer.email}</a></p>` : ''}
          ${proHtml}
          <p style="margin: 8px 0 4px; font-size: 0.8rem;"><strong>MHE types:</strong></p>
          ${trucksHtml}
        </div>
      `;

      marker.bindPopup(popupHtml);
    });
  }

  function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function isInsuranceExpired(trainer: Trainer) {
    if (!trainer.insurance_expiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(trainer.insurance_expiry);
    return exp < today;
  }

  function isInsuranceDueSoon(trainer: Trainer) {
    if (!trainer.insurance_expiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(trainer.insurance_expiry);
    if (isNaN(exp.getTime())) return false;
    const cutoff = new Date(today);
    cutoff.setMonth(cutoff.getMonth() + 3);
    return exp >= today && exp <= cutoff;
  }

  function isRTITBExpired(trainer: Trainer) {
    if (!trainer.rtitb_expiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(trainer.rtitb_expiry);
    return exp < today;
  }

  async function geocodeAddress(parts: string[]) {
    const query = parts.filter(Boolean).join(', ') + ', UK';
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=' +
      encodeURIComponent(query);

    const res = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) throw new Error('Geocoding request failed');

    const data = await res.json();
    if (!data || data.length === 0) {
      throw new Error('No results for that address/postcode');
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error('Invalid coordinates returned');
    }
    return { latitude: lat, longitude: lon };
  }

  async function handlePostcodeSearch() {
    const pc = searchPostcode.trim();
    if (!pc) {
      setCurrentSort({ mode: 'none', origin: null });
      setSearchStatus('Showing all trainers.');
      if (originMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      return;
    }

    setSearchStatus('Searching...');
    try {
      const geo = await geocodeAddress([pc]);
      setCurrentSort({
        mode: 'distance',
        origin: { lat: geo.latitude, lng: geo.longitude }
      });

      const originIcon = new L.Icon({
        iconUrl:
          'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      if (originMarkerRef.current && mapRef.current) {
        originMarkerRef.current.setLatLng([geo.latitude, geo.longitude]);
      } else if (mapRef.current) {
        originMarkerRef.current = L.marker([geo.latitude, geo.longitude], {
          icon: originIcon
        })
          .addTo(mapRef.current)
          .bindPopup('Search location: ' + pc.toUpperCase());
      }

      setSearchStatus('Sorted by distance from ' + pc.toUpperCase());
      if (mapRef.current) {
        mapRef.current.setView([geo.latitude, geo.longitude], 7);
      }
    } catch (err) {
      console.error(err);
      setSearchStatus('');
      alert("Couldn't find that postcode. Please check it and try again.");
    }
  }

  function getSortedTrainers() {
    let list = trainers.filter(
      trainer => selectedTypeId === 'all' || trainer.assigned_types?.some(at => at.id === selectedTypeId)
    );

    if (currentSort.mode === 'distance' && currentSort.origin) {
      const org = currentSort.origin;
      list.sort((a, b) => {
        const da =
          a.latitude && a.longitude
            ? distanceKm(org.lat, org.lng, a.latitude, a.longitude)
            : Number.POSITIVE_INFINITY;
        const db =
          b.latitude && b.longitude
            ? distanceKm(org.lat, org.lng, b.latitude, b.longitude)
            : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }

    return list;
  }

  function getExpiredAndDueSoonTrainers() {
    return trainers
      .filter(
        (t) =>
          t.insurance_expiry &&
          (isInsuranceExpired(t) || isInsuranceDueSoon(t))
      )
      .sort(
        (a, b) =>
          new Date(a.insurance_expiry!).getTime() -
          new Date(b.insurance_expiry!).getTime()
      );
  }

  function handleTrainerCardClick(trainer: Trainer) {
    if (trainer.latitude && trainer.longitude && mapRef.current) {
      mapRef.current.setView([trainer.latitude, trainer.longitude], 11);
    }
  }

  async function handleDeleteTrainer(trainer: Trainer) {
    if (!confirm(`Delete trainer "${trainer.name}"?`)) return;

    const { error } = await supabase
      .from('trainers')
      .delete()
      .eq('id', trainer.id);

    if (error) {
      console.error('Error deleting trainer:', error);
      alert('Could not delete trainer');
      return;
    }

    await loadTrainers();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHeader currentPage={currentPage} onNavigate={onNavigate} />

      <div className="border-b border-slate-800 px-6 py-3 bg-slate-900/50">
        <div className="flex items-center justify-end gap-3 max-w-[1600px] mx-auto">
          <button
            onClick={() => setShowInsuranceModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Insurance monitor
          </button>
          <button
            onClick={() => document.getElementById('searchSection')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search by postcode
          </button>
          <button
            onClick={() => {
              setEditingTrainer(null);
              setShowTrainerModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add trainer
          </button>
        </div>
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 p-4 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Filter by trainer type
              </h2>
              <Filter className="w-4 h-4 text-slate-400" />
            </div>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All trainer types</option>
              {trainerTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {selectedTypeId !== 'all' && (
              <button
                onClick={() => setSelectedTypeId('all')}
                className="mt-2 text-xs text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear filter
              </button>
            )}
          </section>

          <section
            id="searchSection"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Search by postcode
              </h2>
              <span className="text-xs text-slate-400">
                Sort trainers by distance from a customer site
              </span>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={searchPostcode}
                onChange={(e) => setSearchPostcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSearch()}
                placeholder="e.g. CV11 5DQ"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handlePostcodeSearch}
                className="px-4 py-2 text-sm border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Go
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Leave blank and click Go to clear the search and show all trainers.
            </p>
            {searchStatus && (
              <p className="text-xs text-slate-300">{searchStatus}</p>
            )}
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Trainers
              </h2>
              <span className="text-xs text-slate-400">
                Click a trainer to focus the map
              </span>
            </div>
            <div className="space-y-3">
              {getSortedTrainers().map((trainer) => {
                const insuranceExpired = isInsuranceExpired(trainer);
                const rtitbExpired = isRTITBExpired(trainer);

                let distanceText = '';
                if (
                  currentSort.mode === 'distance' &&
                  currentSort.origin &&
                  trainer.latitude &&
                  trainer.longitude
                ) {
                  const dKm = distanceKm(
                    currentSort.origin.lat,
                    currentSort.origin.lng,
                    trainer.latitude,
                    trainer.longitude
                  );
                  const dMiles = dKm * 0.621371;
                  distanceText = dMiles.toFixed(1) + ' miles away';
                }

                return (
                  <div
                    key={trainer.id}
                    onClick={() => handleTrainerCardClick(trainer)}
                    className={`bg-slate-950 border rounded-xl p-3 cursor-pointer hover:border-blue-500 transition-colors relative ${
                      insuranceExpired || rtitbExpired
                        ? 'border-red-500/80'
                        : 'border-slate-800'
                    }`}
                  >
                    {(insuranceExpired || rtitbExpired) && (
                      <div className="absolute top-2 right-2 text-xs px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/50 rounded-full">
                        {insuranceExpired && rtitbExpired
                          ? 'Insurance & RTITB expired'
                          : insuranceExpired
                          ? 'Insurance expired'
                          : 'RTITB expired'}
                      </div>
                    )}
                    <h3 className="font-semibold text-sm mb-1">{trainer.name}</h3>
                    <p className="text-xs text-slate-400 mb-1">
                      {[
                        [trainer.town, trainer.postcode].filter(Boolean).join(' · '),
                        distanceText
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="text-xs text-slate-400 mb-1">
                      {[trainer.telephone, trainer.email].filter(Boolean).join(' · ')}
                    </p>
                    {trainer.truck_types && trainer.truck_types.length > 0 && (
                      <p className="text-xs text-slate-300 mt-2">
                        MHE: {trainer.truck_types.slice(0, 3).join(', ')}
                        {trainer.truck_types.length > 3 && ` +${trainer.truck_types.length - 3} more`}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      {trainer.email && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmailingTrainer(trainer);
                            setShowEmailModal(true);
                          }}
                          className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/50 rounded-full hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          Email
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTrainer(trainer);
                          setShowTrainerModal(true);
                        }}
                        className="px-3 py-1 text-xs border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTrainer(trainer);
                        }}
                        className="px-3 py-1 text-xs bg-red-500/20 text-red-300 border border-red-500/50 rounded-full hover:bg-red-900 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[calc(100vh-140px)] relative z-0">
          <div ref={mapContainerRef} className="w-full h-full" />
        </section>
      </main>

      {showInsuranceModal && (
        <InsuranceModal
          trainers={getExpiredAndDueSoonTrainers()}
          onClose={() => setShowInsuranceModal(false)}
          isExpired={isInsuranceExpired}
          isDueSoon={isInsuranceDueSoon}
        />
      )}

      {showTrainerModal && (
        <TrainerModal
          trainer={editingTrainer}
          onClose={() => {
            setShowTrainerModal(false);
            setEditingTrainer(null);
          }}
          onSave={() => {
            loadTrainers();
            setShowTrainerModal(false);
            setEditingTrainer(null);
          }}
          geocodeAddress={geocodeAddress}
          trainerTypes={trainerTypes}
        />
      )}

      {showEmailModal && emailingTrainer && (
        <EmailModal
          trainer={emailingTrainer}
          onClose={() => {
            setShowEmailModal(false);
            setEmailingTrainer(null);
          }}
        />
      )}
    </div>
  );
}

function InsuranceModal({
  trainers,
  onClose,
  isExpired,
  isDueSoon
}: {
  trainers: Trainer[];
  onClose: () => void;
  isExpired: (t: Trainer) => boolean;
  isDueSoon: (t: Trainer) => boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100]"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider">
              Insurance Monitor
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Expired or due within 3 months
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {trainers.length === 0 ? (
          <p className="text-sm text-slate-400">
            No insurance expiries (expired or due within 3 months) recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {trainers.map((trainer) => {
              const expired = isExpired(trainer);
              const dueSoon = isDueSoon(trainer);

              return (
                <div
                  key={trainer.id}
                  className={`border rounded-xl p-4 ${
                    expired
                      ? 'border-red-500/80 bg-red-950/20'
                      : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{trainer.name}</h3>
                    {expired && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/50 rounded-full">
                        Expired
                      </span>
                    )}
                    {!expired && dueSoon && (
                      <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded-full">
                        Due within 3 months
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-2">
                    {[trainer.telephone, trainer.email].filter(Boolean).join(' · ')}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      Insurance expiry: {trainer.insurance_expiry}
                    </span>
                    {trainer.email && (
                      <a
                        href={`mailto:${trainer.email}?subject=${encodeURIComponent(
                          'Insurance documents / expiry'
                        )}&body=${encodeURIComponent('Hi ' + trainer.name + ',')}`}
                        className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/50 rounded-full hover:bg-blue-500/30 transition-colors"
                      >
                        Email trainer
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TrainerModal({
  trainer,
  onClose,
  onSave,
  geocodeAddress,
  trainerTypes
}: {
  trainer: Trainer | null;
  onClose: () => void;
  onSave: () => void;
  geocodeAddress: (parts: string[]) => Promise<{ latitude: number; longitude: number }>;
  trainerTypes: TrainerType[];
}) {
  const [formData, setFormData] = useState({
    name: trainer?.name || '',
    trainer_type_id: trainer?.trainer_type_id || '',
    address1: trainer?.address1 || '',
    address2: trainer?.address2 || '',
    town: trainer?.town || '',
    postcode: trainer?.postcode || '',
    telephone: trainer?.telephone || '',
    email: trainer?.email || '',
    day_rate: trainer?.day_rate?.toString() || ''
  });

  const [attributes, setAttributes] = useState<TrainerAttribute[]>([]);
  const [attributeOptions, setAttributeOptions] = useState<Record<string, AttributeOption[]>>({});
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formData.trainer_type_id) {
      loadAttributesForTrainerType(formData.trainer_type_id);
    } else {
      setAttributes([]);
      setAttributeOptions({});
      setAttributeValues({});
    }
  }, [formData.trainer_type_id]);

  useEffect(() => {
    if (trainer?.id && attributes.length > 0) {
      loadExistingAttributeValues();
    }
  }, [trainer?.id, attributes]);

  async function loadAttributesForTrainerType(typeId: string) {
    const attrs = await loadAttributesForType(typeId);
    console.log('Loaded attributes for type:', typeId, attrs);
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

  async function handleFileUpload(trainerId: string) {
    if (!insuranceFile) return { fileName: '', url: '' };

    setUploadingFile(true);
    try {
      const fileExt = insuranceFile.name.split('.').pop();
      const fileName = `${trainerId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('insurance-documents')
        .upload(filePath, insuranceFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('insurance-documents')
        .getPublicUrl(filePath);

      return { fileName: insuranceFile.name, url: publicUrl };
    } catch (err) {
      console.error('Error uploading file:', err);
      throw err;
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDeleteInsuranceFile() {
    if (!trainer?.insurance_url) return;

    if (!confirm('Delete the current insurance document?')) return;

    try {
      const fileName = trainer.insurance_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('insurance-documents')
          .remove([fileName]);
      }

      await supabase
        .from('trainers')
        .update({
          insurance_file_name: '',
          insurance_url: '',
          updated_at: new Date().toISOString()
        })
        .eq('id', trainer.id);

      onSave();
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('Could not delete the file.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a trainer name.');
      return;
    }
    if (!formData.postcode.trim()) {
      alert('Please enter a UK postcode.');
      return;
    }

    setSaving(true);

    try {
      const geo = await geocodeAddress([
        formData.address1,
        formData.address2,
        formData.town,
        formData.postcode
      ]);

      let insuranceFileData = {
        fileName: trainer?.insurance_file_name || '',
        url: trainer?.insurance_url || ''
      };

      let trainerId = trainer?.id || '';

      if (!trainer) {
        const tempPayload = {
          name: formData.name,
          trainer_type_id: formData.trainer_type_id || null,
          address1: formData.address1,
          address2: formData.address2,
          town: formData.town,
          postcode: formData.postcode,
          telephone: formData.telephone,
          email: formData.email,
          day_rate: formData.day_rate ? parseFloat(formData.day_rate) : null,
          rtitb_number: '',
          rtitb_expiry: null,
          insurance_expiry: null,
          insurance_file_name: '',
          insurance_url: '',
          latitude: geo.latitude,
          longitude: geo.longitude,
          truck_types: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('trainers')
          .insert([tempPayload])
          .select()
          .single();

        if (error || !data) {
          console.error('Error creating trainer:', error);
          alert('Could not save trainer. Please check the postcode and try again.');
          return;
        }

        trainerId = data.id;
      }

      if (insuranceFile) {
        insuranceFileData = await handleFileUpload(trainerId);
      }

      const payload: any = {
        name: formData.name,
        trainer_type_id: formData.trainer_type_id || null,
        address1: formData.address1,
        address2: formData.address2,
        town: formData.town,
        postcode: formData.postcode,
        telephone: formData.telephone,
        email: formData.email,
        day_rate: formData.day_rate ? parseFloat(formData.day_rate) : null,
        rtitb_number: '',
        rtitb_expiry: null,
        insurance_expiry: null,
        insurance_file_name: insuranceFileData.fileName,
        insurance_url: insuranceFileData.url,
        latitude: geo.latitude,
        longitude: geo.longitude,
        truck_types: [],
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('trainers')
        .update(payload)
        .eq('id', trainerId);

      if (error) {
        console.error('Error saving trainer:', error);
        alert('Could not save trainer. Please check the postcode and try again.');
        return;
      }

      if (formData.trainer_type_id && attributes.length > 0) {
        await saveAttributeValues(trainerId, attributes, attributeValues);
      }

      onSave();
    } catch (err) {
      console.error(err);
      alert('Could not save trainer. Please check the postcode and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] p-4"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider">
              {trainer ? 'Edit Trainer' : 'Add Trainer'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Add or update trainer contact, RTITB and insurance info
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Trainer name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Trainer type
            </label>
            <select
              value={formData.trainer_type_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, trainer_type_id: e.target.value }))
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select trainer type</option>
              {trainerTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Telephone
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, telephone: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Address line 1
              </label>
              <input
                type="text"
                value={formData.address1}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address1: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Address line 2
              </label>
              <input
                type="text"
                value={formData.address2}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address2: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Town / City
              </label>
              <input
                type="text"
                value={formData.town}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, town: e.target.value }))
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Postcode
              </label>
              <input
                type="text"
                value={formData.postcode}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, postcode: e.target.value }))
                }
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Agreed day rate (£)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.day_rate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, day_rate: e.target.value }))
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {attributes.length > 0 && (
            <div className="border-t border-slate-800 pt-4 mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3">
                Additional Attributes
              </h3>
            </div>
          )}

          {attributes.map((attr) => (
            <div key={attr.id}>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                {attr.label}
                {attr.is_required && <span className="text-red-400 ml-1">*</span>}
              </label>

              {attr.field_type === 'text' && (
                <input
                  type="text"
                  value={attributeValues[attr.name] || ''}
                  onChange={(e) =>
                    setAttributeValues((prev) => ({
                      ...prev,
                      [attr.name]: e.target.value
                    }))
                  }
                  required={attr.is_required}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              )}

              {attr.field_type === 'date' && (
                <input
                  type="date"
                  value={attributeValues[attr.name] || ''}
                  onChange={(e) =>
                    setAttributeValues((prev) => ({
                      ...prev,
                      [attr.name]: e.target.value
                    }))
                  }
                  required={attr.is_required}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              )}

              {attr.field_type === 'number' && (
                <input
                  type="number"
                  step="0.01"
                  value={attributeValues[attr.name] || ''}
                  onChange={(e) =>
                    setAttributeValues((prev) => ({
                      ...prev,
                      [attr.name]: e.target.value
                    }))
                  }
                  required={attr.is_required}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              )}

              {attr.field_type === 'multiselect' && attributeOptions[attr.id] && (
                <details className="border border-slate-800 rounded-lg bg-slate-950">
                  <summary className="px-3 py-2 cursor-pointer text-sm text-slate-400 flex items-center justify-between">
                    <span>
                      {attr.label} ({(attributeValues[attr.name] || []).length} selected)
                    </span>
                    <span className="text-xs">Click to expand</span>
                  </summary>
                  <div className="border-t border-slate-800 p-3 max-h-64 overflow-y-auto space-y-3">
                    {Object.entries(
                      attributeOptions[attr.id].reduce((acc, opt) => {
                        if (!acc[opt.category]) acc[opt.category] = [];
                        acc[opt.category].push(opt);
                        return acc;
                      }, {} as Record<string, AttributeOption[]>)
                    ).map(([category, options]) => (
                      <div key={category} className="pb-3 border-b border-slate-800 last:border-0">
                        <div className="text-sm font-medium mb-2">{category}</div>
                        <div className="grid grid-cols-2 gap-2">
                          {options.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={(attributeValues[attr.name] || []).includes(opt.code)}
                                onChange={() => toggleMultiselectOption(attr.name, opt.code)}
                                className="rounded"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">
              Insurance documentation
            </label>

            {trainer?.insurance_url ? (
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">
                      {trainer.insurance_file_name || 'Insurance document'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={trainer.insurance_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-xs border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={handleDeleteInsuranceFile}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-300 border border-red-500/50 rounded-full hover:bg-red-500/30 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Upload a new file to replace the existing document
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mb-2">
                No insurance document uploaded
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setInsuranceFile(file);
              }}
              className="hidden"
            />

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {insuranceFile ? 'Change file' : 'Upload document'}
              </button>
              {insuranceFile && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">{insuranceFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInsuranceFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-slate-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Accepted formats: PDF, JPG, PNG (max 10MB)
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || uploadingFile}
            className="w-full px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingFile ? 'Uploading file...' : saving ? (trainer ? 'Updating...' : 'Saving...') : trainer ? 'Update trainer' : 'Save trainer'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmailModal({
  trainer,
  onClose,
}: {
  trainer: Trainer;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [customEmail, setCustomEmail] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const data = await getEmailTemplates();
    setTemplates(data);
  }

  async function handleSendEmail() {
    if (!trainer.email) {
      alert('This trainer does not have an email address on file.');
      return;
    }

    setSending(true);

    try {
      let success = false;

      if (customEmail) {
        if (!emailData.subject || !emailData.body) {
          alert('Please fill in both subject and body');
          setSending(false);
          return;
        }

        const htmlBody = `<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${emailData.body.replace(
          /\n/g,
          '<br>'
        )}</body></html>`;

        success = await sendEmail(
          trainer.email,
          emailData.subject,
          htmlBody,
          emailData.body,
          { recipientTrainerId: trainer.id }
        );
      } else {
        if (!selectedTemplate) {
          alert('Please select an email template');
          setSending(false);
          return;
        }

        const trainerTypeName = trainer.assigned_types && trainer.assigned_types.length > 0
          ? trainer.assigned_types.map(t => t.name).join(', ')
          : 'Trainer';

        const templateData: Record<string, string> = {
          trainer_name: trainer.name,
          trainer_type: trainerTypeName,
          email: trainer.email || '',
          telephone: trainer.telephone || '',
          expiry_date: trainer.insurance_expiry || 'Unknown',
          expiry_status:
            trainer.insurance_expiry &&
            new Date(trainer.insurance_expiry) < new Date()
              ? 'expired'
              : 'expiring soon',
        };

        success = await sendTemplateEmail(
          trainer.email,
          selectedTemplate,
          templateData,
          undefined,
          { recipientTrainerId: trainer.id }
        );
      }

      if (success) {
        alert('Email sent successfully!');
        onClose();
      } else {
        alert('Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Email to {trainer.name}
            </h2>
            <p className="text-sm text-slate-400 mt-1">{trainer.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setCustomEmail(false)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                !customEmail
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Use Template
            </button>
            <button
              onClick={() => setCustomEmail(true)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                customEmail
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Custom Email
            </button>
          </div>

          {!customEmail ? (
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Email Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.template_key}>
                    {template.name}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="text-xs text-slate-400 mt-2">
                  {
                    templates.find((t) => t.template_key === selectedTemplate)
                      ?.description
                  }
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) =>
                    setEmailData((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Email subject"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Message
                </label>
                <textarea
                  value={emailData.body}
                  onChange={(e) =>
                    setEmailData((prev) => ({ ...prev, body: e.target.value }))
                  }
                  rows={10}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Email message"
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="flex-1 px-4 py-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Email'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
