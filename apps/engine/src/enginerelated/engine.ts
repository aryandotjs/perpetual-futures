import { error } from "node:console";
import { ApiToEngine, order, ProcessesCompletion, ProcessesRejection } from "../../../../packages/common/src";
import { SendBackToBackend } from "../toBackend";
import { fill, Orderbook } from "./orderbookclass";
import { randomUUID } from "node:crypto";
import { position, positionManager } from "./positionManager";
type balance = {
    [key: string]: {
        available: string
        locked: string
    }
}
export class Engine {

    private balances: Map<string, balance> = new Map()
    private orderbooks: Record<string, Orderbook> = {};
    private positionsManager: positionManager;

    private InsuranceFund: Map<string, string> = new Map()


    constructor() {
        const solOrderbook = new Orderbook("SOL_USD", [], [])
        this.orderbooks["SOL"] = solOrderbook
        this.positionsManager = new positionManager
        this.InsuranceFund.set("SOL", "0")
    }

    getInsuranceFund(market: string) {
        return this.InsuranceFund.get(market) ?? 0
    }

    inspectAndLockBalance(userId: string, market: string, price: string, quantity: string, leverage: string) {
        const userBalance: balance | undefined = this.balances.get(userId)
        if (!userBalance || !userBalance["USD"]) throw Error("invalid userId ")

        const marginInNumber = (Number(price) * Number(quantity)) / Number(leverage)

        if (Number(userBalance["USD"].available) >= marginInNumber) {

            userBalance["USD"].available = (Number(userBalance["USD"].available) - marginInNumber).toString()
            userBalance["USD"].locked = (Number(userBalance["USD"].locked) + marginInNumber).toString()

        }
    }


    handleTickerPrice({ market, price }: { market: string, price: string }) {
        // first check if prcie is wrong or right ?? 
        // if (orderbook) { orderbook.setTickerPrice(price) }

        const orderbook: Orderbook = this.orderbooks[market]
        if (!orderbook) throw Error("no orderbook available")

        const liquidatedPositions = this.positionsManager.LiquidationCheckForTickerPrice(market, price)
        if (!liquidatedPositions) return

        // #### Step 1: Open Order Cancellation
        // Before placing any closing orders,
        //  the risk engine immediately **
        //  cancels all open orders ** for that account / symbol[3].This unfreezes
        //  any margin locked up by
        //  pending limit orders to see if margin compliance can be restored without closing positions[3].

        liquidatedPositions.forEach(p => {

            const { fills, finalOrder } = this.addIocLimitOrderForliquidation(p, orderbook)

            //remove all resing order for this postion ? in orderbook , decide where to do this !


            if (fills.length > 0) {

                if (Number(finalOrder.filled) == Number(finalOrder.quantity)) {
                    this.positionsManager.liquidateUser(p.userId, p.market)
                    this.handleFillForInsuranceFund(fills, market, p)
                } else {

                    ///// decreasse the postion

                    this.handleFillForInsuranceFund(fills, market, p)

                    const remainingQty = Number(finalOrder.quantity) - finalOrder.filled

                    ////lets say i have removed the qty in positions whihc are filled 

                    p.quantity = (Number(p.quantity) - finalOrder.filled).toString()

                    this.deleverage(p, price)

                }

            }
            if (fills.length === 0) {

                this.positionsManager.liquidateUser(p.userId, p.market)

                this.deleverage(p, price)

            }

        })

    }

    addIocLimitOrderForliquidation(position: position, orderbook: Orderbook) {
        const order: order = {
            timeInForce: "ioc",
            market: position.market,
            price: position.maxSlippagePrice.toString(),
            quantity: position.quantity,
            filled: 0,
            leverage: position.leverage,
            userId: position.userId,
            orderId: randomUUID(),
            side: Number(position.quantity) <= 0 ? "sell" : "buy",
            orderType: "limit",
            time: Date.now()
        }

        const result = orderbook.addOrder(order)

        return result
    }

    handleFillForInsuranceFund(fills: fill[], market: string, position: position) {

        const marketInsuranceFund = this.InsuranceFund.get(market)

        let extraCash = 0;

        if (!marketInsuranceFund) throw new Error("market insuranceFund didnt found")

        fills.forEach((fill) => {

            const makerMatchedQty = fill.isMakerBuyer ? fill.matchedQuantity : `-${fill.matchedQuantity}`

            this.positionsManager.addPosition(fill.makerUserId, fill.market, fill.makerLevrage, makerMatchedQty, fill.price, "normal")

            /// insurance fund logic
            const qty = fill.matchedQuantity
            const priceDiff = Number(position.quantity) < 0 ? (position.bankcrupcyPrice - Number(fill.price)) : (Number(fill.price) - position.bankcrupcyPrice)
            const Cash = priceDiff * Number(qty)
            extraCash += Cash
            /// inke account se pese nikal locked me daal 

        })

        this.InsuranceFund.set(market, (Number(marketInsuranceFund) + extraCash).toString())
    }

    deleverage(position: position, markprice: string) {

        const curruntPositions = this.positionsManager.positionsByMarket.get(position.market)
        if (!curruntPositions) throw Error("no currunt for this position while doing deleverage")

        const filtered = curruntPositions?.filter((a, b) => {
            this.positionsManager.calculateUnrealizedPandL(a, markprice)
        })

    }



























