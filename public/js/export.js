// Export functionality - PDF e Excel
import { SB, H } from './utils.js';
import { traduciStatoAttivita, traduciTipoImpresa, getCurrentCCIAAData } from './cciaa.js';

let currentAnaIdx = 0;

function setCurrentAnaIdx(idx) {
  currentAnaIdx = idx;
}

// ============================================
// EXCEL EXPORT
// ============================================
async function exportAnaToExcel(anaIdx) {
  setCurrentAnaIdx(anaIdx);
  
  var ana = anaFiltered[anaIdx];
  if (!ana) {
    alert('❌ Errore: anagrafica non trovata');
    return;
  }

  // Converti campi numerici in stringhe con apostrofo per preservare zeri
  var anaFormatted = {...ana};
  ['partitaiva', 'cap', 'codicecliente'].forEach(field => {
    if (anaFormatted[field]) {
      anaFormatted[field] = "'" + anaFormatted[field];
    }
  });

  var fieldsAna = [
    {key: 'codiceanagrafica', label: 'Codice Anagrafica'},
    {key: 'codicecliente', label: 'Codice Cliente'},
    {key: 'ragionesociale', label: 'Ragione Sociale'},
    {key: 'partitaiva', label: 'Partita IVA'},
    {key: 'indirizzo', label: 'Indirizzo'},
    {key: 'cap', label: 'CAP'},
    {key: 'comune', label: 'Comune'},
    {key: 'provincia', label: 'Provincia'},
    {key: 'email', label: 'Email'},
    {key: 'telefono', label: 'Telefono'},
    {key: 'cellulare', label: 'Cellulare'},
    {key: 'pec', label: 'PEC'}
  ];

  var ws = XLSX.utils.json_to_sheet([]);
  XLSX.utils.sheet_add_json(ws, [anaFormatted], {header: fieldsAna.map(f => f.key)});
  
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Anagrafica');
  
  var filename = 'Scheda_' + (ana.ragionesociale || 'impresa').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.xlsx';
  XLSX.writeFile(wb, filename);
  
  console.log('✅ Excel scaricato: ' + filename);
  alert('✅ Excel scaricato: ' + filename);
}

