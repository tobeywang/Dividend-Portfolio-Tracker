// script.js

// --- 1. 資料載入機制 ---
const STORAGE_KEY = 'my_invest_app_v8_twse';

const STOCK_COLORS = {
    '0050': '#2563eb', '0056': '#dc2626', '00878': '#16a34a',
    '00713': '#d97706', '006208': '#9333ea', '2882': '#0ea5e9',   // 新增：青藍色
    '2887': '#f59e0b',   // 新增：琥珀橘
    'default': '#64748b'
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
const portfolioSortState = { key: 'mv', direction: 'desc' };
const dividendSortState = { key: 'Date', direction: 'desc' };
let currentDividendData = [];
let currentDividendApiType = 'last';

function getPortfolioSortValue(entry, key) {
    switch (key) {
        case 'code': return String(entry.code || '');
        case 'name': return String(entry.name || '');
        case 'shares': return Number(entry.shares || 0);
        case 'estShares': return Number(entry.estShares || 0);
        case 'cost': return Number(entry.cost || 0);
        case 'price': return Number(entry.price || 0);
        case 'mv': return Number(entry.shares || 0) * Number(entry.price || 0);
        case 'pf': return (Number(entry.shares || 0) * Number(entry.price || 0)) - Number(entry.cost || 0);
        case 'yoc': return getYoC(entry.cost, entry.shares, entry.div);
        case 'cy': return getCurrentYield(entry.div, entry.price);
        default: return 0;
    }
}

function sortPortfolioTable(key) {
    if (portfolioSortState.key === key) {
        portfolioSortState.direction = portfolioSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        portfolioSortState.key = key;
        portfolioSortState.direction = ['code', 'name'].includes(key) ? 'asc' : 'desc';
    }

    renderPortfolio();
}

function bindPortfolioSortHandlers() {
    document.querySelectorAll('[data-sort-key]').forEach(th => {
        th.onclick = () => sortPortfolioTable(th.dataset.sortKey);
    });
    updatePortfolioSortIndicators();
}

function updatePortfolioSortIndicators() {
    const labels = {
        code: '代號',
        name: '名稱',
        shares: '持有股數',
        estShares: '預估',
        cost: '總成本',
        price: '現價',
        mv: '市值',
        pf: '損益',
        yoc: 'YoC',
        cy: '現價殖利率(CY)'
    };

    document.querySelectorAll('#view-portfolio [data-sort-key]').forEach(th => {
        const key = th.dataset.sortKey;
        const isActive = portfolioSortState.key === key;
        const arrow = isActive ? (portfolioSortState.direction === 'asc' ? ' ↑' : ' ↓') : '';
        th.textContent = `${labels[key] || key}${arrow}`;
    });
}

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
        
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        if(ctxP){
            if(charts.pie) charts.pie.destroy();

            // ===== 內圈：分類（市值型/配息型/其他）=====
            const TYPE_ORDER = ['市值型', '配息型', '其他'];
            const typeColorMap = {
                '市值型': '#3B82F6', // 藍
                '配息型': '#F59E0B', // 橘
                '其他'  : '#10B981'  // 綠
            };

            // 分組累計（內圈）
            const grouped = { 市值型: 0, 配息型: 0, 其他: 0 };

            // ===== 外圈：個股 =====
            const outerLabels = [];
            const outerData = [];
            const outerColors = [];
            const outerTypes = []; // 每個個股對應的分類（tooltip 用）

            appData.portfolio.forEach(p => {
                const type = getStockType(p.cost, p.shares, Number(p.div));
                // const type = getStockType(p.price, p.shares, Number(p.div),targetYield = "current");

                // 內圈與外圈都以市值計算，與再平衡建議保持一致
                const mv = getMarketValue(p);
                grouped[type] = (grouped[type] || 0) + mv;

                // 外圈：每檔股票
                outerLabels.push(p.name);
                outerData.push(mv);
                outerColors.push(getStockColor(p.code)); // 你原本的個股顏色規則
                outerTypes.push(type);
            });

            // 整體總額（算 %）
            const total = outerData.reduce((a,b)=>a+b, 0);

            // 內圈資料（把 0 的類別濾掉，避免出現 0% 扇形）
            const innerLabels = TYPE_ORDER.filter(t => (grouped[t] || 0) > 0);
            const innerData   = innerLabels.map(t => grouped[t]);
            const innerColors = innerLabels.map(t => typeColorMap[t]);

            charts.pie = new Chart(ctxP, {
                // ✅ 多 datasets 的 doughnut 就是多圈（雙層圓環）
                type: 'doughnut',
                data: {
                    // labels 先放外圈的（Chart.js 的 labels 是共用的，我們用 tooltip callback 自己切換顯示）
                    labels: outerLabels,
                    datasets: [
                        // 內圈：分類
                        {
                            label: '分類',
                            data: innerData,
                            backgroundColor: innerColors,
                            borderColor: '#fff',
                            borderWidth: 2,
                            hoverOffset: 6,
                            // 用 weight 控制圈厚度（多 dataset 時會依 weight 分配厚度）【2-134392】
                            weight: 0.8,
                            // 自訂存 labels，讓 tooltip 能拿到正確分類名稱
                            _labels: innerLabels
                        },
                        // 外圈：個股
                        {
                            label: '個股',
                            data: outerData,
                            backgroundColor: outerColors,
                            borderColor: '#fff',
                            borderWidth: 2,
                            hoverOffset: 6,
                            weight: 1.2,
                            _types: outerTypes // tooltip 顯示「這檔屬於哪個分類」
                        }
                    ]
                },
                options: {
                    maintainAspectRatio: false,
                    cutout: '45%',

                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                generateLabels: (chart) => {
                                    const dsInner = chart.data.datasets[0]; // 分類
                                    const dsOuter = chart.data.datasets[1]; // 個股

                                    const total = dsOuter.data.reduce((a,b)=>a+b, 0);

                                    return (dsInner._labels || [])
                                        .map((label, i) => {
                                        const value = dsInner.data[i] || 0;
                                        if(value <= 0) return null;

                                        const pct = total > 0
                                            ? (value / total * 100).toFixed(1)
                                            : '0.0';

                                        return {
                                            text: `${label} ${pct}%`,
                                            fillStyle: dsInner.backgroundColor[i],
                                            strokeStyle: dsInner.backgroundColor[i],
                                            lineWidth: 0,
                                            hidden: false,
                                            index: i
                                        };
                                        })
                                        .filter(x => x); // 移除 null
                                }
                            },
                            onClick: () => {}
                        },

                        tooltip: {
                        callbacks: {
                            title: function(items) {
                            const ctx = items[0];
                            const ds = ctx.chart.data.datasets[ctx.datasetIndex];

                            if(ctx.datasetIndex === 0){
                                return (ds._labels && ds._labels[ctx.dataIndex]) || '分類';
                            }
                            return ctx.chart.data.labels[ctx.dataIndex] || '個股';
                            },
                            label: function(context) {
                            const ds = context.chart.data.datasets[context.datasetIndex];
                            const value = context.raw || 0;
                            const total = context.chart.data.datasets[1].data
                                .reduce((a,b)=>a+b, 0);

                            const pct = total > 0 ? (value / total * 100).toFixed(1) : '0.0';

                            if(context.datasetIndex === 0){
                                return `金額: ${fmt(value)}（${pct}%）`;
                            }

                            const type = ds._types?.[context.dataIndex] || '';
                            return `金額: ${fmt(value)}（${pct}%）${type ? '｜' + type : ''}`;
                            }
                        }
                        },

                        // ✅ ✅ 關鍵：只顯示 外圈前三大 + 股票名稱 + %
                        datalabels: {
                        display: (context) => {
                            // ✅ 只限制外圈
                            if (context.datasetIndex !== 1) return false;

                            const data = context.dataset.data;

                            // ✅ 排序找前三大 index
                            const top3 = data
                            .map((v, i) => ({ v, i }))
                            .filter(x => x.v > 0)
                            .sort((a, b) => b.v - a.v)
                            .slice(0, 3)
                            .map(x => x.i);

                            // ✅ 判斷現在這一筆是不是 Top3
                            return top3.includes(context.dataIndex);

                        },

                        formatter: (value, context) => {
                            if(!value) return '';

                            const code = appData.portfolio[context.dataIndex].code;

                            const total = context.chart.data.datasets[1].data
                            .reduce((a,b)=>a+b, 0);

                            const pct = total > 0
                            ? (value / total * 100).toFixed(1)
                            : '0.0';

                            return `${code} ${pct}%`;
                        },

                        color: '#111827',
                        font: {
                            size: 12,
                            weight: '600'
                        },

                        // ✅ 放外側（關鍵好看）
                        anchor: 'center',
                        align: 'center',

                        clamp: true, //避免超出邊界
                        textAlign: 'center'
                        }

                    }
                }
            });
        }

        // ===== bar chart =====
        const ctxB = document.getElementById('chart-bar');
        if(ctxB){
            if(charts.bar) charts.bar.destroy();
            const currentOnlyData = s.chartDataSets.filter(ds => ds.label.includes('(現有)'));
            charts.bar = new Chart(ctxB, {
                type: 'bar',
                data: { labels: Array.from({length:12},(_,i)=>i+1+'月'), datasets: currentOnlyData },
                options: {
                    maintainAspectRatio: false,
                    scales: { x: { stacked: true }, y: { stacked: true } },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (context)=> context.dataset.label + ': ' + fmt(context.parsed.y) } },
                        datalabels: {
                            display: false
                        }
                    }
                }
            });
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

        // 3. 【新增】初始化除息前收盤價陣列 (若長度不符則預設補 0)
        if (!p.divClosePrice || !Array.isArray(p.divClosePrice) || p.divClosePrice.length !== mArr.length) {
            p.divClosePrice = new Array(mArr.length).fill(0);
        }

        const inputs = mArr.map((m, dIdx) => {
            const val = p.divs[dIdx] || 0;       // 配息金額
            const dateVal = p.divDates[dIdx] || 15; // 除息日
            const closePriceVal = p.divClosePrice[dIdx] || 0; // 除息前收盤價

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

                <!-- 【新增】除息前收盤價輸入 -->
                <div class="mb-3">
                    <label class="text-[10px] text-slate-400 block mb-0.5">除息前收盤價($)</label>
                    <input type="number" value="${closePriceVal}" step="0.01"
                           class="w-full border border-amber-200 rounded px-2 py-1 text-sm font-mono text-amber-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white" 
                           onchange="updateDivClosePrice(${pIdx}, ${dIdx}, this.value)">
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
// 更新除息前收盤價
function updateDivClosePrice(pIdx, dIdx, val) {
    if (!appData.portfolio[pIdx].divClosePrice) {
        appData.portfolio[pIdx].divClosePrice = [];
    }

    const closePrice = Number(val);
    appData.portfolio[pIdx].divClosePrice[dIdx] = isNaN(closePrice) ? 0 : closePrice;

    saveData();
    renderAll();
}
// ======================== 投資組告清單 ====================
function renderPortfolio() {
    const b = document.getElementById('table-portfolio-body');
    if(!b) return;
    
    const sortedList = [...appData.portfolio].sort((a, b) => {
        const av = getPortfolioSortValue(a, portfolioSortState.key);
        const bv = getPortfolioSortValue(b, portfolioSortState.key);

        if (typeof av === 'string' && typeof bv === 'string') {
            const result = av.localeCompare(bv, 'zh-Hant');
            return portfolioSortState.direction === 'asc' ? result : -result;
        }

        const diff = Number(av) - Number(bv);
        return portfolioSortState.direction === 'asc' ? diff : -diff;
    });

    let totalCost = 0;
    let totalMV = 0;

    b.innerHTML = sortedList.map(p => {
        const mv = p.shares * p.price;
        const pf = mv - p.cost;
        
        totalCost += p.cost;
        totalMV += mv;
        
        const yoc = getYoC(p.cost, p.shares, p.div);
        const cy = getCurrentYield(p.div, p.price);
        const diff = yoc - cy;

        return `<tr class="hover:bg-blue-50"><td class="p-4 font-bold text-blue-600">${p.code}</td><td class="p-4">${p.name}</td><td class="p-4 text-right">${Number(p.shares).toLocaleString()}</td><td class="p-4 text-right text-orange-600">+${Number(p.estShares||0).toLocaleString()}</td><td class="p-4 text-right">${fmt(p.cost)}</td><td class="p-4 text-right">${p.price}</td><td class="p-4 text-right font-bold">${fmt(mv)}</td><td class="p-4 text-right font-bold ${pf>=0?'text-red-500':'text-green-500'}">${fmt(pf)}</td>
    <!-- ✅ 成本殖利率 -->
    <td class="p-4 text-right font-bold text-purple-600">
        ${yoc.toFixed(2)}%
    </td>

    <!-- ✅ 現價殖利率 -->
    <td class="p-4 text-right font-bold text-green-600">
        ${cy.toFixed(2)}%(${diff > 0 ? '+' : ''}${diff.toFixed(2)}%)
    </td>
</tr>`;
    }).join('');

    // ✅ 總損益
    const totalPf = totalMV - totalCost;

    // ✅ 更新 footer
    document.getElementById('total-cost').innerText = fmt(totalCost);
    document.getElementById('total-mv').innerText = fmt(totalMV);

    const pfEl = document.getElementById('total-pf');
    pfEl.innerText = fmt(totalPf);
    pfEl.className = `p-4 text-right ${totalPf>=0?'text-red-500':'text-green-500'}`;

    bindPortfolioSortHandlers();
    updatePortfolioSortIndicators();
}
// ======================== 投資組合再平衡建議 ====================
// ==============================
// 目標配置（請自行調整）
// 重要：key 必須與 getStockType 回傳完全一致：市值型/配息型/其他
// ==============================
const TARGET_ALLOCATION = {
  市值型: 0.4,  
  配息型: 0.6, 
  其他: 0
};

// ==============================
// 工具：安全轉數字
// ==============================
function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

// ==============================
// 工具：市值（用於「資產配置」一致）
// ==============================
function getMarketValue(p) {
  return n(p.shares) * n(p.price);
}

// ==============================
// 1) getRebalanceActions()
//    - 以「市值」計算各分類現況比例（會跟資產配置圖一致）
//    - 以「市值」計算各分類目標市值與差距
//    - 同時產生每檔股票的 base 資料（含所屬類別、市值、價格等）
// ==============================
function getRebalanceActions() {
  const portfolio = Array.isArray(appData?.portfolio) ? appData.portfolio : [];

  const stockBase = portfolio.map(p => {
    const cost = n(p.cost);
    const shares = n(p.shares);
    const dividend = n(p.div);
    const type = getStockType(cost, shares, dividend); 
    const mv = getMarketValue(p);
    return {
      code: p.code,
      name: p.name,
      type,
      price: n(p.price),
      mv,
      shares,
      dividend
    };
  });
  const totalMV = stockBase.reduce((sum, s) => sum + s.mv, 0);

  // 分類現況市值
  const typeMV = { 市值型: 0, 配息型: 0, 其他: 0 };
  stockBase.forEach(s => {
    if (typeMV[s.type] === undefined) typeMV[s.type] = 0;
    typeMV[s.type] += s.mv;
  });

  // 目標比例正規化（避免你填的比例加總不是 1）
  const keys = Object.keys(TARGET_ALLOCATION);
  const ratioSum = keys.reduce((a, k) => a + n(TARGET_ALLOCATION[k]), 0) || 1;
  const normTarget = {};
  keys.forEach(k => normTarget[k] = n(TARGET_ALLOCATION[k]) / ratioSum);

  // 分類目標市值與差距（以市值計）
  const typeSummary = {};
  Object.keys(typeMV).forEach(type => {
    const curMV = typeMV[type] || 0;
    const curPct = totalMV > 0 ? curMV / totalMV : 0;

    const tgtPct = normTarget[type] || 0;
    const tgtMV = totalMV * tgtPct;
    const gapMV = tgtMV - curMV; // >0 代表該類別應加碼

    typeSummary[type] = {
      curMV,
      curPct,
      tgtPct,
      tgtMV,
      gapMV
    };
  });

  return {
    stockBase,
    totalMV,
    typeSummary,
    normTarget
  };
}

const MAX_REBALANCE_RECOMMENDED_STOCKS = 3;

// ==============================
// 2) getBudgetRebalance(base, budget)
//    - 只做「加碼」：找出類別 gapMV>0 的類別
//    - 把這些類別的 gapMV 當成需求，依比例分配預算到各類別
//    - 類別內分配：用「原本該類別中各股票市值占比」維持類內權重
//    - 換成可買股數（floor），並用剩餘預算做「補零碎」
//    - 回傳 actions（每檔建議買幾股、金額） + 匯總
// ==============================
function getBudgetRebalance(base, budget) {
  const B = Math.max(0, n(budget));

  const { stockBase, typeSummary } = base;
  const totalMV = base.totalMV;

  // 找出需要加碼的類別（gapMV>0）
  const positiveTypes = Object.keys(typeSummary)
    .filter(t => (typeSummary[t]?.gapMV || 0) > 0);

  if (positiveTypes.length === 0 || B <= 0 || totalMV <= 0) {
    return {
      actions: [],
      invested: 0,
      remaining: B,
      typeBuy: { 市值型: 0, 配息型: 0, 其他: 0 }
    };
  }

  // 加碼需求總量（以市值差距計）
  const totalNeed = positiveTypes.reduce((sum, t) => sum + typeSummary[t].gapMV, 0);

  // 先算每檔股票「理論應補市值」（由類別 gapMV 分配到類內）
  // 類內權重：以該類別內各股票目前市值占比（維持類內比例）
  const typeStocks = {};
  positiveTypes.forEach(t => {
    typeStocks[t] = stockBase.filter(s => s.type === t && s.price > 0);
  });

  // 每檔理論缺口（僅針對要加碼類別）
  const candidates = [];
  positiveTypes.forEach(t => {
    const list = typeStocks[t];
    if (!list.length) return;

    const typeCurMV = typeSummary[t].curMV || 0;
    const typeGap = typeSummary[t].gapMV || 0;

    list.forEach(s => {
      const marketWeight = typeCurMV > 0 ? (s.mv / typeCurMV) : (1 / list.length);
      const yieldPct = getCurrentYield(n(s.dividend), s.price);
      const maxYield = Math.max(...list.map(item => getCurrentYield(n(item.dividend), item.price)), 0);
      const yieldNorm = maxYield > 0 ? (yieldPct / maxYield) : 0;

      const weightYield = (t === '配息型') ? 0.7 : 0.3;
      const weightMarket = (t === '配息型') ? 0.3 : 0.7;
      const score = (weightYield * yieldNorm) + (weightMarket * marketWeight);
      const stockNeedMV = typeGap * score;

      if (stockNeedMV > 0) {
        candidates.push({
          code: s.code,
          type: s.type,
          price: s.price,
          needMV: stockNeedMV,
          score,
          yieldPct,
          marketWeight
        });
      }
    });
  });

  const totalStockNeed = candidates.reduce((a, c) => a + c.needMV, 0);
  if (totalStockNeed <= 0) {
    return {
      actions: [],
      invested: 0,
      remaining: B,
      typeBuy: { 市值型: 0, 配息型: 0, 其他: 0 }
    };
  }

  const singleStockMode = B <= 10000;

  let actions;
  if (singleStockMode) {
    const ranked = candidates.slice().sort((a, b) => (b.score - a.score) || (b.needMV - a.needMV) || (b.price - a.price));
    const top = ranked[0];

    if (!top) {
      return {
        actions: [],
        invested: 0,
        remaining: B,
        typeBuy: { 市值型: 0, 配息型: 0, 其他: 0 }
      };
    }

    const shares = Math.max(0, Math.floor(B / top.price));
    const amount = shares * top.price;
    actions = [{ ...top, alloc: B, shares, amount }];
  } else {
    // 第一輪：按 needMV 比例分配預算並換算股數
    actions = candidates.map(c => {
      const alloc = B * (c.needMV / totalStockNeed);
      const shares = Math.floor(alloc / c.price);
      const amount = shares * c.price;
      return { ...c, alloc, shares, amount };
    });

    // 算投入/剩餘
    let invested = actions.reduce((s, a) => s + a.amount, 0);
    let remaining = B - invested;

    // 補零碎：用剩餘預算買 1 股 1 股補到「剩餘 need」最大且買得起的
    let guard = 0;
    const MAX_LOOP = 2000;

    while (remaining > 0 && guard < MAX_LOOP) {
      guard++;

      // 還有剩餘需求且買得起 1 股
      const affordable = actions.filter(a => {
        const remainNeed = a.needMV - a.amount;
        return remainNeed >= a.price && a.price <= remaining;
      });

      if (!affordable.length) break;

      affordable.sort((a, b) => (b.needMV - b.amount) - (a.needMV - a.amount));

      const pick = affordable[0];
      pick.shares += 1;
      pick.amount += pick.price;
      remaining -= pick.price;
    }

    invested = actions.reduce((s, a) => s + a.amount, 0);
    remaining = B - invested;

    // 清掉 shares=0，排序（投入金額大者優先）
    actions = actions.filter(a => a.shares > 0).sort((a, b) => b.amount - a.amount);
  }

  actions = actions
    .sort((a, b) => b.amount - a.amount)
    .slice(0, MAX_REBALANCE_RECOMMENDED_STOCKS);

  let invested = actions.reduce((s, a) => s + a.amount, 0);
  let remaining = B - invested;

  // 類別買入金額匯總（你要的「股數×現值」）
  const typeBuy = { 市值型: 0, 配息型: 0, 其他: 0 };
  actions.forEach(a => {
    if (typeBuy[a.type] === undefined) typeBuy[a.type] = 0;
    typeBuy[a.type] += a.amount;
  });

  return { actions, invested, remaining, typeBuy };
}

// ==============================
// 3) renderRebalancePanel()
//    - 建立 UI（預算輸入 + 總覽 + 分類建議 + 個股建議）
//    - input 改變即重算
//    - 分類比例用「市值」顯示，會跟資產配置一致
//    - 分類「建議投入」用 typeBuy（股數×現價）顯示
// ==============================
function renderRebalancePanel() {
  const host = document.getElementById('rebalance-panel-content');
  if (!host) return;

  // 若 UI 尚未建立，先建立一次
  if (!document.getElementById('rebalance-budget')) {
    host.innerHTML = `
      <div class="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <div class="text-xs text-slate-400 mb-1">可投入預算（元）</div>
            <input type="number" id="rebalance-budget" value="10000" min="0"
              class="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm">
            <div class="text-[11px] text-slate-400 mt-1">輸入變更即時計算</div>
          </div>
          <div class="bg-white rounded-lg p-3 border border-slate-200">
            <div class="text-xs text-slate-400">建議投入</div>
            <div id="rebalance-total-invest" class="text-2xl font-bold text-blue-600">0</div>
          </div>
          <div class="bg-white rounded-lg p-3 border border-slate-200">
            <div class="text-xs text-slate-400">剩餘預算</div>
            <div id="rebalance-remaining" class="text-2xl font-bold text-slate-700">0</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div class="font-bold text-slate-800 mb-3">資產配置建議（依市值殖利率基準）</div>
          <div id="rebalance-type" class="space-y-2 text-sm"></div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div class="font-bold text-slate-800 mb-3">建議買入清單（受預算限制）</div>
          <div id="rebalance-stocks" class="space-y-2 text-sm"></div>
        </div>
      </div>
    `;

    // 監聽 input：值一改變就算
    document.getElementById('rebalance-budget').addEventListener('input', () => {
      renderRebalancePanel();
    });
  }

  const budget = n(document.getElementById('rebalance-budget')?.value, 0);

  const totalInvestEl = document.getElementById('rebalance-total-invest');
  const remainingEl = document.getElementById('rebalance-remaining');
  const typeEl = document.getElementById('rebalance-type');
  const stocksEl = document.getElementById('rebalance-stocks');

  // === 核心：呼叫你想善用的兩個 function ===
  const base = getRebalanceActions();                      // 理論（用市值）
  const res = getBudgetRebalance(base, budget);            // 預算限制（可執行）

  // 上方總覽
  if (totalInvestEl) totalInvestEl.textContent = fmt(res.invested);
  if (remainingEl) remainingEl.textContent = fmt(res.remaining);

  // 分類建議：顯示 目前% / 目標% / 距離% + 建議投入（股數×現值）
  const order = ['市值型', '配息型', '其他'];
  if (typeEl) {
    typeEl.innerHTML = order.map(type => {
      const s = base.typeSummary[type] || { curPct: 0, tgtPct: 0 };
      const curPct = (s.curPct * 100).toFixed(1);
      const tgtPct = (s.tgtPct * 100).toFixed(1);
      const dist = ((s.tgtPct - s.curPct) * 100);
      const distTxt = `${dist >= 0 ? '+' : ''}${dist.toFixed(1)}%`;

      const buyAmt = n(res.typeBuy[type], 0);

      let badge = '持有';
      let badgeCls = 'bg-slate-100 text-slate-600';
      if (buyAmt > 0) { badge = '加碼'; badgeCls = 'bg-blue-100 text-blue-700'; }
      else if (dist < -3) { badge = '偏高'; badgeCls = 'bg-red-100 text-red-700'; }

      return `
        <div class="bg-slate-50 px-3 py-2 rounded border border-slate-200">
          <div class="flex justify-between items-center">
            <div class="font-bold text-slate-700 flex items-center gap-2">
              ${type}
              <span class="${badgeCls} text-[11px] px-2 py-0.5 rounded">${badge}</span>
            </div>
            <div class="text-xs text-slate-500">
              目前 ${curPct}% / 目標 ${tgtPct}%
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-400">距離目標</span>
              <span class="${dist >= 0 ? 'text-blue-600' : 'text-red-500'} font-bold">${distTxt}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">建議投入</span>
              <span class="${buyAmt > 0 ? 'text-blue-600' : 'text-slate-600'} font-bold">${fmt(buyAmt)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 個股建議：列出 Top 5（代號、股數、金額）
  if (stocksEl) {
    if (!res.actions.length) {
      stocksEl.innerHTML = (budget <= 0)
        ? `<div class="text-slate-400 text-xs">預算為 0，無法產生買入建議</div>`
        : `<div class="text-slate-400 text-xs">目前配置已接近目標，無需加碼</div>`;
    } else {
      stocksEl.innerHTML = res.actions.slice(0, 5).map((a, i) => `
        <div class="flex justify-between bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
          <div class="flex flex-col">
            <span class="font-bold text-slate-800">${i + 1}. ${a.code}</span>
            <span class="text-[11px] text-slate-500">${a.type}｜單價 ${a.price}｜分數 ${Number(a.score || 0).toFixed(3)}</span>
          </div>
          <div class="text-right">
            <div class="text-blue-700 font-bold">+${a.shares} 股</div>
            <div class="text-[11px] text-slate-600">${fmt(a.amount)}</div>
          </div>
        </div>
      `).join('');
    }
  }
}

// ======================== 投資組合再平衡建議 ====================

// ======================== 配息分析 =============================
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
                        datalabels: {
                            // 只顯示非0數值(每支股票每個月配的數字不同，如果是0代表沒有配，這裡要濾掉)
                            formatter: function(value) {
                                return value > 0
                                    ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value)
                                    : null;
                            }

                        },
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
                                    const totalNew = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(total)

                                    ctx.fillText(totalNew, x, y - 5);
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
// ======================== 配息分析 =============================

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
    const summaryRealized = document.getElementById('short-realized-body'); // ★ 新增：已實現損益表 DOM

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
        let idx = 0 ; 
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
                    <td class="p-3 ">
                    <button
                        onclick="openShortSellModal('${s.code}')"
                        class="px-3 py-1 text-xs rounded bg-red-500 hover:bg-red-600 text-white font-bold">
                        賣出
                    </button>
                    </td>
                </tr>
            `;
            idx++;
        }
        
        if (Object.keys(summaryMap).length === 0) {
            summaryHtml = `<tr><td colspan="5" class="p-4 text-center text-slate-400">尚無部位資料</td></tr>`;
        }
        
        summaryBody.innerHTML = summaryHtml;
    }
    
    // 6.
    if(summaryRealized){
        const sellList = appData.shortTermSell || [];
        
        // 目標 DOM（若不在短期頁/沒放區塊，直接略過）
        const elPL = document.getElementById('short-realized-pl');
        const elCost = document.getElementById('short-realized-cost');
        const elPLP = document.getElementById('short-realized-plp');
        if (!elPL || !elCost || !elPLP) return;
        
        if (!sellList.length) {
            elPL.textContent = fmt(0);
            elCost.textContent = fmt(0);
            elPLP.textContent = '0%';
            summaryRealized.innerHTML = `<tr><td class="p-3 text-slate-400" colspan="9">尚無已實現賣出紀錄</td></tr>`;
            return;
        }

        let totalCost = 0;
        let totalPL = 0;

        const rows = sellList.map(item => {
            const shares = Number(item.shares || 0);
            const costPerShare = Number(item.cost || 0);  // 成本/股
            const sellTotal = Number(item.price || 0);    // 賣出總額 
            const costTotal = Math.round(shares * costPerShare);
            const pl = Math.round(sellTotal - costTotal);
            const plp = costTotal > 0 ? (pl / costTotal) * 100 : 0;
            // 累加收到配息
            const div = shares * Number(item.div || 0 ); 

            totalCost += costTotal;
            totalPL += pl + div; // 損益加上配息金額

            const plClass = pl >= 0 ? 'text-red-600' : 'text-green-600';

            return `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-bold text-blue-600">${item.code || ''}</td>
                <td class="p-3">${item.name || ''}</td>
                <td class="p-3">${item.date || ''}</td>
                <td class="p-3 text-right">${shares.toLocaleString()}</td>
                <td class="p-3 text-right">${costPerShare.toFixed(3)}</td>
                <td class="p-3 text-right">${fmt(costTotal)}</td>
                <td class="p-3 text-right">${fmt(sellTotal)}</td>
                <td class="p-3 text-right font-bold ${plClass}">${fmt(pl)}</td>
                <td class="p-3 text-right font-bold ${plClass}">${fmt(div)}</td>
                <td class="p-3 text-right ${plClass}">${plp.toFixed(2)}%</td>
            </tr>
            `;
        }).join('');
        
        const totalPLP = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
        const totalPLClass = totalPL >= 0 ? 'text-red-700' : 'text-green-700';

        elPL.className = `text-2xl font-bold ${totalPLClass}`;
        elPL.textContent = fmt(totalPL);
        elCost.textContent = fmt(totalCost);
        elPLP.textContent = `${totalPLP.toFixed(2)}%`;

        summaryRealized.innerHTML = rows;


    }
}
// ==================== 短期策略賣出彈框相關邏輯 ====================
let currentSellIndex = null;

// 開啟賣出彈框
function openShortSellModal(code) {
    // 1) 找出 shortTerm 中「同代號」的候選清單，保留原本 index
    const candidates = (appData.shortTerm || [])
        .map((item, idx) => ({ item, idx }))
        .filter(x => String(x.item.code) === String(code));

    if (!candidates.length) {
        alert(`找不到短期部位：${code}`);
        return;
    }

    // 2) 依日期由舊到新排序，取第一筆
    //    若 date 空/無效，放到最後（避免 NaN 影響排序）
    candidates.sort((a, b) => {
        const ta = Date.parse(a.item.date);
        const tb = Date.parse(b.item.date);
        const va = Number.isFinite(ta) ? ta : Number.POSITIVE_INFINITY;
        const vb = Number.isFinite(tb) ? tb : Number.POSITIVE_INFINITY;
        return va - vb;
    });

    const picked = candidates[0];
    const item = picked.item;
    currentSellIndex = picked.idx; // ✅ 記住原陣列 index，儲存時 splice 用這個


  
    // 3) 帶入 Modal（代號不可編輯）
    document.getElementById('sell-code').value = item.code;
    document.getElementById('sell-name').value = item.name;
    document.getElementById('sell-shares').value = item.shares;
    document.getElementById('sell-cost').value = item.cost;

    // 預設賣出日期 = 今天
    document.getElementById('sell-date').value = new Date().toISOString().split('T')[0];

    document.getElementById('sell-total').value = '';
    document.getElementById('sell-div').value = 0;

    // 4) 開啟彈框
    const modal = document.getElementById('short-sell-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// 關閉彈框（只能取消或儲存）
function closeShortSellModal() {
  currentSellIndex = null;
  document.getElementById('short-sell-modal').classList.add('hidden');
  document.getElementById('short-sell-modal').classList.remove('flex');
}

// 確認賣出
function confirmShortSell() {
  if (currentSellIndex === null) return;

  const item = appData.shortTerm[currentSellIndex];

  const sellObj = {
    code: item.code,
    name: item.name,
    date: document.getElementById('sell-date').value,
    shares: item.shares,
    cost: item.cost,
    price: Number(document.getElementById('sell-total').value),
    divdend: Number(document.getElementById('sell-div').value)
  };

  if (!sellObj.date || !sellObj.price) {
    alert('請填寫賣出日期與賣出總額');
    return;
  }

  // ✅ 寫入 shortTermSell
  if (!appData.shortTermSell) appData.shortTermSell = [];
  appData.shortTermSell.unshift(sellObj);

  // ✅ 從 shortTerm 移除 先進先出那筆資料（index 用 currentSellIndex）
  appData.shortTerm.splice(currentSellIndex, 1);

  saveData();
  closeShortSellModal();

  // ✅ 立即重算畫面
  renderShortTerm();
}
// ==================== 短期策略相關邏輯 ====================

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

// 計算成本殖利率 (YoC) 總成本,張數,每股股利\
// 殖利率 = 年股利 ÷ 買入成本
function getYoC(cost, shares, dividend){
    if(!cost || !shares) return 0;

    const totalDividend = shares * dividend;
    return (totalDividend / cost) * 100;
}

// 現價殖利率（Current Yield）
//殖利率 = 年股利 ÷ 當前股價
function getCurrentYield(dividend, currentPrice){
    if(!currentPrice) return 0;
    return (dividend / currentPrice) * 100;
}

//判斷股票是什麼類型：如成本殖利率 > 6% 就是配息型，> 0%就是市值型，暫沒有其他投資(如債券)
// targetYield 預設值 "yoc" 代表以成本殖利率作為判斷依據，反之用現價殖利率作為判斷依據
function getStockType(myPrice,shares, dividend,targetYield = "yoc"){
    let value = 0;
    if(targetYield === "yoc"){
        value = getYoC(myPrice, shares, dividend);
    }
    else if(targetYield === "current"){
        value = getCurrentYield(dividend, myPrice); // 以平均成本作為價格基準
    }
    const typeOrder = ['市值型', '配息型', '其他'];
    if (value >= 6) {
        return '配息型';
    } else if (value > 0) {
        return '市值型';
    }   else {      
        return '其他';
    }
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
        let yoc = getYoC(p.cost,p.shares, dividend);

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
            currentYield = getCurrentYield(dividend / currentPrice);
        }

        // 判定是否觸發買入訊號
        const isBuyZone = (targetPrice > 0 && currentPrice > 0 && currentPrice <= targetPrice);
        
        // 買入訊號 HTML
        const buySignalHtml = isBuyZone 
            ? `<span class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse z-10">BUY</span>` 
            : '';

        // 現價顏色
        const priceColorClass = isBuyZone ? 'text-red-600 font-bold' : 'text-slate-700';
        // <!-- 7. 【新增】成本殖利率 (YoC) -->
        // <!-- 使用唯讀欄位顯示，並加上不同顏色背景強調 -->
        // <td class="p-2 w-24 align-middle bg-indigo-50/30">
        //     <div class="flex items-center justify-end px-2 py-1.5 border border-indigo-100 rounded bg-indigo-50">
        //         <span class="text-indigo-700 font-bold font-mono text-sm">${yoc.toFixed(2)}%</span>
        //     </div>
        // </td>
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
    all: 'https://woker-stock-all.hebeplkj.workers.dev/',
    last: 'https://querydividend.hebeplkj.workers.dev/api/new', //最新配息資料
    stock: 'https://querydividend.hebeplkj.workers.dev/api/stock'
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


// --- 6. 證交所 API 查詢除息 ---
//header Key
const API_KEY = 'TWSE_D1_v1_Nr8xP7Kq4Lm2Yw9Zj5Hs6Bc3Fd1Qa8R';

async function fetchTwseDivdendData() {
    const keyword = document
        .getElementById('stockCodeDivdend')
        .value
        .trim()
        .toUpperCase();

    const msgDiv = document.getElementById('twse-messageDivdend');
    const loadingDiv = document.getElementById('twse-loadingDivdend');
    const resultsDiv = document.getElementById('twse-resultsDivdend');
    const statsDiv = document.getElementById('twse-statsDivdend');
    const btn = document.getElementById('queryBtnDivdend');

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
		// 加入 API KEY Header
        let url = API_CONFIG.last
        if(keyword)
            url = `${API_CONFIG.stock}?code=${encodeURIComponent(keyword)}`;

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            }
        });
        
        if (!res.ok) throw new Error(`HTTP 錯誤! 狀態: ${res.status}`);
        
        const rawData = await res.json();
        
        // 2. 確保資料格式正確 (假設回傳的是一個大陣列)
        let allData = [];

		if (rawData.success && Array.isArray(rawData.data)) {
			allData = rawData.data;
		}

        // ADD 增加計算YoC
        allData = allData.map(p => ({
            ...p,
            YoC: getCurrentYield(
                Number(p.CashDividend || 0),
                Number(p.ClosingPrice || 0)
            ).toFixed(2)
        }));

        // 4. 自動將查詢結果同步回股利政策設定
        const updatedStockCount = syncDividendPolicyFromTwseResult(allData);

        if (updatedStockCount > 0) {
            msgDiv.innerHTML = `<div class="bg-green-50 text-green-700 p-3 rounded text-sm border border-green-200">已同步更新 ${updatedStockCount} 筆股票到股利政策詳細設定。</div>`;
        } else {
            msgDiv.innerHTML = '<div class="bg-blue-50 text-blue-600 p-3 rounded text-sm border border-blue-200">查詢成功，但未找到可同步的持股資料。</div>';
        }

        currentDividendData = allData;
        currentDividendApiType = apiType;

        // 3. 顯示結果
        displayTwseDivdendResults(allData, apiType);

    } catch (err) {
        msgDiv.innerHTML = `<div class="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">查詢失敗：${err.message}</div>`;
        console.error(err);
    } finally {
        loadingDiv.classList.add('hidden'); 
        btn.disabled = false; 
        btn.classList.remove('opacity-50');
    }
}

function getDividendSortValue(item, key) {
    switch (key) {
        case 'Date': return String(item.Date || '');
        case 'Code': return String(item.Code || '');
        case 'Name': return String(item.n || item.Name || item.name || '');
        case 'CashDividend': return Number(item.CashDividend || 0);
        case 'StockDividendRatio': return Number(item.StockDividendRatio || 0);
        case 'ClosingPrice': return Number(item.ClosingPrice || 0);
        case 'YoC': return Number(item.YoC || 0);
        case 'UpdateTime': return new Date(item.UpdateTime || 0).getTime();
        case 'PriceDate': return String(item.PriceDate || '');
        default: return 0;
    }
}

function sortDividendTable(key) {
    if (dividendSortState.key === key) {
        dividendSortState.direction = dividendSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        dividendSortState.key = key;
        dividendSortState.direction = ['Date', 'Code', 'Name', 'PriceDate'].includes(key) ? 'asc' : 'desc';
    }

    const rows = [...currentDividendData].sort((a, b) => {
        const av = getDividendSortValue(a, dividendSortState.key);
        const bv = getDividendSortValue(b, dividendSortState.key);

        if (typeof av === 'string' && typeof bv === 'string') {
            const result = av.localeCompare(bv, 'zh-Hant');
            return dividendSortState.direction === 'asc' ? result : -result;
        }

        const diff = Number(av) - Number(bv);
        return dividendSortState.direction === 'asc' ? diff : -diff;
    });

    displayTwseDivdendResults(rows, currentDividendApiType);
}

// 更新配息政策
function syncDividendPolicyFromTwseResult(results) {
    if (!Array.isArray(results) || !Array.isArray(appData?.portfolio)) return 0;

    let updatedCount = 0;

    results.forEach(item => {
        const stockCode = String(item.Code || '').trim();
        const targetStock = appData.portfolio.find(p => String(p.code) === stockCode);
        if (!targetStock) return;

        const dateStr = String(item.Date || '').trim();
        const dateDigits = dateStr.replace(/\D/g, '');
        if (!dateDigits || dateDigits.length < 4) return;

        const month = Number(dateDigits.slice(-4, -2));
        const day = Number(dateDigits.slice(-2));
        if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
            return;
        }

        let months = [];
        if (typeof targetStock.months === 'string') {
            months = targetStock.months.split(',').map(m => parseInt(m.trim(), 10)).filter(m => Number.isInteger(m));
        }
        if (!months.includes(month)) {
            months.push(month);
            months.sort((a, b) => a - b);
            targetStock.months = months.join(',');
        }

        const mIdx = months.indexOf(month);
        if (!Array.isArray(targetStock.divs)) targetStock.divs = [];
        if (!Array.isArray(targetStock.divDates)) targetStock.divDates = [];
        if (!Array.isArray(targetStock.divClosePrice)) targetStock.divClosePrice = [];

        while (targetStock.divs.length < months.length) targetStock.divs.push(0);
        while (targetStock.divDates.length < months.length) targetStock.divDates.push(15);
        while (targetStock.divClosePrice.length < months.length) targetStock.divClosePrice.push(0);

        const cashDividend = Number(item.CashDividend ?? 0);
        const closePrice = Number(item.ClosingPrice ?? item.ClosePrice ?? 0);

        const hadChanged =
            (cashDividend > 0 && Number(targetStock.divs[mIdx] || 0) !== cashDividend) ||
            (closePrice > 0 && Number(targetStock.divClosePrice[mIdx] || 0) !== closePrice) ||
            Number(targetStock.divDates[mIdx] || 15) !== day;

        if (cashDividend > 0) targetStock.divs[mIdx] = cashDividend;
        if (closePrice > 0) targetStock.divClosePrice[mIdx] = closePrice;
        targetStock.divDates[mIdx] = day;
        targetStock.div = (targetStock.divs || []).reduce((sum, value) => sum + Number(value || 0), 0);

        if (hadChanged) updatedCount++;
    });

    saveData();
    return updatedCount;
}

