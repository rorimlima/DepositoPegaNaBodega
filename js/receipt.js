import { SyncEngine } from './syncEngine.js';
import { Store } from './store.js';
import { Toast } from './toast.js';

/**
 * ═══════════════════════════════════════════════════════════════
 * RECEIPT — Centralized receipt generation and printing
 * ═══════════════════════════════════════════════════════════════
 *
 * Provides:
 * 1. Corporate PDF receipt (jsPDF) — elegant 80mm thermal-style
 * 2. A4 PDF receipt (jsPDF) — full-page corporate layout
 * 3. Browser print dialog — via hidden #print-area + @media print CSS
 * 4. Client profile PDF — financial status report
 */

// ─── HELPERS ────────────────────────────────────────────────
async function _getEmpresa() {
  const all = await SyncEngine.getAll('empresa');
  return all[0] || { nome: 'DepostitoPegaNaBodega' };
}

async function _getVendaDetails(venda) {
  const clientes = await SyncEngine.getAll('clientes');
  const itensAll = await SyncEngine.getAll('itens_venda');
  const pagsAll = await SyncEngine.getAll('pagamentos_venda');
  return {
    cliente: clientes.find(c => c.id === venda.cliente_id) || { nome: 'Cliente Balcão' },
    itens: itensAll.filter(i => i.venda_id === venda.id),
    pagamentos: pagsAll.filter(p => p.venda_id === venda.id)
  };
}

function _formatDate(d) { return new Date(d).toLocaleString('pt-BR'); }
function _fmtMoney(v) { return Store.formatMoney(v); }

