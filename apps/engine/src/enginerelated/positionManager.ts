
import { fill } from "./orderbookclass";

export type position = {
    userId: string,
    market: string,
    leverage: string,
    quantity: string,
    avgPrice: string,
    lockedMargin: string,
    liquidationPrice: number,
    bankcrupcyPrice: number,
    maxSlippagePrice: number,
    status: "isLiquidating" | "normal"
}

const PRICE_SCALE = 10n ** 5n

export class positionManager {

    positionsByKey: Map<string, position>;

    positionsByMarket: Map<string, position[]>;

    constructor() {
        this.positionsByKey = new Map()
        this.positionsByMarket = new Map()
    }

    getLiquidationPrice(isLong: boolean, entryPrice: number, collateral: number, size: number, mmr: number) {
        const unitCollateral = collateral / size;
        if (isLong) {
            return (entryPrice - unitCollateral) / (1 - mmr);
        } else {
            return (entryPrice + unitCollateral) / (1 + mmr);
        }
    }

    getBankrupcyPrice(isLong: boolean, entryPrice: number, margin: number, size: number) {
        const unitMargin = margin / size;
        return isLong ? entryPrice - unitMargin : entryPrice + unitMargin
    }

    getMaxSlippagePrice(isLong: boolean, entryPrice: number, margin: number, size: number, slippagePct = 0.03) {
        const unitMargin = margin / Math.abs(size);
        const unitSlippage = entryPrice * slippagePct;

        return isLong
            ? Math.max(0, entryPrice - unitMargin - unitSlippage)
            : entryPrice + unitMargin + unitSlippage;
    }

    LiquidationCheckForTickerPrice(market: string, price: string) {

        const scaledPrice = this.stringToScaledBigInt(price)

        const AllPositionsByMarket = this.positionsByMarket.get(market)

        if (!AllPositionsByMarket) return

        const FlagedPositions: position[] = []

        AllPositionsByMarket.forEach(p => {
            if (p.liquidationPrice >= Number(price) && p.status === "normal") {
                FlagedPositions.push(p)
                p.status = "isLiquidating"
            }
        });

        return FlagedPositions
    }


    addPosition(userId: string, market: string, leverage: string, quantity: string, price: string, status: "isLiquidating" | "normal") {
        const userPosition = this.positionsByKey.get(`${userId}_${market}`)

        if (!userPosition) {
            this.addNewPosition(userId, market, leverage, quantity, price, status)
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

    addNewPosition(userId: string, market: string, leverage: string, quantity: string, price: string, status: "isLiquidating" | "normal") {
        const lockedMargin = (Number(quantity) * Number(price) / Number(leverage)).toString()

        const position: position = {
            userId,
            market,
            quantity: quantity,
            avgPrice: price,
            leverage: leverage,
            lockedMargin,
            liquidationPrice: this.getLiquidationPrice(Number(quantity) > 0 ? true : false, Number(price), Number(lockedMargin), Number(quantity), 0.05),
            bankcrupcyPrice: this.getBankrupcyPrice(Number(quantity) > 0 ? true : false, Number(price), Number(lockedMargin), Number(quantity)),
            maxSlippagePrice: this.getMaxSlippagePrice(Number(quantity) > 0 ? true : false, Number(price), Number(lockedMargin), Number(quantity)),
            status: status
        }

        this.positionsByKey.set(`${userId}_${market}`, position)

        const prevPositions = this.positionsByMarket.get(market)
        this.positionsByMarket.set(market, prevPositions ? [...prevPositions, position] : [position])


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

            const profitOrLoss = this.handleProfitAndLoss(userPosition.avgPrice, quantity, price)

            return { reducedMargin, profitOrLoss }


        } else if (Math.abs(userQty) === Math.abs(qty)) {

            this.positionsByKey.delete(`${userPosition.userId}_${userPosition.market}`)

            const reducedMargin = (Math.abs(qty) * Number(userPosition.avgPrice)) / Number(userPosition.leverage)

            const profitOrLoss = this.handleProfitAndLoss(userPosition.avgPrice, quantity, price)

            return { reducedMargin, profitOrLoss }

        } else {

            const newQty = (userQty + qty).toString()

            const reducedMargin = (Number(userPosition.quantity) * Number(userPosition.avgPrice)) / Number(userPosition.leverage)

            this.positionsByKey.delete(`${userPosition.userId}_${userPosition.market}`)

            this.addNewPosition(userPosition.userId, userPosition.market, userPosition.leverage, newQty, price, "normal")

            const profitOrLoss = this.handleProfitAndLoss(userPosition.avgPrice, userPosition.quantity, price)

            return { reducedMargin, profitOrLoss }
        }
    }


    handleProfitAndLoss(avgPrice: string, quantity: string, fillPrice: string) {

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


    calculateUnrealizedPandL(position: position, markPrice: string) {

        if (Number(position.quantity) > 0) {

            const ProfitOrLoss = ((Number(markPrice) - Number(position.avgPrice)) * Math.abs(Number(position.quantity))).toString()
            return ProfitOrLoss

        } else {

            const ProfitOrLoss = ((Number(position.avgPrice) - Number(markPrice)) * Math.abs(Number(position.quantity))).toString()
            return ProfitOrLoss

        }

    }

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