function displayTwseDivdendResults(data, apiType) {
    const resultsDiv = document.getElementById('twse-resultsDivdend');
    const msgDiv = document.getElementById('twse-messageDivdend');
    const statsDiv = document.getElementById('twse-statsDivdend');

    if (!data || data.length === 0) {
        msgDiv.innerHTML = '<div class="bg-blue-50 text-blue-600 p-3 rounded text-sm">查無符合類型的資料</div>';
        return;
    }

    resultsDiv.classList.remove('hidden');
    statsDiv.classList.remove('hidden');

    const label = (text, key) => {
        const active = dividendSortState.key === key;
        const arrow = active ? (dividendSortState.direction === 'asc' ? ' ↑' : ' ↓') : '';
        return `${text}${arrow}`;
    };

    let html = `
        <div class="flex justify-between items-center p-3 bg-gray-50 border-b sticky left-0">
            <div class="text-sm text-gray-500">
                共找到 <b id="totalCountDivdend">${data.length}</b> 筆資料
            </div>

            <div class="relative">
                <input
                    type="text"
                    id="stockSearchDivdend"
                    placeholder="搜尋股票代號或名稱..."
                    class="w-64 pl-3 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
            </div>
        </div>
        <table class="w-full text-left whitespace-nowrap border-collapse">
            <thead class="bg-teal-50 text-teal-800 text-sm font-bold">
                <tr>
                    <!-- 關鍵修改：加入 sticky top-0 z-10 來凍結標題 -->
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('Date')">${label('除息日', 'Date')}</th>
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('Code')">${label('股票代號', 'Code')}</th>
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('Name')">${label('名稱', 'Name')}</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('CashDividend')">${label('現金股利', 'CashDividend')}</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('StockDividendRatio')">${label('股票股利', 'StockDividendRatio')}</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('ClosingPrice')">${label('最新收盤價', 'ClosingPrice')}</th>
                    <th class="p-3 text-right sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('YoC')">${label('現金殖利率', 'YoC')}</th>
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('UpdateTime')">${label('股利更新時間', 'UpdateTime')}</th>
                    <th class="p-3 sticky top-0 z-10 bg-teal-50 border-b border-teal-200 shadow-sm cursor-pointer select-none" onclick="sortDividendTable('PriceDate')">${label('收盤更新時間', 'PriceDate')}</th>
                </tr>
            </thead>
            <tbody id="dividendTableBody" class="divide-y divide-gray-100 text-sm">`;

    let totalVol = 0;
    data.forEach(item => {
        // 1. 欄位對應
        const code = item.Code || '-';
        const name = item.n || item.Name || item.name || '-';        
		// 除息日
        const exDate = item.Date || '-';
		const logTime = item.UpdateTime
		? new Date(item.UpdateTime).toLocaleString('zh-TW')
		: '-';
        
        // 2. 數值處理
        const stockDivid = parseFloat(item.StockDividendRatio || '0' );
        const CashDivid = parseFloat(item.CashDividend || '0');

        // 收盤價更新日期、收盤價、Yoc
        const closePrice = parseFloat(item.ClosingPrice || '0' );
		const priceTime = item.PriceDate ||  '-';
        const yoc = item.YoC || '0';


        html += `
            <tr class="hover:bg-gray-50 transition-colors" data-code="${code}" data-name="${name}">
                <td class="p-3 font-bold text-slate-700">
                    ${exDate}
                </td>
                <td class="p-3 font-medium">${code}</td>
                <td class="p-3 font-bold">${name}</td>
                <td class="p-3 text-right ">${CashDivid}</td>
                <td class="p-3 text-right ">${stockDivid}</td>
                <td class="p-3 text-right ">${closePrice}</td>
                <td class="p-3 text-right ">${yoc}%</td>
                <td class="p-3 text-slate-500">${logTime}</td>
                <td class="p-3 text-slate-500">${priceTime}</td>
            </tr>`;
            
    });

    html += '</tbody></table>';
    resultsDiv.innerHTML = html;

    document.getElementById('totalCountDivdend').textContent = data.length;
}

