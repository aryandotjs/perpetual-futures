import { WebSocket } from "ws"
import { createClient } from "redis"

const binanceUrl = 'wss://fstream.binance.com/market/stream'
const coinBaseUrl = 'wss://advanced-trade-ws.coinbase.com'
const buyBitUrl = 'wss://stream.bybit.com/v5/public/linear'


const binanceMess = {
    "method": "SUBSCRIBE",
    "params": [
        "btcusdt@aggTrade",
        "ethusdt@aggTrade"
    ],
    "id": "e9d6b4349871b40611412680b3445fac"
}

const buyBitMess = {
    "op": "subscribe",
    "args": ["publicTrade.BTCUSDT", "publicTrade.ETHUSDT"]
}
const coinBaseMess = {
    "type": "subscribe",
    "product_ids": ["BTC-USD", "ETH-USD"],
    "channel": "ticker"
}

const redisClient = createClient({ url: "redis://localhost:6379" })

async function connectClient() {
    if (!redisClient.isOpen) {
        await redisClient.connect()
        console.log("Connected to Redis!");
    }
}
let count = 0
let sec = 0

setInterval(() => {
    console.log("============================================================================================", count, sec)
    sec++
}, 1000);
connectClient()

const priceMap = new Map()



function connectBinance() {

    const binanceWS = new WebSocket(binanceUrl)

    binanceWS.on("open", (ws: any) => {
        console.log("client connected 1")
        binanceWS.send(JSON.stringify(binanceMess))
    })

    binanceWS.on("message", (data: any) => {
        try {
            const a = JSON.parse(data)
            if (a.data && a.stream) {
                const stream = a.stream.slice(0, 3).toUpperCase()

                const lastPrice = priceMap.get(stream + "binance")

                if (lastPrice != a.data.p) {
                    priceMap.set(stream + "binance", a.data.p)
                    getAvgPriceAndPublish(stream)
                    console.log("binance")

                }

            }
        } catch (error) {
            console.error("Failed to parse Binance message", error);
        }
    })

    binanceWS.on("close", () => {
        console.log("client 1 connection closed , reconnecting in 3s ...")
        setTimeout(connectBinance, 3000);
    })
}

function connectBuybit() {
    const buybitWS = new WebSocket(buyBitUrl)
    buybitWS.on("open", (cl: any) => {

        console.log("client connected 2")

        buybitWS.send(JSON.stringify(buyBitMess))

    })

    buybitWS.on("message", (data: any) => {
        const a = JSON.parse(data)

        if (a.data) {
            a.data.forEach((a: any) => {
                if (a.s) {
                    const stream = a.s.slice(0, 3)

                    const lastPrice = priceMap.get(stream + "buybit")

                    if (lastPrice != a.p) {
                        priceMap.set(stream + "buybit", a.p)
                        getAvgPriceAndPublish(stream)
                        console.log("buyBitUrl")
                    }
                }
            })
        }
    })

    buybitWS.on("close", () => {
        console.log("client 2 connection closed , reconnecting in 3s ...")
        setTimeout(connectBuybit, 3000);
    })
}

function connectCoinBase() {
    const coinBaseWS = new WebSocket(coinBaseUrl)
    coinBaseWS.on("open", (cl: any) => {
        console.log("client connected 3")
        coinBaseWS.send(JSON.stringify(coinBaseMess))
    })

    coinBaseWS.on("message", (data: any) => {
        const a = JSON.parse(data)
        if (a.events && a.events[0]) {

            a.events.forEach((a: any) => {
                if (a.tickers) {

                    a.tickers.forEach((t: any) => {
                        const stream = t.product_id.slice(0, 3)
                        const lastPrice = priceMap.get(stream + "coinBase")

                        if (lastPrice != t.price) {
                            priceMap.set(stream + "coinBase", t.price)
                            getAvgPriceAndPublish(stream)
                            console.log("coinbae")
                        }

                    })


                }
            })
        }
    })

    coinBaseWS.on("close", () => {
        console.log("client 3 connection closed , reconnecting in 3s ...")
        setTimeout(connectCoinBase, 3000);
    })
}


async function getAvgPriceAndPublish(market: string) {

    const buybit = priceMap.get(market + "buybit")
    const binance = priceMap.get(market + "binance")
    const coinBase = priceMap.get(market + "coinBase")

    if (binance && buybit && coinBase) {

        const avgPrice = (Number(binance) + Number(buybit) + Number(coinBase)) / 3
        console.log(avgPrice, market)
        count++
        try {
            await redisClient.xAdd("stream:prices", "*", {
                market,
                price: avgPrice.toFixed(2).toString()
            }, {
                TRIM: {
                    strategy: 'MAXLEN',
                    strategyModifier: "~",
                    threshold: 1000
                }
            })
        } catch (error) {
            console.log(`failed to stream`, error)
        }
    }
    return "not enough data to calculate"
}



connectCoinBase()
connectBinance()
connectBuybit()
