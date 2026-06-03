import React from 'react';
import { format12h } from '../utils/dateUtils.js';

export function getSpeciesEmoji(species = '', breed = '') {
  const s = (species || '').toLowerCase();
  const b = (breed || '').toLowerCase();
  if (s.includes('dog') || b.includes('retriever') || b.includes('bulldog') || b.includes('shepherd')) return '🐕';
  if (s.includes('cat') || b.includes('siamese') || b.includes('persian')) return '🐱';
  if (s.includes('rabbit') || s.includes('bunny')) return '🐰';
  if (s.includes('parrot') || s.includes('bird')) return '🦜';
  if (s.includes('turtle') || s.includes('tortoise')) return '🐢';
  if (s.includes('hamster') || s.includes('guinea') || s.includes('cavy') || s.includes('mouse') || s.includes('rat')) return '🐹';
  if (s.includes('snake') || s.includes('lizard') || s.includes('reptile')) return '🐍';
  return '🐾';
}

export function QueueManager({ 
  nowInRoom, 
  upNext, 
  onCallNext, 
  onComplete, 
  onStartSoap 
}) {
  const remainingCount = upNext.length;
  
  return (
    <aside className="queue" style={{
      width: '285px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      flexShrink: 0,
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Title */}
      <div className="card-label" style={{
        fontSize: '11px',
        color: 'var(--text-3)',
        fontWeight: '800',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        marginBottom: '0px'
      }}>
        Today's Queue
      </div>

      {/* NOW IN ROOM Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Now in Room
        </div>
        
        {nowInRoom ? (
          <div style={{
            background: 'linear-gradient(135deg, var(--brand) 0%, #1d4ed8 100%)',
            borderRadius: '10px',
            padding: '16px 14px',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.2)'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ 
                fontSize: '28px', 
                background: 'rgba(255, 255, 255, 0.2)', 
                borderRadius: '8px', 
                width: '46px', 
                height: '46px', 
                display: 'grid', 
                placeItems: 'center',
                flexShrink: 0
              }}>
                {getSpeciesEmoji(nowInRoom.species, nowInRoom.breed)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <strong style={{ color: 'white', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nowInRoom.petName}
                </strong>
                <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '11px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nowInRoom.ownerName} · {nowInRoom.reason}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                className="btn btn-sm" 
                style={{ 
                  flex: 1, 
                  background: 'rgba(255, 255, 255, 0.15)', 
                  color: 'white', 
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  fontSize: '11px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  padding: '6px'
                }}
                onClick={() => onComplete(nowInRoom)}
              >
                Mark done
              </button>
              <button 
                className="btn btn-sm" 
                style={{ 
                  flex: 1, 
                  background: 'white', 
                  color: 'var(--brand)',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  padding: '6px',
                  border: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onClick={() => onStartSoap(nowInRoom)}
              >
                Start Consultation
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-2)',
            border: '1.5px dashed var(--border)',
            borderRadius: '10px',
            padding: '24px 14px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            No patient in room.<br />
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--brand)', marginTop: '4px', display: 'inline-block' }}>
              Click 'Call Next' below
            </span>
          </div>
        )}
      </div>

      {/* UP NEXT Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Up Next
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          overflowY: 'auto', 
          flex: 1,
          paddingRight: '2px'
        }}>
          {upNext.length > 0 ? (
            upNext.map((appt) => (
              <div 
                key={appt._id} 
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease, border-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                  <span style={{ 
                    fontSize: '20px', 
                    flexShrink: 0,
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    {getSpeciesEmoji(appt.species, appt.breed)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appt.petName}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {appt.ownerName} · {appt.reason}
                    </div>
                  </div>
                </div>
                
                <div style={{ 
                  fontWeight: '700', 
                  fontSize: '11px', 
                  color: 'var(--text-2)',
                  flexShrink: 0,
                  background: 'var(--surface)',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)'
                }}>
                  {format12h(appt.time)}
                </div>
              </div>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: '12px',
              padding: '32px 0',
              fontStyle: 'italic',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px'
            }}>
              No upcoming patients.
            </div>
          )}
        </div>
      </div>

      {/* Call Next Action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        <button 
          className="btn btn-primary"
          style={{ 
            width: '100%', 
            padding: '12px', 
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            background: remainingCount > 0 ? 'var(--brand)' : 'var(--text-3)',
            cursor: remainingCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: remainingCount > 0 ? '0 4px 12px rgba(37, 99, 235, 0.18)' : 'none',
            border: 'none',
            color: 'white',
            transition: 'all 0.2s ease'
          }}
          onClick={onCallNext}
          disabled={remainingCount === 0}
        >
          Call Next →
        </button>
        <div style={{ 
          textAlign: 'center', 
          fontSize: '10px', 
          color: 'var(--text-3)', 
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {remainingCount > 0 ? `${remainingCount} more today` : 'No more today'}
        </div>
      </div>
    </aside>
  );
}
