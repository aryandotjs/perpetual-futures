import { createClient } from "redis"
import { Engine } from "./enginerelated/engine"
import { getEngine } from "./enginerelated/engineInstance"
import { resolve } from "node:dns"


const redisClientEngineSide = createClient({ url: "redis://localhost:6379" })
// let length = 0
// let sec = 0
// setInterval(() => {
//     console.log("============================================================================================", length, sec)
//     sec++
// }, 1000);
async function popRedisQuque() {
    if (!redisClientEngineSide.isOpen) {
        await redisClientEngineSide.connect()
    }
    const MainEngine = getEngine()



    let lastPriceId = "$"

    while (1) {

        let totalprocess = 0
        while (totalprocess < 100) {
            const message: any = await redisClientEngineSide.rPop("To_Engine")

            if (!message) break;

            const parsedMessage = JSON.parse(message.element)
            MainEngine.process(parsedMessage)
            totalprocess++
        }


        const stream = await redisClientEngineSide.xRead(
            [{ key: "stream:prices", id: lastPriceId }],
            {
                COUNT: 100,
                BLOCK: 50
            }
        )

        if (!stream) continue;

        stream.forEach((s) => {
            handleTickerPrice(s, MainEngine)
            if (s.messages.length > 0) {
                lastPriceId = s.messages[s.messages.length - 1].id;
            }
        })

    }
}

popRedisQuque()

function handleTickerPrice(stream: any, engine: Engine) {
    stream.messages.forEach((data: any) => {
        if (data.message) {
            engine.handleTickerPrice(data.message)
        }
    })
}

