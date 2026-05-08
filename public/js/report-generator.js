/**
 * Report Generator Skill
 * Genera report PDF di presentazione dati dinamici
 * Versione: 1.0
 */

class ReportGenerator {
  constructor(config) {
    // Config template
    this.template = config.template || 'report-tesseramento';
    this.title = config.title || 'Report';
    this.logoUrl = config.logoUrl || '';
    
    // Dati
    this.kpis = config.kpis || {};
    this.filters = config.filters || {};
    this.charts = config.charts || {};
    this.tables = config.tables || {};
    this.cards = config.cards || [];
    
    // Opzioni rendering
    this.pageSize = config.pageSize || 'a4';
    this.orientation = config.orientation || 'landscape';
    this.filename = config.filename || 'Report_' + new Date().toISOString().slice(0,10) + '.pdf';
    
    this.renderingOptions = {
      scale: config.renderingOptions?.scale || 2,
      delay: config.renderingOptions?.delay || 500,
      timeout: config.renderingOptions?.timeout || 10000,
      useCORS: true,
      allowTaint: true
    };
    
    this.headerType = config.headerType || 'default';
    this.footerType = config.footerType || 'cna';
    this.pageNumbers = config.pageNumbers !== false;
    this.totalPages = config.totalPages !== false;
    
    this.colors = config.colors || {
      header: '#3B82F6',
      accent: '#8B5CF6',
      text: '#333333'
    };
  }

  /**
   * Genera il report PDF completo
   */
  async generatePDF() {
    try {
      // Mostra loading
      this.showLoading();
      
      // Prepara dati
      this.prepareData();
      
      // Cattura grafici come immagini
      await this.captureCharts();
      
      // Costruisci pagine
      const pages = this.buildPages();
      
      // Cattura ogni pagina con html2canvas
      const pageCanvases = await this.capturePages(pages);
      
      // Assembla PDF
      this.assemblePDF(pageCanvases);
      
      // Nascondi loading
      this.hideLoading();
      
      return true;
    } catch (err) {
      console.error('Errore generazione report:', err);
      this.hideLoading();
      alert('Errore nella generazione del report: ' + err.message);
      throw err;
    }
  }

