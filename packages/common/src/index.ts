export type order = {
    market: string
    price: string
    quantity: string
    filled: number
    leverage: string
    userId: string
    orderId: string
    side: "buy" | "sell",
    orderType: "market" | "limit"
    time: number
}

export enum Processes {
    GET_BALANCE = "GET_BALANCE",
    ON_RAMP = "ON_RAMP",
    ADD_ORDER = "ADD_ORDER",
    ADD_BALANCE = "ADD_BALANCE"
}

export enum ProcessesCompletion {
    GOT_BALANCE = "GOT_BALANCE",
    ON_RAMPED = "ON_RAMPED",
    ORDER_ADDED = "ORDER_ADDED",
    BALANCE_ADDED = "BALANCE_ADDED"
}
export enum ProcessesRejection {
    GET_BALANCE_REJECTED = "GET_BALANCE_REJECTED",
    ON_RAMPING_FAILED = "ON_RAMPING_FAILED",
    ADDING_ORDER_FAILED = "ADDING_ORDER_FAILED",
    ADDING_BALANCE_FAILED = "ADDING_BALANCE_FAILED"
}


export type ApiToEngine = {
    type: Processes.GET_BALANCE,
    payload: {
        userId: string
    }
} | {
    type: Processes.ON_RAMP,
    payload: {
        userId: string
    }
} | {
    type: Processes.ADD_BALANCE,
    payload: {
        userId: string,
        amount: string
    }
} | {
    type: Processes.ADD_ORDER,
    payload: {
        market: string
        price: string
        quantity: string
        leverage: string
        userId: string,
        side: "sell" | "buy"
        orderType: "market" | "limit"
    }
}

export type EngineToApi = {
    type: ProcessesCompletion.GOT_BALANCE,
    payload: {
        balance: any
        userId: string,
        message: string
    }
} | {
    type: ProcessesRejection.GET_BALANCE_REJECTED,
    payload: {
        userId: string,
        error: any
    }
} | {
    type: ProcessesCompletion.ON_RAMPED,
    payload: {
        userId: string,
        message: string
    }
} | {
    type: ProcessesRejection.ON_RAMPING_FAILED,
    payload: {
        userId: string
        error: any
    }
} | {
    type: ProcessesCompletion.BALANCE_ADDED,
    payload: {
        userId: string,
        message: string
    }
} | {
    type: ProcessesRejection.ADDING_BALANCE_FAILED,
    payload: {
        userId: string,
        error: any
    }
} | {
    type: ProcessesRejection.ADDING_ORDER_FAILED,
    payload: {
        userId: string,
        error: any
    }
}
