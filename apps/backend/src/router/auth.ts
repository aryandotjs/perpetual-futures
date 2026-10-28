import { Router } from "express";
import { signUpSchema } from "../types";


export const authRouter = Router()


authRouter.post("/signUp", (req, res) => {
    res.json({
        msg: "done ! "
    })
})




// (req, res) => {

//     try {
//         const body = req.body

//         const parsed = signUpSchema.parse(body)

//         // const found = users.find((a: any) => a.email === parsed.email)

//         // if (!found && users.length != 0) {
//         //     return res.json({
//         //         msg: 'email already taken '
//         //     })
//         // }

//         res.json({
//             msg: "signUp done "
//         })

//     } catch (err: any) {
//         res.status(404).json({
//             msg: err.message ? err.message : "some error"
//         })
//     }
// }