// ─── PRINT VIA BROWSER ─────────────────────────────────────
function _printHTML(html) {
  let area = document.getElementById('print-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'print-area';
    document.body.appendChild(area);
  }
  area.innerHTML = html;
  // Small delay so browser renders the content before print dialog
  setTimeout(() => {
    window.print();
    // Clean up after print
    setTimeout(() => { area.innerHTML = ''; }, 1000);
  }, 200);
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════
export const Receipt = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SALE RECEIPT — A4 PDF (Corporate Layout)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async saleReceiptPDF(venda) {
    try {
      const emp = await _getEmpresa();
      const { cliente, itens, pagamentos } = await _getVendaDetails(venda);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210, M = 15;
      let y = 20;

      // ── Header ──
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, W, 40, 'F');
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(22); doc.setFont(undefined, 'bold');
      doc.text(emp.nome || 'DepostitoPegaNaBodega', W / 2, 18, { align: 'center' });
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(9); doc.setFont(undefined, 'normal');
      const subParts = [];
      if (emp.cnpj_cpf) subParts.push(`CNPJ/CPF: ${emp.cnpj_cpf}`);
      if (emp.telefone) subParts.push(`Tel: ${emp.telefone}`);
      if (emp.endereco) subParts.push(emp.endereco);
      if (subParts.length) doc.text(subParts.join('  |  '), W / 2, 28, { align: 'center' });
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text('RECIBO DE VENDA', W / 2, 36, { align: 'center' });
      y = 50;

      // ── Sale Info ──
      doc.setTextColor(0);
      doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.text('DADOS DA VENDA', M, y); y += 6;
      doc.setDrawColor(200);
      doc.line(M, y, W - M, y); y += 6;
      doc.setFont(undefined, 'normal'); doc.setFontSize(10);
      doc.text(`Código:`, M, y); doc.setFont(undefined, 'bold'); doc.text(`#${venda.codigo_venda || venda.id.substring(0, 8)}`, M + 30, y);
      doc.setFont(undefined, 'normal'); doc.text(`Data:`, W / 2, y); doc.text(_formatDate(venda.created_at), W / 2 + 20, y);
      y += 6;
      doc.text(`Cliente:`, M, y); doc.setFont(undefined, 'bold'); doc.text(cliente.nome, M + 30, y);
      doc.setFont(undefined, 'normal');
      if (cliente.telefone) { doc.text(`Tel: ${cliente.telefone}`, W / 2, y); }
      y += 6;
      if (venda.status) { doc.text(`Status:`, M, y); doc.text(venda.status, M + 30, y); y += 6; }
      y += 4;

      // ── Items Table ──
      doc.setFont(undefined, 'bold'); doc.setFontSize(10);
      doc.text('ITENS', M, y); y += 2;
      doc.autoTable({
        startY: y,
        margin: { left: M, right: M },
        head: [['Produto', 'Qtd', 'Preço Unit.', 'Subtotal']],
        body: itens.map(it => [
          it.produto_nome,
          it.quantidade.toString(),
          _fmtMoney(it.preco_unitario),
          _fmtMoney(it.subtotal)
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [17, 24, 39], textColor: [245, 158, 11], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 30 }
        },
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── Total ──
      doc.setFillColor(17, 24, 39);
      doc.roundedRect(W - M - 70, y - 2, 70, 14, 2, 2, 'F');
      doc.setTextColor(245, 158, 11); doc.setFontSize(14); doc.setFont(undefined, 'bold');
      doc.text(`TOTAL: ${_fmtMoney(venda.total)}`, W - M - 5, y + 8, { align: 'right' });
      y += 20;

      // ── Payments ──
      doc.setTextColor(0); doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.text('PAGAMENTOS', M, y); y += 6;
      doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 6;
      doc.setFont(undefined, 'normal'); doc.setFontSize(9);
      for (const pag of pagamentos) {
        doc.text(pag.forma_pagamento, M, y);
        doc.text(_fmtMoney(pag.valor), W - M, y, { align: 'right' });
        if (pag.data_pagamento) {
          doc.setTextColor(150); doc.text(pag.data_pagamento, M + 60, y); doc.setTextColor(0);
        }
        y += 5;
      }
      y += 10;

      // ── Footer ──
      doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 8;
      doc.setTextColor(150); doc.setFontSize(8);
      doc.text('Obrigado pela preferência!', W / 2, y, { align: 'center' }); y += 4;
      doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, W / 2, y, { align: 'center' });

      doc.save(`recibo_${venda.codigo_venda || venda.id.substring(0, 8)}.pdf`);
      Toast.success('PDF do recibo gerado!');
    } catch (e) {
      console.error('[Receipt] PDF error:', e);
      Toast.error('Erro ao gerar PDF do recibo');
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SALE RECEIPT — Thermal 80mm PDF
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async saleReceiptThermal(venda) {
    try {
      const emp = await _getEmpresa();
      const { cliente, itens, pagamentos } = await _getVendaDetails(venda);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
      let y = 10;

      doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text(emp.nome || 'PegaNaBodega', 40, y, { align: 'center' }); y += 5;
      doc.setFontSize(7); doc.setFont(undefined, 'normal');
      if (emp.cnpj_cpf) { doc.text(`CNPJ/CPF: ${emp.cnpj_cpf}`, 40, y, { align: 'center' }); y += 4; }
      if (emp.telefone) { doc.text(`Tel: ${emp.telefone}`, 40, y, { align: 'center' }); y += 4; }
      y += 2; doc.line(5, y, 75, y); y += 4;
      doc.setFontSize(8);
      doc.text(`Cliente: ${cliente.nome}`, 5, y); y += 4;
      doc.text(`Data: ${_formatDate(venda.created_at)}`, 5, y); y += 4;
      if (venda.codigo_venda) { doc.text(`Código: #${venda.codigo_venda}`, 5, y); y += 4; }
      doc.line(5, y, 75, y); y += 4;
      doc.setFontSize(7);
      for (const it of itens) {
        const n = it.produto_nome.length > 18 ? it.produto_nome.substring(0, 18) + '...' : it.produto_nome;
        doc.text(n, 5, y); doc.text(`${it.quantidade}x`, 42, y);
        doc.text(_fmtMoney(it.subtotal), 73, y, { align: 'right' }); y += 3.5;
      }
      y += 2; doc.line(5, y, 75, y); y += 4;
      doc.setFontSize(9); doc.setFont(undefined, 'bold');
      doc.text(`TOTAL: ${_fmtMoney(venda.total)}`, 73, y, { align: 'right' }); y += 5;
      doc.setFontSize(7); doc.setFont(undefined, 'normal');
      for (const p of pagamentos) {
        doc.text(`${p.forma_pagamento}: ${_fmtMoney(p.valor)}`, 5, y); y += 3.5;
      }
      y += 4; doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });
      doc.save(`recibo_${venda.codigo_venda || venda.id.substring(0, 8)}_thermal.pdf`);
      Toast.success('Recibo térmico gerado!');
    } catch (e) {
      console.error('[Receipt] Thermal error:', e);
      Toast.error('Erro ao gerar recibo térmico');
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SALE RECEIPT — Print via browser dialog
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async printSaleReceipt(venda) {
    const emp = await _getEmpresa();
    const { cliente, itens, pagamentos } = await _getVendaDetails(venda);

    const html = `
      <div class="print-header">
        <h1>${emp.nome || 'DepostitoPegaNaBodega'}</h1>
        ${emp.cnpj_cpf ? `<p>CNPJ/CPF: ${emp.cnpj_cpf}</p>` : ''}
        ${emp.telefone ? `<p>Tel: ${emp.telefone}</p>` : ''}
        ${emp.endereco ? `<p>${emp.endereco}</p>` : ''}
        <p style="margin-top:8px;font-weight:700;font-size:13px">RECIBO DE VENDA</p>
      </div>
      <div class="print-section">
        <h3>Dados da Venda</h3>
        <div class="print-detail-row"><span>Código:</span><strong>#${venda.codigo_venda || venda.id.substring(0, 8)}</strong></div>
        <div class="print-detail-row"><span>Data:</span><span>${_formatDate(venda.created_at)}</span></div>
        <div class="print-detail-row"><span>Cliente:</span><strong>${cliente.nome}</strong></div>
        ${cliente.telefone ? `<div class="print-detail-row"><span>Tel:</span><span>${cliente.telefone}</span></div>` : ''}
        ${venda.status ? `<div class="print-detail-row"><span>Status:</span><span>${venda.status}</span></div>` : ''}
      </div>
      <div class="print-section">
        <h3>Itens</h3>
        <table class="print-table">
          <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
          <tbody>
            ${itens.map(it => `<tr><td>${it.produto_nome}</td><td style="text-align:center">${it.quantidade}</td><td style="text-align:right">${_fmtMoney(it.preco_unitario)}</td><td style="text-align:right">${_fmtMoney(it.subtotal)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="print-total">TOTAL: ${_fmtMoney(venda.total)}</div>
      </div>
      <div class="print-section">
        <h3>Pagamentos</h3>
        ${pagamentos.map(p => `<div class="print-detail-row"><span>${p.forma_pagamento}</span><span>${_fmtMoney(p.valor)}</span></div>`).join('')}
      </div>
      <div class="print-footer">
        <p>Obrigado pela preferência!</p>
        <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    `;
    _printHTML(html);
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLIENT PROFILE — PDF Report
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async clientProfilePDF(cliente) {
    try {
      const emp = await _getEmpresa();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210, M = 15;
      let y = 20;

      // Header
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, W, 35, 'F');
      doc.setTextColor(245, 158, 11); doc.setFontSize(18); doc.setFont(undefined, 'bold');
      doc.text(emp.nome || 'DepostitoPegaNaBodega', W / 2, 16, { align: 'center' });
      doc.setTextColor(200); doc.setFontSize(9); doc.setFont(undefined, 'normal');
      doc.text('FICHA DO CLIENTE', W / 2, 28, { align: 'center' });
      y = 45;

      // Client Data
      const financials = await this.getClientFinancials(cliente.id);
      doc.setTextColor(0); doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text(cliente.nome, M, y); y += 6;
      doc.setFontSize(9); doc.setFont(undefined, 'normal');
      doc.text(`Status: ${financials.status === 'ok' ? 'ADIMPLENTE ✓' : 'DEVEDOR ✗'}`, M, y);
      doc.text(`Desde: ${new Date(cliente.created_at).toLocaleDateString('pt-BR')}`, W / 2, y);
      y += 8;

      // Info Table
      doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 6;
      const info = [
        ['Telefone', cliente.telefone || '-'],
        ['Endereço', cliente.endereco || '-'],
        ['Observações', cliente.observacoes || '-'],
      ];
      for (const [label, val] of info) {
        doc.setFont(undefined, 'bold'); doc.text(`${label}:`, M, y);
        doc.setFont(undefined, 'normal'); doc.text(val, M + 35, y);
        y += 5;
      }
      y += 6;

      // Financial Summary
      doc.setFontSize(10); doc.setFont(undefined, 'bold');
      doc.text('RESUMO FINANCEIRO', M, y); y += 2;
      doc.autoTable({
        startY: y,
        margin: { left: M, right: M },
        head: [['Métrica', 'Valor']],
        body: [
          ['Total de Compras', financials.totalVendas.toString()],
          ['Total Gasto', _fmtMoney(financials.totalGasto)],
          ['Total Pago', _fmtMoney(financials.totalPago)],
          ['Total Fiado', _fmtMoney(financials.totalFiado)],
          ['Saldo Devedor', _fmtMoney(financials.saldoDevedor)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [17, 24, 39], textColor: [245, 158, 11] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable.finalY + 10;

      // Sales History
      if (financials.vendas.length > 0) {
        doc.setFontSize(10); doc.setFont(undefined, 'bold');
        doc.text('HISTÓRICO DE VENDAS', M, y); y += 2;
        doc.autoTable({
          startY: y,
          margin: { left: M, right: M },
          head: [['Código', 'Data', 'Total', 'Status']],
          body: financials.vendas.map(v => [
            `#${v.codigo_venda || v.id.substring(0, 8)}`,
            new Date(v.created_at).toLocaleDateString('pt-BR'),
            _fmtMoney(v.total),
            v.status || 'finalizada'
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] },
        });
      }

      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setTextColor(150); doc.setFontSize(7);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, W / 2, pageH - 10, { align: 'center' });

      doc.save(`ficha_cliente_${cliente.nome.replace(/\s+/g, '_')}.pdf`);
      Toast.success('Ficha do cliente exportada!');
    } catch (e) {
      console.error('[Receipt] Client PDF error:', e);
      Toast.error('Erro ao gerar PDF da ficha');
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLIENT PROFILE — Print via browser
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async printClientProfile(cliente) {
    const emp = await _getEmpresa();
    const fin = await this.getClientFinancials(cliente.id);
    const statusBadge = fin.status === 'ok'
      ? '<span style="color:green;font-weight:700">✓ ADIMPLENTE</span>'
      : '<span style="color:red;font-weight:700">✗ DEVEDOR</span>';

    const html = `
      <div class="print-header">
        <h1>${emp.nome || 'DepostitoPegaNaBodega'}</h1>
        <p>FICHA DO CLIENTE</p>
      </div>
      <div class="print-section">
        <h3>Dados do Cliente</h3>
        <div class="print-detail-row"><span>Nome:</span><strong>${cliente.nome}</strong></div>
        <div class="print-detail-row"><span>Status:</span>${statusBadge}</div>
        <div class="print-detail-row"><span>Telefone:</span><span>${cliente.telefone || '-'}</span></div>
        <div class="print-detail-row"><span>Endereço:</span><span>${cliente.endereco || '-'}</span></div>
        <div class="print-detail-row"><span>Observações:</span><span>${cliente.observacoes || '-'}</span></div>
        <div class="print-detail-row"><span>Cliente desde:</span><span>${new Date(cliente.created_at).toLocaleDateString('pt-BR')}</span></div>
      </div>
      <div class="print-section">
        <h3>Resumo Financeiro</h3>
        <div class="print-detail-row"><span>Total de Compras:</span><strong>${fin.totalVendas}</strong></div>
        <div class="print-detail-row"><span>Total Gasto:</span><strong>${_fmtMoney(fin.totalGasto)}</strong></div>
        <div class="print-detail-row"><span>Total Pago:</span><strong>${_fmtMoney(fin.totalPago)}</strong></div>
        <div class="print-detail-row"><span>Total Fiado:</span><strong>${_fmtMoney(fin.totalFiado)}</strong></div>
        <div class="print-detail-row" style="font-size:14px;font-weight:700;border-top:2px solid #333;padding-top:6px">
          <span>Saldo Devedor:</span><strong style="color:${fin.saldoDevedor > 0 ? 'red' : 'green'}">${_fmtMoney(fin.saldoDevedor)}</strong>
        </div>
      </div>
      ${fin.vendas.length > 0 ? `
      <div class="print-section">
        <h3>Histórico de Vendas</h3>
        <table class="print-table">
          <thead><tr><th>Código</th><th>Data</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${fin.vendas.map(v => `<tr><td>#${v.codigo_venda || v.id.substring(0, 8)}</td><td>${new Date(v.created_at).toLocaleDateString('pt-BR')}</td><td style="text-align:right">${_fmtMoney(v.total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
      <div class="print-footer">
        <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    `;
    _printHTML(html);
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FINANCIAL STATUS CALCULATOR (Custom Hook equivalent)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async getClientFinancials(clienteId) {
    const vendas = (await SyncEngine.getAll('vendas')).filter(v => v.cliente_id === clienteId);
    const vendaIds = new Set(vendas.map(v => v.id));
    const pagamentos = (await SyncEngine.getAll('pagamentos_venda')).filter(p => vendaIds.has(p.venda_id));

    const totalGasto = vendas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalPago = pagamentos.filter(p => p.forma_pagamento !== 'Fiado').reduce((s, p) => s + Number(p.valor || 0), 0);
    const totalFiado = pagamentos.filter(p => p.forma_pagamento === 'Fiado').reduce((s, p) => s + Number(p.valor || 0), 0);
    const saldoDevedor = totalGasto - totalPago;

    return {
      vendas: vendas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      pagamentos,
      totalVendas: vendas.length,
      totalGasto,
      totalPago,
      totalFiado,
      saldoDevedor: Math.max(0, saldoDevedor),
      status: saldoDevedor > 0.01 ? 'devedor' : 'ok',
    };
  }
};
