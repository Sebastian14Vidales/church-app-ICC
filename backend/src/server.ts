import express from "express";
import connectDB from "./config/db";

const app = express();
app.use(express.json());
connectDB();

export default app;
