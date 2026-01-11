// script.js

// --- 1. 資料載入機制 ---
const STORAGE_KEY = 'my_invest_app_v8_twse';

// (保持原有的 getStockColor, loadData, saveData, exportDataFile, resetData 函式不變)
// ...
const STOCK_COLORS = {
    '0050': '#2563eb', '0056': '#dc2626', '00878': '#16a34a',
    '00713': '#d97706', '006208': '#9333ea', 'default': '#64748b'
};
function getStockColor(code, isEstimate = false) {
    const baseColor = STOCK_COLORS[code] || STOCK_COLORS['default'];
    if (isEstimate) {
        let c = baseColor.substring(1).split('');
        if(c.length==3) c = [c[0](0), c[0](0), c[1](1), c[1](1), c[2](2), c[2](2)];
        c = '0x'+c.join('');
        return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')}, 0.4)`;
    }
    return baseColor;
}
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) { try { return JSON.parse(stored); } catch (e) { console.error("Load Error"); } }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }
function exportDataFile() {
    const jsonStr = JSON.stringify(appData, null, 4);
    const fileContent = `const DEFAULT_DATA = ${jsonStr};`;
    const blob = new Blob([fileContent], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "data.js"; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    alert("已匯出 data.js！請覆蓋原始檔案。");
}
function resetData() {
    if(confirm("確定重置？")) { localStorage.removeItem(STORAGE_KEY); location.reload(); }
}

var appData = loadData();
var charts = { pie: null, bar: null, detailBar: null };
const fmt = (n) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);

// --- 2. 核心計算邏輯 (保持不變) ---
function calcStats() {
    let tP21 = 0; let tP20 = 0; let tDiv = 0, tDivEst = 0; 
    let mDist = Array(12).fill(0); let mDistEst = Array(12).fill(0); 
    let chartDataSets = [];

    // 1. P21: 交易紀錄
    if (appData.transactions && appData.transactions.length > 0) {
        tP21 = appData.transactions.reduce((sum, t) => sum + Number(t.total), 0);
    }

    // 2. P20 & Div: Portfolio
    appData.portfolio.forEach(p => {
        let estS = Number(p.estShares || 0);
        let curS = Number(p.shares);
        tP20 += estS * Number(p.price);

        let mArr = [];
        if(p.months && typeof p.months === 'string') {
            mArr = p.months.split(',').map(m => parseInt(m.trim())).filter(n => !isNaN(n));
        }
        if(!p.divs || !Array.isArray(p.divs) || p.divs.length !== mArr.length) {
            const avg = mArr.length > 0 ? Number(p.div) / mArr.length : 0;
            p.divs = new Array(mArr.length).fill(avg);
        }

        let stockMonthlyData = Array(12).fill(0);
        let stockMonthlyDataEst = Array(12).fill(0);

        if(mArr.length > 0){
            mArr.forEach((m, idx) => {
                if(m>0 && m<=12) {
                    let divPerShareThisMonth = Number(p.divs[idx] || 0);
                    let pay = curS * divPerShareThisMonth;
                    let payEst = estS * divPerShareThisMonth;
                    
                    mDist[m-1] += pay; mDistEst[m-1] += payEst;
                    stockMonthlyData[m-1] += pay; stockMonthlyDataEst[m-1] += payEst;
                    tDiv += pay; tDivEst += payEst;
                }
            });
        }
        chartDataSets.push({ label: `${p.code} (現有)`, data: stockMonthlyData, backgroundColor: getStockColor(p.code, false), stack: '0' });
        if(stockMonthlyDataEst.some(v => v > 0)) {
            chartDataSets.push({ label: `${p.code} (預估)`, data: stockMonthlyDataEst, backgroundColor: getStockColor(p.code, true), stack: '0' });
        }
    });

    let tP22 = tP21 + tP20; 
    let rem = appData.budget - tP22; 
    return { tP21, tP20, tP22, rem, tDiv, tDivTotal: tDiv + tDivEst, tDivEst, yield: tP22 ? ((tDiv+tDivEst)/tP22)*100 : 0, mDist, mDistEst, chartDataSets };
}

