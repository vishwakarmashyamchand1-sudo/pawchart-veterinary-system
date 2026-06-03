import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { API_BASE_URL as API_URL } from './services/api.js';
import { DoctorDashboard } from './components/DoctorDashboard.jsx';
import { Soap } from './components/SoapConsultation.jsx';

import { formatDateClean, getCompactPurpose, format12h } from './utils/dateUtils.js';

const CLINIC_SPECIALTIES = [
  'Surgery',
  'Grooming and Spa Services',
  'Rehabilitation and Physiotherapy',
  'Veterinary Medicine',
  'Multi-Species Primary Care',
  'In-House Pathology Lab',
  '24-Hour In-Patient Care'
];

const navByRole = {
  admin: [
    ['Dashboard', 'dashboard', 'home'],
    ['Veterinarians', 'vets', 'vet'],
    ['Clients & Pets', 'clients', 'paw'],
    ['Appointments', 'booking', 'cal'],
    ['Vaccinations', 'vax', 'shot'],
    ['Follow-ups', 'followup', 'loop']
  ],
  doctor: [
    ['Appointments', 'calendar', 'cal'],
    ['Follow-ups', 'followup', 'loop']
  ],
  superadmin: [
    ['Clinics', 'dashboard', 'clinic'],
    ['Vaccines Config', 'vaccinemaster', 'shot']
  ]
};
const icons = {
  home: '🏠',
  vet: '🩺',
  paw: '🐾',
  cal: '📅',
  shot: '💉',
  loop: '🔄',
  note: '📝',
  scale: '⚖️',
  chart: '📊',
  clinic: '🏥'
};

