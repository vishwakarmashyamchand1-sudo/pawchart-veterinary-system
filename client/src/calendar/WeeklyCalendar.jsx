import React from 'react';
import { getWeekDates, isSameDay, formatMonthHeader } from '../utils/dateUtils.js';
import { getSpeciesEmoji } from '../queue/QueueManager.jsx';

// Bounding slots mapping
const HOUR_SLOTS = [
  { label: '9 AM', hours: 9 },
  { label: '10 AM', hours: 10 },
  { label: '11 AM', hours: 11 },
  { label: '12 PM', hours: 12 },
  { label: '1 PM', hours: 13 },
  { label: '2 PM', hours: 14 },
  { label: '3 PM', hours: 15 },
  { label: '4 PM', hours: 16 }
];

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

  // Check if appointment falls into a specific date and slot hour
  const getAppointmentsForSlot = (date, slotHour) => {
    return appointments.filter(appt => {
      // Compare calendar date
      const matchesDate = isSameDay(appt.date, date);
      if (!matchesDate) return false;
      
      // Parse time (e.g. "10:30" -> hours: 10)
      const parts = appt.time.split(':');
      const apptHour = parseInt(parts[0], 10);
      
      return apptHour === slotHour;
    });
  };

  // Determine styling for appointment card based on status/reason
  const getCardStyle = (appt) => {
    const r = appt.reason.toLowerCase();
    const t = appt.type?.toLowerCase() || '';
    const status = appt.status;
    
    if (status === 'Now') {
      return {
        bg: '#dbeafe',
        border: '1.5px solid #2563eb',
        color: '#1e3a8a',
        tagColor: '#2563eb'
      };
    }
    
    if (r.includes('vaccin') || t.includes('vaccin')) {
      return {
        bg: '#fef3c7',
        border: '1.5px solid #d97706',
        color: '#78350f',
        tagColor: '#d97706'
      };
    }
    
    if (r.includes('dental') || r.includes('teeth')) {
      return {
        bg: '#f3e8ff',
        border: '1.5px solid #7c3aed',
        color: '#581c87',
        tagColor: '#7c3aed'
      };
    }
    
    if (r.includes('ear') || r.includes('throat') || r.includes('sneeze') || r.includes('cough')) {
      return {
        bg: '#fee2e2',
        border: '1.5px solid #dc2626',
        color: '#7f1d1d',
        tagColor: '#dc2626'
      };
    }
    
    // Default Scheduled Checkup / General Consultation
    return {
      bg: '#eff6ff',
      border: '1.5px solid #3b82f6',
      color: '#1e40af',
      tagColor: '#3b82f6'
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
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', maxHeight: '430px' }}>
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
                borderRight: '1px solid var(--border)'
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
                      color: header.isToday ? 'var(--brand)' : 'var(--text-2)'
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
            {HOUR_SLOTS.map(slot => (
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
                  borderRight: '1px solid var(--border)'
                }}>
                  {slot.label}
                </td>
                
                {/* Day Slot Cells */}
                {visibleDates.map(date => {
                  const cellAppts = getAppointmentsForSlot(date, slot.hours);
                  return (
                    <td 
                      key={date.toISOString() + slot.label} 
                      style={{
                        padding: '6px',
                        borderBottom: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        verticalAlign: 'top',
                        background: isSameDay(date, today) ? 'rgba(37,99,235,0.01)' : 'transparent'
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
                                borderRadius: '8px',
                                padding: '8px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                              }}
                            >
                              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px' }}>
                                  {getSpeciesEmoji(appt.species, appt.breed)}
                                </span>
                                <strong style={{ color: card.color, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {appt.petName} - {appt.ownerName}
                                </strong>
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {appt.reason} {appt.status === 'Now' && '· NOW'}
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
