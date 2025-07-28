import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import type { Node, Edge } from '../types';

export interface ExportOptions {
  format: 'png' | 'jpg' | 'pdf';
  scale?: number;
  quality?: number;
  includeMetadata?: boolean;
  backgroundColor?: string;
}

export interface ExportMetadata {
  title: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  exportDate: Date;
}

class ExportService {
  async exportBoard(
    element: HTMLElement | null,
    nodes: Node[],
    edges: Edge[],
    options: ExportOptions & { metadata?: Partial<ExportMetadata> }
  ): Promise<void> {
    if (!element) {
      throw new Error('Board element not found');
    }

    const {
      format,
      scale = 2,
      quality = 0.95,
      includeMetadata = false,
      backgroundColor = '#ffffff',
      metadata = {}
    } = options;

    try {
      // Create canvas from the board element
      const canvas = await html2canvas(element, {
        scale,
        backgroundColor,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      // Handle different export formats
      switch (format) {
        case 'png':
          await this.exportAsPNG(canvas, metadata.title || 'ragboard-export');
          break;
        case 'jpg':
          await this.exportAsJPG(canvas, quality, metadata.title || 'ragboard-export');
          break;
        case 'pdf':
          await this.exportAsPDF(canvas, nodes, edges, { ...metadata, includeMetadata });
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export board');
    }
  }

  private async exportAsPNG(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `${filename}.png`);
      }
    }, 'image/png');
  }

  private async exportAsJPG(
    canvas: HTMLCanvasElement,
    quality: number,
    filename: string
  ): Promise<void> {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          saveAs(blob, `${filename}.jpg`);
        }
      },
      'image/jpeg',
      quality
    );
  }

  private async exportAsPDF(
    canvas: HTMLCanvasElement,
    nodes: Node[],
    edges: Edge[],
    metadata: Partial<ExportMetadata> & { includeMetadata?: boolean }
  ): Promise<void> {
    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions based on canvas size
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    // Add the canvas image to PDF
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Add metadata page if requested
    if (metadata.includeMetadata) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Board Metadata', 10, 20);
      
      pdf.setFontSize(12);
      let yPosition = 40;
      
      if (metadata.title) {
        pdf.text(`Title: ${metadata.title}`, 10, yPosition);
        yPosition += 10;
      }
      
      if (metadata.description) {
        pdf.text(`Description: ${metadata.description}`, 10, yPosition);
        yPosition += 10;
      }
      
      pdf.text(`Export Date: ${new Date().toLocaleString()}`, 10, yPosition);
      yPosition += 10;
      
      pdf.text(`Total Nodes: ${nodes.length}`, 10, yPosition);
      yPosition += 10;
      
      pdf.text(`Total Connections: ${edges.length}`, 10, yPosition);
    }

    // Save the PDF
    pdf.save(`${metadata.title || 'ragboard-export'}.pdf`);
  }

  // Helper method to export specific node types
  async exportNode(
    nodeElement: HTMLElement,
    nodeData: Node,
    format: 'png' | 'jpg'
  ): Promise<void> {
    const canvas = await html2canvas(nodeElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const filename = `node-${nodeData.id}-${nodeData.type || 'default'}`;
    
    if (format === 'png') {
      await this.exportAsPNG(canvas, filename);
    } else {
      await this.exportAsJPG(canvas, 0.95, filename);
    }
  }

  // Export board data as JSON
  exportAsJSON(nodes: Node[], edges: Edge[], metadata?: Partial<ExportMetadata>): void {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      metadata: metadata || {},
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    saveAs(blob, `${metadata?.title || 'ragboard-export'}.json`);
  }
}

export const exportService = new ExportService();