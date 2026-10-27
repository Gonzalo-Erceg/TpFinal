const express = require("express")
require("dotenv").config()

const app = express()


const PORT = process.env.PORT
const HOST = process.env.HOST


app.use(express.json())


app.get("/heal-check",(req,res)=>{
    res.send("Ok")
})


app.listen(PORT,HOST,()=>{
    console.log(`Servidor levantado en http://${HOST}:${PORT}`)
})