// --- 3. 互動功能 (保持不變) ---
function addTransaction() {
    const date = document.getElementById('tx-date').value;
    const code = document.getElementById('tx-code').value;
    const type = document.getElementById('tx-type').value;
    const shares = Number(document.getElementById('tx-shares').value);
    const price = Number(document.getElementById('tx-price').value);
    if(!date || !code || !shares || !price) { alert("請填寫完整"); return; }
    const total = Math.round(shares * price);
    appData.transactions.unshift({ date, code, type, shares, price, total });
    saveData(); renderAll();
    document.getElementById('tx-shares').value = ''; document.getElementById('tx-price').value = '';
}
function updateDivDetail(pIdx, dIdx, val) {
    appData.portfolio[pIdx].divs[dIdx] = Number(val);
    appData.portfolio[pIdx].div = appData.portfolio[pIdx].divs.reduce((a,b)=>a+b, 0);
    saveData(); renderAll();
}
function updateBudget(v) { appData.budget = Number(v); saveData(); renderAll(); }
function upd(idx, f, v) { 
    if(f==='months') { appData.portfolio[idx][f] = v; appData.portfolio[idx].divs = []; }
    else appData.portfolio[idx][f] = Number(v);
    saveData();
}

// --- 4. 渲染畫面 (保持不變) ---
function renderDashboard() {
    const s = calcStats();
    document.getElementById('dash-budget').innerText = fmt(appData.budget);
    document.getElementById('dash-p21').innerText = fmt(s.tP21);
    document.getElementById('dash-p20').innerText = fmt(s.tP20);
    document.getElementById('dash-p22').innerText = fmt(s.tP22);
    document.getElementById('dash-remaining').innerText = fmt(s.rem);
    document.getElementById('dash-dividend-total').innerText = fmt(s.tDivTotal);
    document.getElementById('dash-dividend-cur').innerText = fmt(s.tDiv);
    document.getElementById('dash-dividend-add').innerText = `+${fmt(s.tDivEst)}`;
    document.getElementById('dash-yield').innerText = `總殖利率 ${s.yield.toFixed(2)}%`;

    if(typeof Chart !== 'undefined'){
        const ctxP = document.getElementById('chart-pie');
        if(ctxP){
            if(charts.pie) charts.pie.destroy();
            charts.pie = new Chart(ctxP, { type: 'pie', data: { labels: appData.portfolio.map(p=>p.name), datasets: [{ data: appData.portfolio.map(p=>p.cost), backgroundColor: appData.portfolio.map(p=>getStockColor(p.code)) }] }, options: { maintainAspectRatio: false } });
        }
        const ctxB = document.getElementById('chart-bar');
        if(ctxB){
            if(charts.bar) charts.bar.destroy();
            const currentOnlyData = s.chartDataSets.filter(ds => ds.label.includes('(現有)'));
            charts.bar = new Chart(ctxB, { type: 'bar', data: { labels: Array.from({length:12},(_,i)=>i+1+'月'), datasets: currentOnlyData }, options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': ' + fmt(context.parsed.y); } } } } } });
        }
    }
}

function renderDivSettings() {
    const c = document.getElementById('div-settings-container');
    c.innerHTML = appData.portfolio.map((p, pIdx) => {
        let mArr = [];
        if(p.months && typeof p.months === 'string') mArr = p.months.split(',').map(m => parseInt(m.trim())).filter(n => !isNaN(n));
        if(!p.divs || p.divs.length !== mArr.length) { const avg = mArr.length > 0 ? Number(p.div) / mArr.length : 0; p.divs = new Array(mArr.length).fill(avg); }
        const inputs = mArr.map((m, dIdx) => {
            const val = p.divs[dIdx] || 0;
            const curPay = Math.round(val * p.shares);
            const estPay = Math.round(val * (p.shares + (p.estShares||0)));
            return `<div class="flex flex-col border p-2 rounded bg-slate-50 hover:bg-slate-100 transition-colors"><label class="text-xs font-bold text-slate-500 mb-1">${m}月 每股配息</label><input type="number" value="${val}" step="0.01" class="border-blue-300 font-bold text-lg mb-2 text-blue-700" onchange="updateDivDetail(${pIdx}, ${dIdx}, this.value)"><div class="flex justify-between text-xs"><span class="text-blue-600">領:${curPay.toLocaleString()}</span><span class="text-orange-600">預:${estPay.toLocaleString()}</span></div></div>`;
        }).join('');
        return `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><div class="flex justify-between mb-4 border-b pb-2"><h3 class="font-bold text-lg text-slate-800">${p.code} ${p.name}</h3><div class="text-right"><div class="text-sm text-slate-500">年度總計</div><div class="font-bold text-green-600">${Number(p.div).toFixed(3)} / 股</div></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-4">${inputs}</div></div>`;
    }).join('');
}

