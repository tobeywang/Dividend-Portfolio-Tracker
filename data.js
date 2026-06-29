const DEFAULT_DATA = {
    "budget": 2120000,
    "portfolio": [
        {
            "id": 1,
            "code": "0050",
            "name": "元大台灣50(國泰證+中信證)",
            "cost": 470273,
            "shares": 9429,
            "estShares": 0,
            "div": 1.3599999999999999,
            "divs": [
                1,
                0.36
            ],
            "price": 103.1,
            "months": "1,7",
            "divDates": [
                22,
                21
            ],
            "saveBank": "中信",
            "targetPrice": 90.67,
            "targetYield": 1.5
        },
        {
            "id": 2,
            "code": "00878",
            "name": "國泰永續高股息",
            "cost": 400235,
            "shares": 18000,
            "estShares": 0,
            "div": 1.88,
            "divs": [
                0.42,
                0.66,
                0.4,
                0.4
            ],
            "price": 32.71,
            "months": "2,5,8,11",
            "divDates": [
                26,
                19,
                18,
                18
            ],
            "saveBank": "台新",
            "targetPrice": 23.5,
            "targetYield": 8
        },
        {
            "id": 3,
            "code": "00713",
            "name": "元大高息低波",
            "cost": 103317,
            "shares": 2000,
            "estShares": 0,
            "div": 3.96,
            "divs": [
                1.4,
                1,
                0.78,
                0.78
            ],
            "price": 59.65,
            "months": "3,6,9,12",
            "divDates": [
                21,
                22,
                19,
                19
            ],
            "saveBank": "台灣",
            "targetPrice": 49.5,
            "targetYield": 8
        },
        {
            "id": 5,
            "code": "0056",
            "name": "元大高股息",
            "cost": 307380,
            "shares": 8000,
            "estShares": 1000,
            "div": 3.5980000000000003,
            "divs": [
                0.866,
                1,
                0.866,
                0.866
            ],
            "price": 51.45,
            "months": "1,4,7,10",
            "divDates": [
                22,
                23,
                21,
                23
            ],
            "saveBank": "中信",
            "targetPrice": 35.98,
            "targetYield": 10
        },
        {
            "id": 6,
            "code": "00919",
            "name": "群益台灣精選",
            "cost": 143114,
            "shares": 6000,
            "estShares": 0,
            "div": 2.8600000000000003,
            "divs": [
                0.78,
                1,
                0.54,
                0.54
            ],
            "price": 29.56,
            "months": "3,6,9,12",
            "divDates": [
                18,
                16,
                16,
                16
            ],
            "saveBank": "中信",
            "targetPrice": 23.83,
            "targetYield": 12
        },
        {
            "id": 8,
            "code": "2882",
            "name": "國泰金",
            "cost": 35000,
            "shares": 1000,
            "estShares": 0,
            "div": 3.5,
            "divs": [
                3.5
            ],
            "price": 106,
            "months": "6",
            "divDates": [
                30
            ],
            "saveBank": "國泰",
            "targetPrice": 70,
            "targetYield": 5
        }
    ],
    "transactions": [
        {
            "date": "2026-06-24",
            "code": "0050",
            "type": "Buy",
            "shares": 132,
            "price": 106.35,
            "total": 14038
        },
        {
            "date": "2026-04-27",
            "code": "0056",
            "type": "Buy",
            "shares": 2000,
            "price": 40.9,
            "total": 81800
        },
        {
            "date": "2026-03-05",
            "code": "00919",
            "type": "Buy",
            "shares": 2000,
            "price": 23.97,
            "total": 47940
        },
        {
            "date": "2026-03-24",
            "code": "00919",
            "type": "Buy",
            "shares": 1000,
            "price": 22.4,
            "total": 22400
        },
        {
            "date": "2026-01-21",
            "code": "0056",
            "type": "Buy",
            "shares": 2000,
            "price": 38.26,
            "total": 76520
        },
        {
            "date": "2026-01-21",
            "code": "0050",
            "type": "Buy",
            "shares": 1000,
            "price": 71.95,
            "total": 71950
        },
        {
            "date": "2026-01-05",
            "code": "00713",
            "type": "Buy",
            "shares": 770,
            "price": 50.61,
            "total": 38977
        },
        {
            "date": "2026-01-05",
            "code": "0056",
            "type": "Buy",
            "shares": 2000,
            "price": 37.2,
            "total": 74409
        },
        {
            "date": "2026-01-05",
            "code": "00878",
            "type": "Buy",
            "shares": 1000,
            "price": 21.9,
            "total": 21908
        },
        {
            "date": "2026-12-30",
            "code": "0050",
            "type": "Buy",
            "shares": 502,
            "price": 65.22,
            "total": 32743
        },
        {
            "date": "2026-01-08",
            "code": "00878",
            "type": "Buy",
            "shares": 1000,
            "price": 22.12,
            "total": 22128
        },
        {
            "date": "2026-01-09",
            "code": "0056",
            "type": "Buy",
            "shares": 2000,
            "price": 37.29,
            "total": 74589
        },
        {
            "date": "2026-02-25",
            "code": "00919",
            "type": "Buy",
            "shares": 3000,
            "price": 24.24,
            "total": 72749
        }
    ],
    "fundTransactions": [
        {
            "id": 1782350970279,
            "date": "2026-06-15",
            "name": "0050連結累積",
            "type": "Buy",
            "nav": 64.15,
            "units": 77.9,
            "amount": 5000,
            "fee": 0,
            "total": 5000
        },
        {
            "id": 1777348287968,
            "date": "2026-05-15",
            "name": "0050連結累積",
            "type": "Buy",
            "nav": 58.3,
            "units": 85.8,
            "amount": 5000,
            "fee": 0,
            "total": 5000
        },
        {
            "id": 1777348287968,
            "date": "2026-04-15",
            "name": "0050連結累積",
            "type": "Buy",
            "nav": 51.44,
            "units": 97.2,
            "amount": 5000,
            "fee": 0,
            "total": 5000
        },
        {
            "id": 1774404048408,
            "date": "2026-03-16",
            "name": "0050連結累積",
            "type": "Buy",
            "nav": 46,
            "units": 108.7,
            "amount": 5000,
            "fee": 0,
            "total": 5000
        },
        {
            "id": 1772414487007,
            "date": "2026-02-23",
            "name": "0050連結累積",
            "type": "Buy",
            "nav": 47.02,
            "units": 106.3,
            "amount": 5000,
            "fee": 0,
            "total": 5000
        },
        {
            "id": 1768718753300,
            "date": "2026-01-15",
            "name": "0050連結累積",
            "type": "Buy",
            "nav": 42.36,
            "units": 236.1,
            "amount": 10000,
            "fee": 0,
            "total": 10000
        }
    ],
    "shortTermTargetDate": "2026-05-31",
    "shortTerm": [
        {
            "code": "0050",
            "name": "元大台灣50",
            "date": "2026-04-29",
            "shares": 1000,
            "cost": 91.65,
            "price": 103.1
        }
    ],
    "shortTerm_history": [
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-01-21",
            "shares": 1000,
            "cost": 38.394,
            "price": 44.85
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-01-21",
            "shares": 5000,
            "cost": 38.3044,
            "price": 44.85
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-01-22",
            "shares": 2000,
            "cost": 37.91,
            "price": 44.85
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-02-02",
            "shares": 2000,
            "cost": 37.08,
            "price": 44.85
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-03-04",
            "shares": 3000,
            "cost": 37.76,
            "price": 44.85
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-03-10",
            "shares": 2000,
            "cost": 37.85,
            "price": 44.85
        },
        {
            "code": "0050",
            "name": "元大台灣50",
            "date": "2026-04-28",
            "shares": 1000,
            "cost": 93,
            "price": 97
        },
        {
            "code": "0050",
            "name": "元大台灣50",
            "date": "2026-04-29",
            "shares": 1000,
            "cost": 90.3,
            "price": 97
        }
    ],
    "shortTermSell": [
        {
            "code": "00713",
            "name": "元大台灣高息低波",
            "date": "2026-04-17",
            "shares": 1000,
            "cost": 51.973,
            "price": 53870,
            "div": 1.4
        },
        {
            "code": "0050",
            "name": "元大台灣50",
            "date": "2026-05-14",
            "shares": 1000,
            "cost": 91.65,
            "price": 95818,
            "div": 0
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-05-14",
            "shares": 15000,
            "cost": 37.93,
            "price": 678364,
            "div": 1.3464
        }
    ]
};
