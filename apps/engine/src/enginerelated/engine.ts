import { error } from "node:console";
import { ApiToEngine, order, ProcessesCompletion, ProcessesRejection } from "../../../../packages/common/src";
import { SendBackToBackend } from "../toBackend";
import { fill, Orderbook } from "./orderbookclass";
import { randomUUID } from "node:crypto";
import { positionManager } from "./positionManager";
type balance = {
    [key: string]: {
        available: string
        locked: string
    }
}
export class Engine {

    private balances: Map<string, balance> = new Map()
    private orderbooks: Orderbook[] = [];
    private positionsManager: positionManager;

    constructor() {
        const solOrderbook = new Orderbook("SOL_USD", [], [])
        this.orderbooks.push(solOrderbook)
        this.positionsManager = new positionManager()
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

    process({ requestId, data }: { requestId: string, data: ApiToEngine }) {
        switch (data.type) {

            case "ADD_ORDER":
                try {
                    const { userId, market, price, quantity, leverage, side, orderType } = data.payload

                    const orderbook = this.orderbooks.find(a => a.getMarket() === market)

                    if (!orderbook) throw Error("invalid market")

                    this.inspectAndLockBalance(userId, market, price, quantity, leverage)

                    const order = {
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

            const resultMaker = this.positionsManager.addPosition(fill.makerUserId, market, fill.makerLevrage, makerMatchedQty, fill.price)

            if (resultMaker) {
                const userBalance = this.balances.get(fill.makerUserId)
                if (!userBalance) throw Error("error updating profit and loss")

                userBalance[market].available = (Number(userBalance[market].available) + Number(resultMaker.profitOrLoss)).toString()


                /// was confused becouse of the loss thign here complete here after sleep 

                // userBalance[market].locked = (Number(userBalance[market].locked) - resultMaker.reducedMargin).toString()
                // userBalance[market].available = (Number(userBalance[market].available) + resultMaker.reducedMargin).toString()
            }

            const resultTaker = this.positionsManager.addPosition(fill.takerUserId, market, fill.takerLevrage, takerMatchedQty, fill.price)

            if (resultTaker) {
                const userBalance = this.balances.get(fill.takerUserId)
                if (!userBalance) throw Error("error updating profit and loss")
                userBalance[market].available = (Number(userBalance[market].available) + Number(resultTaker.profitOrLoss)).toString()
            }
        });

    }

}