// ============================================
// PDF EXPORT - VERSIONE COMPLETA E GRAFICA
// ============================================
async function exportSchemaPDF() {
  console.log('📄 Esportazione PDF in corso...');
  
  var ana = anaFiltered[currentAnaIdx];
  if (!ana) {
    alert('❌ Errore: anagrafica non trovata');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  var doc = new jsPDF('p', 'mm', 'a4');
  var pageHeight = doc.internal.pageSize.getHeight();
  var pageWidth = doc.internal.pageSize.getWidth();
  var margin = 10;
  var yPos = margin;
  var maxWidth = pageWidth - (2 * margin);
  
  // CCIAA Data
  var cciaaData = getCurrentCCIAAData();
  
  // ========== HEADER ==========
  // Background blu
  doc.setFillColor(0, 92, 169);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // Logo placeholder (testo per ora)
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CNA ROMA', margin + 5, 15);
  
  // Data stampa in alto a destra
  doc.setFontSize(8);
  var today = new Date();
  var dateStr = today.toLocaleDateString('it-IT');
  doc.text('Data: ' + dateStr, pageWidth - margin - 5, 15, {align: 'right'});
  
  yPos = 32;
  
  // ========== TITOLO ==========
  doc.setTextColor(0, 92, 169);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Scheda Anagrafica Impresa', margin, yPos);
  yPos += 12;
  
  // ========== BOX STATO E TIPO (Inline) ==========
  if (cciaaData) {
    var statoInfo = traduciStatoAttivita(cciaaData.stato_attivita || 0);
    var tipoInfo = traduciTipoImpresa(cciaaData.art_com_tur);
    
    // BOX STATO
    var statoRGB = hexToRgb(statoInfo.color);
    doc.setFillColor(statoRGB.r, statoRGB.g, statoRGB.b);
    doc.rect(margin, yPos - 3, 50, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('STATO: ' + statoInfo.testo, margin + 2, yPos + 1);
    
    // BOX TIPO
    var tipoRGB = hexToRgb(tipoInfo.bgColor);
    var textColorRGB = tipoInfo.textColor === 'white' ? {r: 255, g: 255, b: 255} : {r: 0, g: 0, b: 0};
    doc.setFillColor(tipoRGB.r, tipoRGB.g, tipoRGB.b);
    doc.rect(margin + 52, yPos - 3, 50, 7, 'F');
    doc.setTextColor(textColorRGB.r, textColorRGB.g, textColorRGB.b);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TIPO: ' + tipoInfo.testo, margin + 54, yPos + 1);
    
    yPos += 10;
  }
  
  yPos += 2;
  
  // ========== SEZIONE: DATI PRINCIPALI ==========
  doc.setTextColor(0, 92, 169);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('📋 DATI PRINCIPALI', margin, yPos);
  yPos += 6;
  
  // Linea separatrice
  doc.setDrawColor(0, 92, 169);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
  yPos += 3;
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  var datiPrinc = [
    {label: 'Ragione Sociale', val: ana.ragionesociale},
    {label: 'Partita IVA', val: ana.partitaiva},
    {label: 'Codice Cliente', val: ana.codicecliente},
    {label: 'Codice Anagrafica', val: ana.codiceanagrafica},
    {label: 'Indirizzo', val: ana.indirizzo},
    {label: 'CAP / Comune', val: (ana.cap || '') + ' / ' + (ana.comune || '')},
    {label: 'Provincia', val: ana.provincia},
    {label: 'Email', val: ana.email},
    {label: 'Telefono', val: ana.telefono},
    {label: 'Cellulare', val: ana.cellulare},
    {label: 'PEC', val: ana.pec}
  ];
  
  datiPrinc.forEach(function(d) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin + 5;
    }
    if (d.val) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(d.label + ':', margin, yPos);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(String(d.val), margin + 45, yPos);
      yPos += 4;
    }
  });
  
  yPos += 2;
  
  // ========== SEZIONE: DATI CCIAA ==========
  if (cciaaData) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin + 5;
    }
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 92, 169);
    doc.text('🏢 DATI CCIAA', margin, yPos);
    yPos += 6;
    
    // Linea separatrice
    doc.setDrawColor(0, 92, 169);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
    yPos += 3;
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    var addSub = parseInt(cciaaData.num_addetti_sub) || 0;
    var addFam = parseInt(cciaaData.num_addetti_fam_ul) || 0;
    var totale = addSub + addFam;
    
    var datiCCIAA = [
      {label: 'Stato Attività', val: traduciStatoAttivita(cciaaData.stato_attivita || 0).testo},
      {label: 'Tipo Impresa', val: traduciTipoImpresa(cciaaData.art_com_tur).testo},
      {label: 'Codice Fiscale', val: cciaaData.codice_fiscale},
      {label: 'Data Iscrizione REA', val: cciaaData.data_iscrizione_rea}
    ];
    
    datiCCIAA.forEach(function(d) {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin + 5;
      }
      if (d.val) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(d.label + ':', margin, yPos);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(String(d.val), margin + 45, yPos);
        yPos += 4;
      }
    });
    
    yPos += 2;
    
    // ========== SEZIONE: ADDETTI E DIPENDENTI (BOX COLORATI) ==========
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin + 5;
    }
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 92, 169);
    doc.text('👥 ADDETTI E DIPENDENTI', margin, yPos);
    yPos += 6;
    
    // Linea separatrice
    doc.setDrawColor(0, 92, 169);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
    yPos += 5;
    
    // BOX 1: Subordinati
    doc.setFillColor(240, 244, 255);
    doc.rect(margin, yPos - 4, 45, 12, 'F');
    doc.setDrawColor(209, 224, 255);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos - 4, 45, 12);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(102, 102, 102);
    doc.text('SUBORDINATI', margin + 2, yPos - 1);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 92, 169);
    doc.text(addSub.toString(), margin + 20, yPos + 4, {align: 'center'});
    
    // BOX 2: Familiari
    doc.setFillColor(240, 244, 255);
    doc.rect(margin + 48, yPos - 4, 45, 12, 'F');
    doc.setDrawColor(209, 224, 255);
    doc.setLineWidth(0.3);
    doc.rect(margin + 48, yPos - 4, 45, 12);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(102, 102, 102);
    doc.text('FAMILIARI', margin + 50, yPos - 1);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 92, 169);
    doc.text(addFam.toString(), margin + 68, yPos + 4, {align: 'center'});
    
    // BOX 3: Totale (blu scuro)
    doc.setFillColor(0, 92, 169);
    doc.rect(margin + 96, yPos - 4, 45, 12, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTALE', margin + 98, yPos - 1);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(totale.toString(), margin + 116, yPos + 4, {align: 'center'});
    
    yPos += 16;
  }
  
  // ========== FOOTER ==========
  yPos = pageHeight - 12;
  doc.setDrawColor(0, 92, 169);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('CNA Roma - Confederazione Nazionale dell\'Artigianato | www.cnaroma.it', margin, yPos + 2);
  
  // ========== SALVA PDF ==========
  var filename = 'Scheda_' + (ana.ragionesociale || 'impresa').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
  doc.save(filename);
  
  console.log('✅ PDF scaricato: ' + filename);
  alert('✅ PDF scaricato: ' + filename);
}

// ========== HELPER FUNCTION ==========
function hexToRgb(hex) {
  // Converte #RRGGBB a {r, g, b}
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

export { exportAnaToExcel, exportSchemaPDF, setCurrentAnaIdx };