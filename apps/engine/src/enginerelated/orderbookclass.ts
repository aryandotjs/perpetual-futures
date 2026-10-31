import { order } from "../../../../packages/common/src";


export type fill = {
    market: string
    price: string,
    matchedQuantity: string

    takerUserId: string
    takerOrderId: string
    takerLevrage: string

    makerUserId: string
    makerOrderId: string,
    makerLevrage: string

    isMakerBuyer: boolean
}

export class Orderbook {
    bids: order[];
    asks: order[];
    asset: string;

    constructor(asset: any, asks: any[], bids: any[]) {
        this.asks = []
        this.bids = []
        this.asset = asset
    }

    addOrder(order: order) {

        if (order.side === "buy") {
            const { fills, BidOrder } = this.matchMyBid(order)
            if (Number(BidOrder.quantity) !== BidOrder.filled) {
                this.bids.push(BidOrder)
                this.bids.sort((a, b) => Number(a.price) - Number(b.price))
            }
            return { fills, finalOrder: BidOrder }
        } else {
        }

    }

    matchMyBid(BidOrder: order) {
        const fills: fill[] = []

        let remainingQuantity = Number(BidOrder.quantity) - BidOrder.filled

        for (let i = 0; i < this.asks.length; i++) {
            const askOrder = this.asks[i]

            if (remainingQuantity === 0) break;


            if (askOrder.price <= BidOrder.price) {

                let matched = Math.min((Number(askOrder.quantity) - askOrder.filled), remainingQuantity);

                if (matched) {

                    remainingQuantity = (Number(remainingQuantity) - matched)

                    fills.push({
                        market: BidOrder.market,
                        price: askOrder.price,
                        matchedQuantity: matched.toString(),

                        takerUserId: BidOrder.userId,
                        takerOrderId: BidOrder.orderId,
                        takerLevrage: BidOrder.leverage,

                        makerOrderId: askOrder.orderId,
                        makerUserId: askOrder.userId,
                        makerLevrage: askOrder.leverage,

                        isMakerBuyer: askOrder.side === "buy" ? true : false
                    })

                    this.asks[i].filled = this.asks[i].filled + matched
                    BidOrder.filled = BidOrder.filled + matched

                }

                if (Number(this.asks[i].quantity) == this.asks[i].filled) {
                    this.asks.splice(i, 1)
                    i--;
                }

            }
        }

        return { fills, BidOrder }

    }


    getMarket() {
        return this.asset
    }
}