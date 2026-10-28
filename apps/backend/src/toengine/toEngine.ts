import { nanoid } from "nanoid"
import { createClient, RedisClientType } from "redis"
import { ApiToEngine, EngineToApi } from "../../../../packages/common/src"

const redisClient = createClient({ url: "redis://localhost:6379" })
const redisClientFromEngine = createClient({ url: "redis://localhost:6379" })

const pendingResponsed = new Map<any, any>()

export async function sendAndAwait(data: ApiToEngine) {


    if (!redisClient.isOpen) {
        await redisClient.connect()
    }


    if (!redisClientFromEngine.isOpen) {
        await redisClientFromEngine.connect()
    }

    const requestId = nanoid()
    redisClient.lPush("To_Engine", JSON.stringify({
        requestId,
        data
    }))

    return new Promise((resolve) => {

        pendingResponsed.set(requestId, resolve)

        const timeout = setTimeout(() => {
            resolve({ msg: "some error , engine not responding" })
        }, 10000);

        pendingResponsed.set(requestId, resolve)
    })

}

getResponseFromEngine()

export async function getResponseFromEngine() {

    if (!redisClientFromEngine.isOpen) {
        console.log("redis listening from engine")
        await redisClientFromEngine.connect()
    }


    while (1) {
        const something = await redisClientFromEngine.brPop(["TO_BACKEND"], 0)
        if (something) {
            const { requestId, sendbackdata }: { requestId: string, sendbackdata: EngineToApi } = JSON.parse(something.element)
            const resolvefunction = pendingResponsed.get(requestId)
            console.log(sendbackdata, "in back loop , this is func", resolvefunction)
            resolvefunction(sendbackdata.payload)
        }
    }

}