import React from 'react';
import { getWeekDates, isSameDay, formatMonthHeader, format12h } from '../utils/dateUtils.js';
import { getSpeciesEmoji } from '../queue/QueueManager.jsx';

// Bounding slots mapping
const HALF_HOUR_SLOTS = [];
for (let sh = 9; sh < 18; sh++) {
  for (let sm = 0; sm < 60; sm += 30) {
    let nextHour = sh;
    let nextMin = sm + 30;
    if (nextMin >= 60) {
      nextMin = 0;
      nextHour++;
    }
    const ampm1 = sh >= 12 ? 'PM' : 'AM';
    const h12_1 = sh % 12 || 12;
    const m_1 = sm === 0 ? '00' : '30';
    const ampm2 = nextHour >= 12 ? 'PM' : 'AM';
    const h12_2 = nextHour % 12 || 12;
    const m_2 = nextMin === 0 ? '00' : '30';
    HALF_HOUR_SLOTS.push({
      label: `${h12_1}:${m_1} ${ampm1} - ${h12_2}:${m_2} ${ampm2}`,
      startMins: sh * 60 + sm,
      endMins: nextHour * 60 + nextMin,
      dbFormat: `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}-${String(nextHour).padStart(2,'0')}:${String(nextMin).padStart(2,'0')}`
    });
  }
}

