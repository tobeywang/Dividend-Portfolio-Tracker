// script.js

// --- 1. 資料載入機制 ---
const STORAGE_KEY = 'my_invest_app_v8_twse';

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
/**
 * 處理檔案匯入的函式
 * @param {HTMLInputElement} inputElement 
 */
function importDataFunc(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();

    // 當檔案讀取完成後觸發
    reader.onload = function(e) {
        const fileContent = e.target.result;

        try {
            // 1. 處理字串：原本匯出的格式是 "const DEFAULT_DATA = { ... };"
            // 我們使用 Regex 去除開頭的 "const 變數名 =" 以及結尾的分號
            let jsonString = fileContent
                .replace(/^\s*const\s+\w+\s*=\s*/, '') // 去除開頭的變數宣告
                .replace(/;\s*$/, '');                 // 去除結尾的分號(如果有的話)

            // 2. 解析 JSON
            const newData = JSON.parse(jsonString);

            // 3. 基本驗證：確保匯入的資料結構正確 (檢查是否有 portfolio 欄位)
            if (newData && Array.isArray(newData.portfolio)) {
                
                // 4. 確認視窗 (防止誤按)
                if(!confirm(`確定要匯入並覆蓋目前的資料嗎？\n(將載入 ${newData.portfolio.length} 筆持股資料)`)) {
                    inputElement.value = ''; // 清空選擇
                    return;
                }

                // 5. 更新全域變數與 LocalStorage
                appData = newData;
                saveData(); // 呼叫您既有的存檔函式
                
                // 6. 重新渲染畫面
                renderAll(); // 呼叫您既有的全域渲染函式
                
                alert("匯入成功！");
            } else {
                throw new Error("檔案內容缺少必要的 portfolio 資料結構");
            }

        } catch (err) {
            console.error(err);
            alert("匯入失敗：檔案格式不正確。\n請確保您匯入的是由本系統匯出的 data.js 檔案。");
        }
        
        // 清空 input 值，這樣如果使用者再次選取同一個檔案也能觸發 onchange
        inputElement.value = '';
    };

    // 開始以文字模式讀取檔案
    reader.readAsText(file);
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
    // 計算股票交易總額 (假設原本邏輯如下)
    if (appData.transactions) {
        appData.transactions.forEach(t => {
            // 假設您的股票 Buy 是正向投入
            if(t.type === 'Buy') tP21 += Number(t.total);
            // 如果有賣出邏輯，通常是減去賣出金額 tP21 -= Number(t.total);
        });
    }
    // --- ★ 新增：加入基金交易對 P21 的影響 ---
    if (appData.fundTransactions) {
        appData.fundTransactions.forEach(ft => {
            const val = Number(ft.total);
            if (ft.type === 'Buy') {
                tP21 += val; // 申購：增加已買入金額
            } else if (ft.type === 'Sell' || ft.type === 'Div') {
                tP21 -= val; // 贖回或配息：減少已買入金額 (視為資金回收)
            }
        });
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
function deleteTransaction(idx) {
    if(confirm("確定刪除此筆交易紀錄？")) {
        appData.transactions.splice(idx, 1);
        saveData();
        renderAll();
    }
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
    renderAll(); // ★ 新增這行：讓數值改變時立即重繪畫面，觸發買入訊號判斷
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
    if (!c) return;

    c.innerHTML = appData.portfolio.map((p, pIdx) => {
        let mArr = [];
        // 解析月份字串
        if (p.months && typeof p.months === 'string') {
            mArr = p.months.split(',').map(m => parseInt(m.trim())).filter(n => !isNaN(n));
        }

        // 1. 初始化配息金額陣列 (若長度不符則補齊)
        if (!p.divs || p.divs.length !== mArr.length) {
            const avg = mArr.length > 0 ? Number(p.div) / mArr.length : 0;
            p.divs = new Array(mArr.length).fill(avg);
        }

        // 2. 【新增】初始化除息日陣列 (若長度不符則預設補 15 號)
        if (!p.divDates || !Array.isArray(p.divDates) || p.divDates.length !== mArr.length) {
            p.divDates = new Array(mArr.length).fill(15);
        }

        const inputs = mArr.map((m, dIdx) => {
            const val = p.divs[dIdx] || 0;       // 配息金額
            const dateVal = p.divDates[dIdx] || 15; // 除息日

            const curPay = Math.round(val * p.shares);
            const estPay = Math.round(val * (p.shares + (p.estShares || 0)));

            return `
            <div class="flex flex-col border border-slate-200 p-3 rounded-lg bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                <!-- 月份標題 -->
                <div class="flex justify-between items-center mb-2 border-b border-slate-200 pb-1">
                    <span class="text-sm font-bold text-slate-700">${m}月</span>
                </div>
                
                <!-- 金額輸入 -->
                <div class="mb-2">
                    <label class="text-[10px] text-slate-400 block mb-0.5">每股配息($)</label>
                    <input type="number" value="${val}" step="0.01" 
                           class="w-full border border-blue-200 rounded px-2 py-1 text-lg font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" 
                           onchange="updateDivDetail(${pIdx}, ${dIdx}, this.value)">
                </div>

                <!-- 【新增】日期輸入 -->
                <div class="mb-3">
                    <label class="text-[10px] text-slate-400 block mb-0.5">除息日(號)</label>
                    <div class="relative">
                        <input type="number" value="${dateVal}" min="1" max="31"
                               class="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono text-gray-700 focus:ring-2 focus:ring-gray-500 bg-white pl-6" 
                               onchange="updateDivDate(${pIdx}, ${dIdx}, this.value)">
                        <span class="absolute left-2 top-1.5 text-xs text-gray-400">D</span>
                    </div>
                </div>

                <!-- 統計資訊 -->
                <div class="flex justify-between text-xs mt-auto pt-2 border-t border-slate-100">
                    <span class="text-blue-600 font-medium" title="目前股數可領">領:${fmt(curPay)}</span>
                    <span class="text-orange-600 font-medium" title="含預估股數">預:${fmt(estPay)}</span>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div class="flex justify-between items-center mb-4 border-b pb-3">
                <div class="flex items-center gap-3">
                    <span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">${p.code}</span>
                    <h3 class="font-bold text-lg text-slate-800">${p.name}</h3>
                    <span class="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">${p.saveBank}</span>
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-500 mb-0.5">年度總配息</div>
                    <div class="font-bold text-green-600 text-xl">${Number(p.div).toFixed(2)} <span class="text-xs text-gray-400">/股</span></div>
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                ${inputs}
            </div>
        </div>`;
    }).join('');
}

// 更新除息日 (日)
function updateDivDate(pIdx, dIdx, val) {
    // 確保 divDates 陣列存在
    if (!appData.portfolio[pIdx].divDates) {
        appData.portfolio[pIdx].divDates = [];
    }
    
    // 更新數值 (限制 1-31)
    let day = parseInt(val);
    if (day < 1) day = 1;
    if (day > 31) day = 31;
    
    appData.portfolio[pIdx].divDates[dIdx] = day;
    
    saveData();
    // 這裡我們不一定要 renderAll，但為了確保計算函式(calcIntervalDividends)能抓到最新資料，建議重繪
    // 如果覺得輸入會跳掉 focus，可以只呼叫 saveData，但在切換頁面時資料要是新的
    renderAll(); 
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
        b.innerHTML = appData.transactions.map((t, idx) => {
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
                <td class="p-4 text-right"><button onclick="deleteTransaction(${idx})" class="text-red-500 hover:text-red-700 px-2 py-1 text-xs rounded hover:bg-red-50">刪除</button></td>
            </tr>`;
        }).join('');
    }

    // 2. 顯示合計金額
    if (footerTotal) {
        footerTotal.innerText = fmt(sumTotal);
        // Also update the colspan of the footer cell to match the new table structure
        const footerCell = footerTotal.previousElementSibling;
        if (footerCell) {
            footerCell.colSpan = "6";
        }
    }
}

function renderShortTerm() {
    // 1. 先取得「總覽頁」的統計數據 (用以計算剩餘資金)
    const s = calcStats(); 
    const sourceIdleCash = s.rem; 

    // 取得 DOM 元素
    const tbody = document.getElementById('table-short-body');
    const sourceDisplay = document.getElementById('short-source-cash');
    const costDisplay = document.getElementById('short-cost-total');
    const realRemDisplay = document.getElementById('short-real-remaining');
    const plDisplay = document.getElementById('short-pl-total');
    const plPctDisplay = document.getElementById('short-pl-percent');
    const summaryBody = document.getElementById('short-summary-body'); // ★ 新增：彙總表 DOM

    // 初始化日期輸入框 (讀取存檔)
    const dateInput = document.getElementById('short-target-date');
    if (dateInput) {
        // 如果沒有存檔日期，預設為今天
        if (!appData.shortTermTargetDate) {
            const today = new Date().toISOString().split('T')[0];
            appData.shortTermTargetDate = today;
        }
        dateInput.value = appData.shortTermTargetDate;
        // 綁定變更事件 (若 HTML 中未綁定)
        dateInput.onchange = function() { updateTargetDate(this.value); };
    }
    
    const targetDateStr = appData.shortTermTargetDate || new Date().toISOString().split('T')[0];

    // --- 變數初始化 ---
    let totalShortCost = 0;      // 總成本
    let totalShortFinal = 0;     // 總損益 (目前含息)
    let totalPricePL = 0;        // ★ 新增：總帳面損益 (價差)
    
    if (!appData.shortTerm) appData.shortTerm = [];

    // ★ 新增：用來儲存分組統計的物件
    const summaryMap = {};

    // 2. 渲染表格並計算短期總成本
    if (tbody) {
        let html = appData.shortTerm.map((p, idx) => {
            const marketVal = Math.round(p.shares * p.price);
            const totalCost = Math.round(p.shares * p.cost);
            totalShortCost += totalCost;
            
             // --- ★ 彙總統計邏輯 ---
            if (!summaryMap[p.code]) {
                summaryMap[p.code] = { code: p.code, name: p.name, totalShares: 0, totalCost: 0 };
            }
            summaryMap[p.code].totalShares += Number(p.shares);
            summaryMap[p.code].totalCost += totalCost;
            // ----------------------

            // A. 基礎價差 (Unrealized P&L)
            const pricePL = marketVal - totalCost;
            totalPricePL += pricePL; // ★ 累加總帳面損益

            // B. 計算「目前」配息 (Buy Date -> Today)
            // 依賴 calcIntervalDividends 函式 (需包含除息日邏輯)
            const divDataNow = calcIntervalDividends(p.code, p.date, p.shares); 
            
            // 目前含息總益
            const totalPLNow = pricePL + divDataNow.amount; 
            const roiNow = totalCost > 0 ? (totalPLNow / totalCost) * 100 : 0;
            
            // 累加目前總數據 (用於 Dashboard)
            totalShortFinal += totalPLNow;

            // C. 計算「預估」配息 (Buy Date -> Target Date)
            const divDataEst = calcIntervalDividends(p.code, p.date, p.shares, targetDateStr);
            
            // 預估含息總益 = (目前價差) + (預估期間總配息)
            // *假設未來股價不變，僅賺取額外股息
            const totalPLEst = pricePL + divDataEst.amount;
            
            // 計算「額外增加」的股利 (預估 - 目前)
            // 這代表持有至目標日期，會多領到的股息
            const extraDiv = divDataEst.amount - divDataNow.amount;

            // --- 樣式邏輯 ---
            
            // 目前損益樣式
            const colorNow = totalPLNow >= 0 ? 'text-red-600' : 'text-green-600';
            const signNow = totalPLNow > 0 ? '+' : '';
            const bgNow = totalPLNow >= 0 ? 'bg-red-50' : 'bg-green-50';

            // 預估損益樣式 (藍色系表示未來/預估)
            const colorEst = totalPLEst >= 0 ? 'text-blue-600' : 'text-green-600';
            const signEst = totalPLEst > 0 ? '+' : '';
            
            // 額外股息提示
            let extraDivHtml = '';
            if (extraDiv > 0) {
                extraDivHtml = `<div class="text-[10px] text-orange-500 font-bold mt-1">
                                    <i class="fas fa-gift"></i> 待除息 +${fmt(extraDiv)}
                                </div>`;
            }

            return `
            <tr class="border-b hover:bg-orange-50/30 transition-colors group">
                <!-- 刪除按鈕 -->
                <td class="p-2 text-center align-middle">
                    <button onclick="removeShortTerm(${idx})" class="text-gray-300 hover:text-red-500 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors">×</button>
                </td>
                
                <!-- 1. 代號 -->
                <td class="p-2 align-middle">
                    <input type="text" value="${p.code}" 
                        class="w-20 text-center font-bold text-orange-600 bg-transparent border-b border-dashed border-gray-300 focus:border-orange-500 focus:outline-none"
                        onchange="updShort(${idx}, 'code', this.value)">
                </td>
                
                <!-- 2. 名稱 -->
                <td class="p-2 align-middle">
                    <input type="text" value="${p.name}" 
                        class="w-24 text-sm bg-transparent border-b border-dashed border-gray-300 focus:border-orange-500 focus:outline-none"
                        onchange="updShort(${idx}, 'name', this.value)">
                </td>
                
                <!-- 3. 交易日期 -->
                <td class="p-2 align-middle">
                    <input type="date" value="${p.date || ''}" 
                        class="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm text-gray-600 focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none" 
                        onchange="updShort(${idx}, 'date', this.value)">
                </td>

                <!-- 4. 股數 -->
                <td class="p-2 align-middle">
                    <input type="number" value="${p.shares}" 
                        class="w-full text-right bg-white border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                        onchange="updShort(${idx}, 'shares', this.value)">
                </td>
                
                <!-- 5. 平均成本 -->
                <td class="p-2 align-middle">
                    <input type="number" value="${p.cost}" 
                        class="w-full text-right bg-white border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                        onchange="updShort(${idx}, 'cost', this.value)">
                </td>
                
                <!-- 6. 現價 -->
                <td class="p-2 align-middle">
                    <input type="number" value="${p.price}" 
                        class="w-full text-right bg-white border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                        onchange="updShort(${idx}, 'price', this.value)">
                </td>
                
                <!-- 7. 帳面損益 (價差) -->
                <td class="p-2 text-right font-mono text-sm align-middle">
                    <span class="${pricePL >= 0 ? 'text-red-600' : 'text-green-600'}">
                        ${pricePL > 0 ? '+' : ''}${fmt(pricePL)}
                    </span>
                    <div class="text-[10px] text-gray-400">價差</div>
                </td>
                
                <!-- 8. 目前含息總益 -->
                <td class="p-2 text-right font-mono border-l border-orange-100 align-middle ${bgNow} bg-opacity-30">
                    <div class="${colorNow} font-bold text-base">
                        ${signNow}${fmt(totalPLNow)}
                    </div>
                    <div class="text-[10px] ${colorNow} opacity-80 font-bold">
                        ${signNow}${roiNow.toFixed(1)}%
                    </div>
                    ${divDataNow.amount > 0 ? `<div class="text-[10px] text-gray-400">(含息 ${fmt(divDataNow.amount)})</div>` : ''}
                </td>

                <!-- 9. 預估含息總益 (至設定日期) -->
                <td class="p-2 text-right font-mono bg-blue-50/20 border-l border-blue-100 align-middle">
                    <div class="${colorEst} font-bold text-base">
                        ${signEst}${fmt(totalPLEst)}
                    </div>
                    ${extraDivHtml}
                </td>
            </tr>`;
        }).join('');

        // 總計列
        if (appData.shortTerm.length > 0) {
            const colorTotalPL = totalShortFinal >= 0 ? 'text-red-600' : 'text-green-600';
            const signTotalPL = totalShortFinal > 0 ? '+' : '';
            
            const colorPricePL = totalPricePL >= 0 ? 'text-red-600' : 'text-green-600';
            const signPricePL = totalPricePL > 0 ? '+' : '';

            html += `
            <tr class="bg-orange-100/50 border-t-2 border-orange-200">
                <td colspan="7" class="p-3 text-right font-bold text-orange-800 align-middle">總計：</td>
                <td class="p-3 text-right font-mono font-bold text-base align-middle ${colorPricePL}">
                    ${signPricePL}${fmt(totalPricePL)}
                </td>
                <td class="p-3 text-right font-mono font-bold text-lg align-middle ${colorTotalPL}">
                    ${signTotalPL}${fmt(totalShortFinal)}
                </td>
                <td class="p-3"></td>
            </tr>`;
        }

        tbody.innerHTML = html;
    }

    // 3. 計算核心數據
    const realRemaining = sourceIdleCash - totalShortCost;
    const totalRoi = totalShortCost > 0 ? (totalShortFinal / totalShortCost) * 100 : 0;

    // 4. 更新上方資訊卡 DOM
    if(sourceDisplay) sourceDisplay.innerText = fmt(sourceIdleCash);
    if(costDisplay) costDisplay.innerText = fmt(totalShortCost);
    
    // 剩餘資金卡片
    if(realRemDisplay) {
        realRemDisplay.innerText = fmt(realRemaining);
        const parentCard = realRemDisplay.parentElement;
        if (realRemaining < 0) {
            // 透支：紅色警告
            realRemDisplay.className = "text-2xl font-bold text-red-600";
            if(parentCard) parentCard.className = "bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm relative overflow-hidden";
        } else {
            // 正常：綠色安全
            realRemDisplay.className = "text-2xl font-bold text-green-600";
            if(parentCard) parentCard.className = "bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm";
        }
    }

    // 總損益卡片
    if(plDisplay) {
        const sign = totalShortFinal > 0 ? '+' : '';
        plDisplay.innerText = sign + fmt(totalShortFinal);
        plDisplay.className = `text-2xl font-bold ${totalShortFinal >= 0 ? 'text-red-600' : 'text-green-600'}`;
    }

    // 報酬率卡片
    if(plPctDisplay) {
        const sign = totalRoi > 0 ? '+' : ''; 
        plPctDisplay.innerText = `${sign}${totalRoi.toFixed(2)}%`;
        plPctDisplay.className = `text-lg font-bold ${totalRoi >= 0 ? 'text-red-600' : 'text-green-600'}`;
    }

    // 5. ★ 渲染彙總表
    if (summaryBody) {
        let summaryHtml = '';
        for (const code in summaryMap) {
            const s = summaryMap[code];
            // 計算平均成本
            const avgCost = s.totalShares > 0 ? (s.totalCost / s.totalShares) : 0;
            
            summaryHtml += `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-3 font-bold text-blue-600">${s.code}</td>
                    <td class="p-3 text-slate-700">${s.name}</td>
                    <td class="p-3 text-right font-mono text-slate-700">${s.totalShares.toLocaleString()}</td>
                    <td class="p-3 text-right font-mono text-slate-700">${avgCost.toFixed(2)}</td>
                    <td class="p-3 text-right font-mono font-bold text-slate-700">${fmt(s.totalCost)}</td>
                </tr>
            `;
        }
        
        if (Object.keys(summaryMap).length === 0) {
            summaryHtml = `<tr><td colspan="5" class="p-4 text-center text-slate-400">尚無部位資料</td></tr>`;
        }
        
        summaryBody.innerHTML = summaryHtml;
    }
}

// 輔助函式：新增與更新
function addShortTermItem() {
    const todayStr = new Date().toISOString().split('T')[0]; // 取得 YYYY-MM-DD
    appData.shortTerm.push({ 
        code: '0000', 
        name: '標的名稱', 
        date: todayStr, // 預設今天
        shares: 0, 
        cost: 0, 
        price: 0 
    });
    saveData();
    renderShortTerm();
}

function removeShortTerm(idx) {
    if(confirm('確定刪除此短期標的？')) {
        appData.shortTerm.splice(idx, 1);
        saveData();
        renderShortTerm();
    }
}

// 更新短期策略的單一欄位
function updShort(idx, field, val) {
    // 1. 取得該筆資料
    let item = appData.shortTerm[idx];
    
    // 2. 根據欄位類型進行資料轉型
    if (field === 'shares' || field === 'cost' || field === 'price') {
        // 數值型欄位：轉為 Number
        item[field] = Number(val);
    } else {
        // 文字或日期型欄位：保持原樣
        item[field] = val;
    }

    // 3. 存檔
    saveData();

    // 4. 重繪短期頁面 (讓總計、損益百分比立即更新)
    renderShortTerm();
}

/**
 * 計算指定區間內獲得的總股利 (修正版)
 * 1. 依據股利政策設定的「各月金額 (divs)」計算，而非平均分配。
 * 2. 移除除息日判斷：只要買入月份遇到配息月，一律寬鬆認定為已領息。
 * @param {string} code - 股票代號
 * @param {string} buyDateStr - 買入日期 (YYYY-MM-DD)
 * @param {number} shares - 持有股數
 * @param {string} endDateStr - (選填) 結算日期，預設為今天。若要算「預估含息」可傳入未來日期。
 */
function calcIntervalDividends(code, buyDateStr, shares, endDateStr = null) {
    // 1. 基礎防呆與資料取得
    if (!buyDateStr || !shares || shares <= 0) return { count: 0, amount: 0 };
    
    // 從長線投資組合中獲取該股票的股利政策 (包含月份、金額、除息日)
    const policy = appData.portfolio.find(p => p.code === code);
    if (!policy) return { count: 0, amount: 0 };

    // 2. 解析日期物件
    const buyDate = new Date(buyDateStr);
    buyDate.setHours(0, 0, 0, 0); // 歸零時分秒，只比對日期

    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    endDate.setHours(0, 0, 0, 0);

    // 3. 準備政策數據
    // 確保 months 是陣列 [3][6][9][12]
    const pMonths = (typeof policy.months === 'string') 
                    ? policy.months.split(',').map(m => parseInt(m.trim())) 
                    : (policy.months || []);
    
    const pDivs = policy.divs || [];
    // 取得除息日設定，若該欄位未設定，預設為每月 15 號
    const pDates = policy.divDates || []; 

    let totalAmount = 0;
    let count = 0;

    // 4. 【核心演算法】時間軸遍歷
    // 建立一個游標，從買入日期的「當月1號」開始檢查
    let cursor = new Date(buyDate.getFullYear(), buyDate.getMonth(), 1);

    // 只要游標月份還在結束日期之前 (或相同)，就持續檢查
    // 這裡比較的是月份，實際除息日判定在迴圈內
    while (cursor <= endDate) {
        const currYear = cursor.getFullYear();
        const currMonth = cursor.getMonth() + 1; // getMonth() 是 0-11，需 +1

        // 檢查這個月份是否有配息政策
        const mIdx = pMonths.indexOf(currMonth);

        if (mIdx !== -1) {
            // ---------------------------------------------------
            // A. 決定除息日期
            // ---------------------------------------------------
            // 優先使用設定的除息日，若無則預設 15 號
            let exDay = (pDates[mIdx] && pDates[mIdx] > 0) ? pDates[mIdx] : 15;
            
            // 處理日期溢位 (例如 2月30日 -> 3月2日)，雖然輸入端有限制，但防呆比較保險
            // 簡單處理：若設定超過28號且是2月，可自動修正，或依賴 Date 自動進位
            const exDate = new Date(currYear, currMonth - 1, exDay);

            // ---------------------------------------------------
            // B. 判定是否符合領息資格
            // 規則：買入日期 < 除息日 (T-1日持有) 且 除息日 <= 結算日期 (已發生)
            // ---------------------------------------------------
            if (buyDate < exDate && exDate <= endDate) {
                // 取得該月配息金額 (若無設定個別金額，則用平均值，建議設定個別金額較準)
                let divPerShare = 0;
                if (pDivs[mIdx] > 0) {
                    divPerShare = pDivs[mIdx];
                } else {
                    // 若無細項設定，使用年度總配息平均
                    divPerShare = (policy.div || 0) / pMonths.length;
                }

                totalAmount += (divPerShare * shares);
                count++;
            }
        }

        // 游標推進到下一個月
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return {
        count: count,
        amount: Math.round(totalAmount) // 四捨五入取整數
    };
}

// 處理日期變更的 Helper
function updateTargetDate(val) {
    appData.shortTermTargetDate = val; // 存入全域變數
    saveData(); // 存檔
    renderShortTerm(); // 重繪表格
}

function renderManagement() {
    const i = document.getElementById('input-budget');
    if(i) i.value = appData.budget;
    const b = document.getElementById('table-management-body');
    
    if(b) b.innerHTML = appData.portfolio.map((p, idx) => {
        // 1. 計算平均成本
        const avgCost = p.shares > 0 ? (p.cost / p.shares) : 0;
        
        // 2. 取得股利與價格資訊
        const dividend = Number(p.div);
        const currentPrice = Number(p.price);
        const targetPrice = p.targetPrice || currentPrice || 0; 

        // 3. 【新增】計算成本殖利率 (YoC)
        // 公式：年股利 / 平均成本
        let yoc = 0;
        if (avgCost > 0) {
            yoc = (dividend / avgCost) * 100;
        }

        // 推算合理價 (供目標價參考) 這裡是用合理股價 = 預估年股利 ÷ 期待殖利率
        const priceYield6 = dividend > 0 ? (dividend / 0.06).toFixed(2) : 0;
        const priceYield7 = dividend > 0 ? (dividend / 0.07).toFixed(2) : 0;

        // 取得自訂的期待殖利率 (若未設定，預設給 6%)
        const targetYield = p.targetYield || 6; 
        // 動態計算建議買價：年股利 / (期待殖利率 / 100)
        const suggestedPrice = dividend > 0 ? (dividend / (targetYield / 100)).toFixed(2) : 0;

        // 計算現價殖利率
        let currentYield = 0;
        if (currentPrice > 0) {
            currentYield = (dividend / currentPrice) * 100;
        }

        // 判定是否觸發買入訊號
        const isBuyZone = (targetPrice > 0 && currentPrice > 0 && currentPrice <= targetPrice);
        
        // 買入訊號 HTML
        const buySignalHtml = isBuyZone 
            ? `<span class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse z-10">BUY</span>` 
            : '';

        // 現價顏色
        const priceColorClass = isBuyZone ? 'text-red-600 font-bold' : 'text-slate-700';

        return `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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

            <!-- 6. 平均成本 -->
            <td class="p-2 w-24 align-middle">
                <input type="text" value="${avgCost.toFixed(2)}" disabled 
                       class="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1.5 text-right text-slate-600 font-bold text-sm font-mono cursor-default">
            </td>

            <!-- 7. 【新增】成本殖利率 (YoC) -->
            <!-- 使用唯讀欄位顯示，並加上不同顏色背景強調 -->
            <td class="p-2 w-24 align-middle bg-indigo-50/30">
                <div class="flex items-center justify-end px-2 py-1.5 border border-indigo-100 rounded bg-indigo-50">
                    <span class="text-indigo-700 font-bold font-mono text-sm">${yoc.toFixed(2)}%</span>
                </div>
            </td>

            <!-- 8. 目標買入價 -->
            <td class="p-2 w-28 align-middle bg-yellow-50/50 relative">
                ${buySignalHtml}
                <input type="number" value="${targetPrice}" step="0.01" placeholder="未設定"
                       class="w-full border border-yellow-300 rounded px-2 py-1.5 text-right text-yellow-800 font-bold bg-white focus:ring-2 focus:ring-yellow-500 text-sm font-mono"
                       onchange="upd(${idx},'targetPrice',this.value)">
            </td>

            <!-- 9. 【獨立新欄位】期待殖利率 & 建議買價 -->
            <td class="p-2 w-32 align-middle bg-green-50/30 border-l border-green-100">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-[10px] text-gray-600 px-1">
                        <span>殖利率:</span>
                        <div class="flex items-center">
                            <input type="number" value="${targetYield}" step="0.1"
                                   class="w-12 border border-gray-300 rounded px-1 py-0.5 text-right focus:ring-1 focus:ring-green-500 bg-white"
                                   onchange="upd(${idx},'targetYield',this.value)">
                            <span class="ml-0.5">%</span>
                        </div>
                    </div>
                    <div class="text-[11px] text-center mt-0.5 pt-1 border-t border-green-200/50">
                        <span class="text-gray-600 cursor-pointer hover:text-blue-600 hover:font-bold transition-colors underline decoration-dashed"
                              title="點擊自動填入目標價"
                              onclick="upd(${idx}, 'targetPrice', ${suggestedPrice})">
                            建議買價: <span class="font-bold text-green-700">${suggestedPrice}</span>
                        </span>
                    </div>
                </div>
            </td>
            
            <!-- 10. 現價 -->
            <td class="p-2 w-24 align-middle">
                <input type="number" value="${p.price}" 
                       class="w-full border border-gray-300 rounded px-2 py-1.5 text-right focus:ring-2 focus:ring-blue-500 text-sm font-mono ${priceColorClass}"
                       onchange="upd(${idx},'price',this.value)">
            </td>
            
            <!-- 11. 股利 -->
            <td class="p-2 w-24 align-middle">
                <input type="number" value="${Number(p.div).toFixed(2)}" disabled 
                       class="w-full bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-right text-gray-400 cursor-not-allowed text-sm font-mono"
                       title="請至「股利政策設定」頁面修改細項">
            </td>
            
            <!-- 12. 配息月份 -->
            <td class="p-2 min-w-[100px] align-middle">
                <input type="text" value="${p.months}" 
                       class="w-full border border-gray-300 rounded px-2 py-1.5 text-left focus:ring-2 focus:ring-blue-500 text-sm"
                       placeholder="如: 1,4,7,10"
                       onchange="upd(${idx},'months',this.value)">
            </td>
        </tr>`;
    }).join('');
}

// --- 基金功能區 ---

function addFundTransaction() {
    const date = document.getElementById('ft-date').value;
    const name = document.getElementById('ft-name').value;
    const type = document.getElementById('ft-type').value;
    
    // ★ 新增：抓取淨值 (nav)
    const nav = Number(document.getElementById('ft-nav').value) || 0;
    
    let amount = Number(document.getElementById('ft-amount').value) || 0;
    let units = Number(document.getElementById('ft-units').value) || 0;
    const fee = Number(document.getElementById('ft-fee').value) || 0;

    // --- 自動補算邏輯 (Optional) ---
    // 如果有輸入「金額」跟「淨值」，但沒輸入「單位數」，自動算出單位數
    if (amount > 0 && nav > 0 && units === 0) {
        units = Number((amount / nav).toFixed(2)); // 通常基金單位數取小數點後2位
    }
    // 如果有輸入「單位數」跟「淨值」，但沒輸入「金額」，自動算出金額
    else if (units > 0 && nav > 0 && amount === 0) {
        amount = Math.round(units * nav);
    }
    // -----------------------------

    if (!date || !name || amount <= 0) {
        alert("請至少填寫日期、名稱與金額 (或透過淨值與單位數自動計算)");
        return;
    }

    // 計算總金額 (維持不變)
    let total = 0;
    if (type === 'Buy') total = amount + fee;      // 申購支出
    else if (type === 'Sell') total = amount - fee; // 贖回實拿
    else total = amount;                            // 配息

    if (!appData.fundTransactions) appData.fundTransactions = [];
    
    // ★ 寫入資料時加入 nav
    appData.fundTransactions.unshift({
        id: Date.now(),
        date, name, type, nav, units, amount, fee, total
    });

    saveData();
    renderAll();
    
    // 清空輸入框
    document.getElementById('ft-name').value = '';
    document.getElementById('ft-nav').value = '';     // ★ 清空淨值
    document.getElementById('ft-units').value = '';
    document.getElementById('ft-amount').value = '';
    document.getElementById('ft-fee').value = '';
}

function renderFundTransactions() {
    const tbody = document.getElementById('table-fund-body');
    const tfootAmount = document.getElementById('fund-total-amount');
    const tfootUnits = document.getElementById('fund-total-units'); // ★ 新增
    const tfootAvgCost = document.getElementById('fund-avg-cost');  // ★ 新增

    if (!tbody) return;

    if (!appData.fundTransactions) appData.fundTransactions = [];

    let netFundInvested = 0;
    let totalUnits = 0; // ★ 新增：累計單位數

    const html = appData.fundTransactions.map((t, idx) => {
        // ★ 計算淨投入與總單位數
        if (t.type === 'Buy') {
            netFundInvested += t.total;
            totalUnits += Number(t.units || 0);
        } else if (t.type === 'Sell') {
            netFundInvested -= t.total;
            totalUnits -= Number(t.units || 0);
        } else if (t.type === 'Div') {
            netFundInvested -= t.total;
            // 配息通常不影響單位數
        }

        const typeBadge = t.type === 'Buy' 
            ? '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">申購</span>'
            : (t.type === 'Sell' 
                ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">贖回</span>'
                : '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">配息</span>');

        // ★ 處理淨值顯示 (如果沒有值就顯示 -)
        const displayNav = (t.nav && t.nav > 0) ? Number(t.nav).toFixed(4) : '-';

        return `<tr class="hover:bg-slate-50 border-b border-gray-50">
            <td class="p-3 text-slate-500">${t.date}</td>
            <td class="p-3 font-bold text-slate-700">${t.name}</td>
            <td class="p-3">${typeBadge}</td>
            <td class="p-3 text-right">${fmt(t.amount)}</td>
            <td class="p-3 text-right font-mono text-slate-600">${displayNav}</td>
            <td class="p-3 text-right">${t.units || '-'}</td>
            <td class="p-3 text-right text-slate-400">${t.fee > 0 ? fmt(t.fee) : '-'}</td>
            <td class="p-3 text-right font-bold text-slate-800">${fmt(t.total)}</td>
            <td class="p-3">
                <button onclick="deleteFundTx(${idx})" class="text-red-400 hover:text-red-600">✕</button>
            </td>
        </tr>`;
    }).join('');

    tbody.innerHTML = html;
    // ★ 計算平均單位成本 (淨投入 / 總單位數)
    let avgCost = 0;
    if (totalUnits > 0) {
        avgCost = netFundInvested / totalUnits;
    }
    // ★ 更新底部統計數據
    if (tfootAmount) tfootAmount.innerText = fmt(netFundInvested);
    if (tfootUnits) tfootUnits.innerText = totalUnits.toFixed(2); // 單位數通常取小數點後2位
    if (tfootAvgCost) tfootAvgCost.innerText = avgCost > 0 ? avgCost.toFixed(4) : '0.0000'; // 淨值/成本通常取小數點後4位

}

function deleteFundTx(idx) {
    if(confirm("確定刪除此筆基金記錄？")) {
        appData.fundTransactions.splice(idx, 1);
        saveData();
        renderAll();
    }
}
// ------------------

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

        // 5.自動將查詢結果同步回持股設定
        syncPricesToPortfolio(filteredData);

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

/**
 * 將查詢到的證交所資料同步到持股參數設定的「現價」
 * @param {Array} data - API 回傳並過濾後的股票/ETF陣列
 */
function syncPricesToPortfolio(data) {
    if (!appData || !appData.portfolio) return;

    let updateCount = 0; // 持股表格更新
    let updateShortCount = 0 ; // 短期表格更新
    
    // 1. 建立代號與價格的對照表 (Map)，加速比對
    // 考慮到 API 欄位可能不同，使用與 displayTwseResults 相同的邏輯抓取價格
    const priceMap = {};
    
    data.forEach(item => {
        const code = item.c || item.Code || item.code; // 代號
        // 嘗試解析價格 (z:最新成交, Price:一般欄位, ClosingPrice:收盤)
        const rawPrice = item.z || item.Price || item.ClosingPrice;
        const price = parseFloat(rawPrice);
        
        // 只有當代號存在且價格為有效數字時才記錄
        if (code && !isNaN(price)) {
            priceMap[code] = price;
        }
    });

    // 2. 遍歷目前的持股清單，若代號吻合則更新現價
    appData.portfolio.forEach(p => {
        // 注意：這裡假設您的 p.code 與 API 回傳的格式一致 (皆為字串)
        if (priceMap[p.code] !== undefined) {
            const newPrice = priceMap[p.code];
            let isUpdated = false;

            // 1. 若現價有變動則更新
            if (p.price !== newPrice) {
                p.price = newPrice;
                isUpdated = true;
            }

            // 2. ★ 新增：只有在「未設定」目標買入價 (為 0 或空值) 時，才將其預設為現價
            if (!p.targetPrice) {
                p.targetPrice = newPrice;
                isUpdated = true;
            }

            // 若有任何欄位被更新，則增加更新計數
            if (isUpdated) {
                updateCount++;
            }
        }
    });

    // 3. 遍歷短期波段配置清單，若代號吻合則更新現價
    if (appData.shortTerm) {
        appData.shortTerm.forEach(p => {
            if (priceMap[p.code] !== undefined) {
                if (p.price !== priceMap[p.code]) {
                    p.price = priceMap[p.code];
                    updateShortCount++;
                }
            }
        });
    }

    // 4. 如果有更新數據，執行存檔並刷新畫面
    if (updateCount > 0 || updateShortCount > 0) {
        saveData(); // 儲存到 localStorage
        
        // 重新渲染畫面
        if (typeof renderAll === 'function') {
            renderAll(); // 如果有主渲染函式
        } else {
            renderManagement(); // 或是只渲染管理介面
            renderShortTerm(); // 確保短期波段配置頁面也更新
        }
        
        // 顯示提示訊息 (可選)
        const msgDiv = document.getElementById('twse-message');
        if (msgDiv) {
            msgDiv.innerHTML += `<div class="mt-2 text-green-600 font-bold">★ 已自動更新 ${updateCount} 支持股的現價資訊！</div>`;
            msgDiv.innerHTML += `<div class="mt-2 text-green-600 font-bold">★ 已自動更新 ${updateShortCount} 支短期配置的現價資訊！</div>`;
        }
    }
}

// --- 6. 全局初始化 ---
function renderAll() { 
    renderDashboard(); 
    renderPortfolio(); 
    renderDivSettings(); 
    renderAnalysis(); 
    renderTransactions(); 
    renderManagement(); 
    renderFundTransactions(); // ★ 新增：渲染基金表
    renderShortTerm(); // 新增這行
}

function switchTab(t) {
    document.querySelectorAll('.page-view').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(e => { e.classList.remove('active', 'bg-blue-600', 'text-white', 'bg-teal-600', 'bg-purple-600', 'bg-orange-600'); });
    const v = document.getElementById('view-'+t); 
    if(v){ v.classList.remove('hidden'); v.classList.remove('fade-in'); void v.offsetWidth; v.classList.add('fade-in'); }
    
    const b = document.getElementById('nav-'+t); 
    if(b) {
        if(t === 'twse') b.classList.add('active', 'bg-teal-600', 'text-white');
        else if(t === 'div-settings') b.classList.add('active', 'bg-purple-600', 'text-white');
        else if(t === 'short') b.classList.add('active', 'bg-orange-600', 'text-white'); // 新增這行
        else b.classList.add('active', 'bg-blue-600', 'text-white');
    }
    
    if(t==='dashboard') renderDashboard(); 
    else if(t==='portfolio') renderPortfolio();
    else if(t==='div-settings') renderDivSettings();
    else if(t==='analysis') renderAnalysis(); 
    else if(t==='transactions') 
    {
        renderTransactions();
        renderFundTransactions();
    }
    else if(t==='short') renderShortTerm(); // 新增這行
    else if(t==='management') renderManagement();
}

// --- 7.手機版下拉選單控制邏輯 ---

// 1. 切換選單顯示/隱藏
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu-dropdown');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// 2. 點擊選項後：執行換頁並關閉選單
function switchTabMobile(tabName) {
    // 執行原本的換頁邏輯
    switchTab(tabName);
    
    // 強制關閉下拉選單
    const menu = document.getElementById('mobile-menu-dropdown');
    if (menu) {
        menu.classList.add('hidden');
    }
}

// 3. (選用) 點擊畫面其他地方時關閉選單
window.addEventListener('click', function(e) {
    const menu = document.getElementById('mobile-menu-dropdown');
    const btn = document.querySelector('button[onclick="toggleMobileMenu()"]'); // 抓取觸發按鈕
    
    // 如果點擊的目標不是選單本身，也不是觸發按鈕，就關閉選單
    if (menu && !menu.classList.contains('hidden')) {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    }
});

window.addEventListener('DOMContentLoaded', () => { 
    const dateInput = document.getElementById('tx-date');
    if(dateInput) dateInput.valueAsDate = new Date();
    
    const qDate = document.getElementById('queryDate');
    if(qDate) qDate.valueAsDate = new Date();

    switchTab('dashboard'); 
});

