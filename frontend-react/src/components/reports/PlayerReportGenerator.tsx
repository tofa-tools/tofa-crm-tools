'use client';

import { toPng } from 'html-to-image';
import { skillsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface PlayerReportGeneratorProps {
  leadId: number;
  playerName: string;
  ageCategory: string;
  centerName: string;
  onImageGenerated?: (imageBlob: Blob) => void;
}

export function usePlayerReportGenerator() {
  const generateAndDownloadReport = async (
    leadId: number,
    playerName: string,
    ageCategory: string,
    centerName: string
  ): Promise<Blob | null> => {
    try {
      // Fetch skill summary
      const summary = await skillsAPI.getSkillSummary(leadId);

      if (summary.total_evaluations === 0) {
        toast.error('No skill evaluations found for this player');
        return null;
      }

      // Create a temporary container for the card
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '400px';
      container.style.height = '600px';
      document.body.appendChild(container);

      // Render the card (we'll need to use React to render it)
      // For now, we'll use a simpler approach with html-to-image
      const cardHtml = `
        <div id="report-card-temp" style="width: 400px; height: 600px; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <div style="background: rgba(0,0,0,0.3); padding: 24px; color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h1 style="font-size: 24px; font-weight: bold; margin: 0;">${playerName}</h1>
              <div style="text-align: right;">
                <div style="font-size: 32px; font-weight: bold;">${ageCategory}</div>
                <div style="font-size: 10px; opacity: 0.9;">Age Category</div>
              </div>
            </div>
            <p style="font-size: 14px; opacity: 0.9; margin: 0;">${centerName}</p>
          </div>
          <div style="padding: 24px; background: rgba(255,255,255,0.95); height: calc(100% - 120px);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px; font-weight: bold; color: #667eea; margin-bottom: 4px;">${((summary.average_technical_score + summary.average_fitness_score + summary.average_teamwork_score + summary.average_discipline_score) / 4).toFixed(1)}</div>
              <div style="font-size: 12px; color: #666;">Overall Rating</div>
            </div>
            <div style="space-y: 16px;">
              ${['Technical', 'Fitness', 'Teamwork', 'Discipline'].map((label, idx) => {
                const scores = [
                  summary.average_technical_score || 0,
                  summary.average_fitness_score || 0,
                  summary.average_teamwork_score || 0,
                  summary.average_discipline_score || 0,
                ];
                const colors = ['#3b82f6', '#10b981', '#a855f7', '#f97316'];
                const score = scores[idx];
                const percentage = (score / 5) * 100;
                return `
                  <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <span style="font-size: 12px; font-weight: 600; color: #333;">${label}</span>
                      <span style="font-size: 12px; font-weight: bold; color: #111;">${score.toFixed(1)} / 5</span>
                    </div>
                    <div style="width: 100%; height: 24px; background: #e5e7eb; border-radius: 12px; overflow: hidden;">
                      <div style="width: ${percentage}%; height: 100%; background: ${colors[idx]}; transition: width 0.5s;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
              <div style="font-size: 10px; color: #666; margin-bottom: 12px;">TOFA Academy Progress Report</div>
              <div style="font-size: 10px; color: #999; margin-bottom: 16px;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              
              <!-- TOFA Logo -->
              <div style="margin-bottom: 12px;">
                <div style="display: inline-block; background: #4f46e5; color: white; padding: 6px 16px; border-radius: 8px; font-weight: bold; font-size: 12px;">TOFA</div>
              </div>
              
              <!-- Join Today Section -->
              <div style="background: #f9fafb; border-radius: 8px; padding: 12px; margin-top: 8px;">
                <div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 4px;">Join Today!</div>
                <div style="font-size: 10px; color: #4f46e5; font-weight: 500; margin-bottom: 8px;">www.tofa.academy/join</div>
                <!-- QR Code Placeholder -->
                <div style="display: inline-block; background: white; padding: 8px; border-radius: 4px; border: 2px solid #d1d5db;">
                  <div style="width: 50px; height: 50px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;">
                    ${Array.from({ length: 16 }).map((_, i) => 
                      `<div style="background: ${i % 3 === 0 || i % 5 === 0 ? '#000' : '#fff'}; width: 100%; height: 100%;"></div>`
                    ).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = cardHtml;

      // Wait for image to render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate image
      const dataUrl = await toPng(container.firstChild as HTMLElement, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      // Clean up
      document.body.removeChild(container);

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      return blob;
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report image');
      return null;
    }
  };

  const shareToWhatsApp = async (
    imageBlob: Blob,
    playerName: string,
    parentName: string,
    phone: string
  ) => {
    try {
      // Create a file from blob
      const file = new File([imageBlob], `${playerName}-report.png`, { type: 'image/png' });

      // Try Web Share API first
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${playerName} Progress Report`,
          text: `Hi ${parentName}, here is the latest progress report for ${playerName} at TOFA!`,
        });
        toast.success('Report shared successfully!');
        return true; // Share was successful
      }

      // Fallback: Download and open WhatsApp
      const url = URL.createObjectURL(imageBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${playerName}-report.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Open WhatsApp with pre-filled message
      const cleanPhone = phone.replace(/\D/g, '');
      const message = encodeURIComponent(
        `Hi ${parentName}, here is the latest progress report for ${playerName} at TOFA!`
      );
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
      window.open(whatsappUrl, '_blank');

      toast.success('Report downloaded! Opening WhatsApp...');
      return true; // Assume success for fallback
    } catch (error: any) {
      console.error('Error sharing report:', error);
      toast.error('Failed to share report');
      return false; // Share failed
    }
  };

  return {
    generateAndDownloadReport,
    shareToWhatsApp,
  };
}

