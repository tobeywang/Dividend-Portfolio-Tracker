const STORAGE_KEY = 'my_invest_app_dividendRecords';
const records = loadRecords();
let sortState = { key: 'date', direction: 'desc' };

function loadRecords() {

    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
        try {
            return JSON.parse(stored);
        }
        catch (e) {
            console.error('Load Error', e);
        }
    }
    // html 載入時，已先載入了dividend-data.js。
    if (
      typeof DIVIDEND_DEFAULT_DATA !== 'undefined' &&
      Array.isArray(DIVIDEND_DEFAULT_DATA.realDividendList)
    ) {
      return structuredClone(DIVIDEND_DEFAULT_DATA.realDividendList);
    }

    console.error('無法載入配息紀錄');
    return [];
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAmount(value, currency = '$') {
  const amount = Number(value || 0);
  return `${currency} ${amount.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} `;
}

function getRecordDate(record) {
  const timestamp = Date.parse(record.date || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getCashDate(record) {
  const date = new Date(`${record.date || ''}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function getSortValue(record, key) {
  if (key === 'date') return getRecordDate(record);
  if (key === 'amount') return Number(record.amount || 0);
  return String(record[key] || '').toLocaleLowerCase('zh-TW');
}

function getFilteredRecords() {
  const year = document.getElementById('filterYear')?.value || '';
  const month = document.getElementById('filterMonth')?.value || '';
  const bank = document.getElementById('filterBank')?.value || '';
  const stock = (document.getElementById('filterStock')?.value || '').trim().toLocaleLowerCase('zh-TW');

  return records.filter(record => {
    const date = getCashDate(record);
    if (!date) return false;
    const matchesYear = !year || String(date.getFullYear()) === year;
    const matchesMonth = !month || String(date.getMonth() + 1) === month;
    const matchesBank = !bank || record.bank === bank;
    const stockText = String(record.stock || '').toLocaleLowerCase('zh-TW');
    const matchesStock = !stock || stockText.includes(stock);
    return matchesYear && matchesMonth && matchesBank && matchesStock;
  });
}
//搜尋的下拉
function updateFilterOptions() {
  const yearSelect = document.getElementById('filterYear');
  const bankSelect = document.getElementById('filterBank');
  if (!yearSelect || !bankSelect) return;

  const selectedYear = yearSelect.value;
  const selectedBank = bankSelect.value;
  const years = [...new Set(records
    .map(record => getCashDate(record)?.getFullYear())
    .filter(year => Number.isInteger(year))
    .map(String))]
    .sort((a, b) => Number(b) - Number(a));
  const banks = [...new Set(records.map(record => record.bank).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-TW'));

  yearSelect.innerHTML = '<option value="">全部</option>' + years
    .map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)
    .join('');
  bankSelect.innerHTML = '<option value="">全部</option>' + banks
    .map(bank => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`)
    .join('');

  yearSelect.value = years.includes(selectedYear) ? selectedYear : '';
  bankSelect.value = banks.includes(selectedBank) ? selectedBank : '';
}
//更新最上方總計
function updateSummary() {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const totalThisYear = records
    .filter(record => getCashDate(record)?.getFullYear() === thisYear)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalThisMonth = records
    .filter(record => {
      const date = getCashDate(record);
      if (!date) return false;
      return date.getFullYear() === thisYear && date.getMonth() + 1 === thisMonth;
    })
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalAll = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);

  document.getElementById('totalThisYear').textContent = formatAmount(totalThisYear);
  document.getElementById('totalThisMonth').textContent = formatAmount(totalThisMonth);
  document.getElementById('totalAll').textContent = formatAmount(totalAll);
  document.getElementById('recordCount').textContent = records.length;
}
// 更新表格的表尾
function updateTableTotal(filteredRecords) {
  const totalAmount = filteredRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalPerShare = filteredRecords.reduce((sum, record) => sum + Number(record.perShare || 0), 0);
  const amountElement = document.getElementById('total-record-amount');
  const perShareElement = document.getElementById('total-per-share');
  const countElement = document.getElementById('total-record-count');

  if (amountElement) amountElement.textContent = totalAmount.toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  if (perShareElement) perShareElement.textContent = totalPerShare.toLocaleString('zh-TW', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });
  if (countElement) countElement.textContent = `${filteredRecords.length} 次`;
}
//刷新資料表
function renderTable() {
  updateFilterOptions();
  updateSummary();

  const body = document.getElementById('recordTableBody');
  if (!body) return;

  const filteredRecords = getFilteredRecords().sort((a, b) => {
    const first = getSortValue(a, sortState.key);
    const second = getSortValue(b, sortState.key);
    let result;
    if (typeof first === 'number' && typeof second === 'number') {
      result = first - second;
    } else {
      result = String(first).localeCompare(String(second), 'zh-TW');
    }
    return sortState.direction === 'asc' ? result : -result;
  });
  // 計算表格最下方的合計
  updateTableTotal(filteredRecords);

  const filteredCount = document.getElementById('filteredCount');
  if (filteredCount) filteredCount.textContent = `顯示 ${filteredRecords.length} / ${records.length} 筆`;

  if (!filteredRecords.length) {
    body.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="icon">💸</div><p>查無符合條件的配息紀錄</p></div></td></tr>`;
    return;
  }

  body.innerHTML = filteredRecords.map(record => {
    const taxText = record.taxStatus === 'before' ? '稅前' : record.taxStatus === 'after'? '稅後':'-';
    const currencyClass = record.currency === 'TWD' ? 'badge-tw' : record.currency === 'USD' ? 'badge-us' : record.currency === 'HKD' ? 'badge-hk' : 'badge-other';
    return `<tr>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.stock)}</td>
      <td>${escapeHtml(record.bank)}</td>
      <td class="amount-positive">${escapeHtml(formatAmount(record.amount))}</td>
      <td><span class="badge ${currencyClass}">${escapeHtml(record.currency)}</span></td>
      <td>${escapeHtml(record.perShare || '-')}</td>
      <td>${escapeHtml(record.shares || '-')}</td>
      <td>${taxText}</td>
      <td>${escapeHtml(record.note || '-')}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteRecord('${escapeHtml(record.id)}')">刪除</button></td>
    </tr>`;
  }).join('');
}

function generateDividendRecords() {
  if (typeof DEFAULT_DATA === 'undefined' || !Array.isArray(DEFAULT_DATA.portfolio)) {
    alert('找不到 data.js 中的投資組合資料');
    return;
  }

  const transactions = Array.isArray(DEFAULT_DATA.transactions) ? DEFAULT_DATA.transactions : [];
  const bankNames = {
    '台灣': '台灣銀行',
    '台新': '台新銀行',
    '中信': '中信銀行',
    '國泰': '國泰'
  };
  const existingKeys = new Set(records.map(record => {
    const code = String(record.stock || '').split('/')[0].trim();
    return `${code}|${String(record.date || '').slice(0, 7)}`;
  }));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const generated = [];

  DEFAULT_DATA.portfolio.forEach(stock => {
    const code = String(stock.code || '').trim();
    if (!code) return;

    const months = String(stock.months || '').split(',')
      .map(month => Number(month.trim()))
      .filter(month => Number.isInteger(month) && month >= 1 && month <= 12);
    const dividends = Array.isArray(stock.divs) ? stock.divs : [];
    const dividendDates = Array.isArray(stock.divDates) ? stock.divDates : [];
    const stockTransactions = transactions
      .filter(transaction => String(transaction.code) === code && /^2026-\d{2}-\d{2}$/.test(transaction.date))
      .sort((first, second) => first.date.localeCompare(second.date));

    months.forEach((month, index) => {
      const perShare = Number(dividends[index] ?? (Number(stock.div || 0) / months.length));
      if (!(perShare > 0)) return;

      for (let year = 2026; year <= today.getFullYear(); year += 1) {
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(Math.max(Number(dividendDates[index]) || 15, 1), lastDay);
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${code}|${date.slice(0, 7)}`;
        if (date > todayKey || existingKeys.has(key)) continue;

        let shares = Number(stock.sharesBefore2026 || 0);
        stockTransactions.forEach(transaction => {
          if (transaction.date <= date) {
            const quantity = Number(transaction.shares || 0);
            shares += transaction.type === 'Buy' ? quantity : -quantity;
          }
        });
        if (!(shares > 0)) continue;

        generated.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          stock: `${code} / ${stock.name || ''}`.trim(),
          date,
          bank: bankNames[stock.saveBank] || stock.saveBank || '其他',
          amount: Math.round(shares * perShare),
          currency: 'TWD',
          perShare: String(perShare),
          shares: String(shares),
          taxStatus: '-',
          note: '依股利政策產生'
        });
        existingKeys.add(key);
      }
    });
  });

  if (!generated.length) {
    alert('沒有新的配息紀錄可產生');
    return;
  }
  console.log(generated)
  if (!confirm(`將新增 ${generated.length} 筆配息紀錄，已存在的股票與日期不會重複新增。是否繼續？`)) return;
  
  records.push(...generated);
  saveRecords();
  renderTable();
  alert(`已新增 ${generated.length} 筆配息紀錄`);
}

