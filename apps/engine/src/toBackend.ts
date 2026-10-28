import { createClient } from "redis"
import { EngineToApi } from "../../../packages/common/src"

const redisClient = createClient({ url: "redis://localhost:6379" })

export async function SendBackToBackend({ requestId, sendbackdata }: { requestId: string, sendbackdata: EngineToApi }) {

    if (!redisClient.isOpen) {
        await redisClient.connect()
    }
    redisClient.rPush("TO_BACKEND", JSON.stringify({
        requestId,
        sendbackdata
    }))
}

