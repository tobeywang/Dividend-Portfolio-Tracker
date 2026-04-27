const DEFAULT_DATA = {
    "budget": 2120000,
    "portfolio": [
        {
            "id": 1,
            "code": "0050",
            "name": "元大台灣50",
            "cost": 360980,
            "shares": 8217,
            "estShares": 0,
            "div": 1.3599999999999999,
            "divs": [
                1,
                0.36
            ],
            "price": 89.95,
            "months": "1,7",
            "divDates": [
                22,
                21
            ],
            "saveBank": "中信",
            "targetPrice": 68,
            "targetYield": 2
        },
        {
            "id": 2,
            "code": "00878",
            "name": "國泰永續高股息",
            "cost": 400235,
            "shares": 18000,
            "estShares": 0,
            "div": 1.69,
            "divs": [
                0.42,
                0.47,
                0.4,
                0.4
            ],
            "price": 25,
            "months": "2,5,8,11",
            "divDates": [
                26,
                19,
                18,
                18
            ],
            "saveBank": "台新",
            "targetPrice": 21.13,
            "targetYield": 8
        },
        {
            "id": 3,
            "code": "00713",
            "name": "元大高息低波",
            "cost": 103317,
            "shares": 2000,
            "estShares": 0,
            "div": 4.0600000000000005,
            "divs": [
                1.4,
                1.1,
                0.78,
                0.78
            ],
            "price": 53.45,
            "months": "3,6,9,12",
            "divDates": [
                21,
                20,
                19,
                19
            ],
            "saveBank": "台灣",
            "targetPrice": 50.75,
            "targetYield": 8
        },
        {
            "id": 4,
            "code": "006208",
            "name": "富邦台50",
            "cost": 19577,
            "shares": 200,
            "estShares": 0,
            "div": 4.437,
            "divs": [
                0.989,
                3.448
            ],
            "price": 208.95,
            "months": "7,11",
            "divDates": [
                16,
                18
            ],
            "saveBank": "第一",
            "targetPrice": 147.9,
            "targetYield": 3
        },
        {
            "id": 5,
            "code": "0056",
            "name": "元大高股息",
            "cost": 307380,
            "shares": 8000,
            "estShares": 0,
            "div": 3.5980000000000003,
            "divs": [
                0.866,
                1,
                0.866,
                0.866
            ],
            "price": 40.95,
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
            "div": 2.58,
            "divs": [
                0.78,
                0.72,
                0.54,
                0.54
            ],
            "price": 23.5,
            "months": "3,6,9,12",
            "divDates": [
                18,
                17,
                16,
                16
            ],
            "saveBank": "中信",
            "targetPrice": 21.5,
            "targetYield": 12
        }
    ],
    "transactions": [
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
            "id": 1776911710755,
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
    "shortTermTargetDate": "2026-04-30",
    "shortTerm": [
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-01-21",
            "shares": 1000,
            "cost": 38.394,
            "price": 40.95
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-01-21",
            "shares": 5000,
            "cost": 38.3044,
            "price": 40.95
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-01-22",
            "shares": 2000,
            "cost": 37.91,
            "price": 40.95
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-02-02",
            "shares": 2000,
            "cost": 37.08,
            "price": 40.95
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-03-04",
            "shares": 3000,
            "cost": 37.76,
            "price": 40.95
        },
        {
            "code": "0056",
            "name": "元大高股息",
            "date": "2026-03-10",
            "shares": 2000,
            "cost": 37.85,
            "price": 40.95
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
            "divdend": 1.4
        }
    ]
};