//新建一筆
function addRecord() {
  const stock = document.getElementById('stockCode').value.trim();
  const date = document.getElementById('dividendDate').value;
  const bank = document.getElementById('bank').value;
  const amount = Number(document.getElementById('amount').value);
  const currency = document.getElementById('currency').value;
  const perShare = document.getElementById('perShare').value;
  const shares = document.getElementById('shares').value;
  const taxStatus = document.getElementById('taxStatus').value;
  const note = document.getElementById('note').value.trim();

  if (!stock || !date || !bank || !Number.isFinite(amount) || amount < 0) {
    alert('請填寫股票、日期、銀行與有效的配息金額');
    return;
  }

  records.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    stock,
    date,
    bank,
    amount,
    currency,
    perShare,
    shares,
    taxStatus,
    note
  });
  saveRecords();
  clearForm();
  renderTable();
}
//刪除一筆
function deleteRecord(id) {
  const index = records.findIndex(record => String(record.id) === String(id));
  if (index < 0 || !confirm('確定要刪除此筆配息紀錄嗎？')) return;
  records.splice(index, 1);
  saveRecords();
  renderTable();
}

function clearForm() {
  document.getElementById('stockCode').value = '';
  document.getElementById('dividendDate').value = '';
  document.getElementById('bank').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('currency').value = 'TWD';
  document.getElementById('perShare').value = '';
  document.getElementById('shares').value = '';
  document.getElementById('taxStatus').value = '-';
  document.getElementById('note').value = '';
}

