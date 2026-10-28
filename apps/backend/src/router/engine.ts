import { Router } from "express";
import { sendAndAwait } from "../toengine/toEngine";
import { EngineToApi, Processes } from "../../../../packages/common/src";
import { nanoid } from "nanoid";

export const engineRouter = Router()

engineRouter.get("/getBalance", async (req, res) => {
    const body = req.body
    if (!body.userId) {
        return res.status(401).json({
            msg: "no input"
        })
    }

    const finalData = await sendAndAwait({
        type: Processes.GET_BALANCE,
        payload: {
            userId: "123"
        }
    })

    res.json({
        finalData
    })
})

engineRouter.post("/onRamp", async (req, res) => {
    const body = req.body
    if (!body.userId) {
        return res.status(401).json({
            msg: "no input"
        })
    }

    const finalData = await sendAndAwait({
        type: Processes.ON_RAMP,
        payload: {
            userId: "123"
        }
    })

    res.json({
        finalData
    })
})

engineRouter.post("/addUserBalance", async (req, res) => {
    // const body = req.body
    // if (!body.userId || !body.amount) {
    //     return res.status(401).json({
    //         msg: "no input"
    //     })
    // }

    const finalData = await sendAndAwait({
        type: Processes.ADD_BALANCE,
        payload: {
            userId: "123",
            amount: "1000"
        }
    })

    res.json({
        finalData
    })
})

engineRouter.post("/addOrder", async (req, res) => {
    // const body = req.body
    // if (!body.userId || !body.amount) {
    //     return res.status(401).json({
    //         msg: "no input"
    //     })
    // }
    const finalData = await sendAndAwait({
        type: Processes.ADD_ORDER,
        payload: {
            userId: "123",
            market: "SOL_USD",
            price: "100",
            quantity: "1",
            leverage: "5",
            side: "buy",
            orderType: "limit",
            time: Date.now()
        }
    })

    res.json({
        finalData
    })
})