export function WeeklyCalendar({ 
  appointments = [], 
  currentDate, 
  onDateChange,
  viewMode,
  onViewModeChange,
  onStartSoap
}) {
  const visibleDates = getWeekDates(currentDate, viewMode);
  const today = new Date();
  
  // Format column headers: e.g. "Sun 26"
  const getColHeader = (date) => {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    const isToday = isSameDay(date, today);
    return {
      text: `${weekday} ${dayNum}`,
      isToday
    };
  };

  // Check if appointment falls into a specific date and half-hour slot
  const getAppointmentsForSlot = (date, slot) => {
    return appointments.filter(appt => {
      const matchesDate = isSameDay(appt.date, date);
      if (!matchesDate) return false;
      
      if (appt.time === slot.dbFormat) return true;
      
      const parts = appt.time.split(/-|:/);
      if (parts.length < 2) return false;
      
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
      const appTimeMins = h * 60 + m;
      
      return appTimeMins >= slot.startMins && appTimeMins < slot.endMins;
    });
  };

  // Determine styling for appointment card based on status/reason
  const getCardStyle = (appt) => {
    const r = appt.reason.toLowerCase();
    const t = appt.type?.toLowerCase() || '';
    const status = appt.status;
    
    if (status === 'Now') {
      return {
        bg: '#f0f7ff',
        borderLeft: '4px solid #2563eb',
        border: '1px solid rgba(37, 99, 235, 0.08)',
        color: '#1e40af',
        tagColor: '#2563eb'
      };
    }
    
    if (r.includes('vaccin') || t.includes('vaccin')) {
      return {
        bg: '#fffbeb',
        borderLeft: '4px solid #d97706',
        border: '1px solid rgba(217, 119, 6, 0.08)',
        color: '#92400e',
        tagColor: '#d97706'
      };
    }
    
    if (r.includes('dental') || r.includes('teeth')) {
      return {
        bg: '#faf5ff',
        borderLeft: '4px solid #7c3aed',
        border: '1px solid rgba(124, 58, 237, 0.08)',
        color: '#6b21a8',
        tagColor: '#7c3aed'
      };
    }
    
    if (r.includes('ear') || r.includes('throat') || r.includes('sneeze') || r.includes('cough') || r.includes('post-op')) {
      return {
        bg: '#fef2f2',
        borderLeft: '4px solid #ef4444',
        border: '1px solid rgba(239, 68, 68, 0.08)',
        color: '#991b1b',
        tagColor: '#ef4444'
      };
    }
    
    // Default Scheduled Checkup / General Consultation
    return {
      bg: '#f0fdf4',
      borderLeft: '4px solid #10b981',
      border: '1px solid rgba(16, 185, 129, 0.08)',
      color: '#065f46',
      tagColor: '#10b981'
    };
  };

  // Handle navigate previous/next week
  const adjustWeek = (weeksDiff) => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + (weeksDiff * 7));
    onDateChange(next);
  };

  return (
    <div style={{
      flex: 1,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      overflow: 'hidden'
    }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
            {formatMonthHeader(visibleDates)}
          </h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              className="btn btn-outline btn-sm" 
              style={{ padding: '4px 8px', height: '26px' }}
              onClick={() => adjustWeek(-1)}
            >
              ◀
            </button>
            <button 
              className="btn btn-outline btn-sm" 
              style={{ padding: '4px 8px', height: '26px' }}
              onClick={() => adjustWeek(1)}
            >
              ▶
            </button>
          </div>
        </div>
        
        {/* Toggle Controls */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
          {['Today', 'Day', 'Work week', 'Week'].map(mode => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  if (mode === 'Today') {
                    onDateChange(new Date());
                    onViewModeChange('Day');
                  } else {
                    onViewModeChange(mode);
                  }
                }}
                style={{
                  border: 0,
                  background: isActive ? 'var(--sidebar-bg)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-2)',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info notice bar */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '12px',
        color: '#1e40af',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        lineHeight: '1.4'
      }}>
        <span>📋</span>
        <span>
          <strong>Each calendar slot shows:</strong> Pet emoji - Pet name - Owner name - Reason — so vet always knows who is coming and who the owner is.
        </span>
      </div>

      {/* Grid Layout Container */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          minWidth: viewMode === 'Week' ? '800px' : 'auto'
        }}>
          <thead>
            <tr>
              {/* Hour Column Header */}
              <th style={{
                width: '60px',
                padding: '10px',
                background: 'var(--surface-2)',
                borderBottom: '2px solid var(--border)',
                borderRight: '1px solid var(--border)',
                position: 'sticky',
                top: 0,
                zIndex: 4
              }} />
              
              {/* Day Columns Header */}
              {visibleDates.map(date => {
                const header = getColHeader(date);
                return (
                  <th 
                    key={date.toISOString()} 
                    style={{
                      padding: '10px',
                      background: 'var(--surface-2)',
                      borderBottom: '2px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: header.isToday ? 'var(--brand)' : 'var(--text-2)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 3
                    }}
                  >
                    {header.text}
                    {header.isToday && <span style={{ marginLeft: '4px', color: 'var(--brand)' }}>•</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          
          <tbody>
            {HALF_HOUR_SLOTS.map(slot => (
              <tr key={slot.label} style={{ minHeight: '80px' }}>
                {/* Hour label */}
                <td style={{
                  padding: '12px 6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--text-3)',
                  textAlign: 'right',
                  verticalAlign: 'top',
                  borderBottom: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)',
                  position: 'sticky',
                  left: 0,
                  background: 'var(--surface)',
                  zIndex: 2
                }}>
                  {slot.label}
                </td>
                
                {/* Day Slot Cells */}
                {visibleDates.map(date => {
                  const cellAppts = getAppointmentsForSlot(date, slot);
                  return (
                    <td 
                      key={date.toISOString() + slot.label} 
                      style={{
                        padding: '6px',
                        borderBottom: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        verticalAlign: 'top',
                        background: isSameDay(date, today) ? 'rgba(37,99,235,0.01)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(37,99,235,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSameDay(date, today) ? 'rgba(37,99,235,0.01)' : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {cellAppts.map(appt => {
                          const card = getCardStyle(appt);
                          return (
                            <div
                              key={appt._id}
                              onClick={() => onStartSoap(appt)}
                              style={{
                                background: card.bg,
                                border: card.border,
                                borderLeft: card.borderLeft,
                                borderRadius: '6px',
                                padding: '8px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                              }}
                            >
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', flexShrink: 0 }}>
                                  {getSpeciesEmoji(appt.species, appt.breed)}
                                </span>
                                <strong style={{ color: card.color, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {appt.petName} - {appt.ownerName}
                                </strong>
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {format12h(appt.time)} · {appt.reason} {appt.status === 'Now' && '· NOW'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