    process({ requestId, data }: { requestId: string, data: ApiToEngine }) {
        switch (data.type) {

            case "ADD_ORDER":
                try {
                    const { userId, market, price, quantity, leverage, side, orderType } = data.payload

                    ///sady check this line if market is some thing else ??
                    const orderbook = this.orderbooks[market]

                    if (!orderbook) throw Error("invalid market")

                    this.inspectAndLockBalance(userId, market, price, quantity, leverage)

                    const order: order = {
                        timeInForce: "normal",
                        market,
                        price,
                        quantity,
                        filled: 0,
                        leverage,
                        userId,
                        orderId: randomUUID(),
                        side,
                        orderType,
                        time: Date.now()
                    }
                    // @ts-ignore
                    const { fills } = orderbook.addOrder(order)

                    this.handleFills(fills, market)

                } catch (err: any) {
                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesRejection.ADDING_ORDER_FAILED,
                            payload: {
                                userId: data.payload.userId,
                                // orderId: data.payload.orderId,
                                error: err.message || "failed to add Order"
                            }
                        }
                    })
                }

                break;


            case "GET_BALANCE":
                try {
                    const userBalances: balance | undefined = this.balances.get(data.payload.userId)
                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesCompletion.GOT_BALANCE,
                            payload: {
                                userId: data.payload.userId,
                                balance: userBalances,
                                message: "balance fetched"
                            }

                        }
                    })

                } catch (error: any) {
                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesRejection.GET_BALANCE_REJECTED,
                            payload: {
                                userId: data.payload.userId,
                                error: error.message || "failed to get balance"
                            }
                        }
                    })
                }

                break;

            case "ON_RAMP":

                try {
                    this.onramp(data.payload.userId)
                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesCompletion.ON_RAMPED,
                            payload: {
                                userId: data.payload.userId,
                                message: "user on ramped"
                            }

                        }
                    })
                } catch (err: any) {
                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesRejection.ON_RAMPING_FAILED,
                            payload: {
                                userId: data.payload.userId,
                                error: err.message || "error on ramping"
                            }
                        }
                    })
                }

                break;

            case "ADD_BALANCE":

                try {
                    const userBalance = this.addBalance(data.payload.userId, "3000")

                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesCompletion.BALANCE_ADDED,
                            payload: {
                                userId: data.payload.userId,
                                message: `amount ${data.payload.amount} added to balances `
                            }
                        }
                    })
                } catch (err: any) {
                    SendBackToBackend({
                        requestId,
                        sendbackdata: {
                            type: ProcessesRejection.ADDING_BALANCE_FAILED,
                            payload: {
                                userId: data.payload.userId,
                                error: err.message || "adding balance failed"
                            }
                        }
                    })
                }

                break;
        }
    }

    onramp(userId: string) {
        const userExist = this.balances.get(userId)
        if (userExist) throw Error("User Already Exist")

        this.balances.set(userId, {
            "USD": {
                available: "30000",
                locked: "0"
            }
        })

    }

    getBalance(userId: string) {
        if (!userId) throw Error("invalid userId")
        const userBalance = this.balances.get(userId)
        return userBalance
    }

    addBalance(userId: string, amount: string) {
        if (!userId) throw Error("invalid userId")
        const amountInNumber = Number(amount)
        if (!amountInNumber) throw Error("invalid amount")

        const currBalance = this.balances.get(userId)

        if (currBalance && currBalance["USD"]) {
            currBalance["USD"].available = (Number(currBalance["USD"].available) + Number(amount)).toString()
            this.balances.set(userId, currBalance)
        }
    }

    handleFills(fills: fill[], market: string) {

        fills.forEach((fill: fill) => {

            const makerMatchedQty = fill.isMakerBuyer ? fill.matchedQuantity : `-${fill.matchedQuantity}`
            const takerMatchedQty = fill.isMakerBuyer ? `-${fill.matchedQuantity}` : fill.matchedQuantity

            const resultMaker = this.positionsManager.addPosition(fill.makerUserId, market, fill.makerLevrage, makerMatchedQty, fill.price, "normal")

            if (resultMaker) {
                const userBalance = this.balances.get(fill.makerUserId)
                if (!userBalance) throw Error("error updating profit and loss")

                userBalance[market].available = (Number(userBalance[market].available) + Number(resultMaker.profitOrLoss)).toString()


                /// was confused becouse of the loss thign here complete here after sleep 

                // userBalance[market].locked = (Number(userBalance[market].locked) - resultMaker.reducedMargin).toString()
                // userBalance[market].available = (Number(userBalance[market].available) + resultMaker.reducedMargin).toString()
            }

            const resultTaker = this.positionsManager.addPosition(fill.takerUserId, market, fill.takerLevrage, takerMatchedQty, fill.price, "normal")

            if (resultTaker) {
                const userBalance = this.balances.get(fill.takerUserId)
                if (!userBalance) throw Error("error updating profit and loss")
                userBalance[market].available = (Number(userBalance[market].available) + Number(resultTaker.profitOrLoss)).toString()
            }
        });

    }

}