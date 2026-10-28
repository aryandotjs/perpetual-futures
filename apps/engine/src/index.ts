import { createClient } from "redis"
import { Engine } from "./enginerelated/engine"


const redisClientEngineSide = createClient({ url: "redis://localhost:6379" })

async function popRedisQuque() {

    if (!redisClientEngineSide.isOpen) {
        await redisClientEngineSide.connect()
    }
    const MainEngine = new Engine()

    while (1) {
        const message = await redisClientEngineSide.brPop(["To_Engine"], 0)
        if (message) {
            const parsedMessage = JSON.parse(message.element)
            MainEngine.process(parsedMessage)
        }
    }
}

popRedisQuque()
