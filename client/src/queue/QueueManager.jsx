import React from 'react';

export function getSpeciesEmoji(species = '', breed = '') {
  const s = species.toLowerCase();
  const b = breed.toLowerCase();
  if (s.includes('dog') || b.includes('retriever') || b.includes('bulldog') || b.includes('shepherd')) return '🐶';
  if (s.includes('cat') || b.includes('siamese') || b.includes('persian')) return '🐱';
  if (s.includes('rabbit') || s.includes('bunny')) return '🐰';
  if (s.includes('parrot') || s.includes('bird')) return '🦜';
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
      width: '240px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      flexShrink: 0
    }}>
      {/* Title */}
      <div className="card-label" style={{
        fontSize: '11px',
        color: 'var(--text-3)',
        fontWeight: '800',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        marginBottom: '4px'
      }}>
        Today's Queue
      </div>

      {/* NOW IN ROOM Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase' }}>
          Now in Room
        </div>
        
        {nowInRoom ? (
          <div style={{
            background: 'var(--brand)',
            borderRadius: '10px',
            padding: '14px',
            color: '#white',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ fontSize: '24px' }}>
                {getSpeciesEmoji(nowInRoom.species, nowInRoom.breed)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ color: 'white', fontSize: '15px' }}>{nowInRoom.petName}</strong>
                <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '11px', marginTop: '2px' }}>
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
                  fontWeight: '600'
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
                  fontWeight: '700'
                }}
                onClick={() => onStartSoap(nowInRoom)}
              >
                Start SOAP
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-2)',
            border: '1.5px dashed var(--border)',
            borderRadius: '10px',
            padding: '16px 14px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            No patient in room.<br />
            <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--brand)' }}>Click 'Call Next' below.</span>
          </div>
        )}
      </div>

      {/* UP NEXT Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase' }}>
          Up Next
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          overflowY: 'auto', 
          maxHeight: '260px',
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
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>
                    {getSpeciesEmoji(appt.species, appt.breed)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appt.petName}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {appt.ownerName} · {appt.reason}
                    </div>
                  </div>
                </div>
                
                <div style={{ 
                  fontWeight: '700', 
                  fontSize: '11px', 
                  color: 'var(--text-2)',
                  flexShrink: 0 
                }}>
                  {appt.time}
                </div>
              </div>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: '11px',
              padding: '18px 0',
              fontStyle: 'italic'
            }}>
              No upcoming patients.
            </div>
          )}
        </div>
      </div>

      {/* Call Next Action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
        <button 
          className="btn btn-primary"
          style={{ 
            width: '100%', 
            padding: '10px', 
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: remainingCount > 0 ? '0 4px 10px rgba(37, 99, 235, 0.15)' : 'none'
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
          fontWeight: '500' 
        }}>
          {remainingCount > 0 ? `${remainingCount} more today` : 'No more today'}
        </div>
      </div>
    </aside>
  );
}
