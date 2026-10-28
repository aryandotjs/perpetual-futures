import express from "express"
import cors from "cors"
import { appRouter } from "./router"

const port = 3000
const app = express()

app.use(express.json())
app.use(cors({
    origin: [
        "http://localhost:3000"
    ]
}))

app.use(appRouter)

app.listen(port, () => {
    console.log(`hiii running on port ${port}`)
})