function clearTwseDivdendResults() {
    document.getElementById('stockCodeDivdend').value = '';
    document.getElementById('twse-messageDivdend').innerHTML = '';
    document.getElementById('twse-resultsDivdend').innerHTML = '';
    document.getElementById('twse-resultsDivdend').classList.add('hidden');
    document.getElementById('twse-statsDivdend').classList.add('hidden');
}

// --- 7. 全局初始化 ---
function renderAll() { 
    renderDashboard(); 
    renderPortfolio(); 
    renderRebalancePanel(); // 新增再平衡面板渲染
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
        if(t === 'twse' || t === 'twse-div') b.classList.add('active', 'bg-teal-600', 'text-white');
        else if(t === 'div-settings') b.classList.add('active', 'bg-purple-600', 'text-white');
        else if(t === 'short') b.classList.add('active', 'bg-orange-600', 'text-white'); // 新增這行
        else b.classList.add('active', 'bg-blue-600', 'text-white');
    }
    
    if(t==='dashboard') renderDashboard(); 
    else if(t==='portfolio') {
        renderPortfolio();
        renderRebalancePanel();
    }
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

// --- 8.手機版下拉選單控制邏輯 ---

// 1. 切換選單顯示/隱藏
// ✅ 主要功能選單（≡）
function toggleMainMenu() {
  const mainDD = document.getElementById('mobile-main-dropdown');
  const adminDD = document.getElementById('mobile-menu-dropdown');
  if (!mainDD) return;

  // 打開主要功能時，關閉後台選單
  if (adminDD) adminDD.classList.add('hidden');

  mainDD.classList.toggle('hidden');
}
// ✅ 後台選單
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

// 除權息頁事件綁定
function filterDividendTable(keyword) {

    keyword = keyword.toLowerCase();

    const rows = document.querySelectorAll(
        '#dividendTableBody tr'
    );

    let visibleCount = 0;

    rows.forEach(row => {

        const code =
            row.dataset.code?.toLowerCase() || '';

        const name =
            row.dataset.name?.toLowerCase() || '';

        const match =
            code.includes(keyword) ||
            name.includes(keyword);

        row.style.display =
            match ? '' : 'none';

        if (match) visibleCount++;
    });

    document.getElementById(
        'totalCountDivdend'
    ).textContent = visibleCount;
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

    // 動態html物件的事件綁定
    document.addEventListener('input', (e) => {

        if (e.target.id === 'stockSearchDivdend') {
            filterDividendTable(e.target.value);
        }

    });


    switchTab('dashboard'); 
});