  /**
   * Mostra overlay loading
   */
  showLoading() {
    if (document.getElementById('report-loading-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'report-loading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:white;padding:40px 50px;border-radius:12px;text-align:center;font-family:sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="font-size:32px;margin-bottom:16px">📄</div>
        <div style="font-size:18px;font-weight:bold;margin-bottom:8px">Generazione Report PDF</div>
        <div style="font-size:14px;color:#888;margin-bottom:16px">Attendere prego...</div>
        <div style="width:200px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden">
          <div style="width:100%;height:100%;background:linear-gradient(90deg,#3B82F6,#8B5CF6);animation:progress 1.5s infinite"></div>
        </div>
      </div>
      <style>
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      </style>
    `;
    document.body.appendChild(overlay);
  }

  /**
   * Nascondi overlay loading
   */
  hideLoading() {
    const overlay = document.getElementById('report-loading-overlay');
    if (overlay) document.body.removeChild(overlay);
  }

  /**
   * Prepara i dati per il rendering
   */
  prepareData() {
    // Niente da fare qui, i dati sono già disponibili
  }

  /**
   * Cattura i grafici Chart.js come immagini base64
   */
  async captureCharts() {
    for (const [key, canvas] of Object.entries(this.charts)) {
      if (canvas && canvas.toDataURL) {
        try {
          this.charts[key] = canvas.toDataURL('image/png');
        } catch (e) {
          console.warn('Errore cattura grafico:', key, e);
        }
      }
    }
  }

  /**
   * Costruisce le pagine HTML
   */
  buildPages() {
    const pages = [];
    
    if (this.template === 'report-tesseramento') {
      // PAGINA 1: Riepilogo con KPI e report per dimensione
      pages.push(this.buildPage1());
      
      // PAGINA 2: Tabella confronto anni + Trend
      pages.push(this.buildPage2());
      
      // PAGINE 3+: Schede promotori
      pages.push(...this.buildCardPages());
    }
    
    return pages;
  }

  /**
   * Pagina 1: Riepilogo KPI + Report per dimensione
   */
  buildPage1() {
    let html = '<div style="margin-bottom:20px">';
    
    // KPI Strip
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">';
    
    const kpiOrder = ['totalImporto', 'nrContratti', 'importoMedio', 'totalDb'];
    const kpiLabels = ['Totale Importo', 'Nr. Contratti', 'Importo Medio', 'Totale DB'];
    const kpiBorderColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];
    
    kpiOrder.forEach((key, idx) => {
      const value = this.kpis[key] || '–';
      const label = kpiLabels[idx];
      const color = kpiBorderColors[idx];
      
      html += `
        <div style="flex:1;min-width:140px;border:1px solid #e5e7eb;border-radius:8px;padding:12px;border-top:3px solid ${color}">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px">${label}</div>
          <div style="font-size:24px;font-weight:bold;margin-top:4px;color:#333">${value}</div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Report per dimensione
    html += '<div style="font-weight:bold;font-size:13px;margin-bottom:12px;color:#333">● Report per dimensione</div>';
    html += '<div style="display:flex;gap:16px">';
    
    // Card Tipo Rete
    html += '<div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff">';
    html += '<div style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb"><div style="font-weight:600;font-size:12px;color:#333">🔗 Tipo Rete</div></div>';
    if (this.charts.tiporete) {
      html += `<div style="padding:8px"><img src="${this.charts.tiporete}" style="width:100%;height:auto;display:block" /></div>`;
    }
    if (this.tables.tiporete) {
      html += `<div style="padding:8px;font-size:9px;overflow-x:auto">${this.tables.tiporete}</div>`;
    }
    html += '</div>';
    
    // Card Promotore
    html += '<div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff">';
    html += '<div style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb"><div style="font-weight:600;font-size:12px;color:#333">👤 Promotore</div></div>';
    if (this.charts.promotore) {
      html += `<div style="padding:8px"><img src="${this.charts.promotore}" style="width:100%;height:auto;display:block" /></div>`;
    }
    if (this.tables.promotore) {
      html += `<div style="padding:8px;font-size:9px;overflow-x:auto">${this.tables.promotore}</div>`;
    }
    html += '</div>';
    
    html += '</div></div>';
    
    return html;
  }

  /**
   * Pagina 2: Tabella confronto anni + Trend
   */
  buildPage2() {
    let html = '';
    
    // Tabella dettaglio promotore
    if (this.tables.trendTable) {
      html += '<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;background:#fff">';
      html += '<div style="background:#DC2626;color:white;padding:10px 14px;font-weight:600;font-size:12px">👥 Dettaglio per promotore — confronto anni</div>';
      html += `<div style="padding:8px;font-size:9px;overflow-x:auto">${this.tables.trendTable}</div>`;
      html += '</div>';
    }
    
    // Grafico trend
    if (this.charts.trend) {
      html += '<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#fff">';
      html += '<div style="background:#8B5CF6;color:white;padding:10px 14px;font-weight:600;font-size:12px">📈 Trend numerico per anno</div>';
      html += `<div style="padding:10px"><img src="${this.charts.trend}" style="width:100%;height:auto;display:block" /></div>`;
      html += '</div>';
    }
    
    return html;
  }

  /**
   * Pagine schede promotori (3 per riga)
   */
  buildCardPages() {
    const pages = [];
    if (!this.cards || this.cards.length === 0) return pages;
    
    const cardsPerPage = 3;
    let currentPageCards = [];
    let isFirstPage = true;
    
    this.cards.forEach((card, idx) => {
      currentPageCards.push(card);
      
      if (currentPageCards.length === cardsPerPage || idx === this.cards.length - 1) {
        let pageHtml = '';
        
        // Titolo sezione solo sulla prima pagina
        if (isFirstPage) {
          pageHtml += '<div style="font-size:18px;font-weight:bold;margin-bottom:16px;color:#333">Dettaglio per promotore</div>';
          pageHtml += '<div style="font-weight:bold;font-size:12px;margin-bottom:12px;color:#333">● Schede individuali per promotore</div>';
          isFirstPage = false;
        }
        
        pageHtml += '<div style="display:flex;gap:12px;align-items:flex-start">';
        
        currentPageCards.forEach(card => {
          pageHtml += this.buildCardHTML(card);
        });
        
        pageHtml += '</div>';
        pages.push(pageHtml);
        currentPageCards = [];
      }
    });
    
    return pages;
  }

  /**
   * Costruisce HTML per una singola card
   */
  buildCardHTML(card) {
    const headerBg = card.color || '#3B82F6';
    const name = card.name || 'Card';
    const total = card.total || '–';
    
    let html = '<div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;min-width:0;background:#fff">';
    
    // Header
    html += `<div style="background:${headerBg};color:white;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">`;
    html += `<span style="font-weight:bold;font-size:11px">${name}</span>`;
    html += `<span style="font-size:9px;background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px">${total}</span>`;
    html += '</div>';
    
    // KPI
    if (card.kpis) {
      html += '<div style="display:flex;border-bottom:1px solid #eee">';
      Object.entries(card.kpis).forEach(([label, value]) => {
        html += `<div style="flex:1;text-align:center;padding:4px">
          <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
          <div style="font-size:14px;font-weight:bold;color:#333">${value}</div>
        </div>`;
      });
      html += '</div>';
    }
    
    // Sparkline (se disponibile)
    if (card.sparkline) {
      html += `<div style="padding:4px 8px"><img src="${card.sparkline}" style="width:100%;height:60px;display:block" /></div>`;
    }
    
    // Tabella
    if (card.table) {
      html += `<div style="padding:4px 6px;font-size:8px;overflow-x:auto">${card.table}</div>`;
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Cattura le pagine HTML con html2canvas
   */
  async capturePages(pages) {
    const pageCanvases = [];
    const container = this.createContainer();
    
    for (let i = 0; i < pages.length; i++) {
      const pageHtml = this.wrapPageHTML(pages[i], i + 1, pages.length);
      container.innerHTML = pageHtml;
      
      // Attendi immagini
      await new Promise(resolve => setTimeout(resolve, this.renderingOptions.delay));
      
      try {
        const canvas = await html2canvas(container.firstChild, {
          scale: this.renderingOptions.scale,
          useCORS: this.renderingOptions.useCORS,
          allowTaint: this.renderingOptions.allowTaint,
          logging: false,
          backgroundColor: '#ffffff',
          width: 1120,
          timeout: this.renderingOptions.timeout
        });
        pageCanvases.push(canvas);
      } catch (err) {
        console.error(`Errore cattura pagina ${i + 1}:`, err);
      }
    }
    
    document.body.removeChild(container);
    return pageCanvases;
  }

  /**
   * Crea container nascosto per rendering
   */
  createContainer() {
    const container = document.createElement('div');
    container.id = 'report-render-container-' + Date.now();
    container.style.cssText = 'position:fixed;top:-99999px;left:0;width:1120px;background:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#333';
    document.body.appendChild(container);
    return container;
  }

  /**
   * Avvolge il contenuto con header e footer
   */
  wrapPageHTML(content, pageNum, totalPages) {
    let filtroAnno = this.filters.anno || 'tutti gli anni';
    let filtroMesi = this.filters.mesi || 'Tutti i mesi';
    
    return `
      <div style="position:relative;width:1120px;min-height:780px;padding:20px 30px 60px 30px;box-sizing:border-box">
        <!-- HEADER -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:0 0 12px 0;border-bottom:1px solid #ddd;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px">
            <img src="${this.logoUrl}" style="height:40px" crossorigin="anonymous" onerror="this.style.display='none'" />
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:bold;color:#333">Report tesseramento</div>
            <div style="font-size:11px;color:#888">Dati selezionati</div>
            <div style="font-size:11px;color:#888">Anno, ${filtroAnno}</div>
            <div style="font-size:11px;color:#888">mesi: ${filtroMesi}</div>
          </div>
        </div>
        
        <!-- CONTENUTO -->
        ${content}
        
        <!-- FOOTER -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:12px 30px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:8px;color:#999">
          <div>
            <b>Sede CNA di Roma</b><br>
            Via Cristoforo Colombo, 283A - 00147 Roma<br>
            Tel 06570151 • direzione@cnaroma.it • www.cnaroma.it
          </div>
          <div style="text-align:right;font-size:12px;color:#333">
            ${this.pageNumbers ? 'Pagina ' + pageNum : ''}${this.totalPages && this.pageNumbers ? ' di ' + totalPages : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Assembla il PDF finale
   */
  assemblePDF(pageCanvases) {
    if (pageCanvases.length === 0) {
      throw new Error('Nessuna pagina da assemblare');
    }
    
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({
      orientation: this.orientation,
      unit: 'mm',
      format: this.pageSize
    });
    
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    
    pageCanvases.forEach((canvas, idx) => {
      if (idx > 0) doc.addPage();
      
      const imgData = canvas.toDataURL('image/png');
      const ratio = canvas.width / canvas.height;
      
      let fitW = pw;
      let fitH = fitW / ratio;
      
      if (fitH > ph) {
        fitH = ph;
        fitW = fitH * ratio;
      }
      
      const x = (pw - fitW) / 2;
      const y = (ph - fitH) / 2;
      
      doc.addImage(imgData, 'PNG', x, y, fitW, fitH);
    });
    
    // Scarica
    doc.save(this.filename);
  }
}

// Esporta globalmente
window.ReportGenerator = ReportGenerator;
