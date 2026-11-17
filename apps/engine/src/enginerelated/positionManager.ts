// type position = {
//     userId: "user_123",
//     market: "BTC_USD",
//     size: 2.5,          // Positive for Long, Negative for Short, 0 for Flat
//     entryPrice: 61000,  // The weighted average entry price
//     leverage: 10,       // The multiplier chosen when opening
//     marginLocked: 1525
// }

import { fill } from "./orderbookclass";

type position = {
    userId: string,
    market: string,
    leverage: string,
    quantity: string,
    avgPrice: string,
    lockedMargin: string,
    liquidationPrice: string
}


export class positionManager {

    positionsByKey: Map<string, position>;

    positionsByMarket: Map<string, position>;

    constructor() {
        this.positionsByKey = new Map()
        this.positionsByMarket = new Map()
    }

    LiquidationCheckForTickerPrice(market: string, price: string) {
        console.log("lega ")
    }

    addPosition(userId: string, market: string, leverage: string, quantity: string, price: string) {
        const userPosition = this.positionsByKey.get(`${userId}_${market}`)

        if (!userPosition) {
            this.addNewPosition(userId, market, leverage, quantity, price)
            return;
        }
        const oldUserQty = userPosition.quantity

        if ((Number(oldUserQty) > 0 && Number(quantity) > 0) || (Number(oldUserQty) < 0 && Number(quantity) < 0)) {
            this.addToExistingPosition(quantity, price, userPosition)
            return
        } else {
            return this.reduceToExistingPosition(quantity, price, userPosition)
        }

    }

    addNewPosition(userId: string, market: string, leverage: string, quantity: string, price: string) {

        this.positionsByKey.set(`${userId}_${market}`, {
            userId,
            market,
            quantity: quantity,
            avgPrice: price,
            leverage: leverage,
            lockedMargin: (Number(quantity) * Number(price) / Number(leverage)).toString(),
            liquidationPrice: ""
        })

    }

    addToExistingPosition(quantity: string, price: string, userPosition: position) {
        const oldQty = userPosition.quantity

        userPosition.quantity = (Number(userPosition.quantity) + Number(quantity)).toString()
        userPosition.avgPrice = (((Number(userPosition.avgPrice) * Number(oldQty)) + (Number(price) * Number(quantity))) / Number(userPosition.quantity)).toString()

        const totalqty = Math.abs(Number(userPosition.quantity))
        const avgPrice = Number(userPosition.avgPrice)
        const leverage = Number(userPosition.leverage)

        userPosition.lockedMargin = (totalqty * avgPrice / leverage).toString()
    }

    reduceToExistingPosition(quantity: string, price: string, userPosition: position) {

        const userQty = Number(userPosition.quantity)
        const qty = Number(quantity)

        if (Math.abs(userQty) > Math.abs(qty)) {

            userPosition.quantity = (userQty + qty).toString()

            const reducedMargin = (Math.abs(qty) * Number(userPosition.avgPrice)) / Number(userPosition.leverage)

            userPosition.lockedMargin = (Number(userPosition.lockedMargin) - reducedMargin).toString()

            const profitOrLoss = this.handleProfitAndLoss(userPosition.userId, userPosition.market, userPosition.avgPrice, quantity, price)

            return { reducedMargin, profitOrLoss }


        } else if (Math.abs(userQty) === Math.abs(qty)) {

            this.positionsByKey.delete(`${userPosition.userId}_${userPosition.market}`)

            const reducedMargin = (Math.abs(qty) * Number(userPosition.avgPrice)) / Number(userPosition.leverage)

            const profitOrLoss = this.handleProfitAndLoss(userPosition.userId, userPosition.market, userPosition.avgPrice, quantity, price)

            return { reducedMargin, profitOrLoss }

        } else {

            const newQty = (userQty + qty).toString()

            const reducedMargin = (Number(userPosition.quantity) * Number(userPosition.avgPrice)) / Number(userPosition.leverage)

            this.positionsByKey.delete(`${userPosition.userId}_${userPosition.market}`)

            this.addNewPosition(userPosition.userId, userPosition.market, userPosition.leverage, newQty, price)

            const profitOrLoss = this.handleProfitAndLoss(userPosition.userId, userPosition.market, userPosition.avgPrice, userPosition.quantity, price)

            return { reducedMargin, profitOrLoss }
        }
    }


    handleProfitAndLoss(userId: string, market: string, avgPrice: string, quantity: string, fillPrice: string) {

        if (Number(quantity) > 0) {
            let profit;
            let loss;
            const qty = Math.abs(Number(quantity))
            const diff = Number(fillPrice) - Number(avgPrice)

            if (diff > 0) {
                profit = Math.abs(diff * qty)
            } else {
                loss = Math.abs(diff * qty)
            }

            return profit ? profit.toString() : `-${loss}`


        } else {

            let profit;
            let loss;
            const qty = Math.abs(Number(quantity))
            const diff = Number(avgPrice) - Number(fillPrice)

            if (diff > 0) {
                profit = Math.abs(diff * qty)
            } else {
                loss = Math.abs(diff * qty)
            }

            return profit ? profit.toString() : `-${loss}`
        }

    }


    //////////////////////// diff breed 

    // liquidationChecker(markPrice: string) {

    //     const liquidatedUsers: any[] = []

    //     this.positions.forEach((position) => {
    //         const UnrealizedProfitOrLoss = this.calculateUnrealizedPandL(position, markPrice)

    //         const margin = (Number(position.avgPrice) * Math.abs(Number(position.quantity)) / Number(position.leverage))
    //         const maintenanceMargin = margin * 0.5

    //         if (Number(UnrealizedProfitOrLoss) < 0 && maintenanceMargin < Math.abs(Number(UnrealizedProfitOrLoss))) {
    //             // this.liquadateUser(position.userId, position.market)

    //             /////////////we have to add a opp order what ever order we close 
    //             liquidatedUsers.push({
    //                 userId: position.userId,
    //                 market: position.market,
    //                 margin
    //             })
    //         }

    //     })
    //     return liquidatedUsers;
    // }

    // calculateUnrealizedPandL(position: position, markPrice: string) {

    //     if (Number(position.quantity) > 0) {

    //         const ProfitOrLoss = ((Number(markPrice) - Number(position.avgPrice)) * Math.abs(Number(position.quantity))).toString()
    //         return ProfitOrLoss

    //     } else {

    //         const ProfitOrLoss = ((Number(position.avgPrice) - Number(markPrice)) * Math.abs(Number(position.quantity))).toString()
    //         return ProfitOrLoss

    //     }

    // }

    // liquadateUser(userId: string, market: string) {
    //     this.positions.delete(`${userId}_${market}`)
    // }



    stringToScaledBigInt(price: string) {
        const input = price.trim()

        const dotIndex = input.indexOf(".");

        const wholePart = dotIndex === -1 ? input : input.slice(0, dotIndex);
        const fracPart = dotIndex === -1 ? "" : input.slice(dotIndex + 1);

        const wholeScaled = BigInt(wholePart || "0") * PRICE_SCALE;

        const paddedFrac = fracPart.padEnd(5, "0").slice(0, 5);

        const fracScaled = BigInt(paddedFrac || "0");

        return wholeScaled + fracScaled;
    }

    liquidateUser(userId: string, market: string) {
        // this.positionsByMarket.set(market, filteredPositions)
        // this.positionsByKey.delete(`${p.userId}_${p.market}`)

    }
}