function sortBy(key) {
  if (sortState.key === key) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.key = key;
    sortState.direction = key === 'date' ? 'desc' : 'asc';
  }
  renderTable();
}

function exportCSV() {
  const headers = ['配息日期', '股票', '入帳銀行', '配息金額', '幣別', '每股配息', '持有股數', '稅別', '備註'];
  const rows = getFilteredRecords().map(record => [
    record.date, record.stock, record.bank, record.amount, record.currency,
    record.perShare, record.shares, record.taxStatus === 'before' ? '稅前' : record.taxStatus === 'after'? '稅後':'-', record.note
    
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dividend-records-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
// Start
document.addEventListener('DOMContentLoaded', () => {
  // 配息日期
  document.getElementById('dividendDate').value = new Date().toISOString().slice(0, 10);

  const params = new URLSearchParams(window.location.search);

  // 由index.html 轉跳而來
  const s = params.get("s");
  if(s){
    renderTable();
  }
  else {
    alert('請由首頁轉跳')
    if (window.history.length > 1) {
        history.back();
    } else {
        window.location.href = "/";
    }
  }

});
// 匯出資料 js
function exportDataFile() {

    const data = {
        realDividendList: getFilteredRecords()
    };

    const content =
`const DIVIDEND_DEFAULT_DATA = ${JSON.stringify(data, null, 4)};`;

    const blob = new Blob(
        [content],
        { type: 'application/javascript;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'dividend-data.js';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    alert('已匯出 dividend-data.js！請覆蓋原始檔案。');
}
// --- 強制從 dividend-record.js 檔案重新載入 ---
function reloadDataFromFile() {

    if (!confirm(
        "這將捨棄所有未匯出的資料，並重新載入 dividend-data.js。\n\n確定繼續？"
    )) {
        return;
    }

    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}
