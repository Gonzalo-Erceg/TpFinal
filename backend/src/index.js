
require('dotenv').config({
    path: require('path').resolve(__dirname, '../../.env')
});


const express = require("express")
const authRouter = require("./routers/auth.router")
const groupsRouter = require("./routers/groups.router")
const questionsRouter = require("./routers/questions.router");
const examsRouter = require("./routers/exams.router")
const studentExamsRouter = require("./routers/student-exams.router")
const attemptsRouter = require("./routers/attempts.router")
const helmet = require("helmet")


const PORT = process.env.PORT
const HOST = process.env.HOST
const app = express()





app.use(express.json())
app.use(helmet())

app.get("/heal-check",(req,res)=>{
    res.send("Ok")
})

app.use("/auth",authRouter)
app.use("/groups", groupsRouter)
app.use("/questions", questionsRouter)
app.use("/exams", studentExamsRouter)
app.use("/exams", examsRouter)
app.use("/attempts", attemptsRouter)

app.listen(PORT,HOST,()=>{
    console.log(`Servidor levantado en http://${HOST}:${PORT}`)
})






