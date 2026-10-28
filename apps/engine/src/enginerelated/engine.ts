import { error } from "node:console";
import { ApiToEngine, order, ProcessesCompletion, ProcessesRejection } from "../../../../packages/common/src";
import { SendBackToBackend } from "../toBackend";
import { fill, Orderbook } from "./orderbookclass";
import { randomUUID } from "node:crypto";
type balance = {
    [key: string]: {
        available: string
        locked: string
    }
}
export class Engine {

    private balances: Map<string, balance> = new Map()
    private orderbooks: Orderbook[] = [];

    constructor() {
        const solOrderbook = new Orderbook("SOL_USD", [], [])
        this.orderbooks.push(solOrderbook)
    }
    inspectAndLockBalance(userId: string, market: string, price: string, quantity: string, leverage: string) {
        const userBalance: balance | undefined = this.balances.get(userId)
        if (!userBalance || !userBalance["USD"]) throw Error("invalid userId ha")

        const marginInNumber = (Number(price) * Number(quantity))

        if (Number(userBalance["USD"].available) >= marginInNumber) {

            userBalance["USD"].available = (Number(userBalance["USD"].available) - marginInNumber).toString()
            userBalance["USD"].locked = marginInNumber.toString()

            throw Error("locked and saved acc")

        }
    }
    process({ requestId, data }: { requestId: string, data: ApiToEngine }) {
        switch (data.type) {

            case "ADD_ORDER":
                try {
                    const { userId, market, price, quantity, leverage, side, orderType, time } = data.payload

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
                        time
                    }

                    const { fills, BidOrder } = orderbook.addOrder(order)

                    this.updateUserBalance(fills, BidOrder)


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


    updateUserBalance(fills: fill[], BidOrder: order) {
        fills.forEach(fill => {



        })
    }
}