
export type RequestType = "GET_BALANCE" | "PLACE_ORDER"

export type messageToEngine = {
    RequestType: RequestType,
    requestID: string,
    data: {
        id: string
    }
}