function renderPortfolio() {
    const b = document.getElementById('table-portfolio-body');
    if(!b) return;
    b.innerHTML = appData.portfolio.map(p => {
        const mv = p.shares * p.price;
        const pf = mv - p.cost;
        return `<tr class="hover:bg-blue-50"><td class="p-4 font-bold text-blue-600">${p.code}</td><td class="p-4">${p.name}</td><td class="p-4 text-right">${Number(p.shares).toLocaleString()}</td><td class="p-4 text-right text-orange-600">+${Number(p.estShares||0).toLocaleString()}</td><td class="p-4 text-right">${fmt(p.cost)}</td><td class="p-4 text-right">${p.price}</td><td class="p-4 text-right font-bold">${fmt(mv)}</td><td class="p-4 text-right font-bold ${pf>=0?'text-red-500':'text-green-500'}">${fmt(pf)}</td></tr>`;
    }).join('');
}

function renderAnalysis() {
    const s = calcStats();
    if(typeof Chart !== 'undefined'){
        const ctx = document.getElementById('chart-bar-detail');
        if(ctx){
            if(charts.detailBar) charts.detailBar.destroy();
            charts.detailBar = new Chart(ctx, { 
                type: 'bar', 
                data: { 
                    labels: Array.from({length:12},(_,i)=>i+1+'月'), 
                    datasets: s.chartDataSets 
                }, 
                options: { 
                    maintainAspectRatio: false, 
                    scales: { 
                        x: { stacked: true }, 
                        y: { stacked: true } 
                    },
                    plugins: { 
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.y !== null) {
                                        label += fmt(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    // *** 關鍵新增：自訂繪圖邏輯來顯示總額 ***
                    animation: {
                        onComplete: function() {
                            const chart = this;
                            const ctx = chart.ctx;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = '#666'; // 文字顏色
                            ctx.font = 'bold 12px "Microsoft JhengHei"'; // 字體

                            // 1. 計算每個月的堆疊總高
                            const meta = chart.getDatasetMeta(0); // 基準 meta
                            const xScale = chart.scales.x;
                            const yScale = chart.scales.y;

                            s.mDist.forEach((val, index) => {
                                // 計算該月總金額 (現有 + 預估)
                                const total = val + s.mDistEst[index];
                                
                                if (total > 0) {
                                    // 找出該柱狀圖的頂部位置 (y 座標)
                                    // 由於是堆疊圖，我們可以用 yScale.getPixelForValue(total) 來取得高度
                                    const x = xScale.getPixelForValue(index);
                                    const y = yScale.getPixelForValue(total);

                                    // 繪製文字 (位置稍微往上 -5px)
                                    // 使用 fmt() 函式將數字轉為貨幣格式 (例如 "\$12,345")
                                    // 如果覺得字太長，可以改用 parseInt(total).toLocaleString()
                                    ctx.fillText(parseInt(total).toLocaleString(), x, y - 5);
                                }
                            });
                        }
                    }
                } 
            });
        }
    }
    // 卡片部分保持不變
    const c = document.getElementById('analysis-cards');
    if(c) c.innerHTML = appData.portfolio.map(p => {
        const divTotalPerShare = p.divs ? p.divs.reduce((a,b)=>a+b,0) : p.div;
        const curDiv = divTotalPerShare * p.shares;
        const estAdd = divTotalPerShare * (p.estShares||0);
        
        const borderColor = getStockColor(p.code);
        
        return `<div class="bg-white p-4 rounded-xl shadow-sm border-l-4 flex justify-between items-center" style="border-left-color: ${borderColor}; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
            <div><div class="font-bold text-lg">${p.code}</div><div class="text-xs text-slate-500">${p.name}</div><div class="text-xs text-blue-500">月: ${p.months}</div></div>
            <div class="text-right">
                <div class="font-bold text-blue-600">${fmt(curDiv)}</div>
                ${estAdd > 0 ? `<div class="text-xs text-orange-500 font-bold">+${fmt(estAdd)} (預估)</div>` : ''}
                <div class="text-xs text-slate-400">年總合: ${fmt(curDiv+estAdd)}</div>
            </div>
        </div>`;
    }).join('');
}

function renderTransactions() {
    // 1. 處理下拉選單
    const select = document.getElementById('tx-code');
    if(select) {
        const currentVal = select.value;
        select.innerHTML = appData.portfolio.map(p => `<option value="${p.code}">${p.code} ${p.name}</option>`).join('');
        if(currentVal) select.value = currentVal;
    }

    const b = document.getElementById('table-transactions-body');
    const footerTotal = document.getElementById('tx-total-amount'); // 取得合計欄位
    
    let sumTotal = 0; // 用來累加總金額

    if(b) {
        b.innerHTML = appData.transactions.map(t => {
            // 累加金額 (注意：如果是賣出，邏輯上可能是負項，但通常交易記錄顯示成交額皆為正，視您需求)
            // 這裡假設是統計「成交總值」(Volume)，所以都加正數
            sumTotal += Number(t.total);

            return `<tr class="hover:bg-slate-50 border-b border-slate-50">
                <td class="p-4 text-slate-500">${t.date}</td>
                <td class="p-4 font-bold">${t.code}</td>
                <td class="p-4"><span class="${t.type==='Buy'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'} px-2 py-1 rounded text-xs font-bold">${t.type}</span></td>
                <td class="p-4 text-right">${t.shares}</td>
                <td class="p-4 text-right">${t.price}</td>
                <td class="p-4 text-right font-bold">${fmt(t.total)}</td>
            </tr>`;
        }).join('');
    }

    // 2. 顯示合計金額
    if (footerTotal) {
        footerTotal.innerText = fmt(sumTotal);
    }
}

function renderManagement() {
    const i = document.getElementById('input-budget');
    if(i) i.value = appData.budget;
    const b = document.getElementById('table-management-body');
    
    if(b) b.innerHTML = appData.portfolio.map((p, idx) => {
        // 計算平均成本 (防呆：如果股數為 0，顯示 0)
        const avgCost = p.shares > 0 ? (p.cost / p.shares) : 0;

        return `<tr class="border-b border-gray-100 hover:bg-gray-50">
            <!-- 1. 代號 -->
            <td class="p-3 font-bold text-blue-600 align-middle w-20 text-center">${p.code}</td>
            
            <!-- 2. 名稱 -->
            <td class="p-3 text-slate-700 text-sm align-middle w-32 font-medium">${p.name}</td>
            
            <!-- 3. 持有股數 -->
            <td class="p-2 w-28 align-middle">
                <input type="number" value="${p.shares}" 
                       class="w-full border border-gray-300 rounded px-2 py-1.5 text-right focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                       onchange="upd(${idx},'shares',this.value)">
            </td>
            
            <!-- 4. 預估 -->
            <td class="p-2 w-28 align-middle bg-orange-50/50">
                <input type="number" value="${p.estShares||0}" 
                       class="w-full border border-orange-200 rounded px-2 py-1.5 text-right text-orange-700 font-bold bg-white focus:ring-2 focus:ring-orange-500 text-sm font-mono"
                       onchange="upd(${idx},'estShares',this.value)">
            </td>
            
            <!-- 5. 成本 -->
            <td class="p-2 w-32 align-middle">
                <input type="number" value="${p.cost}" 
                       class="w-full border border-gray-300 rounded px-2 py-1.5 text-right focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                       onchange="upd(${idx},'cost',this.value)">
            </td>

            <!-- 6. NEW: 平均成本 (唯讀，自動計算) -->
            <td class="p-2 w-24 align-middle">
                <input type="text" value="${avgCost.toFixed(2)}" disabled 
                       class="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1.5 text-right text-slate-600 font-bold text-sm font-mono cursor-default">
            </td>
            
            <!-- 7. 股利 -->
            <td class="p-2 w-24 align-middle">
                <input type="number" value="${Number(p.div).toFixed(2)}" disabled 
                       class="w-full bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-right text-gray-400 cursor-not-allowed text-sm font-mono"
                       title="請至「股利政策設定」頁面修改細項">
            </td>
            
            <!-- 8. 現價 -->
            <td class="p-2 w-24 align-middle">
                <input type="number" value="${p.price}" 
                       class="w-full border border-gray-300 rounded px-2 py-1.5 text-right focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                       onchange="upd(${idx},'price',this.value)">
            </td>
            
            <!-- 9. 配息月份 -->
            <td class="p-2 min-w-[100px] align-middle">
                <input type="text" value="${p.months}" 
                       class="w-full border border-gray-300 rounded px-2 py-1.5 text-left focus:ring-2 focus:ring-blue-500 text-sm"
                       placeholder="如: 1,4,7,10"
                       onchange="upd(${idx},'months',this.value)">
            </td>
        </tr>`;
    }).join('');
}

// --- 新增功能：強制從 data.js 檔案重新載入 ---
function reloadDataFromFile() {
    if (confirm("這將會捨棄目前尚未匯出的修改，並強制讀取 data.js 檔案內容。\n\n確定要重新載入嗎？")) {
        // 1. 清除瀏覽器記憶的舊資料
        localStorage.removeItem(STORAGE_KEY);
        
        // 2. 重新整理網頁 (這會觸發瀏覽器重新讀取 data.js)
        location.reload();
    }
}

// --- 5. 證交所 API 查詢功能 (New) ---
const API_CONFIG = {
    // 統一使用您的 Worker 網址
    all: 'https://woker-stock-all.hebeplkj.workers.dev/'
};

// 因為是撈取全部資料，所以隱藏輸入框，只保留類型選擇
document.getElementById('apiType').addEventListener('change', function() {
    // 這裡其實可以什麼都不做，或者根據需要顯示過濾輸入框
    // 為了簡化，我們隱藏日期和代號輸入，因為是撈全表再過濾
    document.getElementById('stockCodeGroup').style.display = 'none';
    document.getElementById('dateGroup').style.display = 'none';
});

// 初始化時也隱藏
document.getElementById('stockCodeGroup').style.display = 'none';
document.getElementById('dateGroup').style.display = 'none';

async function fetchTwseData() {
    const apiType = document.getElementById('apiType').value; // 'etf' 或 'stock'
    const msgDiv = document.getElementById('twse-message');
    const loadingDiv = document.getElementById('twse-loading');
    const resultsDiv = document.getElementById('twse-results');
    const statsDiv = document.getElementById('twse-stats');
    const btn = document.getElementById('queryBtn');

    // UI 重置
    msgDiv.innerHTML = ''; 
    resultsDiv.innerHTML = ''; 
    statsDiv.classList.add('hidden'); 
    resultsDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden'); 
    btn.disabled = true; 
    btn.classList.add('opacity-50');

    try {
        // 1. 呼叫統一的 Worker API
        const res = await fetch(API_CONFIG.all);
        
        if (!res.ok) throw new Error(`HTTP 錯誤! 狀態: ${res.status}`);
        
        const rawData = await res.json();
        
        // 2. 確保資料格式正確 (假設回傳的是一個大陣列)
        // 根據常見 Worker 回傳格式，可能是直接陣列，或是 { msgArray: [...] }
        const allData = Array.isArray(rawData) ? rawData : (rawData.msgArray || []);

        if (allData.length === 0) throw new Error('API 回傳空資料');

        // 3. 前端過濾資料
        let filteredData = [];
        if (apiType === 'etf') {
            // 過濾 ETF: 代號以 "00" 開頭 (例如 0050, 00878)
            filteredData = allData.filter(item => {
                const code = item.c || item.Code || item.code || ''; // 相容不同欄位名
                return code.startsWith('00');
            });
        } else {
            // 過濾個股: 代號 "不是" 以 00 開頭
            filteredData = allData.filter(item => {
                const code = item.c || item.Code || item.code || '';
                return !code.startsWith('00') && code.length > 0; // 排除空資料
            });
        }

        // 4. 顯示結果
        displayTwseResults(filteredData, apiType);

    } catch (err) {
        msgDiv.innerHTML = `<div class="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">查詢失敗：${err.message}</div>`;
        console.error(err);
    } finally {
        loadingDiv.classList.add('hidden'); 
        btn.disabled = false; 
        btn.classList.remove('opacity-50');
    }
}

function displayTwseResults(data, apiType) {
    const resultsDiv = document.getElementById('twse-results');
    const msgDiv = document.getElementById('twse-message');
    const statsDiv = document.getElementById('twse-stats');

    if (!data || data.length === 0) {
        msgDiv.innerHTML = '<div class="bg-blue-50 text-blue-600 p-3 rounded text-sm">查無符合類型的資料</div>';
        return;
    }

    resultsDiv.classList.remove('hidden');
    statsDiv.classList.remove('hidden');

    let html = `
        <div class="p-3 bg-gray-50 border-b text-sm text-gray-500 sticky left-0">
            共找到 <b>${data.length}</b> 筆資料
        </div>
        <table class="w-full text-left whitespace-nowrap border-collapse">
            <thead class="bg-teal-50 text-teal-800 text-sm font-bold">
                <tr>
                    <!-- 關鍵修改：加入 sticky top-0 z-10 來凍結標題 -->
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">代號</th>
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">名稱</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">成交價</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">漲跌</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">幅度(%)</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">成交量</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm">時間</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">`;

    let totalVol = 0;

    data.forEach(item => {
        // 1. 欄位對應
        const code = item.c || item.Code || item.code || '-';
        const name = item.n || item.Name || item.name || '-';
        const time = item.t || item.Date || '-';
        const volumeStr = item.v || item.Volume || item.TradeVolume || '0';
        
        // 2. 數值處理
        let price = parseFloat(item.z || item.Price || item.ClosingPrice);
        let yesterday = parseFloat(item.y || item.ReferencePrice);
        
        const priceDisplay = isNaN(price) ? (item.z || '-') : price.toFixed(2);

        // 3. 計算漲跌
        let change = parseFloat(item.Change || 0 );
        // if (item.diff !== undefined && item.diff !== null && item.diff !== "") {
        //     change = parseFloat(item.diff);
        // } else if (!isNaN(price) && !isNaN(yesterday)) {
        //     change = price - yesterday;
        // }

        // 4. 計算幅度
        let percent = 0;
        if (!isNaN(change) && !isNaN((price - change)) && (price - change) > 0) {
            percent = (change / (price - change)) * 100;
        }

        // 5. 顏色判斷
        let colorClass = 'text-gray-800'; 
        let sign = '';
        
        if (change > 0.000001) {
            colorClass = 'text-red-600 font-bold';
            sign = '+';
        } else if (change < -0.000001) {
            colorClass = 'text-green-600 font-bold';
            sign = ''; 
        }

        // 6. 格式化
        const changeDisplay = isNaN(change) ? '-' : change.toFixed(2);
        const percentDisplay = isNaN(percent) ? '-' : percent.toFixed(2) + '%';
        const volDisplay = parseInt(volumeStr).toLocaleString();

        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-3 font-bold text-slate-700">${code}</td>
                <td class="p-3 font-medium">${name}</td>
                <td class="p-3 text-right font-bold ${colorClass}">${priceDisplay}</td>
                <td class="p-3 text-right ${colorClass}">${sign}${changeDisplay}</td>
                <td class="p-3 text-right ${colorClass}">${sign}${percentDisplay}</td>
                <td class="p-3 text-right text-slate-500">${volDisplay}</td>
                <td class="p-3 text-right text-xs text-gray-400">${time}</td>
            </tr>`;
            
        totalVol += parseInt(volumeStr) || 0;
    });

    html += '</tbody></table>';
    resultsDiv.innerHTML = html;

    document.getElementById('totalCount').textContent = data.length;
    document.querySelector('#totalAmount').parentElement.querySelector('.text-xs').textContent = '總成交量 (股)';
    document.getElementById('totalAmount').textContent = totalVol.toLocaleString();
}

function clearTwseResults() {
    document.getElementById('twse-message').innerHTML = '';
    document.getElementById('twse-results').innerHTML = '';
    document.getElementById('twse-results').classList.add('hidden');
    document.getElementById('twse-stats').classList.add('hidden');
}

// --- 6. 全局初始化 ---
function renderAll() { 
    renderDashboard(); 
    renderPortfolio(); 
    renderDivSettings(); 
    renderAnalysis(); 
    renderTransactions(); 
    renderManagement(); 
}

function switchTab(t) {
    document.querySelectorAll('.page-view').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(e => { e.classList.remove('active', 'bg-blue-600', 'text-white', 'bg-teal-600', 'bg-purple-600'); });
    const v = document.getElementById('view-'+t); 
    if(v){ v.classList.remove('hidden'); v.classList.remove('fade-in'); void v.offsetWidth; v.classList.add('fade-in'); }
    
    const b = document.getElementById('nav-'+t); 
    if(b) {
        if(t === 'twse') b.classList.add('active', 'bg-teal-600', 'text-white');
        else if(t === 'div-settings') b.classList.add('active', 'bg-purple-600', 'text-white');
        else b.classList.add('active', 'bg-blue-600', 'text-white');
    }
    
    if(t==='dashboard') renderDashboard(); 
    else if(t==='portfolio') renderPortfolio();
    else if(t==='div-settings') renderDivSettings();
    else if(t==='analysis') renderAnalysis(); 
    else if(t==='transactions') renderTransactions();
    else if(t==='management') renderManagement();
}

window.addEventListener('DOMContentLoaded', () => { 
    const dateInput = document.getElementById('tx-date');
    if(dateInput) dateInput.valueAsDate = new Date();
    
    const qDate = document.getElementById('queryDate');
    if(qDate) qDate.valueAsDate = new Date();

    switchTab('dashboard'); 
});

