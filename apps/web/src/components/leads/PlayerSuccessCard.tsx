'use client';

import { useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { brandConfig } from '@tofa/core';

interface PlayerSuccessCardProps {
  playerName: string;
  ageCategory: string;
  centerName?: string;
  technicalSkill: number;
  fitness: number;
  teamwork: number;
  discipline: number;
  onGenerate: () => void;
}

export function PlayerSuccessCard({
  playerName,
  ageCategory,
  centerName,
  technicalSkill,
  fitness,
  teamwork,
  discipline,
  onGenerate,
}: PlayerSuccessCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      onGenerate();
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `${playerName.replace(/\s+/g, '-')}-TOFA-Card.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating card:', error);
    }
  };

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto+Condensed:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleDownload}
        className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
        style={{ fontFamily: 'Roboto Condensed, sans-serif' }}
      >
        📸 Generate FUT Card
      </button>

      {/* Hidden card for image generation */}
      <div
        ref={cardRef}
        className="hidden"
        style={{
          width: '400px',
          height: '600px',
          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
          borderRadius: '20px',
          padding: '30px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            left: '-30px',
            width: '150px',
            height: '150px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Top Section */}
          <div style={{ marginBottom: '30px' }}>
            <div
              style={{
                fontSize: '42px',
                fontWeight: 'bold',
                color: '#FFFFFF',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                marginBottom: '10px',
                fontFamily: 'Bebas Neue, sans-serif',
                letterSpacing: '2px',
              }}
            >
              {playerName.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: '20px',
                color: '#FFF8DC',
                fontFamily: 'Roboto Condensed, sans-serif',
                fontWeight: 'bold',
              }}
            >
              {ageCategory}
            </div>
          </div>

          {/* Center Section - Player Initial */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '20px 0',
            }}
          >
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: '8px solid rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '80px',
                fontWeight: 'bold',
                color: '#FFFFFF',
                textShadow: '3px 3px 6px rgba(0,0,0,0.4)',
                fontFamily: 'Bebas Neue, sans-serif',
              }}
            >
              {getInitials(playerName)}
            </div>
          </div>

          {/* Stats Section */}
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '15px',
              padding: '20px',
              marginBottom: '20px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginBottom: '15px',
                textAlign: 'center',
                fontFamily: 'Bebas Neue, sans-serif',
                letterSpacing: '1px',
              }}
            >
              SKILL RATINGS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <StatItem label="TEC" value={technicalSkill} />
              <StatItem label="FIT" value={fitness} />
              <StatItem label="TM" value={teamwork} />
              <StatItem label="DIS" value={discipline} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: 'auto' }}>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginBottom: '8px',
                fontFamily: 'Bebas Neue, sans-serif',
                letterSpacing: '1px',
              }}
            >
              {brandConfig.name.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#FFF8DC',
                fontFamily: 'Roboto Condensed, sans-serif',
              }}
            >
              {centerName || brandConfig.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        style={{
          fontSize: '14px',
          color: '#FFF8DC',
          marginBottom: '5px',
          fontFamily: 'Roboto Condensed, sans-serif',
          fontWeight: 'bold',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              fontSize: '18px',
              color: star <= value ? '#FFD700' : 'rgba(255,255,255,0.3)',
              textShadow: star <= value ? '0 0 5px rgba(255,215,0,0.8)' : 'none',
            }}
          >
            ★
          </span>
        ))}
        <span
          style={{
            fontSize: '16px',
            color: '#FFFFFF',
            marginLeft: '5px',
            fontFamily: 'Roboto Condensed, sans-serif',
            fontWeight: 'bold',
          }}
        >
          {value}/5
        </span>
      </div>
    </div>
  );
}