function useApi(selectedClinicId, role, screen) {
  const [data, setData] = useState({
    dashboard: null,
    vets: [],
    clients: [],
    appointments: [],
    vaccinations: [],
    followups: [],
    weights: [],
    soapnotes: [],
    vaccinemaster: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Track which resources have been fetched for the current clinic
  const loadedRef = React.useRef(new Set());
  const clinicRef = React.useRef(selectedClinicId);

  // Reset cache when clinic changes
  if (clinicRef.current !== selectedClinicId) {
    clinicRef.current = selectedClinicId;
    loadedRef.current = new Set();
  }

  async function load(forceRefresh = false) {
    setError('');
    try {
      const headers = selectedClinicId ? { 'x-clinic-id': selectedClinicId } : {};
      const fetchResource = async (name) => {
        const res = await fetch(`${API_URL}/${name}?page=1&limit=50`, { headers });
        if (!res.ok) throw new Error(`API request failed: ${name}`);
        const data = await res.json();
        return (data && data.data && Array.isArray(data.data)) ? data.data : data;
      };

      // Define required endpoints per role and screen
      const screenConfigs = {
        admin: {
          dashboard: ['dashboard', 'appointments'],
          vets: ['vets', 'appointments'],
          clients: ['clients', 'vaccinations', 'weights', 'followups', 'soapnotes', 'appointments'],
          petprofile: ['clients', 'appointments', 'vaccinations', 'soapnotes', 'weights'],
          booking: ['appointments', 'clients', 'vets'],
          vax: ['vaccinations', 'vaccinemaster', 'clients'],
          followup: ['followups', 'clients', 'vets'],
          weight: ['weights', 'clients']
        },
        doctor: {
          calendar: ['appointments', 'clients', 'vets'],
          soap: ['appointments', 'clients', 'soapnotes', 'vets', 'vaccinations', 'weights', 'followups'],
          followup: ['followups', 'clients', 'vets'],
          petprofile: ['clients', 'appointments', 'vaccinations', 'soapnotes', 'weights'],
          weight: ['weights', 'clients', 'appointments']
        },
        superadmin: {
          dashboard: [],
          vaccinemaster: ['vaccinemaster']
        }
      };

      let requiredResources = [];
      if (screenConfigs[role] && screenConfigs[role][screen]) {
        requiredResources = screenConfigs[role][screen];
      } else {
        // Fallback for safety if screen is unknown
        requiredResources = ['dashboard', 'vets', 'clients', 'appointments', 'vaccinations', 'followups', 'weights', 'soapnotes', 'vaccinemaster'];
      }

      // Only fetch resources we haven't loaded yet (unless force refresh)
      const toFetch = forceRefresh
        ? requiredResources
        : requiredResources.filter(r => !loadedRef.current.has(r));

      if (toFetch.length === 0) {
        // Everything is already cached, no network calls needed
        setLoading(false);
        return;
      }

      setLoading(true);

      const results = await Promise.all(toFetch.map(fetchResource));
      const newData = Object.fromEntries(toFetch.map((name, i) => [name, results[i]]));
      
      const todayStr = new Date().toISOString().split('T')[0];
      const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (newData.vaccinations) {
        const petVaxMap = {};
        newData.vaccinations.forEach(v => {
          const key = `${v.petName?.toLowerCase()}_${v.ownerName?.toLowerCase()}_${v.vaccine?.toLowerCase()}`;
          if (!petVaxMap[key]) petVaxMap[key] = [];
          petVaxMap[key].push(v);
        });

        newData.vaccinations.forEach(v => {
          if (v.status === 'Pending') {
            if (!v.isRecorded) {
              v.status = 'Not recorded';
            } else {
              if (v.dueDate < todayStr) v.status = 'Overdue';
              else if (v.dueDate <= next30) v.status = 'Due soon';
              else v.status = 'Upcoming';
            }
          } else if (v.status === 'Completed') {
            v.status = 'Done';
          }
        });
      }

      if (newData.followups) {
        newData.followups.forEach(f => {
          if (f.status !== 'Completed' && f.status !== 'Scheduled' && f.status !== 'Cancelled' && f.planDate) {
            if (f.planDate < todayStr) f.status = 'Overdue';
            else f.status = 'Pending';
          }
        });
      }

      // Mark these resources as loaded
      toFetch.forEach(r => loadedRef.current.add(r));

      setData(prev => ({ ...prev, ...newData }));
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function create(resource, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (selectedClinicId) {
      headers['x-clinic-id'] = selectedClinicId;
    }
    const res = await fetch(`${API_URL}/${resource}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Could not create ${resource}`);
    }
    const createdObj = await res.json();
    await load(true);
    return createdObj;
  }

  async function update(resource, id, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (selectedClinicId) {
      headers['x-clinic-id'] = selectedClinicId;
    }
    const res = await fetch(`${API_URL}/${resource}/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Could not update ${resource}`);
    }
    await load(true);
  }

  async function remove(resource, id) {
    const headers = {};
    if (selectedClinicId) {
      headers['x-clinic-id'] = selectedClinicId;
    }
    const res = await fetch(`${API_URL}/${resource}/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`Could not delete ${resource}`);
    await load(true);
  }

  useEffect(() => {
    load();
  }, [selectedClinicId, role, screen]);

  return { data, loading, error, create, update, remove, reload: () => load(true) };
}

function ClinicCreateModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [regNum, setRegNum] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedSpecs, setSelectedSpecs] = useState([]);

  const wrapRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      if (wrapRef.current) {
        wrapRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const modalEl = document.querySelector('.clinic-create-card');
      if (modalEl) {
        modalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const handleSpecChange = (spec, isChecked) => {
    if (isChecked) {
      setSelectedSpecs(prev => [...prev, spec]);
    } else {
      setSelectedSpecs(prev => prev.filter(item => item !== spec));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      window.showToast('"name" length must be at least 3 characters long', 'error');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      window.showToast("Phone number must be exactly 10 digits (numeric only)!", 'error');
      return;
    }
    if (!/^\d{6}$/.test(zip)) {
      window.showToast("Postal code must be exactly 6 digits (numeric only)!", 'error');
      return;
    }
    onSave({
      name,
      registration_number: regNum,
      address: { street, city, state, postal_code: zip },
      contact: { phone, email },
      specialties: selectedSpecs.join(', ') || 'General Practice, Vaccines, Surgery'
    }).then(() => {
      setName('');
      setRegNum('');
      setStreet('');
      setCity('');
      setState('');
      setZip('');
      setPhone('');
      setEmail('');
      setSelectedSpecs([]);
      onClose();
    }).catch(err => {
      window.showToast(err.message, 'error');
    });
  };

  return (
    <div
      ref={wrapRef}
      className="modal-wrap"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        overflowY: 'auto',
        padding: '24px 16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal clinic-create-card"
        style={{
          width: 'min(560px, calc(100% - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          background: 'white',
          borderRadius: '12px',
          padding: '22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto'
        }}
      >
        <div className="modal-hd" style={{ flexShrink: 0 }}>
          <h3>Create New Veterinary Clinic</h3>
          <button type="button" className="modal-x" onClick={onClose}>×</button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: 1
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '18px',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: '6px',
            minHeight: 0,
            flex: 1
          }}>
            <label className="field-label">Clinic Name<input className="input" required value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="field-label">Registration ID<input className="input" required value={regNum} onChange={e => setRegNum(e.target.value)} /></label>
            <label className="field-label">Street Address<input className="input" required value={street} onChange={e => setStreet(e.target.value)} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="field-label">City<input className="input" required value={city} onChange={e => setCity(e.target.value)} /></label>
              <label className="field-label">State<input className="input" required value={state} onChange={e => setState(e.target.value)} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="field-label">Postal Code<input className="input" required value={zip} onChange={e => setZip(e.target.value)} placeholder="6 digits" pattern="\d{6}" title="Postal code must be exactly 6 digits (numeric only)" /></label>
              <label className="field-label">Phone<input className="input" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10 digits" pattern="\d{10}" title="Phone number must be exactly 10 digits (numeric only)" /></label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="field-label" style={{ fontWeight: '700' }}>Specialties / Services</span>
              <div style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 12px',
                maxHeight: '150px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: '#fff',
                marginTop: '4px'
              }}>
                {CLINIC_SPECIALTIES.map(spec => {
                  const checked = selectedSpecs.includes(spec);
                  return (
                    <label key={spec} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleSpecChange(spec, e.target.checked)}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      {spec}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="field-label">Email<input className="input" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border)',
            paddingTop: '14px',
            flexShrink: 0,
            flexWrap: 'wrap'
          }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save & Onboard</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ClinicSelector({ clinics, onSelect, onCreate, onEdit, onDelete }) {
  const [openForm, setOpenForm] = useState(false);

  return (
    <div className="main-scroll">
      <div className="main-pad">
        <div className="topbar">
          <div>
            <h2>Clinics</h2>
          </div>
          <button className="btn btn-primary" onClick={() => setOpenForm(true)}>+ Create Clinic</button>
        </div>

        <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', marginTop: '10px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '18px' }}>Name</th>
                <th>City</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Specialties</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clinics.length > 0 ? (
                clinics.map(c => (
                  <tr key={c._id}>
                    <td style={{ paddingLeft: '18px' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ border: 0, padding: 0, background: 'transparent', fontWeight: '700', color: 'var(--text)', textAlign: 'left', fontSize: '13.5px' }}
                        onClick={() => onSelect(c)}
                        title="Click to launch clinic dashboard"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{c.address?.city || '-'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{c.contact?.phone || '-'}</td>
                    <td>
                      <span className={`badge b-${c.status === 'inactive' ? 'red' : 'green'}`} style={{ textTransform: 'capitalize', fontSize: '11px', padding: '2px 8px' }}>
                        {c.status || 'active'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '13px' }}>{c.specialties || 'General Practice, Vaccines, Surgery'}</td>
                    <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 8px', color: 'var(--text-3)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => onEdit(c)}
                          title="Edit Clinic Details"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 8px', color: 'var(--red)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => onDelete(c)}
                          title="Delete Clinic"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                    No active clinics onboarded yet. Click Create Clinic to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {openForm && (
        <ClinicCreateModal
          onClose={() => setOpenForm(false)}
          onSave={(body) => onCreate(body).then(() => setOpenForm(false)).catch(err => window.showToast(err.message, 'error'))}
        />
      )}
    </div>
  );
}

function ClinicEditModal({ clinic, onClose, onSave }) {
  const [name, setName] = useState(clinic.name || '');
  const [regNum, setRegNum] = useState(clinic.registration_number || '');
  const [street, setStreet] = useState(clinic.address?.street || '');
  const [city, setCity] = useState(clinic.address?.city || '');
  const [state, setState] = useState(clinic.address?.state || '');
  const [zip, setZip] = useState(clinic.address?.postal_code || '');
  const [phone, setPhone] = useState(clinic.contact?.phone || '');
  const [email, setEmail] = useState(clinic.contact?.email || '');
  const [selectedSpecs, setSelectedSpecs] = useState(() => {
    if (!clinic.specialties) return [];
    return clinic.specialties.split(',').map(s => s.trim()).filter(Boolean);
  });

  const wrapRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      if (wrapRef.current) {
        wrapRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const modalEl = document.querySelector('.clinic-edit-card');
      if (modalEl) {
        modalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const handleSpecChange = (spec, isChecked) => {
    if (isChecked) {
      setSelectedSpecs(prev => [...prev, spec]);
    } else {
      setSelectedSpecs(prev => prev.filter(item => item !== spec));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      window.showToast('"name" length must be at least 3 characters long', 'error');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      window.showToast("Phone number must be exactly 10 digits (numeric only)!", 'error');
      return;
    }
    if (!/^\d{6}$/.test(zip)) {
      window.showToast("Postal code must be exactly 6 digits (numeric only)!", 'error');
      return;
    }
    onSave({
      name,
      registration_number: regNum,
      address: { street, city, state, postal_code: zip },
      contact: { phone, email },
      specialties: selectedSpecs.join(', ') || 'Veterinary Medicine'
    }).catch(err => window.showToast(err.message, 'error'));
  };

  return (
    <div
      ref={wrapRef}
      className="modal-wrap"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        overflowY: 'auto',
        padding: '24px 16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal clinic-edit-card"
        style={{
          width: 'min(560px, calc(100% - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          background: 'white',
          borderRadius: '12px',
          padding: '22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto'
        }}
      >
        <div className="modal-hd" style={{ flexShrink: 0 }}>
          <h3>Edit Clinic - {clinic.name}</h3>
          <button type="button" className="modal-x" onClick={onClose}>×</button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: 1
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '18px',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: '6px',
            minHeight: 0,
            flex: 1
          }}>
            <label className="field-label">Clinic Name<input className="input" required value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="field-label">Registration ID<input className="input" required disabled value={regNum} /></label>
            <label className="field-label">Street Address<input className="input" required value={street} onChange={e => setStreet(e.target.value)} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="field-label">City<input className="input" required value={city} onChange={e => setCity(e.target.value)} /></label>
              <label className="field-label">State<input className="input" required value={state} onChange={e => setState(e.target.value)} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="field-label">Postal Code<input className="input" required value={zip} onChange={e => setZip(e.target.value)} placeholder="6 digits" pattern="\d{6}" title="Postal code must be exactly 6 digits (numeric only)" /></label>
              <label className="field-label">Phone<input className="input" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="10 digits" pattern="\d{10}" title="Phone number must be exactly 10 digits (numeric only)" /></label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="field-label" style={{ fontWeight: '700' }}>Specialties / Services</span>
              <div style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 12px',
                maxHeight: '150px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: '#fff',
                marginTop: '4px'
              }}>
                {CLINIC_SPECIALTIES.map(spec => {
                  const checked = selectedSpecs.includes(spec);
                  return (
                    <label key={spec} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)', fontWeight: '500' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleSpecChange(spec, e.target.checked)}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      {spec}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="field-label">Email<input className="input" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border)',
            paddingTop: '14px',
            flexShrink: 0,
            flexWrap: 'wrap'
          }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function VaccineModal({ initialTab, initialData, onClose, onSave }) {
  const [name, setName] = useState(initialData?.name || '');
  const [species, setSpecies] = useState(initialData?.species || initialTab || 'Dog');
  const [recommendedAge, setRecommendedAge] = useState(initialData?.recommendedAge || '');
  const [desc, setDesc] = useState(initialData?.desc || '');

  return (
    <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2 style={{ marginBottom: '16px', fontSize: '20px', color: 'var(--text)' }}>{initialData ? 'Edit Vaccine' : 'Add Vaccine'}</h2>
        <Input label="Vaccine Name" value={name} onChange={setName} />
        <Select label="Species" value={species} onChange={setSpecies} options={['Dog', 'Cat', 'Rabbit', 'Bird', 'Other']} />
        <Input label="Recommended Age" value={recommendedAge} onChange={setRecommendedAge} />
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-2)', marginBottom: '8px' }}>Description</label>
          <textarea 
            className="input" 
            style={{ width: '100%', minHeight: '64px', resize: 'vertical', fontFamily: 'inherit', padding: '10px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)' }} 
            value={desc} 
            onChange={e => setDesc(e.target.value)} 
            placeholder="e.g. Prevents fatal rabies infection."
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn" style={{ background: 'transparent', color: 'var(--text-2)' }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ name, species, recommendedAge, desc })}>{initialData ? 'Save Changes' : 'Save Vaccine'}</button>
        </div>
      </div>
    </div>
  );
}

function PetVaccinationEditModal({ vaccination, pet, onClose, onSave }) {
  const isAlreadyGiven = vaccination.status === 'Completed' || vaccination.status === 'Up to date' || vaccination.status === 'Done';
  const [status, setStatus] = useState(isAlreadyGiven ? 'Completed' : '');
  const [lastDate, setLastDate] = useState(vaccination.lastDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(vaccination.dueDate || '');
  const [vaccine, setVaccine] = useState(vaccination.vaccine || '');
  const [vetName, setVetName] = useState(vaccination.vetName || '');
  const [notes, setNotes] = useState(vaccination.notes || '');

  // Calculate due date based on pet's date of birth or last given date
  const getCalculatedDueDate = () => {
    const isGivenCheck = status === 'Completed' || status === 'Up to date';
    if (isGivenCheck && lastDate) {
      try {
        const ld = new Date(lastDate);
        if (!isNaN(ld.getTime())) {
          ld.setFullYear(ld.getFullYear() + 1);
          const yyyy = ld.getFullYear();
          const mm = String(ld.getMonth() + 1).padStart(2, '0');
          const dd = String(ld.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      } catch (e) {}
    }

    if (!pet) return dueDate || '';
    const dobStr = pet.dateOfBirth || pet.dob;
    if (!dobStr) return dueDate || '';
    
    const cleanVax = (vaccine || vaccination.vaccine || '').toLowerCase().trim();
    let recAge = '12 weeks';
    if (cleanVax.includes('rabies')) {
      recAge = '12 weeks';
    } else if (cleanVax.includes('dhpp')) {
      recAge = '8 weeks';
    } else if (cleanVax.includes('bordetella')) {
      recAge = '12 weeks';
    } else if (cleanVax.includes('fvrcp')) {
      recAge = '8 weeks';
    } else if (cleanVax.includes('rhdv2')) {
      recAge = '6 weeks';
    } else if (cleanVax.includes('polyomavirus')) {
      recAge = '4 weeks';
    } else if (cleanVax.includes('titer')) {
      recAge = '1 year';
    }
    
    try {
      const dob = new Date(dobStr);
      if (isNaN(dob.getTime())) return '';
      
      const match = recAge.match(/(\d+)/);
      if (!match) return '';
      const value = parseInt(match[1], 10);
      const lowerStr = recAge.toLowerCase();
      const calculated = new Date(dob);
      
      if (lowerStr.includes('week')) {
        calculated.setDate(calculated.getDate() + (value * 7));
      } else if (lowerStr.includes('month')) {
        calculated.setMonth(calculated.getMonth() + value);
      } else if (lowerStr.includes('year')) {
        calculated.setFullYear(calculated.getFullYear() + value);
      } else if (lowerStr.includes('day')) {
        calculated.setDate(calculated.getDate() + value);
      }
      
      const yyyy = calculated.getFullYear();
      const mm = String(calculated.getMonth() + 1).padStart(2, '0');
      const dd = String(calculated.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return '';
    }
  };

  const computedDueDate = getCalculatedDueDate();

  // Handle status toggle button clicks
  // "Given" matches "Completed", "Not Given" matches "Pending"
  const isGiven = status === 'Completed' || status === 'Up to date';
  const isNotGiven = status === 'Pending' || status === 'Not recorded';

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'Completed') {
      if (!lastDate) {
        setLastDate(new Date().toISOString().split('T')[0]);
      }
    }
  };

  return (
    <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2 style={{ marginBottom: '16px', fontSize: '20px', color: 'var(--text)' }}>
          {vaccination.isNew ? 'Add Vaccination' : 'Record Vaccination'}
        </h2>

        <div style={{ marginBottom: '16px', color: 'var(--text-2)' }}>
          <strong>Vaccine:</strong> {vaccination.isNew ? (
            <input 
              className="input" 
              style={{ display: 'inline-block', width: 'auto', marginLeft: '8px', padding: '4px 8px' }} 
              value={vaccine} 
              onChange={(e) => setVaccine(e.target.value)} 
              placeholder="e.g. Rabies"
            />
          ) : vaccination.vaccine}
        </div>

        {/* STATUS TOGGLE BUTTON GROUP */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <strong style={{ color: 'var(--text-2)' }}>Status:</strong>
          
          <div 
            style={{ 
              position: 'relative', 
              display: 'flex', 
              background: '#e2e8f0', 
              borderRadius: '30px', 
              width: '220px', 
              height: '40px', 
              padding: '4px',
              cursor: 'pointer'
            }}
            onClick={() => handleStatusChange(isGiven ? 'Pending' : 'Completed')}
          >
            {/* Sliding Background */}
            <div 
              style={{
                position: 'absolute',
                top: '4px',
                left: isGiven ? '4px' : '110px',
                width: '106px',
                height: '32px',
                borderRadius: '26px',
                background: isGiven ? '#22c55e' : '#ef4444',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}
            />
            {/* Labels */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, color: isGiven ? '#fff' : 'var(--text-2)', fontWeight: '700', fontSize: '13px', transition: 'color 0.3s' }}>
              Given
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, color: !isGiven ? '#fff' : 'var(--text-2)', fontWeight: '700', fontSize: '13px', transition: 'color 0.3s' }}>
              Not Given
            </div>
          </div>
        </div>

        {isGiven && (
          <Input label="Date Given" type="date" value={lastDate} onChange={setLastDate} />
        )}

        {isNotGiven && (
          <div style={{ marginBottom: '16px', color: 'var(--text-2)', background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <strong>Due Date:</strong> {computedDueDate || 'Not Calculated'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn" style={{ background: 'transparent', color: 'var(--text-2)' }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            disabled={!status}
            style={{
              opacity: !status ? 0.6 : 1,
              cursor: !status ? 'not-allowed' : 'pointer'
            }}
            onClick={() => {
              if (!status) return;
              onSave({ 
                ...vaccination, 
                vaccine: vaccination.isNew ? vaccine : vaccination.vaccine, 
                dueDate: computedDueDate, 
                status, 
                lastDate: isGiven ? lastDate : '', 
                vetName: isGiven ? vetName : '', 
                notes: isGiven ? notes : '',
                isRecorded: true
              });
            }}
          >
            Save Record
          </button>
        </div>
      </div>
    </div>
  );
}

function VaccinesConfig({ vaccines, create }) {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Dog');

  const handleSave = async (data) => {
    if (!data.name || !data.recommendedAge || !data.desc || data.desc.trim() === '') {
      alert('Please fill in all fields (Vaccine Name, Recommended Age, and Description).');
      return;
    }
    try {
      await create('vaccinemaster', data);
      setShowModal(false);
      // Data is dynamically added, so it will update the table.
      setActiveTab(data.species); // Switch to the tab where it was added
    } catch (err) {
      alert(err.message);
    }
  };

  const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'];
  const SPECIES_ICONS = { Dog: '🐶', Cat: '🐱', Rabbit: '🐰', Bird: '🦜', Other: '🐾' };

  const hardcodedVaccines = [
    { id: 'hc-1', name: 'Rabies', species: 'Dog', recommendedAge: '12 weeks', desc: 'Prevents fatal rabies infection.', mandatory: true },
    { id: 'hc-2', name: 'DHPP', species: 'Dog', recommendedAge: '8 weeks', desc: 'Protects against major canine viral diseases.', mandatory: true },
    { id: 'hc-3', name: 'Bordetella', species: 'Dog', recommendedAge: '12 weeks', desc: 'Prevents kennel cough infection.', mandatory: true },
    { id: 'hc-7', name: 'Rabies', species: 'Cat', recommendedAge: '12 weeks', desc: 'Prevents fatal rabies infection.', mandatory: true },
    { id: 'hc-8', name: 'FVRCP', species: 'Cat', recommendedAge: '8 weeks', desc: 'Protects against core feline viral diseases.', mandatory: true },
    { id: 'hc-11', name: 'RHDV2', species: 'Rabbit', recommendedAge: '6 weeks', desc: 'Protects against rabbit hemorrhagic disease.', mandatory: true },
    { id: 'hc-14', name: 'Polyomavirus', species: 'Bird', recommendedAge: '4 weeks', desc: 'Protects against avian polyomavirus infection.', mandatory: true }
  ];

  // Filter out any incomplete records that lack a proper description
  const combinedVaccines = [...hardcodedVaccines, ...vaccines].filter(v => v.desc && v.desc.trim() !== '' && v.desc !== '—');

  const currentList = combinedVaccines.filter(v => v.species === activeTab);

  const tabCounts = SPECIES.reduce((acc, s) => {
    acc[s] = combinedVaccines.filter(v => v.species === s).length;
    return acc;
  }, {});

  return (
    <div className="main-scroll">
      <div className="main-pad">
        <div className="topbar">
          <div>
            <h2>Vaccine Master List</h2>
            <p style={{ color: 'var(--text-2)', marginTop: '4px' }}>Manage the global list of standard vaccines and their recommended ages.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Vaccine</button>
        </div>

        {/* SPECIES TABS */}
        <div className="vm-tabs-bar" style={{ marginTop: '16px' }}>
          {SPECIES.map(sp => (
            <div 
              key={sp} 
              className={`vm-tab ${activeTab === sp ? 'active' : ''}`}
              onClick={() => setActiveTab(sp)}
            >
              {SPECIES_ICONS[sp] || '🐾'} {sp}
              <span className="tab-count">{tabCounts[sp] || 0}</span>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div className="vm-content" style={{ padding: '18px 0' }}>
          {currentList.length === 0 ? (
            <div className="vm-empty">
              <i className="ti ti-vaccine"></i>
              <p>No vaccines found for {activeTab}.</p>
            </div>
          ) : (
            <div className="vm-table-wrap" style={{ marginBottom: '4px' }}>
              <table className="vm-table" style={{ fontSize: '14px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '25%', padding: '12px 16px', fontSize: '11px' }}>Vaccine Name</th>
                    <th style={{ width: '50%', padding: '12px 16px', fontSize: '11px' }}>Description</th>
                    <th style={{ width: '25%', padding: '12px 16px', fontSize: '11px' }}>Recommended Age</th>
                  </tr>
                </thead>
                <tbody>
                  {currentList.map(v => (
                    <tr key={v._id || v.id}>
                      <td style={{ padding: '16px' }}>
                        <div className="vm-vax-name" style={{ fontSize: '14px' }}>{v.name}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div className="vm-vax-desc" style={{ marginTop: 0, fontSize: '13px' }}>{v.desc || '—'}</div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>
                        {v.recommendedAge}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && <VaccineModal initialTab={activeTab} onClose={() => setShowModal(false)} onSave={handleSave} />}
      </div>
    </div>
  );
}

function App() {
  const [clinics, setClinics] = useState([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState(() => {
    const saved = localStorage.getItem('pawchart_clinic');
    return saved ? JSON.parse(saved) : null;
  });
  const [editingClinic, setEditingClinic] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [bookingClient, setBookingClient] = useState(null);
  const [bookingPet, setBookingPet] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }
  const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }

  useEffect(() => {
    window.showToast = (message, type = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast(null);
      }, 4000);
    };

    window.showConfirm = (message, onConfirm) => {
      setConfirmState({ message, onConfirm });
    };

    window.alert = (msg) => {
      const lower = String(msg).toLowerCase();
      const isError = lower.includes('fail') || 
                      lower.includes('error') || 
                      lower.includes('invalid') || 
                      lower.includes('cannot') || 
                      lower.includes('could not') || 
                      lower.includes('please') || 
                      lower.includes('empty') || 
                      lower.includes('must be');
      window.showToast?.(msg, isError ? 'error' : 'info');
    };
  }, []);

  const [screen, setScreen] = useState('dashboard');
  const [role, setRole] = useState('admin');
  const { data, loading, error, create, update, remove, reload } = useApi(selectedClinic?._id, role, screen);

  async function loadClinics() {
    setClinicsLoading(true);
    try {
      const res = await fetch(`${API_URL}/clinics`);
      if (res.ok) {
        const list = await res.json();
        setClinics(list);

        // Removed auto-assign so the dropdown stays on "Switch Clinic" until the user explicitly selects one
      }
    } catch (err) {
      console.error('Failed to load clinics:', err);
    } finally {
      setClinicsLoading(false);
    }
  }

  useEffect(() => {
    if (clinics.length === 0 || role === 'superadmin') {
      loadClinics();
    }
  }, [role]);

  const selectClinic = (clinic) => {
    setSelectedClinic(clinic);
    if (clinic) {
      localStorage.setItem('pawchart_clinic', JSON.stringify(clinic));
    } else {
      localStorage.removeItem('pawchart_clinic');
    }
  };

  async function handleCreateClinic(clinicForm) {
    try {
      const res = await fetch(`${API_URL}/clinics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicForm)
      });
      if (res.ok) {
        alert('Clinic successfully onboarded! You can now manually select it from the list.');
        await loadClinics();
        // Do NOT selectClinic or auto-switch context. Keep currently selected clinic active.
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to onboard clinic');
      }
    } catch (err) {
      throw err;
    }
  }

  async function handleUpdateClinic(updatedFields) {
    try {
      const res = await fetch(`${API_URL}/clinics/${editingClinic._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        const updated = await res.json();
        window.showToast('Clinic details updated successfully!');
        await loadClinics();
        if (selectedClinic && selectedClinic._id === updated._id) {
          setSelectedClinic(updated);
          localStorage.setItem('pawchart_clinic', JSON.stringify(updated));
        }
        setEditingClinic(null);
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update clinic');
      }
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  async function handleDeleteClinic(clinic) {
    window.showConfirm(`Are you sure you want to permanently delete "${clinic.name}"? All associated vets, appointments, and client records under this clinic will no longer be accessible.`, async () => {
      try {
        const res = await fetch(`${API_URL}/clinics/${clinic._id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          window.showToast('Clinic successfully deleted!');
          await loadClinics();
          if (selectedClinic && selectedClinic._id === clinic._id) {
            selectClinic(null);
          }
        } else {
          throw new Error('Failed to delete clinic');
        }
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  }

  const activePet = useMemo(() => {
    if (!data?.clients) return null;
    const allPets = data.clients.flatMap((client) => (client.pets || []).map((pet) => ({
      ...pet,
      ownerId: client._id,
      ownerName: client.name,
      email: client.email,
      phone: client.phone
    })));
    if (selectedPet) {
      const found = allPets.find(p => p._id === selectedPet._id);
      if (found) return found;
    }
    return allPets.find((pet) => pet.name === 'Buddy') || allPets[0] || null;
  }, [data?.clients, selectedPet]);

  const doctorPatients = useMemo(() => {
    if (role !== 'doctor' || !selectedDoctor || !data?.appointments || !data?.clients) return [];
    const patientMap = new Map();
    data.appointments.forEach(app => {
      if (app.vetName === selectedDoctor.name) {
        const key = `${app.ownerName}-${app.petName}`;
        if (!patientMap.has(key)) {
          patientMap.set(key, { ownerName: app.ownerName, petName: app.petName });
        }
      }
    });
    const pets = [];
    patientMap.forEach((pt) => {
      const client = data.clients.find(c => c.name === pt.ownerName);
      if (client && client.pets) {
        const pet = client.pets.find(p => p.name === pt.petName);
        if (pet) {
          pets.push({
            ...pet,
            ownerId: client._id,
            ownerName: client.name,
            email: client.email,
            phone: client.phone
          });
        }
      }
    });
    return pets;
  }, [role, selectedDoctor, data?.appointments, data?.clients]);

  function switchRole(nextRole) {
    setRole(nextRole);
    setScreen(nextRole === 'doctor' ? 'calendar' : 'dashboard');
    selectClinic(null);
  }

  return (
    <div className="proto-shell">
      <div className="app-frame">
        <aside className="sidebar">
          <div className="sb-top">
            <div className="sb-brand"><span className="paw-mark">◆</span> Paw<span>Chart</span></div>
            <label className="sb-field-label">Role</label>
            <select className="sb-select" value={role} onChange={(event) => switchRole(event.target.value)}>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Clinic Admin</option>
              <option value="doctor">Doctor</option>
            </select>

            {role === 'doctor' && (
              <>
                <label className="sb-field-label" style={{ marginTop: '16px' }}>Clinic</label>
                <select
                  className="sb-select"
                  value={selectedClinic?._id || ''}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      selectClinic(null);
                    } else {
                      const c = clinics.find(item => item._id === e.target.value);
                      selectClinic(c);
                    }
                    setSelectedDoctor(null);
                  }}
                  disabled={clinicsLoading}
                >
                  <option value="">Select clinic...</option>
                  {clinicsLoading ? (
                    <option value="loading" disabled>Loading clinics...</option>
                  ) : (
                    clinics.map(c => <option key={c._id} value={c._id}>{c.name}</option>)
                  )}
                </select>

                <label className="sb-field-label" style={{ marginTop: '16px' }}>Doctor</label>
                <select
                  className="sb-select"
                  value={selectedDoctor?._id || ''}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setSelectedDoctor(null);
                    } else {
                      const d = data.vets?.find(item => item._id === e.target.value);
                      setSelectedDoctor(d || null);
                    }
                  }}
                  disabled={loading}
                >
                  <option value="">{!selectedClinic ? 'Select clinic first...' : 'Select doctor...'}</option>
                  {loading ? (
                    <option value="loading" disabled>Loading doctors...</option>
                  ) : (
                    data.vets?.map(v => <option key={v._id} value={v._id}>{v.name}</option>)
                  )}
                </select>
              </>
            )}
          </div>

          {role === 'admin' && clinics.length > 0 ? (
            <div style={{ padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: '6px' }}>
              <select
                className="sb-select"
                style={{ flex: 1 }}
                value={selectedClinic?._id || ''}
                onChange={(e) => {
                  if (e.target.value === "") {
                    selectClinic(null);
                  } else {
                    const c = clinics.find(item => item._id === e.target.value);
                    selectClinic(c);
                  }
                }}
              >
                <option value="">Select clinic...</option>
                {clinics.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            role !== 'doctor' && selectedClinic && (
              <div className="sb-clinic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', color: '#cbd5e1', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: '11px', fontWeight: '600' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedClinic.name}
                </span>
                {role === 'superadmin' && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '3px 6px', fontSize: '9px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', height: 'auto', display: 'inline-flex', alignItems: 'center', borderRadius: '4px' }}
                    onClick={() => selectClinic(null)}
                    title="Return to Clinics Panel"
                  >
                    ◀ Exit
                  </button>
                )}
              </div>
            )
          )}

          <nav className="sb-nav">
            {navByRole[role].map(([label, id, icon]) => (
              <button key={`${role}-${label}`} className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => {
                if (id === 'booking' || id === 'calendar') {
                  setBookingClient(null);
                  setBookingPet(null);
                }
                setScreen(id);
              }}>
                <span className="ni">{icons[icon]}</span>{label}
              </button>
            ))}
          </nav>
          <div className="sb-footer">
            <div className="pulse-row"><span className="pulse-dot" />Monitoring {data.dashboard?.monitoring?.length ?? 0} follow-ups</div>
            <div className="fp-sub">System watching for earlier slots</div>
          </div>
        </aside>

        <main className="main">
          {loading && <SkeletonLoader message={screen === 'dashboard' ? 'Loading dashboard data...' : screen === 'clients' ? 'Loading clients...' : screen === 'booking' ? 'Loading appointments...' : screen === 'vaccinemaster' ? 'Loading vaccines...' : screen === 'soap' ? 'Loading consultation...' : `Loading ${screen}...`} />}
          {error && <Status message={`${error}. Start the API and seed MongoDB.`} tone="error" action={reload} />}
          {!loading && !error && (
            !selectedClinic && screen !== 'vaccinemaster' ? (
              role === 'superadmin' ? (
                <ClinicSelector clinics={clinics} onSelect={selectClinic} onCreate={handleCreateClinic} onEdit={setEditingClinic} onDelete={handleDeleteClinic} />
              ) : (
                <div style={{ height: '100%', background: 'var(--surface)', padding: '24px' }}>
                  <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Select a clinic from the sidebar to manage your clinic.</p>
                </div>
              )
            ) : (
              <>
                {screen === 'dashboard' && <Dashboard data={data.dashboard} appointments={data.appointments} go={setScreen} />}
                {screen === 'vaccinemaster' && role === 'superadmin' && <VaccinesConfig vaccines={data.vaccinemaster || []} create={create} />}
                {screen === 'vets' && <Vets vets={data.vets} appointments={data.appointments} create={create} update={update} onDelete={remove} selectedClinic={selectedClinic} />}
                {screen === 'clients' && <Clients clients={data.clients} create={create} update={update} onDelete={remove} appointments={data.appointments} vaccinations={data.vaccinations} go={setScreen} onSelectPet={setSelectedPet} />}
                {screen === 'petprofile' && <PetProfile pet={activePet} clients={data.clients} appointments={data.appointments} vaccinations={data.vaccinations} soapnotes={data.soapnotes} weights={data.weights} go={setScreen} onSetBookingClient={setBookingClient} onSetBookingPet={setBookingPet} update={update} create={create} />}
                {screen === 'vax' && <Vaccinations rows={data.vaccinations} update={update} clients={data.clients} />}
                {screen === 'booking' && <Booking key={`booking-${bookingClient?._id || 'none'}`} vets={data.vets} clients={data.clients} appointments={data.appointments} create={create} bookingClient={bookingClient} setBookingClient={setBookingClient} bookingPet={bookingPet} setBookingPet={setBookingPet} go={setScreen} />}
                {screen === 'soap' && (
                  <Soap
                    appointment={selectedAppointment}
                    clients={data.clients}
                    appointments={data.appointments}
                    soapNotes={data.soapnotes}
                    vaccinations={data.vaccinations}
                    weights={data.weights}
                    followups={data.followups}
                    create={create}
                    update={update}
                    go={setScreen}
                    setBookingClient={setBookingClient}
                    setBookingPet={setBookingPet}
                  />
                )}
                {screen === 'weight' && <Weights weights={data.weights} create={create} go={setScreen} activePet={activePet} clients={data.clients} doctorPatients={doctorPatients} selectedDoctor={selectedDoctor} onPetSelect={setSelectedPet} role={role} />}
                {screen === 'followup' && <FollowUps rows={role === 'doctor' && selectedDoctor ? (data.followups || []).filter(f => f.vetName === selectedDoctor.name) : (data.followups || [])} selectedClinic={selectedClinic} />}
                {screen === 'calendar' && (
                  role === 'doctor' ? (
                    !selectedDoctor ? (
                      <div style={{ height: '100%', background: 'var(--surface)', padding: '24px' }}>
                        <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Select a doctor from the sidebar to manage your appointments.</p>
                      </div>
                    ) : (
                      <DoctorDashboard
                        appointments={data.appointments}
                        clients={data.clients}
                        selectedDoctor={selectedDoctor}
                        selectedClinic={selectedClinic}
                        go={setScreen}
                        update={update}
                        onStartConsultation={setSelectedAppointment}
                      />
                    )
                  ) : (
                    <Calendar appointments={selectedDoctor ? data.appointments.filter(a => a.vetName === selectedDoctor.name) : data.appointments} go={setScreen} />
                  )
                )}
              </>
            )
          )}
        </main>
      </div>

      {editingClinic && (
        <ClinicEditModal
          clinic={editingClinic}
          onClose={() => setEditingClinic(null)}
          onSave={handleUpdateClinic}
        />
      )}

      {/* Custom Confirmation Modal */}
      {confirmState && (
        <div className="modal-wrap" style={{ zIndex: 200 }}>
          <div className="modal" style={{ width: '420px', padding: '24px' }}>
            <div className="modal-hd" style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Confirm Action</h3>
              <button className="modal-x" onClick={() => setConfirmState(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              {confirmState.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setConfirmState(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--red)', color: 'white' }}
                onClick={async () => {
                  await confirmState.onConfirm();
                  setConfirmState(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification System */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: toast.type === 'error' ? 'var(--red)' : toast.type === 'info' ? 'var(--brand)' : 'var(--green)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontWeight: '600',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.3s ease'
        }}>
          <span>{toast.type === 'error' ? '⚠️' : toast.type === 'info' ? '' : '✓'}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Status({ message, tone = 'info', action }) {
  return <div className="status"><div className={`status-box ${tone}`}>{message}{action && <button className="btn btn-primary" onClick={action}>Retry</button>}</div></div>;
}

function SkeletonLoader({ message = 'Loading...' }) {
  return (
    <div className="main-scroll" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <h2 style={{ fontSize: '18px', color: 'var(--text)', margin: 0 }}>{message}</h2>
      </div>
      <div className="skeleton skeleton-title"></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div className="skeleton skeleton-avatar" style={{ marginBottom: '10px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div className="skeleton skeleton-avatar" style={{ marginBottom: '10px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div className="skeleton skeleton-avatar" style={{ marginBottom: '10px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
        </div>
      </div>
      <div className="card" style={{ padding: '20px' }}>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text"></div>
      </div>
    </div>
  );
}

function AlertCard({ type, petName, title, sub }) {
  const colors = {
    amber: { bg: '#fef3c7', border: '#fcd34d', text: '#b45309', subText: '#b45309' },
    purple: { bg: '#ede9fe', border: '#c084fc', text: '#6d28d9', subText: '#6d28d9' },
    red: { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c', subText: '#b91c1c' },
    blue: { bg: '#dbeafe', border: '#bfdbfe', text: '#1d4ed8', subText: '#1d4ed8' },
    green: { bg: '#dcfce7', border: '#bbf7d0', text: '#15803d', subText: '#15803d' }
  };
  const color = colors[type] || colors.amber;
  return (
    <div style={{
      background: color.bg,
      border: `1px solid ${color.border}`,
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '10px',
      cursor: 'pointer'
    }}>
      <div style={{ fontWeight: '700', fontSize: '13px', color: color.text }}>
        <strong>{petName}</strong> — {title}
      </div>
      <div style={{ fontSize: '11px', color: color.subText, marginTop: '2px', opacity: 0.8 }}>
        {sub}
      </div>
    </div>
  );
}

function MonitoringBox({ count = 3 }) {
  return (
    <div style={{
      background: '#0b1329',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '16px',
      color: '#fff'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#60a5fa', fontWeight: '700' }}>
        <span className="pulse-dot" style={{ background: '#3b82f6' }} /> Background Monitoring
      </div>
      <div style={{ fontWeight: '700', fontSize: '14px', marginTop: '6px', color: '#fff' }}>
        Watching for earlier slots
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
        {count} follow-up patients on watch. Owner is notified the moment an earlier slot opens.
      </div>
    </div>
  );
}

function Dashboard({ data, appointments = [], go }) {
  const stats = data?.stats || {};

  // Real time date
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const subtitle = `${todayStr} · live clinic dashboard`;

  // Calculate Today's Appointments count dynamically from actual appointments list
  const localTodayStr = getLocalDateString();
  const todayAppts = appointments.filter(a => {
    const apptDateOnly = a.date && a.date.includes('T') ? a.date.split('T')[0] : a.date;
    return apptDateOnly === localTodayStr;
  });
  const todayCount = todayAppts.length;

  // Calculate Yesterday's Appointments count for the dynamic hint comparison
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const yesterdayAppts = appointments.filter(a => {
    const apptDateOnly = a.date && a.date.includes('T') ? a.date.split('T')[0] : a.date;
    return apptDateOnly === yesterdayStr;
  });
  const yesterdayCount = yesterdayAppts.length;
  const diff = todayCount - yesterdayCount;
  const apptsHint = diff >= 0
    ? `+${diff} appointments compared to yesterday`
    : `${diff} appointments compared to yesterday`;

  // Filter and sort today's appointments for the dashboard list
  const todayApptsSorted = [...todayAppts].sort((a, b) => {
    const timeA = a.time.includes('-') ? a.time.split('-')[0] : a.time;
    const timeB = b.time.includes('-') ? b.time.split('-')[0] : b.time;
    return timeA.localeCompare(timeB);
  });

  // Get real alerts from vaccinations & follow-ups
  const alertsList = [];
  const todayPetNames = new Set(todayAppts.map(a => a.petName?.toLowerCase()).filter(Boolean));

  // 1. Process vaccinations as alerts
  if (data?.alerts && data.alerts.length > 0) {
    data.alerts.forEach((vax) => {
      if (todayPetNames.has(vax.petName?.toLowerCase())) {
        if (vax.status === 'Completed' || vax.status === 'Waived' || vax.status === 'Up to date' || vax.status === 'Done') return;
        alertsList.push({
          _id: vax._id,
          type: vax.status === 'Overdue' ? 'red' : vax.status === 'Completed' ? 'blue' : 'amber',
          petName: vax.petName,
          title: `${vax.vaccine} vaccine ${vax.status?.toLowerCase() || 'due'}`,
          sub: `Due date: ${vax.dueDate} · Status: ${vax.status}`
        });
      }
    });
  }

  // 2. Process monitoring followups as alerts
  if (data?.monitoring && data.monitoring.length > 0) {
    data.monitoring.forEach((follow) => {
      if (todayPetNames.has(follow.petName?.toLowerCase())) {
        alertsList.push({
          _id: follow._id,
          type: 'purple',
          petName: follow.petName,
          title: `Follow-up pending (${getCompactPurpose(follow.purpose)})`,
          sub: `Planned for: ${formatDateClean(follow.planDate)} · Doctor: ${follow.vetName}`
        });
      }
    });
  }

  return (
    <Screen
      title="Dashboard"
      sub={subtitle}
      action={<button className="btn btn-primary" onClick={() => go('booking')}>+ New Appointment</button>}
    >
      <div className="stat-grid">
        <Stat
          label="TODAY'S APPOINTMENTS"
          value={todayCount}
          hint={apptsHint}
          primary
        />
        <Stat
          label="ACTIVE PATIENTS"
          value={`${stats.activePatients ?? 0} 🐾`}
          hint={stats.activePatientsHint || "No new patients this month"}
        />
        <Stat
          label="VACCINES DUE"
          value={`${stats.vaccinesDue ?? 0} 💉`}
          hint={stats.vaccinesDueHint || "No vaccines due"}
          danger
        />
        <Stat
          label="FOLLOW-UPS PENDING"
          value={`${stats.followUpsPending ?? 0} 🔄`}
          hint={stats.followUpsPendingHint || "No pending follow-ups"}
        />
      </div>

      <div className="grid-two">
        <section className="panel no-pad" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: '15px' }}>Today's Appointments</strong>
            <span className="badge b-blue" style={{ fontSize: '11px', padding: '2px 8px' }}>
              {todayCount} total
            </span>
          </div>

          {todayApptsSorted.length > 0 ? (
            <AppointmentList rows={todayApptsSorted} clients={clients} />
          ) : (
            <div style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: '13px'
            }}>
              No appointments today
            </div>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <section className="panel" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div className="card-label" style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.07em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>
              ALERTS & REMINDERS
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {alertsList.length > 0 ? (
                alertsList.map((alert) => (
                  <AlertCard
                    key={alert._id || alert.title}
                    type={alert.type}
                    petName={alert.petName}
                    title={alert.title}
                    sub={alert.sub}
                  />
                ))
              ) : (
                <div style={{
                  padding: '30px 16px',
                  textAlign: 'center',
                  color: 'var(--text-3)',
                  fontSize: '13px',
                  border: '1.5px dashed var(--border)',
                  borderRadius: '8px',
                  fontStyle: 'italic'
                }}>
                  No alerts or reminders
                </div>
              )}
            </div>
          </section>

          <MonitoringBox count={stats.followUpsPending ?? 0} />
        </div>
      </div>
    </Screen>
  );
}

function Stat({ label, value, hint, primary, danger }) {
  return <div className={`stat-card ${primary ? 'primary' : ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-num">{value}</div>
    <div className={`stat-change ${danger ? 'danger' : ''}`}>{hint}</div>
  </div>;
}

function Vets({ vets, appointments = [], create, update, onDelete, selectedClinic }) {
  const [openOnboard, setOpenOnboard] = useState(false);
  const [editingVet, setEditingVet] = useState(null);

  return (
    <Screen
      title="Veterinarians"
      sub={`${selectedClinic?.name || 'Clinic'} · ${vets.length} vets on staff`}
      action={<button className="btn btn-primary" onClick={() => setOpenOnboard(true)}>+ Onboard Vet</button>}
    >
      <section style={{ background: 'transparent', border: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '18px' }}>NAME</th>
              <th>SPECIALIZATION</th>
              <th>EXPERIENCE</th>
              <th>CONSULTATION FEE</th>
              <th>STATUS</th>
              <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {vets.length > 0 ? (
              vets.map((vet) => {
                let displayStatus = vet.status || 'Available';

                const now = new Date();
                const nowStr = now.toDateString();

                const inConsultation = appointments.some(appt => {
                  if (appt.vetName !== vet.name) return false;
                  if (appt.status === 'Completed' || appt.status === 'Cancelled') return false;

                  const apptDate = new Date(appt.date);
                  if (nowStr !== apptDate.toDateString()) return false;

                  if (!appt.time) return false;
                  let startHour, startMin, endHour, endMin;
                  if (appt.time.includes('-')) {
                    const [startT, endT] = appt.time.split('-');
                    [startHour, startMin] = startT.trim().split(':').map(Number);
                    [endHour, endMin] = endT.trim().split(':').map(Number);
                  } else {
                    [startHour, startMin] = appt.time.split(':').map(Number);
                    endHour = startHour;
                    endMin = startMin + (appt.durationMinutes || 30);
                    if (endMin >= 60) {
                      endHour += Math.floor(endMin / 60);
                      endMin = endMin % 60;
                    }
                  }

                  const start = new Date(now);
                  start.setHours(startHour, startMin, 0, 0);

                  const end = new Date(now);
                  end.setHours(endHour, endMin, 0, 0);

                  return now >= start && now <= end;
                });

                if (inConsultation) {
                  displayStatus = 'In Consultation';
                }

                return (
                  <tr key={vet._id}>
                    <td style={{ paddingLeft: '18px' }}>
                      <div className="td-name">{vet.name}</div>
                      <div className="td-sub">{vet.email}</div>
                    </td>
                    <td>{vet.specialization || 'General Practice'}</td>
                    <td>{vet.experienceYears ? `${vet.experienceYears} yrs` : '-'}</td>
                    <td>{vet.consultationFee ? `$${vet.consultationFee}` : '-'}</td>
                    <td>
                      <Badge value={displayStatus} />
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => setEditingVet(vet)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '6px 8px', color: 'var(--red)', border: '1px solid #cbd5e1' }}
                          onClick={() => {
                            window.showConfirm(`Are you sure you want to delete Dr. ${vet.name}?`, () => {
                              onDelete('vets', vet._id);
                            });
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  No veterinarians onboarded. Click Onboard Vet to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {openOnboard && (
        <VetModal
          onClose={() => setOpenOnboard(false)}
          onSave={(body) => create('vets', body)
            .then(() => {
              window.showToast('Veterinarian onboarded successfully!', 'success');
              setOpenOnboard(false);
            })
            .catch(err => window.showToast(err.message, 'error'))
          }
        />
      )}

      {editingVet && (
        <VetModal
          vet={editingVet}
          onClose={() => setEditingVet(null)}
          onSave={(body) => update('vets', editingVet._id, body)
            .then(() => {
              window.showToast('Veterinarian updated successfully!', 'success');
              setEditingVet(null);
            })
            .catch(err => window.showToast(err.message, 'error'))
          }
        />
      )}
    </Screen>
  );
}

function Clients({ clients, create, update, onDelete, appointments, vaccinations, go, onSelectPet }) {
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedClients, setExpandedClients] = useState({});
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => {
      const matchOwner = c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q));
      const matchPet = (c.pets || []).some(p => p.name.toLowerCase().includes(q) || (p.breed && p.breed.toLowerCase().includes(q)));
      return matchOwner || matchPet;
    });
  }, [clients, search]);

  const petEmoji = (species = '') => {
    const s = (species || '').toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const getVaccinesBadgeForClient = (clientPets, vaccinations, clientName) => {
    let overdue = 0;
    let dueSoon = 0;
    let totalVaxes = 0;
    let hasCompleted = false;

    (clientPets || []).forEach(p => {
      const petVaxes = vaccinations.filter(v => v.petId ? v.petId === p._id : (v.petName === p.name && v.ownerName === clientName));
      totalVaxes += petVaxes.length;
      petVaxes.forEach(v => {
        const s = String(v.status).toLowerCase();
        if (s.includes('completed') || s.includes('waived') || v.lastDate) {
          hasCompleted = true;
        }
        if (s.includes('overdue')) overdue++;
        else if (s.includes('due') || s.includes('soon')) dueSoon++;
      });
    });

    if (totalVaxes === 0 || !hasCompleted) {
      return <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>Not recorded</span>;
    }

    if (overdue > 0) return <span className="badge b-red">{overdue} overdue</span>;
    if (dueSoon > 0) return <span className="badge b-amber">{dueSoon} due soon</span>;
    return <span className="badge b-green">Up to date</span>;
  };

  const getNextAppointmentBadge = (clientPets, appointments, clientName) => {
    const todayStr = getLocalDateString();
    const clientAppts = appointments.filter(a => {
      if (a.status === 'Completed' || a.status === 'Cancelled') return false;

      const isMatch = (clientPets || []).some(p => a.petId ? a.petId === p._id : (a.petName.toLowerCase() === p.name.toLowerCase() && a.ownerName === clientName));
      if (!isMatch) return false;

      const apptDateOnly = a.date && a.date.includes('T') ? a.date.split('T')[0] : a.date;
      if (apptDateOnly > todayStr) return true;
      if (apptDateOnly === todayStr) {
        const apptDateTime = parseApptDateTime(a.date, a.time);
        return apptDateTime > new Date();
      }
      return false;
    });

    if (clientAppts.length === 0) return <span style={{ color: 'var(--text-3)' }}>None</span>;

    clientAppts.sort((a, b) => {
      const timeA = a.time.includes('-') ? a.time.split('-')[0] : a.time;
      const timeB = b.time.includes('-') ? b.time.split('-')[0] : b.time;
      return new Date(`${a.date}T${timeA}`) - new Date(`${b.date}T${timeB}`);
    });
    const next = clientAppts[0];

    let timeStr = next.time;
    try {
      if (next.time.includes('-')) {
        const parts = next.time.split('-');
        const formatSingle = (singleT) => {
          const trimmed = singleT.trim();
          const hasPM = /PM/i.test(trimmed);
          const clean = trimmed.replace(/\s*[AP]M\s*$/i, '').trim();
          const [h, m] = clean.split(':');
          let hr = parseInt(h);
          if (hasPM && hr < 12) hr += 12;
          const ampm = hr >= 12 ? 'PM' : 'AM';
          const hr12 = hr % 12 || 12;
          return `${hr12}:${m || '00'} ${ampm}`;
        };
        timeStr = `${formatSingle(parts[0])}`;
      } else {
        const trimmed = next.time.trim();
        const hasPM = /PM/i.test(trimmed);
        const clean = trimmed.replace(/\s*[AP]M\s*$/i, '').trim();
        const [h, m] = clean.split(':');
        let hr = parseInt(h);
        if (hasPM && hr < 12) hr += 12;
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const hr12 = hr % 12 || 12;
        timeStr = `${hr12}:${m || '00'} ${ampm}`;
      }
    } catch (e) { }

    let prefix = next.date === todayStr ? 'Today ' : `${new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} `;

    let badgeColor = 'blue';
    if (next.type === 'Follow-up' || next.type === 'Follow Up' || next.reason?.toLowerCase().includes('follow')) {
      prefix = 'Follow-up ';
      badgeColor = 'purple';
    } else if (next.date !== todayStr) {
      badgeColor = 'amber';
    }

    return <span className={`badge b-${badgeColor}`}>{prefix}{timeStr}</span>;
  };

  const getLastVisitDate = (clientPets, appointments, clientCreatedAt, clientName) => {
    const pastAppts = appointments.filter(a => {
      if (a.status !== 'Completed' && new Date(a.date) >= new Date()) return false;
      return (clientPets || []).some(p => a.petId ? a.petId === p._id : (a.petName.toLowerCase() === p.name.toLowerCase() && a.ownerName === clientName));
    });
    if (pastAppts.length > 0) {
      pastAppts.sort((a, b) => new Date(b.date) - new Date(a.date));
      return new Date(pastAppts[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return '-';
  };

  return (
    <Screen
      title="Clients & Pets"
      sub={`${clients.reduce((sum, c) => sum + (c.pets || []).length, 0)} pets across ${clients.length} client accounts · Owner is the account, each pet is a separate patient`}
      action={<button className="btn btn-primary" onClick={() => setOpen(true)}>+ Register New Client</button>}
    >
      <div className="search-row">
        <input
          className="search-box"
          placeholder="Search by owner name, pet name, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-outline">Search</button>
      </div>

      <section style={{ background: 'transparent', border: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '18px' }}>OWNER / CLIENT</th>
              <th>PETS</th>
              <th>LAST VISIT</th>
              <th>NEXT APPOINTMENT</th>
              <th>VACCINES</th>
              <th style={{ textAlign: 'right', paddingRight: '24px' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.flatMap((client) => {
                const pets = client.pets && client.pets.length > 0 ? client.pets : [null];
                const isExpanded = expandedClients[client._id];
                const visiblePets = isExpanded ? pets : [pets[0]];
                // If collapsed, we analyze ALL pets. If expanded, we analyze just the individual pet for that row.
                const petsToAnalyze = (!isExpanded && pets.length > 1 && pets[0] !== null) ? pets : null;

                return visiblePets.map((pet, idx) => (
                  <tr key={`${client._id}-${pet ? pet._id || pet.name : 'nopet'}-${idx}`} style={idx > 0 ? { backgroundColor: '#fafafa' } : {}}>
                    <td style={{ paddingLeft: '18px', borderTop: idx > 0 ? 'none' : undefined }}>
                      {idx === 0 && (
                        <>
                          <div className="td-name">{client.name}</div>
                          <div className="td-sub">{client.email} · {client.phone}</div>
                        </>
                      )}
                    </td>
                    <td style={{ borderTop: idx > 0 ? 'none' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {pet ? (
                          <span
                            className="pet-chip"
                            style={{ cursor: 'pointer', marginBottom: 0 }}
                            onClick={() => {
                              onSelectPet(pet);
                              go('petprofile');
                            }}
                          >
                            {petEmoji(pet.species)} {pet.name}
                          </span>
                        ) : (
                          <span className="td-sub">No pets</span>
                        )}
                        {idx === 0 && pets.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedClients(prev => ({ ...prev, [client._id]: !prev[client._id] }));
                            }}
                            className="btn btn-outline"
                            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '12px', height: '24px' }}
                          >
                            {isExpanded ? 'Collapse' : `+${pets.length - 1} More`}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ borderTop: idx > 0 ? 'none' : undefined }}>{pet ? getLastVisitDate(petsToAnalyze || [pet], appointments, client.createdAt, client.name) : '-'}</td>
                    <td style={{ borderTop: idx > 0 ? 'none' : undefined }}>{pet ? getNextAppointmentBadge(petsToAnalyze || [pet], appointments, client.name) : <span className="td-sub">-</span>}</td>
                    <td style={{ borderTop: idx > 0 ? 'none' : undefined }}>{pet ? getVaccinesBadgeForClient(petsToAnalyze || [pet], vaccinations, client.name) : <span className="td-sub">-</span>}</td>
                    <td style={{ textAlign: 'right', paddingRight: '24px', borderTop: idx > 0 ? 'none' : undefined }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {pet && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: '6px 8px', color: 'var(--text-2)', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                              onSelectPet(pet);
                              go('petprofile');
                            }}
                            title={`View ${pet.name}'s Profile`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ display: 'block' }}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        )}
                        {idx === 0 && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-2)', border: '1px solid #cbd5e1' }}
                            onClick={() => setEditingClient(client)}
                            title="Edit Client & Pets"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  No clients or pets matching your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {open && (
        <ClientModal
          onClose={() => setOpen(false)}
          onSave={(body) => create('clients', body)
            .then(() => {
              window.showToast('Client added successfully!', 'success');
              setOpen(false);
            })
            .catch(err => window.showToast(err.message, 'error'))
          }
        />
      )}

      {editingClient && (
        <ClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSave={(body) => update('clients', editingClient._id, body)
            .then(() => {
              window.showToast('Client updated successfully!', 'success');
              setEditingClient(null);
            })
            .catch(err => window.showToast(err.message, 'error'))
          }
          onDeleteClient={() => {
            return onDelete('clients', editingClient._id)
              .then(() => {
                window.showToast('Client deleted successfully!', 'success');
                setEditingClient(null);
              })
              .catch(err => {
                window.showToast(err.message, 'error');
                throw err;
              });
          }}
        />
      )}
    </Screen>
  );
}

// Time-aware appointment parsing helper
const parseApptDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return new Date();
  const actualTime = timeStr.includes('-') ? timeStr.split('-')[0] : timeStr;
  const dateParts = dateStr.split('-');
  const timeParts = actualTime.split(':');
  if (dateParts.length === 3 && timeParts.length === 2) {
    const year = parseInt(dateParts[0], 10);
    const monthIndex = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    return new Date(year, monthIndex, day, hours, minutes);
  }
  return new Date(`${dateStr}T${actualTime}:00`); // fallback
};

// Timezone-resilient date helpers
const formatDateSafe = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[monthIndex]} ${day}, ${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

const formatMonthSafe = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex] || '';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getUTCMonth()] || '';
};

const getAgeStr = (dobStr) => {
  if (!dobStr) return '';
  try {
    const birth = new Date(dobStr);
    if (isNaN(birth.getTime())) return dobStr;
    const today = new Date();

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months--;
    }

    
    let totalMonths = (years * 12) + months;
    if (totalMonths < 0) totalMonths = 0;
    
    return `${totalMonths}M`;
  } catch (err) {

    return dobStr;
  }
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Configurable species/breed ideal range map
const parseWeightRange = (rangeStr) => {
  if (!rangeStr) return null;
  const cleaned = rangeStr.replace(/[a-zA-Z\s]/g, '');
  const parts = cleaned.split('-');
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max };
    }
  }
  return null;
};

const getIdealRange = (species = '', breed = '') => {
  const s = (species || '').toLowerCase();
  const b = (breed || '').toLowerCase();

  // Dogs
  if (s.includes('dog')) {
    if (b.includes('retriever') || b.includes('shepherd')) return { min: 60, max: 80 };
    if (b.includes('bulldog')) return { min: 40, max: 55 };
    if (b.includes('beagle')) return { min: 20, max: 30 };
    if (b.includes('poodle')) {
      if (b.includes('toy') || b.includes('mini')) return { min: 6, max: 15 };
      return { min: 45, max: 70 };
    }
    if (b.includes('french')) return { min: 16, max: 28 };
    return { min: 25, max: 75 }; // Default dog
  }

  // Cats
  if (s.includes('cat')) {
    if (b.includes('maine coon')) return { min: 11, max: 25 };
    if (b.includes('siamese') || b.includes('persian')) return { min: 7, max: 12 };
    return { min: 8, max: 15 }; // Default cat
  }

  // Rabbits
  if (s.includes('rabbit') || s.includes('lop')) {
    if (b.includes('flemish')) return { min: 10, max: 22 };
    if (b.includes('netherland') || b.includes('dwarf')) return { min: 1.5, max: 3.5 };
    return { min: 3, max: 10 }; // Default rabbit
  }

  // Birds
  if (s.includes('bird') || s.includes('parrot')) {
    if (b.includes('macaw')) return { min: 2, max: 4.5 };
    if (b.includes('cockatiel')) return { min: 0.15, max: 0.25 };
    return { min: 0.1, max: 4 }; // Default bird
  }

  return { min: 5, max: 50 }; // Safe overall fallback
};

function PetProfile({ pet, clients, appointments, vaccinations, soapnotes, weights, go, onSetBookingClient, onSetBookingPet, update, create }) {
  const [currentPet, setCurrentPet] = useState(pet);
  const [activeTab, setActiveTab] = useState('visits');
  const [editingVax, setEditingVax] = useState(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightLogVal, setWeightLogVal] = useState('');
  const [weightLogNote, setWeightLogNote] = useState('');
  const [weightTimeframe, setWeightTimeframe] = useState('12months');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [expandedVisits, setExpandedVisits] = useState({});

  const toggleVisitExpand = (id) => {
    setExpandedVisits(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    setCurrentPet(pet);
  }, [pet]);

  if (!currentPet) return <Status message="Select a pet to view profile." />;

  const owner = clients.find(c => (c.pets || []).some(p => p._id === currentPet._id));
  const ownerName = owner ? owner.name : (currentPet.ownerName || 'James Martinez');
  const ownerEmail = owner ? owner.email : (currentPet.email || 'james.m@email.com');
  const ownerPhone = owner ? owner.phone : (currentPet.phone || '(555) 824-3901');

  // Implicit booking state update removed to prevent leaking state to global appointments tab

  const ownerPets = owner ? (owner.pets || []) : [currentPet];

  const handlePrevPet = () => {
    const currentIndex = ownerPets.findIndex(p => p._id === currentPet._id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + ownerPets.length) % ownerPets.length;
      setCurrentPet(ownerPets[prevIndex]);
    }
  };

  const handleNextPet = () => {
    const currentIndex = ownerPets.findIndex(p => p._id === currentPet._id || p.name.toLowerCase() === currentPet.name.toLowerCase());
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % ownerPets.length;
      setCurrentPet(ownerPets[nextIndex]);
    }
  };

  const petEmoji = (species = '') => {
    const s = (species || '').toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const petWeights = weights.filter(w =>
    w.petName.toLowerCase() === currentPet.name.toLowerCase() &&
    w.ownerName.toLowerCase() === ownerName.toLowerCase()
  );
  const latestWeightLog = [...petWeights].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const currentWeight = (() => {
    if (petWeights.length === 0) return '-';
    const sorted = [...petWeights].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sorted[sorted.length - 1];
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    if (prev) {
      const diff = latest.value - prev.value;
      return `${latest.value.toFixed(1)} ${latest.unit || 'lbs'} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)} lbs)`;
    }
    return `${latest.value.toFixed(1)} ${latest.unit || 'lbs'}`;
  })();

  const currentWeightSimple = (() => {
    if (petWeights.length === 0) return '-';
    const sorted = [...petWeights].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sorted[sorted.length - 1];
    return `${latest.value.toFixed(1)} ${latest.unit || 'lbs'}`;
  })();

  // dynamic timeline records (visits) from SoapNotes
  const petVisits = soapnotes.filter(s => s.petId ? s.petId === currentPet._id : (s.petName.toLowerCase() === currentPet.name.toLowerCase() && s.ownerName.toLowerCase() === ownerName.toLowerCase()));

  // dynamic vaccinations
  const today = new Date().toISOString().split('T')[0];
  const next30Days = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const petVax = vaccinations.filter(v => v.petId ? v.petId === currentPet._id : (v.petName.toLowerCase() === currentPet.name.toLowerCase() && v.ownerName.toLowerCase() === ownerName.toLowerCase())).map(v => {
    let displayStatus = v.status;
    if (displayStatus === 'Completed' || displayStatus === 'Up to date') {
      displayStatus = 'Done';
    } else if (displayStatus !== 'Done' && displayStatus !== 'Not recorded') {
      if (v.dueDate < today) {
        displayStatus = 'Overdue';
      } else if (v.dueDate <= next30Days) {
        displayStatus = 'Due soon';
      } else {
        displayStatus = 'Upcoming';
      }
    }
    return { ...v, displayStatus };
  });

  const hasRecordedVax = petVax.some(v =>
    v.isRecorded ||
    String(v.status).toLowerCase().includes('done') ||
    String(v.status).toLowerCase().includes('completed') ||
    String(v.status).toLowerCase().includes('waived') ||
    v.lastDate
  );

  let vaxIndicatorColor = '#94a3b8'; // Grey
  let vaxIndicatorTooltip = 'Not recorded';
  if (petVax.length > 0) {
    if (!hasRecordedVax) {
      vaxIndicatorColor = '#94a3b8'; // Grey
      vaxIndicatorTooltip = 'Not recorded';
    } else if (petVax.some(v => v.displayStatus === 'Overdue')) {
      vaxIndicatorColor = 'var(--red)';
      vaxIndicatorTooltip = 'Vaccines Overdue!';
    } else if (petVax.some(v => v.displayStatus === 'Due soon')) {
      vaxIndicatorColor = 'var(--amber)';
      vaxIndicatorTooltip = 'Vaccines Due Soon';
    } else if (petVax.some(v => v.displayStatus === 'Done')) {
      vaxIndicatorColor = 'var(--green)';
      vaxIndicatorTooltip = 'Vaccines Done';
    } else {
      vaxIndicatorColor = '#94a3b8'; // Grey
      vaxIndicatorTooltip = 'Vaccines Pending';
    }
  }

  // Find the first assigned vet name from the appointments
  const petAppts = appointments.filter(a => a.petId ? a.petId === currentPet._id : (a.petName.toLowerCase() === currentPet.name.toLowerCase() && a.ownerName.toLowerCase() === ownerName.toLowerCase()));
  const assignedVetAppt = petAppts.find(a => a.vetName);
  const primaryVetName = assignedVetAppt ? assignedVetAppt.vetName : null;

  const handleBookAppointment = () => {
    onSetBookingClient(owner);
    onSetBookingPet(currentPet);
    go('booking');
  };

  const formatDOB = (dobStr) => {
    if (!dobStr) return '';
    try {
      const d = new Date(dobStr);
      if (isNaN(d.getTime())) return dobStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dobStr;
    }
  };
  const calculatedAge = getAgeStr(currentPet.dateOfBirth || currentPet.dob) || currentPet.age || 'Not Provided';

  const petDetailsList = [];

  if (currentPet.petId) {
    petDetailsList.push({ label: 'Pet ID', value: currentPet.petId });
  }

  petDetailsList.push({ label: 'Date of Birth', value: currentPet.dateOfBirth ? formatDOB(currentPet.dateOfBirth) : 'Not Provided' });

  petDetailsList.push({ label: 'Microchip', value: (currentPet.microchip && currentPet.microchip.trim()) ? currentPet.microchip : 'Not Provided' });

  petDetailsList.push({ label: 'Insurance', value: (currentPet.insurance && currentPet.insurance.trim() && currentPet.insurance !== 'None') ? currentPet.insurance : 'Not Provided' });

  petDetailsList.push({ label: 'Blood Group', value: currentPet.bloodType || 'Not Provided' });

  petDetailsList.push({ label: 'Primary Vet', value: primaryVetName || 'Not Assigned' });
  petDetailsList.push({ label: 'Owner', value: ownerName, isLink: true });

  const breadcrumbs = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-3)' }}>
      <span style={{ cursor: 'pointer', color: 'var(--brand)', textDecoration: 'none' }} onClick={() => go('clients')}>Clients & Pets</span>
      <span>›</span>
      <span style={{ color: 'var(--text-2)' }}>{ownerName}</span>
      <span>›</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: 'var(--text)' }}>
        {petEmoji(currentPet.species)} {currentPet.name}
      </span>
    </div>
  );

  const actionButtons = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button className="btn btn-outline" style={{ background: '#fff' }} onClick={handleBookAppointment}>+ Book Appointment</button>
    </div>
  );

  const handleSavePetDetails = async (updatedPetFields) => {
    try {
      const ownerClient = clients.find(c => (c.pets || []).some(p => p._id === currentPet._id));
      if (!ownerClient) {
        alert("Parent client account not found!");
        return;
      }

      // If weight was modified, let's also create a weight log so it syncs with the weight chart and lists!
      const oldWeight = String(currentPet.weightRange || '').trim();
      const newWeight = String(updatedPetFields.weightRange || '').trim();
      if (newWeight && newWeight !== oldWeight) {
        const parsedWeight = parseFloat(newWeight);
        if (!isNaN(parsedWeight)) {
          await create('weights', {
            petName: currentPet.name,
            ownerName: ownerClient.name,
            value: parsedWeight,
            unit: 'lbs',
            date: getLocalDateString(),
            note: 'Updated via profile edit'
          });
        }
      }

      const updatedPets = (ownerClient.pets || []).map(p => {
        if (p._id === currentPet._id) {
          return {
            ...p,
            microchip: updatedPetFields.microchip,
            insurance: updatedPetFields.insurance,
            bloodType: updatedPetFields.bloodType,
            weightRange: updatedPetFields.weightRange
          };
        }
        return p;
      });

      const updatedClientBody = {
        ...ownerClient,
        pets: updatedPets
      };

      await update('clients', ownerClient._id, updatedClientBody);

      // Find the updated pet inside updatedPets
      const savedPet = updatedPets.find(p => p._id === currentPet._id);
      if (savedPet) {
        setCurrentPet({
          ...savedPet,
          ownerId: ownerClient._id,
          ownerName: ownerClient.name,
          email: ownerClient.email,
          phone: ownerClient.phone
        });
      }

      setIsEditModalOpen(false);
      window.showToast?.('Pet medical profile details saved successfully!');
    } catch (err) {
      console.error(err);
      alert("Failed to save pet details: " + err.message);
    }
  };

  return (
    <>
      <Screen title={breadcrumbs} sub="" action={actionButtons}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* LEFT COLUMN: PET CARDS & DETAILS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* BLUE HERO CARD */}
            <div style={{
              background: 'var(--brand)',
              borderRadius: '16px',
              padding: '24px 16px',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(37,99,235,0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '10px' }}>
                {ownerPets.length > 1 ? (
                  <button
                    type="button"
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 0,
                      color: 'white',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background 0.2s'
                    }}
                    onClick={handlePrevPet}
                    title="Previous Pet"
                  >
                    &lt;
                  </button>
                ) : <div style={{ width: '28px' }} />}

                <div style={{ position: 'relative', fontSize: '48px', lineHeight: '1' }}>
                  {petEmoji(currentPet.species)}
                  <div
                    title={vaxIndicatorTooltip}
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '-4px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: vaxIndicatorColor,
                      border: '2px solid var(--primary)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </div>

                {ownerPets.length > 1 ? (
                  <button
                    type="button"
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 0,
                      color: 'white',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background 0.2s'
                    }}
                    onClick={handleNextPet}
                    title="Next Pet"
                  >
                    &gt;
                  </button>
                ) : <div style={{ width: '28px' }} />}
              </div>

              <h2 style={{ fontSize: '26px', margin: '12px 0 2px 0', fontWeight: '800', color: '#fff' }}>{currentPet.name}</h2>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
                {currentPet.breed || 'Mixed Breed'} - {currentPet.sex || 'Male'} - {currentPet.spayedNeutered === 'Yes' ? 'Neutered/Spayed' : 'Intact'}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '20px', justifyContent: 'center', flexWrap: 'nowrap', width: '100%' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  ⏱️ {calculatedAge}
                </span>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  ⚖️ {currentWeightSimple}
                </span>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  🩸 {(() => {
                    const bt = currentPet.bloodType || '-';
                    return bt.replace(/positive/i, 'Pos').replace(/negative/i, 'Neg');
                  })()}
                </span>
              </div>
            </div>

            {/* PET DETAILS PANEL */}
            <section className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '800', letterSpacing: '.07em', textTransform: 'uppercase', margin: 0 }}>
                  PET DETAILS
                </div>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--brand)',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    transition: 'opacity 0.2s'
                  }}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  Edit
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {petDetailsList.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-3)' }}>{item.label}</span>
                    {item.isLink ? (
                      <span
                        style={{ color: 'var(--brand)', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => go('clients')}
                      >
                        {item.value}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text)', fontWeight: '700' }}>{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* VACCINATION STATUS SUMMARY */}
            <section className="panel" style={{ padding: '16px 18px', borderRadius: '12px', background: '#fff' }}>
              <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '800', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '14px' }}>
                VACCINATION STATUS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {petVax.length > 0 ? (
                  petVax.map(v => (
                    <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: v.displayStatus === 'Overdue' ? 'var(--red)' : v.displayStatus === 'Due soon' ? 'var(--amber)' : v.displayStatus === 'Not recorded' ? 'var(--text-3)' : v.displayStatus === 'Upcoming' ? 'var(--blue)' : 'var(--green)', fontSize: '14px' }}>●</span>
                        <strong style={{ color: 'var(--text)' }}>{v.vaccine}</strong>
                      </div>
                      <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{v.displayStatus === 'Not recorded' ? '-' : new Date(v.dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No vaccination records found</div>
                )}
              </div>
            </section>

          </div>

          {/* RIGHT COLUMN: TABS & TIMELINE CONTENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* TAB HEADERS */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '24px', paddingBottom: '4px' }}>
              {[
                ['Visit History', 'visits'],
                ['Weight Chart', 'weight'],
                ['Vaccinations', 'vaccines'],
                ['Prescriptions', 'prescriptions']
              ].map(([label, id]) => (
                <button
                  key={id}
                  style={{
                    border: 0,
                    borderBottom: activeTab === id ? '2px solid var(--brand)' : '2px solid transparent',
                    background: 'transparent',
                    padding: '6px 0 10px 0',
                    fontSize: '14px',
                    fontWeight: activeTab === id ? '700' : '500',
                    color: activeTab === id ? 'var(--brand)' : 'var(--text-3)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT PANEL */}
            <div style={{ minHeight: '400px' }}>

              {/* VISIT HISTORY TIMELINE */}
              {activeTab === 'visits' && (
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px' }}>
                  {/* Timeline vertical bar */}
                  <div style={{
                    position: 'absolute',
                    left: '8px',
                    top: '12px',
                    bottom: '12px',
                    width: '2px',
                    background: 'var(--border)',
                    zIndex: '1'
                  }} />

                  {petVisits.length > 0 ? (
                    petVisits.map((visit, index) => {
                      const visitType = visit.assessment.includes('Vaccinations') ? 'Vaccination' : visit.assessment.includes('Gastro') ? 'Sick visit' : 'Annual Wellness';
                      const icon = visitType === 'Vaccination' ? '💉' : visitType === 'Sick visit' ? '💊' : '🩺';
                      const formattedDate = visit.createdAt ? new Date(visit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 19, 2026';

                      return (
                        <div key={visit._id} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                          {/* Timeline node */}
                          <div style={{
                            position: 'absolute',
                            left: '-26px',
                            top: '6px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#fff',
                            border: '2px solid var(--brand)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '11px',
                            zIndex: '2'
                          }}>
                            {icon}
                          </div>

                          {/* Timeline Card */}
                          <div className="panel" style={{ flex: 1, padding: '14px 18px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>
                              {formattedDate} · {visit.vetName || 'Dr. Sarah Chen'} · {visitType}
                            </div>
                            <h4 style={{ fontSize: '15px', margin: '0 0 8px 0', fontWeight: '800', color: 'var(--text)' }}>
                              {visit.assessment.split('.')[0]}
                            </h4>
                            {(() => {
                              const fullText = `${visit.subjective || ''} ${visit.objective || ''} ${visit.plan || ''}`.trim();
                              const isExpanded = !!expandedVisits[visit._id || index];
                              const isLong = fullText.length > 250;

                              return (
                                <>
                                  <p 
                                    style={{ 
                                      fontSize: '13px', 
                                      color: 'var(--text-2)', 
                                      margin: '0 0 8px 0', 
                                      lineHeight: '1.45',
                                      display: isExpanded ? 'block' : '-webkit-box',
                                      WebkitLineClamp: isExpanded ? 'none' : 4,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: isExpanded ? 'visible' : 'hidden'
                                    }}
                                  >
                                    {fullText}
                                  </p>
                                  {isLong && (
                                    <button
                                      type="button"
                                      style={{
                                        background: 'transparent',
                                        border: 0,
                                        color: 'var(--brand)',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        padding: '0 0 8px 0',
                                        display: 'block',
                                        outline: 'none',
                                        textAlign: 'left'
                                      }}
                                      onClick={() => toggleVisitExpand(visit._id || index)}
                                    >
                                      {isExpanded ? 'Show Less ▴' : 'Read More ▾'}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                            {visit.tags && visit.tags.length > 0 && (
                              <div className="chips">
                                {visit.tags.map(t => (
                                  <span
                                    className={`badge b-${t.includes('✓') || t.includes('Resolved') ? 'green' : t.includes('booster') || t.includes('needed') ? 'amber' : 'blue'}`}
                                    key={t}
                                    style={{ fontSize: '11px', padding: '2px 8px' }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>No visit history found.</div>
                  )}
                </div>
              )}

              {/* WEIGHT CHART TABS */}
              {activeTab === 'weight' && (() => {
                const sortedPetWeights = [...petWeights].sort((a, b) => new Date(a.date) - new Date(b.date));
                const hasWeights = sortedPetWeights.length > 0;

                const petSpecies = currentPet.species || 'Dog';
                const petBreed = currentPet.breed || 'Golden Retriever';

                const parsedRange = parseWeightRange(currentPet.weightRange);
                const idealRange = parsedRange || getIdealRange(petSpecies, petBreed);
                const idealMin = idealRange.min;
                const idealMax = idealRange.max;

                const currentWeightRecord = hasWeights ? sortedPetWeights[sortedPetWeights.length - 1] : null;
                const currentWeight = currentWeightRecord ? currentWeightRecord.value : 0;
                const currentUnit = currentWeightRecord ? currentWeightRecord.unit : 'lbs';

                const previousWeightRecord = sortedPetWeights.length > 1 ? sortedPetWeights[sortedPetWeights.length - 2] : null;
                const lastDiff = previousWeightRecord ? (currentWeight - previousWeightRecord.value) : 0;
                const lastDiffStr = !hasWeights ? 'No weight logged' : previousWeightRecord ? `(${lastDiff >= 0 ? '+' : ''}${lastDiff.toFixed(1)} lbs from previous visit)` : 'Initial weight visit';
                const lastDiffColor = !hasWeights ? 'var(--text-3)' : lastDiff > 0 ? 'var(--amber)' : lastDiff < 0 ? 'var(--green)' : 'var(--text-3)';

                const latestWeightDate = currentWeightRecord ? new Date(currentWeightRecord.date) : new Date();
                const sixMonthsAgo = new Date(latestWeightDate);
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                let sixMonthWeight = currentWeightRecord;
                for (let i = sortedPetWeights.length - 1; i >= 0; i--) {
                  if (new Date(sortedPetWeights[i].date) <= sixMonthsAgo) {
                    sixMonthWeight = sortedPetWeights[i];
                    break;
                  }
                }
                if (!sixMonthWeight && sortedPetWeights.length > 0) sixMonthWeight = sortedPetWeights[0];

                const sixMonthDiff = sixMonthWeight ? (currentWeight - sixMonthWeight.value) : 0;
                const sixMonthDiffStr = !hasWeights ? '—' : sixMonthDiff > 0 ? `+${sixMonthDiff.toFixed(1)}` : sixMonthDiff < 0 ? `${sixMonthDiff.toFixed(1)}` : '0.0';

                const initialWeight = currentWeight - sixMonthDiff;
                const pctChange = initialWeight > 0 ? (sixMonthDiff / initialWeight) * 100 : 0;
                const isSignificant = hasWeights && Math.abs(pctChange) > 5;

                let sixMonthTrendStr = !hasWeights ? 'No weight history' : 'Stable weight trend';
                let sixMonthDiffColor = 'var(--green)';
                if (isSignificant) {
                  sixMonthTrendStr = '⚠ Dietary review recommended';
                  sixMonthDiffColor = 'var(--amber)';
                }

                const isWithinRange = hasWeights && currentWeight >= idealMin && currentWeight <= idealMax;
                const rangeColor = !hasWeights ? 'var(--text-3)' : isWithinRange ? 'var(--green)' : 'var(--amber)';
                const rangeStr = !hasWeights ? 'Awaiting weight log' : isWithinRange ? '✓ Currently within range' : '⚠ Outside ideal range';

                const logList = [...sortedPetWeights].reverse();
                const now = new Date();
                const twelveMonthsAgo = new Date(now.setFullYear(now.getFullYear() - 1));
                const chartData = weightTimeframe === '12months'
                  ? sortedPetWeights.filter(w => new Date(w.date) >= twelveMonthsAgo)
                  : sortedPetWeights;

                // Dynamic Weight Graph Scaling
                const weightValues = chartData.map(w => w.value);
                let minWeight = Math.min(...weightValues, idealMin);
                let maxWeight = Math.max(...weightValues, idealMax);

                const weightRangeDiff = maxWeight - minWeight;
                const paddingVal = weightRangeDiff > 0 ? weightRangeDiff * 0.15 : 2;
                minWeight = Math.max(0, minWeight - paddingVal);
                maxWeight = maxWeight + paddingVal;

                const yRange = 108;
                const points = chartData.map((w, index) => {
                  let x = 44;
                  if (chartData.length > 1) {
                    x = 44 + (446 / (chartData.length - 1)) * index;
                  } else {
                    x = 267;
                  }
                  let y = 124;
                  const diff = maxWeight - minWeight;
                  if (diff > 0) {
                    y = 124 - ((w.value - minWeight) / diff) * yRange;
                  } else {
                    y = 70;
                  }
                  if (y < 16) y = 16;
                  if (y > 124) y = 124;
                  return { x, y, value: w.value, dateStr: w.date };
                });

                const getWeightAtY = (yCoord) => {
                  const diff = maxWeight - minWeight;
                  if (diff > 0) {
                    return (minWeight + ((124 - yCoord) / yRange) * diff).toFixed(1);
                  }
                  return minWeight.toFixed(1);
                };

                let idealYMax = 124;
                let idealYMin = 16;
                const diff = maxWeight - minWeight;
                if (diff > 0) {
                  idealYMin = 124 - ((idealMax - minWeight) / diff) * yRange;
                  idealYMax = 124 - ((idealMin - minWeight) / diff) * yRange;
                }
                if (idealYMin < 16) idealYMin = 16;
                if (idealYMin > 124) idealYMin = 124;
                if (idealYMax < 16) idealYMax = 16;
                if (idealYMax > 124) idealYMax = 124;

                const idealHeight = idealYMax - idealYMin;
                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

                const handleLogWeightInTab = () => {
                  setWeightLogVal('');
                  setWeightLogNote('');
                  setIsWeightModalOpen(true);
                };

                const handleSaveNewWeight = () => {
                  if (!weightLogVal || isNaN(weightLogVal)) {
                    alert("Please enter a valid numeric weight.");
                    return;
                  }
                  create('weights', {
                    petName: currentPet.name,
                    ownerName: ownerName,
                    value: Number(weightLogVal),
                    unit: currentUnit,
                    date: getLocalDateString(),
                    note: weightLogNote || 'Manual entry via profile'
                  }).then(() => {
                    setIsWeightModalOpen(false);
                    setWeightLogVal('');
                    setWeightLogNote('');
                    window.showToast?.('Weight logged successfully!');
                  }).catch(err => {
                    alert("Failed to save weight: " + err.message);
                  });
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-8px' }}>
                      <button className="btn btn-primary btn-sm" onClick={handleLogWeightInTab}>+ Log Weight</button>
                    </div>
                    <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: '700', letterSpacing: '.06em' }}>CURRENT WEIGHT</div>
                        <div style={{ fontSize: '30px', fontWeight: '700', color: 'var(--text)' }}>
                          {hasWeights ? currentWeight.toFixed(1) : '-'} <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: '400' }}>{hasWeights ? currentUnit : ''}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: lastDiffColor, marginTop: '3px', fontWeight: '500' }}>{lastDiffStr}</div>
                      </div>
                      <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: '700', letterSpacing: '.06em' }}>6-MONTH CHANGE</div>
                        <div style={{ fontSize: '30px', fontWeight: '700', color: sixMonthDiffColor }}>{sixMonthDiffStr} <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: '400' }}>{hasWeights ? currentUnit : ''}</span></div>
                        <div style={{ fontSize: '11px', color: sixMonthDiffColor, marginTop: '3px', fontWeight: '500' }}>{sixMonthTrendStr}</div>
                      </div>
                      <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: '700', letterSpacing: '.06em' }}>IDEAL RANGE</div>
                        <div style={{ fontSize: '26px', fontWeight: '700', color: rangeColor }}>{idealMin}–{idealMax} <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: '400' }}>{currentUnit}</span></div>
                        <div style={{ fontSize: '11px', color: rangeColor, marginTop: '3px', fontWeight: '500' }}>{rangeStr}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: '16px' }}>
                      <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Weight Over Time</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{weightTimeframe === '12months' ? 'Last 12 months' : 'All time'} · All clinic visits</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className={`badge ${weightTimeframe === '12months' ? 'b-blue' : 'b-gray'}`} style={{ cursor: 'pointer' }} onClick={() => setWeightTimeframe('12months')}>12 months</span>
                            <span className={`badge ${weightTimeframe === 'alltime' ? 'b-blue' : 'b-gray'}`} style={{ cursor: 'pointer' }} onClick={() => setWeightTimeframe('alltime')}>All time</span>
                          </div>
                        </div>

                        <svg viewBox="0 0 500 150" style={{ width: '100%', height: '150px', display: 'block' }}>
                          <defs>
                            <linearGradient id="tabBg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
                              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <line x1="44" y1="16" x2="490" y2="16" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="44" y1="52" x2="490" y2="52" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="44" y1="88" x2="490" y2="88" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="44" y1="124" x2="490" y2="124" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

                          <text x="38" y="20" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(16)}</text>
                          <text x="38" y="56" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(52)}</text>
                          <text x="38" y="92" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(88)}</text>
                          <text x="38" y="128" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(124)}</text>

                          {points.map(p => (
                            <text key={p.x} x={p.x} y="142" fontSize="9" fill="var(--text-3)" textAnchor="middle" fontFamily="sans-serif">
                              {formatMonthSafe(p.dateStr)}
                            </text>
                          ))}

                          <rect x="44" y={idealYMin} width="446" height={idealHeight > 0 ? idealHeight : 2} fill="#16A34A" fillOpacity="0.06" rx="2" />

                          {points.length > 0 && (
                            <>
                              <path d={`${pathD} L ${points[points.length - 1].x},124 L ${points[0].x},124 Z`} fill="url(#tabBg)" />
                              <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              {points.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 4} fill={i === points.length - 1 ? "#F97316" : "#3B82F6"} stroke="var(--bg)" strokeWidth="2" />
                              ))}
                            </>
                          )}

                          {!hasWeights && (
                            <text x="267" y="75" fontSize="12" fill="var(--text-3)" textAnchor="middle" fontFamily="sans-serif">No weight history logged yet</text>
                          )}
                        </svg>
                      </div>

                      <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px', marginLeft: '4px' }}>Visit Log</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {logList.length > 0 ? (
                            logList.map((row, i) => {
                              let diffStr = '—';
                              let diffColor = 'var(--text-3)';
                              if (i < logList.length - 1) {
                                const diff = row.value - logList[i + 1].value;
                                if (diff > 0) {
                                  diffStr = `↑ +${diff.toFixed(1)}`;
                                  diffColor = 'var(--amber)';
                                } else if (diff < 0) {
                                  diffStr = `↓ -${Math.abs(diff).toFixed(1)}`;
                                  diffColor = 'var(--green)';
                                } else {
                                  diffStr = `—`;
                                  diffColor = 'var(--text-3)';
                                }
                              }

                              return (
                                <div key={row._id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                  <div style={{ width: '90px' }}>
                                    <span style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--text-2)' }}>{formatDateSafe(row.date)}</span>
                                  </div>
                                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', flex: 1, textAlign: 'center' }}>
                                    {row.value.toFixed(1)} <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '400' }}>{row.unit || 'lbs'}</span>
                                  </div>
                                  <div style={{ fontSize: '12.5px', color: diffColor, fontWeight: '600', width: '70px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {diffStr}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>No logs yet</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isWeightModalOpen && (
                      <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        animation: 'modalBackdropFade 0.25s ease-out forwards'
                      }}>
                        <style>{`
                          @keyframes modalBackdropFade {
                            from { opacity: 0; }
                            to { opacity: 1; }
                          }
                          @keyframes modalContentSlideUp {
                            from { transform: translateY(30px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                          }
                        `}</style>
                        <div style={{
                          background: '#fff',
                          borderRadius: '16px',
                          width: '100%',
                          maxWidth: '400px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                          border: '1px solid var(--border)',
                          padding: '24px',
                          animation: 'modalContentSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text)' }}>
                              ⚖️ Log New Weight
                            </h3>
                            <button
                              onClick={() => setIsWeightModalOpen(false)}
                              style={{
                                background: 'transparent',
                                border: 0,
                                fontSize: '20px',
                                color: 'var(--text-3)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              &times;
                            </button>
                          </div>

                          <div style={{ fontSize: '13px', color: 'var(--text-2)', background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            ⚖️ <strong>Auto-Capturing Current Date & Time:</strong>
                            <div style={{ marginTop: '4px', fontWeight: '600', color: 'var(--brand)' }}>
                              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-2)' }}>
                              Weight ({currentUnit}) <span style={{ color: 'red' }}>*</span>
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder={`Enter weight in ${currentUnit} (e.g. 32.4)`}
                              value={weightLogVal}
                              onChange={(e) => setWeightLogVal(e.target.value)}
                              autoFocus
                              style={{
                                padding: '10px 12px',
                                fontSize: '14px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-2)' }}>
                              Notes (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Routine checkup or post-diet review"
                              value={weightLogNote}
                              onChange={(e) => setWeightLogNote(e.target.value)}
                              style={{
                                padding: '10px 12px',
                                fontSize: '14px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-outline"
                              onClick={() => setIsWeightModalOpen(false)}
                              style={{ padding: '8px 16px', fontSize: '13px' }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={handleSaveNewWeight}
                              style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '600' }}
                            >
                              Save Log
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* VACCINATIONS TAB */}
              {activeTab === 'vaccines' && (
                <section className="panel no-pad" style={{ background: '#fff', borderRadius: '12px' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '15px' }}>Vaccination Records</h3>
                    <button className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setEditingVax({ isNew: true, status: 'Completed' })}>+ Add Vaccination</button>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: '14px' }}>Vaccine</th>
                        <th>Last Given</th>
                        <th>Next Due Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right', paddingRight: '14px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {petVax.length > 0 ? (
                        petVax.map(v => (
                          <tr key={v._id}>
                            <td style={{ paddingLeft: '14px', fontWeight: '700', color: 'var(--text)' }}>{v.vaccine}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{v.lastDate ? formatDateSafe(v.lastDate) : '-'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{v.displayStatus === 'Not recorded' ? '-' : formatDateSafe(v.dueDate)}</td>
                            <td><Badge value={v.displayStatus} /></td>
                            <td style={{ textAlign: 'right', paddingRight: '14px' }}>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                onClick={() => setEditingVax(v)}
                              >
                                Edit / Record
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)' }}>
                            No vaccination logs available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              )}

              {/* PRESCRIPTIONS TAB */}
              {activeTab === 'prescriptions' && (
                <section className="panel no-pad" style={{ background: '#fff', borderRadius: '12px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: '14px' }}>Prescription / Drug</th>
                        <th>Instructions</th>
                        <th>Visit Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const prescriptionList = petVisits.flatMap(v => {
                          const list = [];
                          
                          if (Array.isArray(v.prescription) && v.prescription.length > 0) {
                            v.prescription.forEach((rx, idx) => {
                              if (rx && rx.medicine_name) {
                                const parts = [];
                                if (rx.dosage) parts.push(rx.dosage);
                                if (rx.frequency) parts.push(rx.frequency);
                                if (rx.duration) parts.push(rx.duration);
                                let instructionStr = parts.join(' — ');
                                if (rx.instructions) {
                                  instructionStr += instructionStr ? ` (${rx.instructions})` : rx.instructions;
                                }

                                let rxStatus = 'Completed';
                                if (v.createdAt) {
                                  const visitDate = new Date(v.createdAt);
                                  const now = new Date();
                                  const diffTime = Math.abs(now - visitDate);
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  
                                  let durationDays = 7;
                                  if (rx.duration) {
                                    const match = rx.duration.match(/(\d+)\s*day/i);
                                    if (match) {
                                      durationDays = parseInt(match[1]);
                                    } else {
                                      const anyNumMatch = rx.duration.match(/(\d+)/);
                                      if (anyNumMatch) {
                                        durationDays = parseInt(anyNumMatch[1]);
                                      }
                                    }
                                  }
                                  if (diffDays <= durationDays) {
                                    rxStatus = 'Active';
                                  }
                                } else {
                                  rxStatus = 'Active';
                                }

                                list.push({
                                  id: `${v._id || 'v'}-${idx}`,
                                  drug: rx.medicine_name,
                                  instruction: instructionStr || 'Use as directed',
                                  date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jun 1, 2026',
                                  status: rxStatus
                                });
                              }
                            });
                          } else {
                            if (v.plan && typeof v.plan === 'string') {
                              if (v.plan.includes('Otomax')) {
                                list.push({
                                  id: v._id + '1',
                                  drug: 'Otomax ear drops',
                                  instruction: 'Apply Otomax ointment twice daily for 7 days',
                                  date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'May 19, 2026',
                                  status: 'Active'
                                });
                              }
                              if (v.plan.includes('Metronidazole')) {
                                list.push({
                                  id: v._id + '2',
                                  drug: 'Metronidazole 250mg',
                                  instruction: 'Take twice daily for 5 days',
                                  date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Nov 12, 2025',
                                  status: 'Completed'
                                });
                              }
                            }
                          }
                          return list;
                        });

                        if (prescriptionList.length > 0) {
                          return prescriptionList.map(p => (
                            <tr key={p.id}>
                              <td style={{ paddingLeft: '14px', fontWeight: '700', color: 'var(--text)' }}>{p.drug}</td>
                              <td>{p.instruction}</td>
                              <td>{p.date}</td>
                              <td>
                                <span className={`badge b-${p.status === 'Active' ? 'blue' : 'green'}`}>{p.status}</span>
                              </td>
                            </tr>
                          ));
                        } else {
                          return (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)' }}>
                                No active or completed prescriptions logged
                              </td>
                            </tr>
                          );
                        }
                      })()}
                    </tbody>
                  </table>
                </section>
              )}

            </div>

          </div>

        </div>
      </Screen>
      {isEditModalOpen && (
        <PetEditModal
          pet={currentPet}
          owner={owner}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSavePetDetails}
        />
      )}
      {editingVax && (
        <PetVaccinationEditModal
          vaccination={editingVax}
          pet={currentPet}
          onClose={() => setEditingVax(null)}
          onSave={(updated) => {
            if (updated.isNew) {
              const payload = { ...updated, petName: currentPet.name, ownerName: owner.name, breed: currentPet.breed, clinic_id: owner.clinic_id };
              create('vaccinations', payload)
                .then(() => {
                  window.showToast('Vaccination added successfully!', 'success');
                  setEditingVax(null);
                })
                .catch(err => window.showToast(err.message, 'error'));
            } else {
              update('vaccinations', updated._id, updated)
                .then(() => {
                  window.showToast('Vaccination updated successfully!', 'success');
                  setEditingVax(null);
                })
                .catch(err => window.showToast(err.message, 'error'));
            }
          }}
        />
      )}
    </>
  );
}

function PetEditModal({ pet, owner, onClose, onSave }) {
  const [microchip, setMicrochip] = useState(pet.microchip || '');
  const [insurance, setInsurance] = useState(pet.insurance || '');
  const [bloodType, setBloodType] = useState(pet.bloodType || '');
  const [weight, setWeight] = useState(pet.weightRange || '');

  const wrapRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      if (wrapRef.current) {
        wrapRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
  }, []);

  const speciesKey = String(pet.species || 'Dog').toLowerCase();
  let bloodGroupOptions = [];
  if (speciesKey.includes('dog')) {
    bloodGroupOptions = ['DEA 1.1 Positive', 'DEA 1.1 Negative', 'DEA 1.2', 'DEA 3', 'DEA 4', 'DEA 5', 'DEA 7'];
  } else if (speciesKey.includes('cat')) {
    bloodGroupOptions = ['A', 'B', 'AB'];
  } else if (speciesKey.includes('rabbit')) {
    bloodGroupOptions = ['A', 'B'];
  } else if (speciesKey.includes('bird') || speciesKey.includes('parrot')) {
    bloodGroupOptions = ['Unknown', 'Not Tested'];
  } else {
    bloodGroupOptions = ['Unknown', 'Not Tested'];
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      microchip: microchip || undefined,
      insurance: insurance || undefined,
      bloodType: bloodType || undefined,
      weightRange: weight || undefined
    });
  };

  return (
    <div
      ref={wrapRef}
      className="modal-wrap"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        overflowY: 'auto',
        padding: '24px 16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal client-modal-card"
        style={{
          width: 'min(480px, calc(100% - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          background: 'white',
          borderRadius: '12px',
          padding: '22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto'
        }}
      >
        <div className="modal-hd" style={{ flexShrink: 0 }}>
          <h3>Edit Medical Profile</h3>
          <button type="button" className="modal-x" onClick={onClose}>×</button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: 1
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '18px',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: '6px',
            minHeight: 0,
            flex: 1
          }}>

            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '8px' }}>
              Medical & Profile Extensions ({pet.name})
            </div>

            <label className="field-label">
              Microchip #
              <input
                className="input"
                placeholder="Not Provided"
                value={microchip}
                onChange={e => setMicrochip(e.target.value)}
              />
            </label>

            <label className="field-label">
              Insurance
              <input
                className="input"
                placeholder="e.g. Nationwide, Trupanion"
                value={insurance}
                onChange={e => setInsurance(e.target.value)}
              />
            </label>

            <label className="field-label">
              Blood Group
              <select
                className="input"
                value={bloodType}
                onChange={e => setBloodType(e.target.value)}
              >
                <option value="">Not Provided</option>
                {bloodGroupOptions.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Weight (lbs)
              <input
                className="input"
                type="number"
                step="0.1"
                placeholder="Not Provided"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
            </label>

          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border)',
            paddingTop: '14px',
            flexShrink: 0,
            flexWrap: 'wrap'
          }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Vaccinations({ rows, update, clients = [] }) {
  const [viewingVax, setViewingVax] = React.useState(null);

  const petEmoji = (species = '') => {
    const s = (species || '').toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const mappedRows = React.useMemo(() => {
    const petHistoryMap = {};
    rows.forEach(r => {
      const key = `${r.petName?.toLowerCase()}_${r.ownerName?.toLowerCase()}_${r.vaccine?.toLowerCase()}`;
      if (!petHistoryMap[key]) {
        petHistoryMap[key] = false;
      }
      if (String(r.status).toLowerCase().includes('completed') || String(r.status).toLowerCase().includes('done') || String(r.status).toLowerCase().includes('waived') || r.lastDate) {
        petHistoryMap[key] = true;
      }
    });

    return rows.map(r => {
      const key = `${r.petName?.toLowerCase()}_${r.ownerName?.toLowerCase()}_${r.vaccine?.toLowerCase()}`;
      const hasHistory = petHistoryMap[key];
      let displayStatus = r.status;
      if (!hasHistory && r.status === 'Pending') {
        displayStatus = 'Not recorded';
      } else if (displayStatus === 'Completed' || displayStatus === 'Up to date') {
        displayStatus = 'Done';
      }
      return { ...r, displayStatus };
    });
  }, [rows]);

  const upToDate = mappedRows.filter(r => String(r.displayStatus).toLowerCase().includes('done')).length;
  const overdue = mappedRows.filter(r => String(r.displayStatus).toLowerCase().includes('overdue')).length;
  const dueSoon = mappedRows.filter(r => String(r.displayStatus).toLowerCase().includes('due in') || String(r.displayStatus).toLowerCase().includes('due soon') || (String(r.displayStatus).toLowerCase().includes('pending') && r.displayStatus !== 'Not recorded')).length;

  const getReminderStatusDisplay = (reminderStatus) => {
    if (!reminderStatus || reminderStatus === 'Not sent') return <span style={{ color: 'var(--text-3)' }}>Not sent</span>;
    if (reminderStatus.startsWith('Auto-sent')) return <Badge value={reminderStatus} tone="green" />;
    return <Badge value={reminderStatus} tone="blue" />;
  };

  const handleTriggerReminder = async (id) => {
    try {
      const res = await fetch(`${API_URL}/vaccinations/${id}/remind`, {
        method: 'POST'
      });
      if (res.ok) {
        window.showToast?.('Automated Reminder Queued successfully!');
        update('vaccinations', id, { reminderStatus: 'Resent just now' });
      } else {
        alert("Failed to queue reminder.");
      }
    } catch (err) {
      console.error("Reminder error:", err);
    }
  };

  const getActionButtons = (row) => {
    const isUpToDate = String(row.displayStatus).toLowerCase().includes('done');
    const isNotSent = !row.reminderStatus || row.reminderStatus === 'Not sent';

    if (isUpToDate) {
      return <button className="btn btn-outline btn-sm" onClick={() => setViewingVax(row)}>View</button>;
    }

    if (isNotSent) {
      return <button className="btn btn-accent btn-sm" onClick={() => handleTriggerReminder(row._id)}>Notify Owner</button>;
    }

    return <button className="btn btn-outline btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={() => handleNotify(row, 'Resent just now')}>Resend</button>;
  };

  const handleBatch = async () => {
    try {
      const response = await fetch(`${API_URL}/vaccinations/remind/batch`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        alert(`Successfully queued ${data.count} reminders!`);
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      alert('Error triggering batch reminders.');
    }
  };

  const getDueDateStyle = (status) => {
    if (String(status).toLowerCase().includes('overdue')) return { color: 'var(--red)', fontWeight: 600 };
    if (String(status).toLowerCase().includes('due in') || String(status).toLowerCase().includes('due soon') || String(status).toLowerCase().includes('pending')) return { color: 'var(--amber)', fontWeight: 600 };
    if (String(status).toLowerCase().includes('not recorded')) return { color: 'var(--text-3)', fontWeight: 400 };
    return { color: 'var(--green)', fontWeight: 600 };
  };

  const getPetIcon = (row) => {
    let species = '';
    for (const client of clients) {
      if (client.name === row.ownerName) {
        const pet = (client.pets || []).find(p => p.name === row.petName);
        if (pet && pet.species) {
          species = pet.species;
          break;
        }
      }
    }
    return petEmoji(species || row.breed);
  };

  return (
    <Screen
      title="Vaccination Tracker"
      sub="Clinic-wide • Auto-reminders enabled"
      action={<button className="btn btn-accent" onClick={handleBatch}>Send Reminder Batch</button>}
    >
      <div className="tracker-cards">
        <div className="tracker-card green">
          <div className="tracker-icon">✅</div>
          <div className="tracker-info">
             <h3>{upToDate}</h3>
            <p>Done</p>
          </div>
        </div>
        <div className="tracker-card yellow">
          <div className="tracker-icon">⚠️</div>
          <div className="tracker-info">
            <h3>{dueSoon}</h3>
            <p>Due within 30 days</p>
          </div>
        </div>
        <div className="tracker-card red">
          <div className="tracker-icon">🚨</div>
          <div className="tracker-info">
            <h3>{overdue}</h3>
            <p>Overdue</p>
          </div>
        </div>
      </div>

      <Table headers={['PET', 'OWNER', 'VACCINE', 'LAST GIVEN', 'NEXT DUE', 'STATUS', 'REMINDER SENT', '']}>
        {mappedRows.map((row) => (
          <tr key={row._id}>
            <td>
              <div className="pet-cell">
                <div className="pet-avatar">{getPetIcon(row)}</div>
                <Name title={row.petName} sub={row.breed} />
              </div>
            </td>
            <td>{row.ownerName}</td>
            <td>{row.vaccine}</td>
            <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{row.lastDate ? formatDateSafe(row.lastDate) : '-'}</td>
            <td style={{ ...getDueDateStyle(row.displayStatus), whiteSpace: 'nowrap' }}>{row.displayStatus === 'Not recorded' ? '-' : formatDateSafe(row.dueDate)}</td>
            <td><Badge value={row.displayStatus} /></td>
            <td>{getReminderStatusDisplay(row.reminderStatus)}</td>
            <td style={{ textAlign: 'right' }}>{getActionButtons(row)}</td>
          </tr>
        ))}
      </Table>

      {viewingVax && (
        <div className="modal-wrap">
          <div className="modal">
            <div className="modal-hd">
              <h3>Vaccination Details</h3>
              <button className="modal-x" onClick={() => setViewingVax(null)}>×</button>
            </div>
            <div className="form-grid">
              <div>
                <label className="field-label">Pet Name</label>
                <div style={{ padding: '8px 0', fontWeight: 600 }}>{viewingVax.petName} ({viewingVax.breed})</div>
              </div>
              <div>
                <label className="field-label">Owner</label>
                <div style={{ padding: '8px 0', fontWeight: 600 }}>{viewingVax.ownerName}</div>
              </div>
              <div>
                <label className="field-label">Vaccine</label>
                <div style={{ padding: '8px 0' }}>{viewingVax.vaccine}</div>
              </div>
              <div>
                <label className="field-label">Status</label>
                <div style={{ padding: '8px 0' }}><Badge value={viewingVax.status} /></div>
              </div>
              <div>
                <label className="field-label">Last Given</label>
                <div style={{ padding: '8px 0' }}>{viewingVax.lastDate ? formatDateSafe(viewingVax.lastDate) : '-'}</div>
              </div>
              <div>
                <label className="field-label">Next Due</label>
                <div style={{ padding: '8px 0' }}>{viewingVax.dueDate}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Reminder Status</label>
                <div style={{ padding: '8px 0' }}>{viewingVax.reminderStatus || 'Not sent'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setViewingVax(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Booking({ vets, clients, appointments, create, bookingClient, setBookingClient, bookingPet, setBookingPet, go }) {
  const [isBookingFlow, setIsBookingFlow] = useState(() => {
    return !!bookingClient;
  });
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('today');
  const [currentDate, setCurrentDate] = useState(getLocalDateString());
  const [viewMode, onViewModeChange] = useState('Week');

  const [selectedDate, setSelectedDate] = useState(() => {
    return getLocalDateString();
  });
  const [selectedVet, setSelectedVet] = useState(vets[0] || null);
  const [visitType, setVisitType] = useState('Annual Wellness Exam');
  const [selectedTime, setSelectedTime] = useState(null);
  const [isBookedSuccess, setIsBookedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!selectedVet && vets.length > 0) {
      setSelectedVet(vets[0]);
    }
  }, [vets, selectedVet]);

  useEffect(() => {
    if (bookingClient && (!bookingPet || !bookingClient.pets.some(p => p.name === bookingPet.name))) {
      setBookingPet(bookingClient.pets[0] || null);
    }
  }, [bookingClient, bookingPet, setBookingPet]);

  useEffect(() => {
    setIsBookedSuccess(false);
  }, [bookingClient, bookingPet, selectedDate, selectedVet, visitType, selectedTime]);

  const clientsFiltered = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    clients.forEach(c => {
      const matchClient = c.name?.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.email && c.email.toLowerCase().includes(q));
      if (c.pets && c.pets.length > 0) {
        c.pets.forEach(p => {
          const matchPet = p.name?.toLowerCase().includes(q) || (p.petId && p.petId.toLowerCase().includes(q));
          if (matchClient || matchPet) {
            results.push({ client: c, pet: p });
          }
        });
      } else if (matchClient) {
        results.push({ client: c, pet: null });
      }
    });
    return results;
  }, [clients, searchQuery]);

  const allPossibleSlots = useMemo(() => {
    const slots = [];
    let startHour = 9;
    let startMin = 0;
    while (startHour < 18) {
      const sh = String(startHour).padStart(2, '0');
      const sm = String(startMin).padStart(2, '0');

      let endMin = startMin + 30;
      let endHour = startHour;
      if (endMin >= 60) {
        endMin = 0;
        endHour += 1;
      }
      const eh = String(endHour).padStart(2, '0');
      const em = String(endMin).padStart(2, '0');

      slots.push(`${sh}:${sm}-${eh}:${em}`);

      startHour = endHour;
      startMin = endMin;
    }
    return slots;
  }, []);

  const getSlotStatus = (slotTime) => {
    const todayStr = getLocalDateString();
    if (selectedDate === todayStr) {
      const now = new Date();
      const actualTime = slotTime.includes('-') ? slotTime.split('-')[0] : slotTime;
      const [sh, sm] = actualTime.split(':');
      const slotDateTime = new Date();
      slotDateTime.setHours(parseInt(sh), parseInt(sm), 0, 0);
      if (slotDateTime <= now) {
        return 'past';
      }
    }

    const normalizedTime = slotTime;
    const isBooked = appointments.some(appt => {
      if (appt.date !== selectedDate) return false;
      if (selectedVet && appt.vetName !== selectedVet.name) return false;
      const apptTime = appt.time.replace(/\s*[AP]M\s*$/i, '');
      const apptStart = apptTime.includes('-') ? apptTime.split('-')[0] : apptTime;
      const slotStart = normalizedTime.includes('-') ? normalizedTime.split('-')[0] : normalizedTime;
      return (apptTime === normalizedTime || apptStart === slotStart) && appt.status !== 'Cancelled';
    });

    if (isBooked) return 'booked';
    if (selectedTime === slotTime) return 'selected';

    return 'available';
  };

  const handleConfirm = () => {
    if (!bookingClient || !bookingPet || !selectedVet || !selectedTime) {
      alert('Please select client, pet, vet, and time slot!');
      return;
    }

    const appointmentBody = {
      clientId: bookingClient._id,
      petId: bookingPet._id,
      vetId: selectedVet._id,
      petName: bookingPet.name,
      species: bookingPet.species,
      breed: bookingPet.breed || '',
      ownerName: bookingClient.name,
      vetName: selectedVet.name,
      reason: visitType,
      date: selectedDate,
      time: selectedTime,
      type: visitType.includes('Vaccin') ? 'Vaccination' : visitType.includes('Follow') ? 'Follow-up' : 'Checkup',
      status: 'Scheduled'
    };

    setIsSubmitting(true);
    create('appointments', appointmentBody).then(() => {
      setIsBookedSuccess(true);
      window.showToast?.(`Appointment successfully booked for ${bookingPet.name} with ${selectedVet.name} at ${selectedTime}`, 'info');
      setBookingClient(null);
      setBookingPet(null);
      setSelectedTime(null);
      setIsBookingFlow(false);
    }).catch(err => {
      alert('Failed to book appointment: ' + err.message);
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  const format12h = (t) => {
    if (!t) return '';
    if (t.includes('-')) {
      const parts = t.split('-');
      return `${format12h(parts[0])}`;
    }
    const trimmed = t.trim();
    const hasPM = /PM/i.test(trimmed);
    const clean = trimmed.replace(/\s*[AP]M\s*$/i, '').trim();
    const [h, m] = clean.split(':');
    let hr = parseInt(h);
    if (hasPM && hr < 12) hr += 12;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;
    return `${hr12}:${m || '00'} ${ampm}`;
  };

  const petEmoji = (species = '') => {
    const s = (species || '').toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const todayStr = getLocalDateString();

  const getFilteredAppointments = () => {
    if (activeSubTab === 'today') {
      return appointments.filter(a => {
        const apptDateOnly = a.date && a.date.includes('T') ? a.date.split('T')[0] : a.date;
        return apptDateOnly === todayStr;
      });
    }
    if (activeSubTab === 'week') {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return appointments.filter(a => {
        const d = new Date(a.date);
        return d >= startOfWeek && d <= endOfWeek;
      });
    }
    if (activeSubTab === 'upcoming') {
      return appointments.filter(a => {
        if (a.status === 'Completed') return false;
        const apptDateOnly = a.date && a.date.includes('T') ? a.date.split('T')[0] : a.date;
        if (apptDateOnly > todayStr) return true;
        if (apptDateOnly === todayStr) {
          const apptDateTime = parseApptDateTime(a.date, a.time);
          return apptDateTime > new Date();
        }
        return false;
      });
    }
    return appointments;
  };

  const filteredAppts = getFilteredAppointments();

  if (!isBookingFlow) {
    return (
      <Screen
        title="Appointments"
        sub="Manage clinic appointments and schedule slots"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" style={{ background: '#fff' }} onClick={() => setOpenRegisterModal(true)}>
              + Register New Client
            </button>
            <button className="btn btn-primary" onClick={() => { setIsBookingFlow(true); setBookingClient(null); setBookingPet(null); setSelectedTime(null); }}>
              + Book Appointment
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '24px', paddingBottom: '4px', marginBottom: '16px' }}>
          {[
            ['today', "Today's Appointments"],
            ['week', 'This Week'],
            ['upcoming', 'Upcoming'],
            ['all', 'All Appointments']
          ].map(([id, label]) => (
            <button
              key={id}
              style={{
                border: 0,
                borderBottom: activeSubTab === id ? '2px solid var(--brand)' : '2px solid transparent',
                background: 'transparent',
                padding: '6px 0 10px 0',
                fontSize: '14px',
                fontWeight: activeSubTab === id ? '700' : '500',
                color: activeSubTab === id ? 'var(--brand)' : 'var(--text-3)',
                cursor: 'pointer'
              }}
              onClick={() => setActiveSubTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <section style={{ background: 'transparent', border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '18px' }}>PET / CLIENT</th>
                <th>VETERINARIAN</th>
                <th>REASON / TYPE</th>
                <th>DATE</th>
                <th>TIME</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppts.length > 0 ? (
                filteredAppts.map((appt) => (
                  <tr key={appt._id}>
                    <td style={{ paddingLeft: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{petEmoji(appt.petSpecies || appt.species || appt.petBreed)}</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{appt.petName}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{appt.ownerName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontWeight: '500' }}>{appt.vetName || 'Dr. Sarah Chen'}</td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{appt.reason}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{appt.type || 'Checkup'}</div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{formatDateSafe(appt.date)}</td>
                    <td style={{ color: 'var(--text)', fontWeight: '700' }}>{format12h(appt.time)}</td>
                    <td>
                      <Badge value={appt.status || 'Scheduled'} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                    No appointments scheduled under this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {openRegisterModal && (
          <ClientModal
            onClose={() => setOpenRegisterModal(false)}
            onSave={(body) => create('clients', body).then((createdClient) => {
              setBookingClient(createdClient);
              if (createdClient.pets && createdClient.pets.length > 0) {
                setBookingPet(createdClient.pets[0]);
              }
              setIsBookingFlow(true);
              setOpenRegisterModal(false);
            }).catch(err => window.showToast(err.message, 'error'))}
          />
        )}
      </Screen>
    );
  }

  if (!bookingClient) {
    const isSearching = searchQuery.trim() !== '';
    const showRegister = isSearching && clientsFiltered.length === 0;

    return (
      <Screen
        title="Book Appointment — Step 1 of 3"
        sub="Find and select a client account to begin"
        action={
          <button className="btn btn-outline" style={{ background: '#fff' }} onClick={() => setIsBookingFlow(false)}>
            ◀ Back to Appointments
          </button>
        }
      >
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '16px',
              color: 'var(--text-3)',
              userSelect: 'none',
              pointerEvents: 'none'
            }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by Client Name, Pet Name or Pet ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 40px',
                fontSize: '15px',
                borderRadius: '12px',
                border: '2px solid var(--border)',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                background: '#fff',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand)';
                e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.02)';
              }}
            />
          </div>

          {isSearching && (
            <section className="panel no-pad" style={{ background: '#fff', borderRadius: '12px', maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '18px' }}>Owner</th>
                    <th>Contact</th>
                    <th style={{ textAlign: 'right', paddingRight: '18px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsFiltered.length > 0 ? (
                    clientsFiltered.map((row, idx) => (
                      <tr key={row.pet ? `${row.client._id}-${row.pet._id}` : `${row.client._id}-${idx}`}>
                        <td style={{ paddingLeft: '18px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text)' }}>{row.client.name}</div>
                          {row.pet && (
                            <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '2px' }}>
                              <span style={{ fontWeight: '600' }}>{row.pet.name}</span> <span style={{ opacity: 0.8 }}>({row.pet.petId || 'No ID'})</span>
                            </div>
                          )}
                        </td>
                        <td>{row.client.email} · {row.client.phone}</td>
                        <td style={{ textAlign: 'right', paddingRight: '18px' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            setBookingClient(row.client);
                            if (row.pet) setBookingPet(row.pet);
                          }}>Select</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '36px 24px', color: 'var(--text-3)' }}>
                        <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>📭</span>
                        <strong>No clients found matching "{searchQuery}"</strong>
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>Please check the spelling or register them as a new client below.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {showRegister && (
            <button
              type="button"
              className="btn btn-outline"
              style={{
                border: '1px dashed var(--brand)',
                color: 'var(--brand)',
                background: '#f0f9ff',
                width: '100%',
                padding: '12px',
                justifyContent: 'center',
                fontWeight: '700',
                marginTop: '4px'
              }}
              onClick={() => setOpenRegisterModal(true)}
            >
              ➕ Register New Client
            </button>
          )}
        </div>

        {openRegisterModal && (
          <ClientModal
            onClose={() => setOpenRegisterModal(false)}
            onSave={(body) => create('clients', body).then((createdClient) => {
              setBookingClient(createdClient);
              if (createdClient.pets && createdClient.pets.length > 0) {
                setBookingPet(createdClient.pets[0]);
              }
              setIsBookingFlow(true);
              setOpenRegisterModal(false);
            }).catch(err => window.showToast(err.message, 'error'))}
          />
        )}
      </Screen>
    );
  }

  return (
    <>
      {isSubmitting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>📅</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Booking Appointment...
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Please wait while we secure this time slot.
            </p>
          </div>
        </div>
      )}
      <Screen
      title="Book Appointment"
      sub="Step 3 of 3 — Select time slot & confirm"
    >
      <div className="steps" style={{ marginBottom: '20px' }}>
        <span className="step done" style={{ cursor: 'pointer', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBookingClient(null)}>
          ✓
        </span>
        <span style={{ background: 'var(--brand)' }} />
        <span className="step done" style={{ background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✓
        </span>
        <span style={{ background: 'var(--brand)' }} />
        <span className="step current" style={{ background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 4px var(--brand-light)' }}>
          3
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '14px 18px', borderRadius: '12px' }}>
            <div>
              <div className="sb-field-label" style={{ color: 'var(--text-3)', fontSize: '10px' }}>Selected client</div>
              <strong style={{ fontSize: '15px', color: 'var(--text)' }}>
                {bookingClient.name} · <span style={{ fontWeight: '500', color: 'var(--text-2)' }}>{bookingClient.email}</span>
              </strong>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--brand)', borderColor: 'var(--brand)' }}
              onClick={() => {
                setBookingClient(null);
                setBookingPet(null);
                setSelectedTime(null);
              }}
            >
              Change
            </button>
          </div>

          <div className="panel" style={{ background: '#fff', padding: '16px 18px', borderRadius: '12px' }}>
            <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Select pet ({bookingClient.name} has {(bookingClient.pets || []).length} pets)
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(bookingClient.pets || []).map((pet) => {
                const isSelected = bookingPet && bookingPet.name === pet.name;
                const petAppt = appointments.find(appt =>
                  appt.date === selectedDate &&
                  appt.status !== 'Cancelled' &&
                  (
                    (appt.petId && pet._id && String(appt.petId) === String(pet._id)) ||
                    (appt.petName && pet.name && appt.petName.toLowerCase() === pet.name.toLowerCase() &&
                      appt.ownerName && bookingClient.name && appt.ownerName.toLowerCase() === bookingClient.name.toLowerCase())
                  )
                );

                return (
                  <div
                    key={pet._id || pet.name}
                    style={{
                      border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      width: '210px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(37,99,235,0.03)' : '#fff',
                      position: 'relative'
                    }}
                    onClick={() => {
                      setBookingPet(pet);
                      setSelectedTime(null);
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)' }}>
                      {petEmoji(pet.species)} {pet.name}
                      {isSelected && (
                        <span className="badge b-blue" style={{ fontSize: '9px', padding: '1px 6px', marginLeft: 'auto' }}>
                          Selected ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
                      {pet.species} · {pet.breed || 'Mixed Breed'} · {getAgeStr(pet.dob || pet.dateOfBirth) || pet.age || '-'}
                    </div>
                    {petAppt && (
                      <div style={{
                        fontSize: '11px',
                        color: '#0369a1',
                        fontWeight: '700',
                        marginTop: '8px',
                        background: '#e0f2fe',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🕒 Booked: {format12h(petAppt.time)} {petAppt.vetName ? `(${petAppt.vetName})` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


          </div>

          <div className="panel" style={{ background: '#fff', padding: '16px 18px', borderRadius: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <label className="field-label">
                Booking Date *
                <input
                  className="input"
                  type="date"
                  min={getLocalDateString()}
                  value={selectedDate}
                  onChange={e => {
                    setSelectedDate(e.target.value);
                    setSelectedTime(null);
                  }}
                />
              </label>

              <label className="field-label">
                Veterinarian *
                <select
                  className="input"
                  value={selectedVet ? selectedVet.name : ''}
                  onChange={e => {
                    const found = vets.find(v => v.name === e.target.value);
                    setSelectedVet(found || null);
                    setSelectedTime(null);
                  }}
                >
                  {vets.map(v => <option key={v._id} value={v.name}>{v.name}</option>)}
                </select>
              </label>

              <label className="field-label">
                Visit type *
                <select
                  className="input"
                  value={visitType}
                  onChange={e => setVisitType(e.target.value)}
                >
                  <option value="Annual Wellness Exam">Annual Wellness Exam</option>
                  <option value="Sick Visit / Diagnostics">Sick Visit / Diagnostics</option>
                  <option value="Vaccination Appointment">Vaccination Appointment</option>
                  <option value="Follow-up Checkup">Follow-up Checkup</option>
                  <option value="Dental Scaling & Cleaning">Dental Scaling & Cleaning</option>
                  <option value="Wellness Spa">Wellness Spa</option>
                </select>
              </label>
            </div>
          </div>

          <div className="panel" style={{ background: '#fff', padding: '16px 18px', borderRadius: '12px' }}>
            <div className="card-label" style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Available slots — {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '14px' }}>
              Green = available · Grey = booked/disabled · Blue = selected
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {allPossibleSlots.map((slot) => {
                const status = getSlotStatus(slot);
                const formattedTime = format12h(slot);

                let btnStyle = {
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  padding: '10px 4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                };

                if (status === 'past' || status === 'booked') {
                  btnStyle.background = '#f1f5f9';
                  btnStyle.color = '#cbd5e1';
                  btnStyle.borderColor = '#e2e8f0';
                  btnStyle.cursor = 'not-allowed';
                  btnStyle.fontWeight = '500';
                } else if (status === 'selected') {
                  btnStyle.background = 'var(--brand)';
                  btnStyle.color = '#fff';
                  btnStyle.borderColor = 'var(--brand)';
                } else {
                  btnStyle.background = '#f0fdf4';
                  btnStyle.color = 'var(--green)';
                  btnStyle.borderColor = '#bbf7d0';
                }

                const handleClickSlot = () => {
                  if (status === 'past' || status === 'booked') return;
                  setSelectedTime(slot);
                };

                return (
                  <button
                    key={slot}
                    type="button"
                    style={btnStyle}
                    onClick={handleClickSlot}
                    disabled={status === 'past' || status === 'booked'}
                  >
                    {slot.includes('-') ? formattedTime : formattedTime.replace(' AM', '').replace(' PM', '')}
                    {status === 'selected' ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{
          background: '#0b1329',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '24px 20px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', color: '#fff' }}>
            Appointment Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Pet</span>
              <strong style={{ color: '#fff' }}>{bookingPet ? `${petEmoji(bookingPet.species)} ${bookingPet.name}` : 'Not selected'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Species</span>
              <strong style={{ color: '#fff' }}>{bookingPet ? bookingPet.species : 'Not selected'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Owner</span>
              <strong style={{ color: '#fff' }}>{bookingClient.name}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Vet</span>
              <strong style={{ color: '#fff' }}>{selectedVet ? selectedVet.name : 'Not selected'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Visit type</span>
              <strong style={{ color: '#fff' }}>{visitType.split(' / ')[0]}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Date</span>
              <strong style={{ color: '#fff' }}>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#94a3b8' }}>Time</span>
              <strong style={{ color: '#fff' }}>{selectedTime ? format12h(selectedTime) : 'Select a slot'}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '14px', background: 'var(--brand)', color: '#fff' }}
            onClick={handleConfirm}
            disabled={isBookedSuccess || isSubmitting}
          >
            {isSubmitting ? 'Creating Appointment...' : 'Confirm Appointment'}
          </button>

          {isBookedSuccess && (
            <div style={{ fontSize: '11px', color: '#60a5fa', textAlign: 'center', marginTop: '12px', fontWeight: '500' }}>
              Confirmation email sent to {bookingClient.email}
            </div>
          )}
        </div>
      </div>

      {openRegisterModal && (
        <ClientModal
          onClose={() => setOpenRegisterModal(false)}
          onSave={(body) => create('clients', body).then((createdClient) => {
            setBookingClient(createdClient);
            if (createdClient.pets && createdClient.pets.length > 0) {
              setBookingPet(createdClient.pets[0]);
            }
            setIsBookingFlow(true);
            setOpenRegisterModal(false);
          }).catch(err => window.showToast(err.message, 'error'))}
        />
      )}
    </Screen>
    </>
  );
}

function LegacySoap({ note, create }) {
  const [draft, setDraft] = useState(note || { subjective: '', objective: '', assessment: '', plan: '' });
  const [transcript, setTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [recordingIntervalId, setRecordingIntervalId] = useState(null);

  const presets = {
    ears: {
      label: "Buddy - Ear scratching (Dog)",
      text: "Owner states Buddy has been shaking his head and scratching his right ear persistently for 3 days. A dark discharge and strong odor are present. Doctor examined ears: Right ear canal is erythematous, stenotic with abundant waxy brown exudate. Tympanic membrane is intact. Left ear is clear. Diagnosed Otitis Externa. Treatment: Thorough clean, apply Otomax ointment twice daily for 7 days. Follow up in 7 days."
    },
    cold: {
      label: "Luna - Sneezing & Nasal discharge (Cat)",
      text: "Owner reports Luna has been sneezing, has clear nasal discharge, and has been slightly lethargic for 2 days. Appetite is reduced. Temp is 101.8 F. Clear lung fields, normal respiratory effort. Serous ocular and nasal discharge, mildly congested. Assessment: Upper Respiratory Infection (URI). Plan: Supplement with L-Lysine, keep warm and hydrated, soft food. Follow up if she stops eating."
    },
    tummy: {
      label: "Rocky - Acute Gastroenteritis (Dog)",
      text: "Owner noted Rocky vomited twice last night and has soft diarrhea. He scavenged grass and soil yesterday. Weight is 28.5kg. Dog is bright, alert, and responsive. Hydration is normal. Abdomen soft, non-painful on palpation. Diagnosis: Acute Gastroenteritis. Plan: Fast for 12 hours, then bland diet of chicken and rice for 3 days. Metronidazole 250mg twice daily for 5 days. Monitor hydration closely."
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordTimer(0);
    const interval = setInterval(() => {
      setRecordTimer(prev => prev + 1);
    }, 1000);
    setRecordingIntervalId(interval);
  };

  const stopRecording = () => {
    if (recordingIntervalId) {
      clearInterval(recordingIntervalId);
      setRecordingIntervalId(null);
    }
    setIsRecording(false);
    // Auto-populate with ears template if transcript is empty
    if (!transcript) {
      setTranscript(presets.ears.text);
    }
  };

  const handlePresetChange = (key) => {
    if (presets[key]) {
      setTranscript(presets[key].text);
    }
  };

  const handleAIAssist = async () => {
    if (!transcript.trim()) {
      alert("Please enter a transcript or select a template first!");
      return;
    }
    setIsGenerating(true);
    setErrorInfo('');
    try {
      const res = await fetch(`${API_URL}/ai/process-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          appointment_id: note?.appointment_id || undefined,
          duration_seconds: recordTimer || 45
        })
      });
      if (!res.ok) throw new Error("Claude AI processed using simulation fallback.");
      const result = await res.json();
      if (result.success && result.preview) {
        setDraft({
          subjective: result.preview.subjective,
          objective: result.preview.objective,
          assessment: result.preview.assessment,
          plan: result.preview.plan
        });
      }
    } catch (err) {
      console.warn(err.message);
      // Seamless mock fallback executed immediately on failure
      const simulatedText = transcript.toLowerCase();
      let subjective = `Owner reports: ${transcript}`;
      let objective = "Vital signs stable, clear chest, normal abdominal palpation.";
      let assessment = "Observation needed.";
      let plan = "Monitor at home.";

      if (simulatedText.includes("ear") || simulatedText.includes("scratch")) {
        assessment = "Otitis Externa (Ear Infection)";
        plan = "Clean ears, apply Otomax ointment twice daily for 7 days. Recheck in 1 week.";
      } else if (simulatedText.includes("sneeze") || simulatedText.includes("cold")) {
        assessment = "Feline Upper Respiratory Infection (URI)";
        plan = "L-Lysine supplements, keep hydrated, soft food. Monitor appetite.";
      } else if (simulatedText.includes("vomit") || simulatedText.includes("diarrhea")) {
        assessment = "Acute Gastroenteritis";
        plan = "Bland diet (chicken & rice) for 3 days. Metronidazole 250mg twice daily for 5 days.";
      }

      setDraft({
        subjective,
        objective,
        assessment,
        plan
      });
      setErrorInfo('Claude AI offline: Seamlessly resolved with local veterinary clinical fallback.');
    } finally {
      setIsGenerating(false);
    }
  };

  return <Screen title="Veterinary AI Consultation" sub="Intelligent audio transcription & consultation modules">
    <div className="grid-two" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '20px' }}>

      {/* AI AUDIO & TRANSCRIPT PANEL */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>AI Audio Recorder & Transcript</span>
          {isRecording && <span className="badge b-red" style={{ animation: 'pulse 1.2s infinite' }}>● RECORDING ({recordTimer}s)</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="sb-field-label" style={{ color: 'var(--text-2)' }}>Select Demo Preset Template</label>
          <select className="sb-select" style={{ background: '#fff', border: '1px solid #cbd5e1', color: 'var(--text)' }} onChange={(e) => handlePresetChange(e.target.value)}>
            <option value="">-- Choose consultation scenario --</option>
            {Object.entries(presets).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <label className="sb-field-label" style={{ color: 'var(--text-2)' }}>Raw Dialogue / Audio Transcript</label>
          <textarea
            className="input"
            style={{ flex: 1, minHeight: '160px', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.5' }}
            placeholder="Type or paste doctor-owner dialogue here, or click Record to simulate audio transcript..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!isRecording ? (
            <button className="btn btn-outline" style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red)', background: '#fef2f2' }} onClick={startRecording}>
              🎙 Simulate Audio Record
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--red)' }} onClick={stopRecording}>
              ⏹ Stop & Auto-Transcribe
            </button>
          )}

          <button className="btn btn-accent" style={{ flex: 1 }} onClick={handleAIAssist} disabled={isGenerating}>
            {isGenerating ? "⚡ Parsing..." : "✨ Claude AI Assist"}
          </button>
        </div>

        {errorInfo && (
          <div className="badge b-amber" style={{ padding: '8px 12px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', borderRadius: '8px' }}>
            <strong>💡 Fallback Active:</strong>
            <span>{errorInfo}</span>
          </div>
        )}
      </section>

      {/* SOAP NOTE EDITOR */}
      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-label">Consultation Medical Documentation</div>

        <div className="soap-grid" style={{ gridTemplateColumns: '1fr', gap: '10px' }}>
          {['subjective', 'objective', 'assessment', 'plan'].map((field) => (
            <label className="soap-card" key={field} style={{ padding: '10px 12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--brand)', textTransform: 'uppercase' }}>
                {field[0].toUpperCase()} · {field}
              </span>
              <textarea
                style={{ width: '100%', minHeight: '60px', height: '65px', fontSize: '13px', padding: '4px 0', border: 0, resize: 'vertical' }}
                placeholder={`Enter clinical ${field} data...`}
                value={draft[field] || ''}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
              />
            </label>
          ))}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
          onClick={() => {
            const { _id, createdAt, updatedAt, __v, clinic_id, ...rest } = draft;
            create('soapnotes', {
              ...rest,
              petName: rest.petName || 'Buddy',
              ownerName: rest.ownerName || 'James Martinez',
              vetName: rest.vetName || 'Dr. Sarah Chen'
            }).then(() => {
              alert("Consultation Medical Note saved successfully!");
            });
          }}
        >
          📝 Save Consultation Note
        </button>
      </section>

    </div>
  </Screen>;
}

function Weights({ weights, create, activePet, clients, go, doctorPatients, selectedDoctor, onPetSelect, role }) {
  const pet = activePet || { name: 'Buddy', breed: 'Golden Retriever', emoji: '🐶', age: '4 yrs' };

  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightLogVal, setWeightLogVal] = useState('');
  const [weightLogNote, setWeightLogNote] = useState('');
  const [weightTimeframe, setWeightTimeframe] = useState('12months');

  let ownerName = 'James Martinez';
  if (clients) {
    const owner = clients.find(c => c.pets && c.pets.some(p => p._id === pet._id));
    if (owner) ownerName = owner.name;
  }

  // Resilient case-insensitive name mapping
  const petWeights = [...weights]
    .filter(w => w.petId ? w.petId === pet._id : (w.petName.toLowerCase() === pet.name.toLowerCase() && w.ownerName.toLowerCase() === ownerName.toLowerCase()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const hasWeights = petWeights.length > 0;

  // Determine species & breed from DB dynamically
  const clientOwner = clients ? clients.find(c => c.pets && c.pets.some(p => p._id === pet._id)) : null;
  const petInDb = clientOwner ? clientOwner.pets.find(p => p._id === pet._id) : null;
  const petSpecies = petInDb ? petInDb.species : (pet.species || 'Dog');
  const petBreed = petInDb ? petInDb.breed : (pet.breed || 'Golden Retriever');

  // Resolve ideal range dynamically from pet.weightRange or shared species/breed-aware helper
  const parsedRange = parseWeightRange(pet.weightRange);
  const idealRange = parsedRange || getIdealRange(petSpecies, petBreed);
  const idealMin = idealRange.min;
  const idealMax = idealRange.max;

  const currentWeightRecord = hasWeights ? petWeights[petWeights.length - 1] : null;
  const currentWeight = currentWeightRecord ? currentWeightRecord.value : 0;
  const currentUnit = currentWeightRecord ? currentWeightRecord.unit : 'lbs';

  const previousWeightRecord = petWeights.length > 1 ? petWeights[petWeights.length - 2] : null;
  const lastDiff = previousWeightRecord ? (currentWeight - previousWeightRecord.value) : 0;
  const lastDiffStr = !hasWeights ? 'No weight logged' : previousWeightRecord ? `${lastDiff > 0 ? '↑' : lastDiff < 0 ? '↓' : ''} ${Math.abs(lastDiff).toFixed(1)} lbs from last visit` : 'Initial weight visit';
  const lastDiffColor = !hasWeights ? 'var(--text-3)' : lastDiff > 0 ? 'var(--amber)' : lastDiff < 0 ? 'var(--green)' : 'var(--text-3)';

  // Calculate 6-month change relative to latest weight record's date for run-date independence
  const latestWeightDate = currentWeightRecord ? new Date(currentWeightRecord.date) : new Date();
  const sixMonthsAgo = new Date(latestWeightDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let sixMonthWeight = currentWeightRecord;
  for (let i = petWeights.length - 1; i >= 0; i--) {
    if (new Date(petWeights[i].date) <= sixMonthsAgo) {
      sixMonthWeight = petWeights[i];
      break;
    }
  }
  if (!sixMonthWeight && petWeights.length > 0) sixMonthWeight = petWeights[0];

  const sixMonthDiff = sixMonthWeight ? (currentWeight - sixMonthWeight.value) : 0;
  const sixMonthDiffStr = !hasWeights ? '—' : sixMonthDiff > 0 ? `+${sixMonthDiff.toFixed(1)}` : sixMonthDiff < 0 ? `${sixMonthDiff.toFixed(1)}` : '0.0';

  // Calculate percentage-based clinical significance (species-aware!)
  const initialWeight = currentWeight - sixMonthDiff;
  const pctChange = initialWeight > 0 ? (sixMonthDiff / initialWeight) * 100 : 0;
  const isSignificant = hasWeights && Math.abs(pctChange) > 5; // 5% threshold

  let sixMonthTrendStr = !hasWeights ? 'No weight history' : 'Stable weight trend';
  let sixMonthDiffColor = 'var(--green)';
  if (isSignificant) {
    sixMonthTrendStr = '⚠ Dietary review recommended';
    sixMonthDiffColor = 'var(--amber)';
  }

  const isWithinRange = hasWeights && currentWeight >= idealMin && currentWeight <= idealMax;
  const rangeColor = !hasWeights ? 'var(--text-3)' : isWithinRange ? 'var(--green)' : 'var(--amber)';
  const rangeStr = !hasWeights ? 'Awaiting weight log' : isWithinRange ? '✓ Currently within range' : '⚠ Outside ideal range';

  const logList = [...petWeights].reverse();
  const now = new Date();
  const twelveMonthsAgo = new Date(now.setFullYear(now.getFullYear() - 1));
  const chartData = weightTimeframe === '12months'
    ? petWeights.filter(w => new Date(w.date) >= twelveMonthsAgo)
    : petWeights;

  // Dynamic Weight Graph Scaling
  const weightValues = chartData.map(w => w.value);
  let minWeight = Math.min(...weightValues, idealMin);
  let maxWeight = Math.max(...weightValues, idealMax);

  const weightRangeDiff = maxWeight - minWeight;
  const paddingVal = weightRangeDiff > 0 ? weightRangeDiff * 0.15 : 2;
  minWeight = Math.max(0, minWeight - paddingVal);
  maxWeight = maxWeight + paddingVal;

  const yRange = 108;
  const points = chartData.map((w, index) => {
    let x = 44;
    if (chartData.length > 1) {
      x = 44 + (446 / (chartData.length - 1)) * index;
    } else {
      x = 267;
    }
    let y = 124;
    const diff = maxWeight - minWeight;
    if (diff > 0) {
      y = 124 - ((w.value - minWeight) / diff) * yRange;
    } else {
      y = 70;
    }
    if (y < 16) y = 16;
    if (y > 124) y = 124;
    return { x, y, value: w.value, dateStr: w.date };
  });

  const getWeightAtY = (yCoord) => {
    const diff = maxWeight - minWeight;
    if (diff > 0) {
      return (minWeight + ((124 - yCoord) / yRange) * diff).toFixed(1);
    }
    return minWeight.toFixed(1);
  };

  let idealYMax = 124;
  let idealYMin = 16;
  const diff = maxWeight - minWeight;
  if (diff > 0) {
    idealYMin = 124 - ((idealMax - minWeight) / diff) * yRange;
    idealYMax = 124 - ((idealMin - minWeight) / diff) * yRange;
  }
  if (idealYMin < 16) idealYMin = 16;
  if (idealYMin > 124) idealYMin = 124;
  if (idealYMax < 16) idealYMax = 16;
  if (idealYMax > 124) idealYMax = 124;

  const idealHeight = idealYMax - idealYMin;
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  const handleLogWeight = () => {
    setWeightLogVal('');
    setWeightLogNote('');
    setIsWeightModalOpen(true);
  };

  const handleSaveNewWeight = () => {
    if (!weightLogVal || isNaN(weightLogVal)) {
      alert("Please enter a valid numeric weight.");
      return;
    }
    create('weights', {
      petName: pet.name,
      ownerName: ownerName,
      value: Number(weightLogVal),
      unit: currentUnit,
      date: getLocalDateString(),
      note: weightLogNote || 'Manual entry'
    }).then(() => {
      setIsWeightModalOpen(false);
      setWeightLogVal('');
      setWeightLogNote('');
      window.showToast?.('Weight logged successfully!');
    }).catch(err => {
      alert("Failed to save weight: " + err.message);
    });
  };

  const getPetEmoji = (species = '') => {
    const s = (species || '').toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop')) return '🐰';
    if (s.includes('bird') || s.includes('parrot')) return '🦜';
    return '🐾';
  };

  const handlePrevPet = () => {
    if (!doctorPatients || doctorPatients.length === 0) return;
    const currentIndex = doctorPatients.findIndex(p => p._id === pet._id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : doctorPatients.length - 1;
    onPetSelect?.(doctorPatients[prevIndex]);
  };

  const handleNextPet = () => {
    if (!doctorPatients || doctorPatients.length === 0) return;
    const currentIndex = doctorPatients.findIndex(p => p._id === pet._id);
    const nextIndex = currentIndex < doctorPatients.length - 1 ? currentIndex + 1 : 0;
    onPetSelect?.(doctorPatients[nextIndex]);
  };

  const hasMultiplePatients = role === 'doctor' && doctorPatients && doctorPatients.length > 1;

  if (role === 'doctor' && selectedDoctor && (!doctorPatients || doctorPatients.length === 0)) {
    return (
      <div className="main-scroll" style={{ background: 'var(--bg)' }}>
        <div className="main-pad">
          <div className="topbar">
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text)' }}>
                Weight Tracker
              </h2>
              <div className="sub" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                No patients found for Dr. {selectedDoctor.name}.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPetIndex = (doctorPatients || []).findIndex(p => p._id === pet._id) + 1;
  const totalPatients = (doctorPatients || []).length;

  return (
    <div className="main-scroll" style={{ background: 'var(--bg)' }}>
      <div className="main-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px', color: 'var(--text-3)', cursor: 'pointer' }} onClick={() => go && go('petprofile')}>
          ← Back to {pet.name}'s profile
        </div>
        <div className="topbar">
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Weight Tracker —
              {hasMultiplePatients && (
                <button className="btn" style={{ padding: '4px 8px', minWidth: 'auto', height: 'auto', fontSize: '16px', background: 'transparent', color: 'var(--text-2)', border: 'none' }} onClick={handlePrevPet}>
                  &lt;
                </button>
              )}
              <span style={{ color: 'var(--brand)' }}>{getPetEmoji(pet.species || pet.emoji)} {pet.name}</span>
              {hasMultiplePatients && (
                <button className="btn" style={{ padding: '4px 8px', minWidth: 'auto', height: 'auto', fontSize: '16px', background: 'transparent', color: 'var(--text-2)', border: 'none' }} onClick={handleNextPet}>
                  &gt;
                </button>
              )}
              {(role === 'doctor' && selectedDoctor) && (
                <span style={{ fontSize: '12px', background: 'var(--bg-2)', color: 'var(--text-3)', padding: '2px 8px', borderRadius: '12px', marginLeft: '4px', fontWeight: '600' }}>
                  {currentPetIndex > 0 ? currentPetIndex : 1} / {totalPatients} {totalPatients === 1 ? 'pet' : 'pets'}
                </span>
              )}
            </h2>
            <div className="sub" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
              {petBreed} · {getAgeStr(pet.dob || pet.dateOfBirth) || pet.age || '-'} · Healthy range: {idealMin}–{idealMax} {currentUnit}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleLogWeight}>+ Log Weight</button>
        </div>

        <div className="grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: '700', letterSpacing: '.06em' }}>CURRENT WEIGHT</div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: 'var(--text)' }}>
              {hasWeights ? currentWeight.toFixed(1) : '-'} <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: '400' }}>{hasWeights ? currentUnit : ''}</span>
            </div>
            <div style={{ fontSize: '11px', color: lastDiffColor, marginTop: '3px', fontWeight: '500' }}>{lastDiffStr}</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: '700', letterSpacing: '.06em' }}>6-MONTH CHANGE</div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: sixMonthDiffColor }}>{sixMonthDiffStr} <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: '400' }}>{hasWeights ? currentUnit : ''}</span></div>
            <div style={{ fontSize: '11px', color: sixMonthDiffColor, marginTop: '3px', fontWeight: '500' }}>{sixMonthTrendStr}</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: '700', letterSpacing: '.06em' }}>IDEAL RANGE</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: rangeColor }}>{idealMin}–{idealMax} <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: '400' }}>{currentUnit}</span></div>
            <div style={{ fontSize: '11px', color: rangeColor, marginTop: '3px', fontWeight: '500' }}>{rangeStr}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Weight Over Time</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{weightTimeframe === '12months' ? 'Last 12 months' : 'All time'} · All clinic visits</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className={`badge ${weightTimeframe === '12months' ? 'b-blue' : 'b-gray'}`} style={{ cursor: 'pointer' }} onClick={() => setWeightTimeframe('12months')}>12 months</span>
                <span className={`badge ${weightTimeframe === 'alltime' ? 'b-blue' : 'b-gray'}`} style={{ cursor: 'pointer' }} onClick={() => setWeightTimeframe('alltime')}>All time</span>
              </div>
            </div>

            <svg viewBox="0 0 500 150" style={{ width: '100%', height: '150px', display: 'block' }}>
              <defs>
                <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="44" y1="16" x2="490" y2="16" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="44" y1="52" x2="490" y2="52" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="44" y1="88" x2="490" y2="88" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="44" y1="124" x2="490" y2="124" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

              <text x="38" y="20" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(16)}</text>
              <text x="38" y="56" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(52)}</text>
              <text x="38" y="92" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(88)}</text>
              <text x="38" y="128" fontSize="9" fill="var(--text-3)" textAnchor="end" fontFamily="sans-serif">{getWeightAtY(124)}</text>

              {points.map(p => (
                <text key={p.x} x={p.x} y="142" fontSize="9" fill="var(--text-3)" textAnchor="middle" fontFamily="sans-serif">
                  {formatMonthSafe(p.dateStr)}
                </text>
              ))}

              <rect x="44" y={idealYMin} width="446" height={idealHeight > 0 ? idealHeight : 2} fill="#16A34A" fillOpacity="0.06" rx="2" />

              {points.length > 0 && (
                <>
                  <path d={`${pathD} L ${points[points.length - 1].x},124 L ${points[0].x},124 Z`} fill="url(#bg2)" />
                  <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 4} fill={i === points.length - 1 ? "#F97316" : "#3B82F6"} stroke="var(--bg)" strokeWidth="2" />
                  ))}
                </>
              )}

              {!hasWeights && (
                <text x="267" y="75" fontSize="12" fill="var(--text-3)" textAnchor="middle" fontFamily="sans-serif">No weight history logged yet</text>
              )}
            </svg>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '14px', marginLeft: '4px' }}>Visit Log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logList.length > 0 ? (
                logList.map((row, i) => {
                  let diffStr = '—';
                  let diffColor = 'var(--text-3)';
                  if (i < logList.length - 1) {
                    const diff = row.value - logList[i + 1].value;
                    if (diff > 0) {
                      diffStr = `↑ +${diff.toFixed(1)}`;
                      diffColor = 'var(--amber)';
                    } else if (diff < 0) {
                      diffStr = `↓ -${Math.abs(diff).toFixed(1)}`;
                      diffColor = 'var(--green)';
                    } else {
                      diffStr = `—`;
                      diffColor = 'var(--text-3)';
                    }
                  }

                  return (
                    <div key={row._id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: '90px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--text-2)' }}>{formatDateSafe(row.date)}</span>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', flex: 1, textAlign: 'center' }}>
                        {row.value.toFixed(1)} <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '400' }}>{row.unit || 'lbs'}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: diffColor, fontWeight: '600', width: '70px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {diffStr}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>No logs yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isWeightModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'modalBackdropFade 0.25s ease-out forwards'
        }}>
          <style>{`
            @keyframes modalBackdropFade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes modalContentSlideUp {
              from { transform: translateY(30px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border)',
            padding: '24px',
            animation: 'modalContentSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text)' }}>
                ⚖️ Log New Weight
              </h3>
              <button
                onClick={() => setIsWeightModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 0,
                  fontSize: '20px',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-2)', background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              ⚖️ <strong>Auto-Capturing Current Date & Time:</strong>
              <div style={{ marginTop: '4px', fontWeight: '600', color: 'var(--brand)' }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-2)' }}>
                Weight ({currentUnit}) <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                step="0.1"
                placeholder={`Enter weight in ${currentUnit} (e.g. 32.4)`}
                value={weightLogVal}
                onChange={(e) => setWeightLogVal(e.target.value)}
                autoFocus
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-2)' }}>
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Routine checkup or post-diet review"
                value={weightLogNote}
                onChange={(e) => setWeightLogNote(e.target.value)}
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline"
                onClick={() => setIsWeightModalOpen(false)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveNewWeight}
                style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '600' }}
              >
                Save Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUps({ rows, selectedClinic }) {
  const monitoringCount = rows.filter(r => r.monitoring || String(r.status).toLowerCase() === 'pending').length;

  const getPetIcon = (breed) => {
    const s = String(breed || '').toLowerCase();
    if (s.includes('dog')) return '🐶';
    if (s.includes('cat') || s.includes('siamese')) return '🐱';
    if (s.includes('rabbit') || s.includes('lop') || s.includes('bunny')) return '🐰';
    if (s.includes('parrot') || s.includes('bird')) return '🦜';
    return '🐾';
  };

  const format12h = (t) => {
    if (!t) return '';
    if (t.includes('-')) {
      const parts = t.split('-');
      return `${format12h(parts[0])}`;
    }
    const trimmed = t.trim();
    const hasPM = /PM/i.test(trimmed);
    const clean = trimmed.replace(/\s*[AP]M\s*$/i, '').trim();
    const [h, m] = clean.split(':');
    let hr = parseInt(h);
    if (hasPM && hr < 12) hr += 12;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;
    return `${hr12}:${m || '00'} ${ampm}`;
  };

  const getDateStatus = (plan, confirmed) => {
    if (!confirmed) return null;
    const pDate = new Date(plan);
    const cDate = new Date(confirmed);
    if (cDate < pDate) return 'early';
    if (cDate > pDate) return 'late';
    return null;
  };

  return (
    <Screen
      title="Follow-up Tracker"
      sub={`${selectedClinic?.name || 'Clinic'} — planned vs confirmed dates`}
      action={
        <div style={{ padding: '6px 12px', background: '#0f172a', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="pulse-dot"></span> Watching {monitoringCount} patients
        </div>
      }
    >
      <div className="legend-row" style={{ gap: '16px', marginBottom: '14px', fontSize: '12px' }}>
        <span><Badge value="↑ Early Slot" tone="purple" /> Earlier slot found</span>
        <span><Badge value="⚠️ Late Date" tone="amber" /> Confirmed later than planned</span>
        <span className="watch-text" style={{ fontSize: '11px' }}><span className="pulse-dot"></span> Active Scan</span>
      </div>

      <Table headers={['PET / OWNER', 'VET', 'PURPOSE', 'PLAN DATE', 'CONFIRMED DATE', 'TIME', 'PRIORITY', 'STATUS']}>
        {rows.map((row) => {
          const dateStatus = getDateStatus(row.planDate, row.confirmedDate);
          const isPending = String(row.status).toLowerCase() === 'pending';
          const isScheduled = String(row.status).toLowerCase() === 'scheduled';

          return (
            <tr key={row._id} style={isScheduled ? { background: 'rgba(16, 185, 129, 0.04)' } : undefined}>
              <td>
                <div className="pet-cell" style={{ gap: '8px' }}>
                  <div className="pet-avatar" style={{ fontSize: '16px' }}>{getPetIcon(row.breed || row.petName)}</div>
                  <Name title={row.petName} sub={row.ownerName} />
                </div>
              </td>
              <td style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{row.vetName}</td>
              <td style={{ fontSize: '13px', fontWeight: '600', color: 'var(--brand)' }}>{getCompactPurpose(row.purpose)}</td>
              <td style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)' }}>{formatDateClean(row.planDate)}</td>
              <td>
                {row.confirmedDate ? (
                  <>
                    <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                      {formatDateClean(row.confirmedDate)}
                    </div>
                    {dateStatus === 'early' && <div style={{ marginTop: '2px' }}><Badge value="↑ Early Slot" tone="purple" /></div>}
                    {dateStatus === 'late' && <div style={{ marginTop: '2px' }}><Badge value="⚠️ Late Date" tone="amber" /></div>}
                  </>
                ) : (
                  <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: '12px' }}>Not confirmed</span>
                )}
              </td>
              <td style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13px' }}>
                {row.confirmedDate ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {format12h(row.time || '11:00 AM')}
                  </span>
                ) : '—'}
              </td>
              <td>
                <Badge value={row.priority || 'Routine'} tone={String(row.priority).toLowerCase() === 'high' ? 'red' : undefined} />
              </td>
              <td>
                <Badge value={row.status} tone={isScheduled ? 'green' : undefined} />
                {isPending && (
                  <div style={{ marginTop: '4px' }}>
                    <span className="watch-text"><span className="pulse-dot"></span> Watching</span>
                  </div>
                )}
                {isScheduled && (
                  <div style={{ marginTop: '4px', color: 'var(--green)', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>✓ Confirmed</span>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <div className="monitor-box" style={{ padding: '14px 18px', marginTop: '18px', background: '#0f172a', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="monitor-box-title" style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="pulse-dot" style={{ background: '#10b981' }}></span> Background slot monitoring active for {monitoringCount} patients
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.4' }}>
          Real-time check active. If an earlier slot becomes available due to cancellation, the pet owner is automatically notified with direct one-click booking options.
        </div>
      </div>
    </Screen>
  );
}

function Calendar({ appointments, go }) {
  return <Screen title="Doctor Calendar" sub="Pet, owner, and reason visible in every slot">
    <div className="calendar-layout">
      <aside className="queue"><div className="card-label">Today's Queue</div>{appointments.slice(0, 4).map((appt) => <button key={appt._id} onClick={() => go('soap')}><strong>{appt.petName}</strong><span>{appt.ownerName} · {appt.reason}</span><small>{format12h(appt.time)}</small></button>)}</aside>
      <section className="week-grid">{appointments.map((appt) => <button className={`cal-ev ${appt.status === 'Now' ? 'now' : ''}`} key={appt._id} onClick={() => go('soap')}><strong>{format12h(appt.time)} · {appt.petName}</strong><span>{appt.ownerName}</span><small>{appt.reason}</small></button>)}</section>
    </div>
  </Screen>;
}

export function Screen({ title, sub, action, children }) {
  return <div className="main-scroll"><div className="main-pad"><div className="topbar"><div><h2>{title}</h2><div className="sub">{sub}</div></div>{action}</div>{children}</div></div>;
}

function Table({ headers, children }) {
  return <section style={{ background: 'transparent', border: 'none' }}><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></section>;
}

function AppointmentList({ rows, clients = [] }) {
  const getPetMeta = (row) => {
    let species = row.petSpecies || row.species || '';
    if (!species && clients.length > 0) {
      for (const client of clients) {
        if (client.name === row.ownerName) {
          const pet = (client.pets || []).find(p => p.name === row.petName);
          if (pet && pet.species) {
            species = pet.species;
            break;
          }
        }
      }
    }

    const searchString = (species || row.petBreed || row.breed || '').toLowerCase();

    if (searchString.includes('dog') || searchString.includes('retriever') || searchString.includes('bulldog') || searchString.includes('pug') || searchString.includes('shih')) return { emoji: '🐶', bg: '#eff6ff', color: '#1d4ed8' };
    if (searchString.includes('cat') || searchString.includes('siamese') || searchString.includes('feline')) return { emoji: '🐱', bg: '#fce7f3', color: '#db2777' };
    if (searchString.includes('rabbit') || searchString.includes('lop') || searchString.includes('bunny')) return { emoji: '🐰', bg: '#fef3c7', color: '#d97706' };
    if (searchString.includes('parrot') || searchString.includes('bird') || searchString.includes('grey') || searchString.includes('parakeet')) return { emoji: '🦜', bg: '#dcfce7', color: '#16a34a' };
    return { emoji: '🐾', bg: '#f1f5f9', color: '#475569' };
  };

  return (
    <div className="appointment-list">
      {rows.length > 0 ? (
        rows.map((row) => {
          const { emoji, bg } = getPetMeta(row);
          let badgeVal = '';
          if (row.petName === 'Buddy') badgeVal = 'Now';
          else if (row.petName === 'Luna') badgeVal = 'Follow-up';

          return (
            <div className="appt" key={row._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'grid', placeItems: 'center', fontSize: '20px', flexShrink: 0 }}>
                {emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{row.petName}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>· {row.petBreed || row.breed || 'Golden Retriever'}</span>
                </div>
                <span style={{ display: 'block', color: 'var(--text-2)', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.ownerName} · {row.reason} · {row.vetName || 'Dr. Sarah Chen'}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>{format12h(row.time)}</strong>
                {badgeVal && (
                  <span className={`badge b-${badgeVal === 'Now' ? 'blue' : 'purple'}`} style={{ marginTop: '4px', fontSize: '10px', padding: '1px 6px' }}>
                    {badgeVal}
                  </span>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)' }}>No appointments scheduled for today</div>
      )}
    </div>
  );
}

function Alert({ title, meta }) {
  return <div className="alert-row"><strong>{title}</strong><span>{meta}</span></div>;
}

function Name({ title, sub }) {
  return <div><div className="td-name">{title}</div><div className="td-sub">{sub}</div></div>;
}

function Badge({ value, tone }) {
  const isOverdue = String(value).includes('Overdue') || String(value).includes('alert') || String(value).includes('overdue');
  const isAvailable = String(value).includes('Available') || String(value).includes('Up to date') || String(value).includes('active') || String(value).includes('Done');
  const isPending = String(value).includes('Pending') || String(value).includes('Due') || String(value).includes('soon') || String(value).includes('Consultation');
  const isGray = String(value).includes('Not recorded');

  const color = tone || (isOverdue ? 'red' : isAvailable ? 'green' : isPending ? 'amber' : isGray ? 'gray' : 'blue');
  return <span className={`badge b-${color}`}>{value}</span>;
}

function Input({ label, value, onChange, type = 'text' }) {
  return <label className="field-label">{label}<input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="field-label">{label}<select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function VetModal({ vet, onClose, onSave }) {
  const [name, setName] = useState(vet?.name || '');
  const [email, setEmail] = useState(vet?.email || '');
  const [phone, setPhone] = useState(vet?.phone || '');
  const [specialization, setSpecialization] = useState(vet?.specialization || 'General Practice');
  const [license, setLicense] = useState(vet?.license || '');
  const [experienceYears, setExperienceYears] = useState(vet?.experienceYears || '');
  const [consultationFee, setConsultationFee] = useState(vet?.consultationFee || '');
  const [status, setStatus] = useState(vet?.status || 'Available');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      alert("Please fill in all required fields!");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      alert("Phone number must be exactly 10 digits (numeric only)!");
      return;
    }

    onSave({
      name,
      email,
      phone,
      specialization,
      license,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      consultationFee: consultationFee ? Number(consultationFee) : undefined,
      status
    });
  };

  const specs = [
    'General Practice',
    'Surgery & Dentistry',
    'Exotic Animals',
    'Dermatology & Oncology',
    'Cardiology',
    'Neurology'
  ];

  return (
    <Modal title={vet ? "Edit Veterinarian Details" : "Onboard Veterinarian"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <label className="field-label">
            Full Name *
            <input
              className="input"
              required
              placeholder="e.g. Dr. Sarah Chen"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Email *
              <input
                className="input"
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>
            <label className="field-label">
              Phone *
              <input
                className="input"
                required
                placeholder="10 digits"
                pattern="\d{10}"
                title="Phone number must be exactly 10 digits (numeric only)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Specialization *
              <select
                className="input"
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
              >
                {specs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field-label">
              License Number
              <input
                className="input"
                value={license}
                onChange={e => setLicense(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field-label">
              Experience (years)
              <input
                className="input"
                type="number"
                value={experienceYears}
                onChange={e => setExperienceYears(e.target.value)}
              />
            </label>
            <label className="field-label">
              Consultation Fee ($)
              <input
                className="input"
                type="number"
                value={consultationFee}
                onChange={e => setConsultationFee(e.target.value)}
              />
            </label>
          </div>

          {vet && (
            <label className="field-label">
              Status
              <select
                className="input"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Available">Available</option>
                <option value="In Consultation">In Consultation</option>
                <option value="On Leave">On Leave</option>
              </select>
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{vet ? "Save Changes" : "Onboard"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ClientModal({ onClose, onSave, client, onDeleteClient }) {
  const [ownerName, setOwnerName] = useState(client ? client.name : '');
  const [email, setEmail] = useState(client ? client.email : '');
  const [phone, setPhone] = useState(client ? client.phone : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [pets, setPets] = useState(() => {
    if (client && client.pets && client.pets.length > 0) {
      return client.pets.map(p => ({
        _id: p._id,
        name: p.name || '',
        species: p.species || 'Dog',
        breed: p.breed || '',
        dob: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
        sex: p.sex || 'Male',
        microchip: p.microchip || '',
        spayedNeutered: p.spayedNeutered || 'Yes',
        petId: p.petId,
        alerts: p.alerts
      }));
    }
    return [
      { name: '', species: 'Dog', breed: '', dob: '', sex: 'Male', microchip: '', spayedNeutered: 'Yes', petId: '' }
    ];
  });

  const wrapRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      if (wrapRef.current) {
        wrapRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const modalEl = document.querySelector('.client-modal-card');
      if (modalEl) {
        modalEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const addAnotherPet = () => {
    setPets([
      ...pets,
      { name: '', species: 'Dog', breed: '', dob: '', sex: 'Male', microchip: '', spayedNeutered: 'Yes', petId: '' }
    ]);
  };

  const removePetForm = (index) => {
    if (pets.length === 1) return;
    setPets(pets.filter((_, idx) => idx !== index));
  };

  const handleUpdatePetField = (index, field, value) => {
    setPets(prev =>
      prev.map((p, idx) => {
        if (idx === index) {
          const updated = { ...p, [field]: value };
          if (field === 'species') {
            updated.breed = '';
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ownerName || !email || !phone) {
      alert("Please fill in all required fields for the owner!");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      alert("Owner phone number must be exactly 10 digits (numeric only)!");
      return;
    }

    for (let i = 0; i < pets.length; i++) {
      if (!pets[i].name.trim()) {
        alert(`Please specify a name for Pet #${i + 1}!`);
        return;
      }
    }

    const savedPets = pets.map(p => ({
      _id: p._id || undefined,
      petId: p.petId || undefined,
      name: p.name,
      species: p.species,
      breed: p.breed || undefined,
      dateOfBirth: p.dob || undefined,
      sex: p.sex,
      microchip: p.microchip || undefined,
      spayedNeutered: p.spayedNeutered,
      alerts: p.alerts || []
    }));

    setIsSubmitting(true);
    Promise.resolve(onSave({
      name: ownerName,
      email,
      phone,
      pets: savedPets
    })).finally(() => {
      setIsSubmitting(false);
    });
  };

  const speciesOptions = ['Dog', 'Cat', 'Rabbit', 'Parrot/Bird'];
  const sexOptions = ['Male', 'Female'];
  const spayedOptions = ['Yes', 'No'];

  const breedOptions = {
    'Dog': ['Golden Retriever', 'Labrador Retriever', 'French Bulldog', 'Beagle', 'Poodle', 'German Shepherd', 'Bulldog', 'Mixed Breed', 'Other'],
    'Cat': ['Domestic Shorthair', 'Domestic Longhair', 'Siamese', 'Persian', 'Maine Coon', 'Ragdoll', 'British Shorthair', 'Mixed Breed', 'Other'],
    'Rabbit': ['Mini Rex', 'Holland Lop', 'Lionhead', 'Flemish Giant', 'Netherland Dwarf', 'Other'],
    'Parrot/Bird': ['Parrot', 'Parakeet', 'Cockatiel', 'African Grey', 'Macaw', 'Cockatoo', 'Canary', 'Other'],
    'Other': ['Other']
  };

  return (
    <>
      {isDeleting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>🗑️</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Deleting Client...
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Please wait while we remove this client and all associated pet records.
            </p>
          </div>
        </div>
      )}
      {isSubmitting && !isDeleting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', width: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>{client ? '💾' : '📝'}</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              {client ? 'Saving Changes...' : 'Registering Client...'}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Please wait while we {client ? 'update' : 'create'} the client profile and associated pet records.
            </p>
          </div>
        </div>
      )}
      <div
        ref={wrapRef}
      className="modal-wrap"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        overflowY: 'auto',
        padding: '24px 16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal client-modal-card"
        style={{
          width: 'min(560px, calc(100% - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          background: 'white',
          borderRadius: '12px',
          padding: '22px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto'
        }}
      >
        <div className="modal-hd" style={{ flexShrink: 0 }}>
          <h3>{client ? "Edit Client & Pets Details" : "Register New Client & Pets"}</h3>
          <button type="button" className="modal-x" onClick={onClose}>×</button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: 1
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '18px',
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: '6px',
            minHeight: 0,
            flex: 1
          }}>

            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
              Step 1 — Owner details
            </div>

            <label className="field-label">
              Owner Full Name *
              <input
                className="input"
                required
                placeholder="e.g. James Martinez"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label className="field-label">
                Email *
                <input
                  className="input"
                  required
                  type="email"
                  placeholder="e.g. james.m@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>
              <label className="field-label">
                Phone *
                <input
                  className="input"
                  required
                  placeholder="10 digits"
                  pattern="\d{10}"
                  title="Phone number must be exactly 10 digits (numeric only)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </label>
            </div>

            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '8px' }}>
              Step 2 — Pet details (can register multiple pets)
            </div>

            {pets.map((pet, index) => (
              <div key={index} style={{
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '10px',
                background: '#f8fafc',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '12px', color: 'var(--brand)' }}>Pet #{index + 1}</strong>
                  {pets.length > 1 && (
                    <button
                      type="button"
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: 'var(--red)',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      onClick={() => removePetForm(index)}
                    >
                      ✕ Remove Pet
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label className="field-label">
                      Pet Name *
                      <input
                        className="input"
                        required
                        placeholder="e.g. Buddy"
                        value={pet.name}
                        onChange={e => handleUpdatePetField(index, 'name', e.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Species *
                      <select
                        className="input"
                        value={pet.species}
                        onChange={e => {
                          handleUpdatePetField(index, 'species', e.target.value);
                        }}
                      >
                        {speciesOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                    <label className="field-label">
                      Breed
                      <select
                        className="input"
                        value={(pet.isCustomBreed || (pet.breed && !(breedOptions[pet.species] || ['Other']).includes(pet.breed))) ? 'Other' : pet.breed}
                        onChange={e => {
                          if (e.target.value === 'Other') {
                            handleUpdatePetField(index, 'isCustomBreed', true);
                            if (!pet.breed || (breedOptions[pet.species] || []).includes(pet.breed)) {
                              handleUpdatePetField(index, 'breed', '');
                            }
                          } else {
                            handleUpdatePetField(index, 'isCustomBreed', false);
                            handleUpdatePetField(index, 'breed', e.target.value);
                          }
                        }}
                      >
                        <option value="">Select breed</option>
                        {(breedOptions[pet.species] || ['Other']).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      {(pet.isCustomBreed || (pet.breed && !(breedOptions[pet.species] || ['Other']).includes(pet.breed))) && (
                        <input
                          className="input"
                          style={{ marginTop: '8px' }}
                          placeholder="Specify breed"
                          value={pet.breed === 'Other' ? '' : pet.breed}
                          onChange={e => {
                            handleUpdatePetField(index, 'isCustomBreed', true);
                            handleUpdatePetField(index, 'breed', e.target.value);
                          }}
                        />
                      )}
                    </label>
                    <label className="field-label">
                      Date of Birth
                      <input
                        className="input"
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={pet.dob}
                        onChange={e => handleUpdatePetField(index, 'dob', e.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Sex
                      <select
                        className="input"
                        value={pet.sex}
                        onChange={e => handleUpdatePetField(index, 'sex', e.target.value)}
                      >
                        {sexOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label className="field-label">
                      Microchip #
                      <input
                        className="input"
                        placeholder="Optional"
                        value={pet.microchip}
                        onChange={e => handleUpdatePetField(index, 'microchip', e.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Spayed / Neutered
                      <select
                        className="input"
                        value={pet.spayedNeutered}
                        onChange={e => handleUpdatePetField(index, 'spayedNeutered', e.target.value)}
                      >
                        {spayedOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-outline"
              style={{
                border: '1px dashed var(--brand)',
                color: 'var(--brand)',
                background: '#f0f9ff',
                width: '100%',
                padding: '10px',
                justifyContent: 'center',
                fontWeight: '700'
              }}
              onClick={addAnotherPet}
            >
              ➕ Add Another Pet
            </button>

          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border)',
            paddingTop: '14px',
            flexShrink: 0,
            flexWrap: 'wrap',
            width: '100%'
          }}>
            {client && onDeleteClient ? (
              <button
                type="button"
                className="btn btn-outline"
                style={{ color: 'var(--red)', border: '1px solid var(--red)' }}
                onClick={() => {
                  window.showConfirm(`Are you sure you want to delete ${client.name} and all their pets?`, () => {
                    setIsDeleting(true);
                    Promise.resolve(onDeleteClient()).finally(() => setIsDeleting(false));
                  });
                }}
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Client"}
              </button>
            ) : (
              <div />
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting || isDeleting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || isDeleting}>
                {isSubmitting ? (client ? "Saving..." : "Registering...") : (client ? "Save Changes" : "Create & Continue")}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
    </>
  );
}

function ModalForm({ form, setForm, fields }) {
  return <div className="form-grid">{fields.map((field) => <Input key={field} label={field} value={form[field] || ''} onChange={(value) => setForm({ ...form, [field]: value })} />)}</div>;
}

function Modal({ title, onClose, children }) {
  return <div className="modal-wrap"><section className="modal"><div className="modal-hd"><h3>{title}</h3><button className="modal-x" onClick={onClose}>×</button></div>{children}</section></div>;
}

createRoot(document.getElementById('root')).render(<App />);
